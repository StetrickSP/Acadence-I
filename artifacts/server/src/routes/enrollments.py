"""Enrollment routes — list, create, delete with per-instructor ownership checks."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.db.models import EnrollmentRow, StudentRow, CourseRow
from src.auth.clerk import require_auth
from src.auth.ownership import get_owned_course

router = APIRouter()


def _fmt(e: EnrollmentRow, student_name=None, course_name=None):
    return {
        "id": e.id,
        "student_id": e.student_id,
        "course_id": e.course_id,
        "semester": e.semester,
        "enrolled_at": e.enrolled_at.isoformat(),
        "student_name": student_name,
        "course_name": course_name,
    }


class CreateEnrollmentBody(BaseModel):
    student_id: int
    course_id: int
    semester: str


@router.get("/enrollments")
def list_enrollments(
    request: Request,
    student_id: Optional[int] = Query(None),
    course_id: Optional[int] = Query(None),
    semester: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    clerk_user_id = require_auth(request)
    q = (
        db.query(EnrollmentRow, StudentRow.name, CourseRow.name)
        .outerjoin(StudentRow, EnrollmentRow.student_id == StudentRow.id)
        .outerjoin(CourseRow, EnrollmentRow.course_id == CourseRow.id)
        .filter(CourseRow.owner_clerk_id == clerk_user_id)
    )
    if student_id is not None:
        q = q.filter(EnrollmentRow.student_id == student_id)
    if course_id is not None:
        q = q.filter(EnrollmentRow.course_id == course_id)
    if semester:
        q = q.filter(EnrollmentRow.semester == semester)
    rows = q.order_by(EnrollmentRow.enrolled_at).all()
    return [_fmt(e, sname, cname) for e, sname, cname in rows]


@router.post("/enrollments", status_code=201)
def create_enrollment(request: Request, body: CreateEnrollmentBody, db: Session = Depends(get_db)):
    clerk_user_id = require_auth(request)
    course = get_owned_course(db, body.course_id, clerk_user_id)
    row = EnrollmentRow(student_id=body.student_id, course_id=body.course_id, semester=body.semester)
    db.add(row)
    db.commit()
    db.refresh(row)
    student = db.query(StudentRow).filter(StudentRow.id == body.student_id).first()
    return _fmt(row, student.name if student else None, course.name)


@router.delete("/enrollments/{enrollment_id}", status_code=204)
def delete_enrollment(request: Request, enrollment_id: int, db: Session = Depends(get_db)):
    clerk_user_id = require_auth(request)
    e = db.query(EnrollmentRow).filter(EnrollmentRow.id == enrollment_id).first()
    if e:
        get_owned_course(db, e.course_id, clerk_user_id)
        db.delete(e)
        db.commit()
