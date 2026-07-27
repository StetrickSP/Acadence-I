"""Assignment routes — full CRUD."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.db.models import AssignmentRow

router = APIRouter()


def _fmt(a: AssignmentRow):
    return {
        "id": a.id,
        "course_id": a.course_id,
        "name": a.name,
        "type": a.type,
        "max_score": float(a.max_score),
        "weight": float(a.weight),
        "due_date": a.due_date,
        "description": a.description,
        "created_at": a.created_at.isoformat(),
    }


class CreateAssignmentBody(BaseModel):
    course_id: int
    name: str
    type: str
    max_score: float
    weight: float
    due_date: Optional[str] = None
    description: Optional[str] = None


class UpdateAssignmentBody(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    max_score: Optional[float] = None
    weight: Optional[float] = None
    due_date: Optional[str] = None
    description: Optional[str] = None


@router.get("/assignments")
def list_assignments(
    course_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(AssignmentRow)
    if course_id is not None:
        q = q.filter(AssignmentRow.course_id == course_id)
    if type:
        q = q.filter(AssignmentRow.type == type)
    return [_fmt(a) for a in q.order_by(AssignmentRow.course_id, AssignmentRow.created_at).all()]


@router.post("/assignments", status_code=201)
def create_assignment(body: CreateAssignmentBody, db: Session = Depends(get_db)):
    row = AssignmentRow(
        course_id=body.course_id, name=body.name, type=body.type,
        max_score=str(body.max_score), weight=str(body.weight),
        due_date=body.due_date, description=body.description,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _fmt(row)


@router.get("/assignments/{assignment_id}")
def get_assignment(assignment_id: int, db: Session = Depends(get_db)):
    a = db.query(AssignmentRow).filter(AssignmentRow.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return _fmt(a)


@router.put("/assignments/{assignment_id}")
def update_assignment(assignment_id: int, body: UpdateAssignmentBody, db: Session = Depends(get_db)):
    a = db.query(AssignmentRow).filter(AssignmentRow.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if body.name is not None:
        a.name = body.name
    if body.type is not None:
        a.type = body.type
    if body.max_score is not None:
        a.max_score = str(body.max_score)
    if body.weight is not None:
        a.weight = str(body.weight)
    if body.due_date is not None:
        a.due_date = body.due_date
    if body.description is not None:
        a.description = body.description
    db.commit()
    db.refresh(a)
    return _fmt(a)


@router.delete("/assignments/{assignment_id}", status_code=204)
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    a = db.query(AssignmentRow).filter(AssignmentRow.id == assignment_id).first()
    if a:
        db.delete(a)
        db.commit()
