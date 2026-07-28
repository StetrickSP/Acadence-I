"""Session and attendance routes with per-instructor ownership checks."""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from src.db.session import get_db
from src.db.models import SessionRow, AttendanceRecordRow, StudentRow, CourseRow, EnrollmentRow
from src.auth.clerk import require_auth
from src.auth.ownership import get_owned_course

router = APIRouter()


def _fmt_session(s: SessionRow, attendance: list = None):
    return {
        "id": s.id,
        "course_id": s.course_id,
        "name": s.name,
        "date": s.date,
        "time_slot": s.time_slot or "",
        "created_at": s.created_at.isoformat(),
        "attendance": attendance if attendance is not None else [],
    }


def _fmt_record(r: AttendanceRecordRow, student_id_str: Optional[str] = None):
    return {
        "id": r.id,
        "session_id": r.session_id,
        "student_db_id": r.student_id,
        "student_id_str": student_id_str,
        "status": r.status,
    }


def _get_session_or_404(db: DBSession, session_id: int) -> SessionRow:
    s = db.query(SessionRow).filter(SessionRow.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s


def _attendance_list(db: DBSession, session_id: int):
    records = db.query(AttendanceRecordRow).filter(AttendanceRecordRow.session_id == session_id).all()
    result = []
    for r in records:
        student = db.query(StudentRow).filter(StudentRow.id == r.student_id).first()
        result.append(_fmt_record(r, student.student_id if student else None))
    return result


class CreateSessionBody(BaseModel):
    course_id: int
    name: str
    date: str
    time_slot: Optional[str] = ""


class UpdateSessionBody(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    time_slot: Optional[str] = None


class UpsertAttendanceBody(BaseModel):
    student_db_id: int
    status: str  # present | absent | late | excused


class BulkAttendanceBody(BaseModel):
    records: List[UpsertAttendanceBody]


@router.get("/sessions")
def list_sessions(
    request: Request,
    course_id: Optional[int] = Query(None),
    db: DBSession = Depends(get_db),
):
    clerk_user_id = require_auth(request)
    q = (
        db.query(SessionRow)
        .join(CourseRow, SessionRow.course_id == CourseRow.id)
        .filter(CourseRow.owner_clerk_id == clerk_user_id)
    )
    if course_id is not None:
        q = q.filter(SessionRow.course_id == course_id)
    sessions = q.order_by(SessionRow.date, SessionRow.created_at).all()
    return [_fmt_session(s, _attendance_list(db, s.id)) for s in sessions]


@router.post("/sessions", status_code=201)
def create_session(request: Request, body: CreateSessionBody, db: DBSession = Depends(get_db)):
    clerk_user_id = require_auth(request)
    get_owned_course(db, body.course_id, clerk_user_id)
    row = SessionRow(
        course_id=body.course_id,
        name=body.name,
        date=body.date,
        time_slot=body.time_slot or "",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _fmt_session(row, [])


@router.get("/sessions/{session_id}")
def get_session(request: Request, session_id: int, db: DBSession = Depends(get_db)):
    clerk_user_id = require_auth(request)
    s = _get_session_or_404(db, session_id)
    get_owned_course(db, s.course_id, clerk_user_id)
    return _fmt_session(s, _attendance_list(db, s.id))


@router.put("/sessions/{session_id}")
def update_session(request: Request, session_id: int, body: UpdateSessionBody, db: DBSession = Depends(get_db)):
    clerk_user_id = require_auth(request)
    s = _get_session_or_404(db, session_id)
    get_owned_course(db, s.course_id, clerk_user_id)
    if body.name is not None:
        s.name = body.name
    if body.date is not None:
        s.date = body.date
    if body.time_slot is not None:
        s.time_slot = body.time_slot
    db.commit()
    db.refresh(s)
    return _fmt_session(s)


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(request: Request, session_id: int, db: DBSession = Depends(get_db)):
    clerk_user_id = require_auth(request)
    s = _get_session_or_404(db, session_id)
    get_owned_course(db, s.course_id, clerk_user_id)
    db.delete(s)
    db.commit()


@router.get("/sessions/{session_id}/attendance")
def get_attendance(request: Request, session_id: int, db: DBSession = Depends(get_db)):
    clerk_user_id = require_auth(request)
    s = _get_session_or_404(db, session_id)
    get_owned_course(db, s.course_id, clerk_user_id)
    return _attendance_list(db, session_id)


@router.post("/sessions/{session_id}/attendance")
def upsert_attendance(request: Request, session_id: int, body: UpsertAttendanceBody, db: DBSession = Depends(get_db)):
    """Create or update a single attendance record."""
    clerk_user_id = require_auth(request)
    s = _get_session_or_404(db, session_id)
    get_owned_course(db, s.course_id, clerk_user_id)
    existing = (
        db.query(AttendanceRecordRow)
        .filter(
            AttendanceRecordRow.session_id == session_id,
            AttendanceRecordRow.student_id == body.student_db_id,
        )
        .first()
    )
    if existing:
        existing.status = body.status
        db.commit()
        db.refresh(existing)
        student = db.query(StudentRow).filter(StudentRow.id == existing.student_id).first()
        return _fmt_record(existing, student.student_id if student else None)
    row = AttendanceRecordRow(
        session_id=session_id,
        student_id=body.student_db_id,
        status=body.status,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    student = db.query(StudentRow).filter(StudentRow.id == row.student_id).first()
    return _fmt_record(row, student.student_id if student else None)


@router.put("/attendance/{record_id}")
def update_attendance_record(request: Request, record_id: int, status: str, db: DBSession = Depends(get_db)):
    clerk_user_id = require_auth(request)
    r = db.query(AttendanceRecordRow).filter(AttendanceRecordRow.id == record_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    s = _get_session_or_404(db, r.session_id)
    get_owned_course(db, s.course_id, clerk_user_id)
    r.status = status
    db.commit()
    db.refresh(r)
    student = db.query(StudentRow).filter(StudentRow.id == r.student_id).first()
    return _fmt_record(r, student.student_id if student else None)
