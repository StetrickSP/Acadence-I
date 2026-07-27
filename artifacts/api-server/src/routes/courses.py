"""Course routes — full CRUD + students + stats."""
import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.db.models import CourseRow, EnrollmentRow, StudentRow, AssignmentRow, GradeRow
from src.domain.grade_utils import to_percent

router = APIRouter()


def _avg_grade(db: Session, course_id: int):
    grades = (
        db.query(GradeRow, AssignmentRow)
        .join(AssignmentRow, GradeRow.assignment_id == AssignmentRow.id)
        .filter(AssignmentRow.course_id == course_id)
        .all()
    )
    if not grades:
        return None
    pcts = [to_percent(float(g.score), float(a.max_score)) for g, a in grades]
    return round(sum(pcts) / len(pcts) * 10) / 10


def _fmt_course(c: CourseRow, student_count: int = 0, average_grade=None):
    return {
        "id": c.id,
        "code": c.code,
        "name": c.name,
        "credits": c.credits,
        "semester": c.semester,
        "instructor": c.instructor,
        "description": c.description,
        "grading_scheme": c.grading_scheme or "weighted",
        "created_at": c.created_at.isoformat(),
        "student_count": student_count,
        "average_grade": average_grade,
    }


class CreateCourseBody(BaseModel):
    code: str
    name: str
    credits: int
    semester: str
    instructor: str
    description: Optional[str] = None
    grading_scheme: Optional[str] = "weighted"


class UpdateCourseBody(BaseModel):
    name: Optional[str] = None
    credits: Optional[int] = None
    semester: Optional[str] = None
    instructor: Optional[str] = None
    description: Optional[str] = None


@router.get("/courses")
def list_courses(
    semester: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(CourseRow)
    if semester:
        q = q.filter(CourseRow.semester == semester)
    if search:
        q = q.filter(CourseRow.name.ilike(f"%{search}%"))
    courses = q.order_by(CourseRow.name).all()
    result = []
    for c in courses:
        cnt = db.query(EnrollmentRow).filter(EnrollmentRow.course_id == c.id).count()
        result.append(_fmt_course(c, cnt, _avg_grade(db, c.id)))
    return result


@router.post("/courses", status_code=201)
def create_course(body: CreateCourseBody, db: Session = Depends(get_db)):
    row = CourseRow(
        code=body.code, name=body.name, credits=body.credits,
        semester=body.semester, instructor=body.instructor,
        description=body.description,
        grading_scheme=body.grading_scheme or "weighted",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _fmt_course(row, 0, None)


@router.get("/courses/{course_id}")
def get_course(course_id: int, db: Session = Depends(get_db)):
    c = db.query(CourseRow).filter(CourseRow.id == course_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    cnt = db.query(EnrollmentRow).filter(EnrollmentRow.course_id == course_id).count()
    return _fmt_course(c, cnt, _avg_grade(db, course_id))


@router.put("/courses/{course_id}")
def update_course(course_id: int, body: UpdateCourseBody, db: Session = Depends(get_db)):
    c = db.query(CourseRow).filter(CourseRow.id == course_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    if body.name is not None:
        c.name = body.name
    if body.credits is not None:
        c.credits = body.credits
    if body.semester is not None:
        c.semester = body.semester
    if body.instructor is not None:
        c.instructor = body.instructor
    if body.description is not None:
        c.description = body.description
    db.commit()
    db.refresh(c)
    return _fmt_course(c, None, None)


@router.delete("/courses/{course_id}", status_code=204)
def delete_course(course_id: int, db: Session = Depends(get_db)):
    c = db.query(CourseRow).filter(CourseRow.id == course_id).first()
    if c:
        db.delete(c)
        db.commit()


@router.get("/courses/{course_id}/students")
def get_course_students(course_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(StudentRow)
        .join(EnrollmentRow, EnrollmentRow.student_id == StudentRow.id)
        .filter(EnrollmentRow.course_id == course_id)
        .all()
    )
    return [
        {
            "id": s.id, "name": s.name, "email": s.email,
            "student_id": s.student_id, "year": s.year, "major": s.major,
            "gpa": None, "created_at": s.created_at.isoformat(),
        }
        for s in rows
    ]


@router.get("/courses/{course_id}/stats")
def get_course_stats(course_id: int, db: Session = Depends(get_db)):
    student_count = db.query(EnrollmentRow).filter(EnrollmentRow.course_id == course_id).count()
    grade_data = (
        db.query(GradeRow, AssignmentRow)
        .join(AssignmentRow, GradeRow.assignment_id == AssignmentRow.id)
        .filter(AssignmentRow.course_id == course_id)
        .all()
    )
    if not grade_data:
        return {
            "course_id": course_id, "average_grade": 0, "median_grade": 0,
            "pass_rate": 0, "fail_rate": 0, "highest_grade": 0, "lowest_grade": 0,
            "student_count": student_count, "std_deviation": None,
        }
    pcts = sorted([to_percent(float(g.score), float(a.max_score)) for g, a in grade_data])
    n = len(pcts)
    mean = sum(pcts) / n
    median = (pcts[n // 2 - 1] + pcts[n // 2]) / 2 if n % 2 == 0 else pcts[n // 2]
    passing = sum(1 for p in pcts if p >= 60)
    variance = sum((p - mean) ** 2 for p in pcts) / n
    return {
        "course_id": course_id,
        "average_grade": round(mean * 10) / 10,
        "median_grade": round(median * 10) / 10,
        "pass_rate": round((passing / n) * 1000) / 10,
        "fail_rate": round(((n - passing) / n) * 1000) / 10,
        "highest_grade": round(pcts[-1] * 10) / 10,
        "lowest_grade": round(pcts[0] * 10) / 10,
        "student_count": student_count,
        "std_deviation": round(math.sqrt(variance) * 10) / 10,
    }
