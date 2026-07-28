"""Grade routes — full CRUD."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.db.models import GradeRow, AssignmentRow, StudentRow
from src.domain.grade_utils import to_percent, score_to_letter

router = APIRouter()


def _fmt(g: GradeRow, asgn: Optional[AssignmentRow] = None, student_name=None):
    pct = to_percent(float(g.score), float(asgn.max_score)) if asgn else None
    return {
        "id": g.id,
        "student_id": g.student_id,
        "assignment_id": g.assignment_id,
        "score": float(g.score),
        "feedback": g.feedback,
        "submitted_at": g.submitted_at.isoformat(),
        "percentage": round(pct * 10) / 10 if pct is not None else None,
        "letter_grade": score_to_letter(pct) if pct is not None else None,
        "student_name": student_name,
        "assignment_name": asgn.name if asgn else None,
        "course_id": asgn.course_id if asgn else None,
    }


class CreateGradeBody(BaseModel):
    student_id: int
    assignment_id: int
    score: float
    feedback: Optional[str] = None


class UpdateGradeBody(BaseModel):
    score: Optional[float] = None
    feedback: Optional[str] = None


@router.get("/grades")
def list_grades(
    student_id: Optional[int] = Query(None),
    course_id: Optional[int] = Query(None),
    assignment_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = (
        db.query(GradeRow, AssignmentRow, StudentRow.name)
        .outerjoin(AssignmentRow, GradeRow.assignment_id == AssignmentRow.id)
        .outerjoin(StudentRow, GradeRow.student_id == StudentRow.id)
    )
    if student_id is not None:
        q = q.filter(GradeRow.student_id == student_id)
    if assignment_id is not None:
        q = q.filter(GradeRow.assignment_id == assignment_id)
    if course_id is not None:
        q = q.filter(AssignmentRow.course_id == course_id)
    rows = q.order_by(GradeRow.submitted_at).all()
    return [_fmt(g, a, sname) for g, a, sname in rows]


@router.post("/grades", status_code=201)
def create_grade(body: CreateGradeBody, db: Session = Depends(get_db)):
    row = GradeRow(
        student_id=body.student_id,
        assignment_id=body.assignment_id,
        score=str(body.score),
        feedback=body.feedback,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    asgn = db.query(AssignmentRow).filter(AssignmentRow.id == body.assignment_id).first()
    return _fmt(row, asgn)


@router.put("/grades/upsert")
def upsert_grade(body: CreateGradeBody, db: Session = Depends(get_db)):
    """Create or update a grade for a student+assignment pair."""
    existing = db.query(GradeRow).filter(
        GradeRow.student_id == body.student_id,
        GradeRow.assignment_id == body.assignment_id,
    ).first()
    if existing:
        existing.score = str(body.score)
        if body.feedback is not None:
            existing.feedback = body.feedback
        db.commit()
        db.refresh(existing)
        asgn = db.query(AssignmentRow).filter(AssignmentRow.id == existing.assignment_id).first()
        return _fmt(existing, asgn)
    else:
        row = GradeRow(
            student_id=body.student_id,
            assignment_id=body.assignment_id,
            score=str(body.score),
            feedback=body.feedback,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        asgn = db.query(AssignmentRow).filter(AssignmentRow.id == body.assignment_id).first()
        return _fmt(row, asgn)


@router.put("/grades/{grade_id}")
def update_grade(grade_id: int, body: UpdateGradeBody, db: Session = Depends(get_db)):
    g = db.query(GradeRow).filter(GradeRow.id == grade_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grade not found")
    if body.score is not None:
        g.score = str(body.score)
    if body.feedback is not None:
        g.feedback = body.feedback
    db.commit()
    db.refresh(g)
    asgn = db.query(AssignmentRow).filter(AssignmentRow.id == g.assignment_id).first()
    return _fmt(g, asgn)


@router.delete("/grades/{grade_id}", status_code=204)
def delete_grade(grade_id: int, db: Session = Depends(get_db)):
    g = db.query(GradeRow).filter(GradeRow.id == grade_id).first()
    if g:
        db.delete(g)
        db.commit()
