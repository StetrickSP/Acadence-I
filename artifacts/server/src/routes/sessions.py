"""Session and attendance routes."""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.db.models import SessionRow, AttendanceRecordRow, StudentRow

router = APIRouter()


def _fmt_session(s: SessionRow):
    records = {}
    for r in (s.records or []):
        student = r.student
        if student:
            records[student.student_id] = r.status
    return {
        "id": s.id,
        "course_id": s.course_id,
        "name": s.name,
        "date": s.date,
        "time": s.time_slot,
        "records": records,
    }


class CreateSessionBody(BaseModel):
    course_id: int
    name: str
    date: str
    time: str


class UpdateSessionBody(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None


class SetAttendanceBody(BaseModel):
    session_id: int
    student_db_id: int
    status: str  # present | absent | late | excused


@router.get("/sessions")
def list_sessions(
    course_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(SessionRow)
    if course_id is not None:
        q = q.filter(SessionRow.course_id == course_id)
    return [_fmt_session(s) for s in q.order_by(SessionRow.date, SessionRow.created_at).all()]


@router.post("/sessions", status_code=201)
def create_session(body: CreateSessionBody, db: Session = Depends(get_db)):
    row = SessionRow(
        course_id=body.course_id,
        name=body.name,
        date=body.date,
        time_slot=body.time,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _fmt_session(row)


@router.put("/sessions/{session_id}")
def update_session(session_id: int, body: UpdateSessionBody, db: Session = Depends(get_db)):
    s = db.query(SessionRow).filter(SessionRow.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    if body.name is not None:
        s.name = body.name
    if body.date is not None:
        s.date = body.date
    if body.time is not None:
        s.time_slot = body.time
    db.commit()
    db.refresh(s)
    return _fmt_session(s)


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(SessionRow).filter(SessionRow.id == session_id).first()
    if s:
        db.delete(s)
        db.commit()


@router.post("/attendance", status_code=200)
def set_attendance(body: SetAttendanceBody, db: Session = Depends(get_db)):
    """Upsert a single attendance record."""
    rec = db.query(AttendanceRecordRow).filter(
        AttendanceRecordRow.session_id == body.session_id,
        AttendanceRecordRow.student_id == body.student_db_id,
    ).first()
    if rec:
        rec.status = body.status
    else:
        rec = AttendanceRecordRow(
            session_id=body.session_id,
            student_id=body.student_db_id,
            status=body.status,
        )
        db.add(rec)
    db.commit()
    db.refresh(rec)
    return {"session_id": rec.session_id, "student_id": body.student_db_id, "status": rec.status}
