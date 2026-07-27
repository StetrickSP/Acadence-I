"""Student routes — full CRUD + GPA + courses."""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.db.models import StudentRow, EnrollmentRow, CourseRow, AssignmentRow, GradeRow
from src.domain.grade_utils import score_to_letter
from src.domain.student import Student, CourseGradeInfo
from src.domain.grade_book import AssignmentScore

router = APIRouter()


def _fmt_student(s: StudentRow, gpa=None):
    return {
        "id": s.id,
        "name": s.name,
        "email": s.email,
        "student_id": s.student_id,
        "year": s.year,
        "major": s.major,
        "clerk_user_id": s.clerk_user_id,
        "created_at": s.created_at.isoformat(),
        "gpa": gpa,
    }


def _compute_course_grade(db: Session, student_id: int, course: CourseRow, semester: str) -> CourseGradeInfo:
    assignments = db.query(AssignmentRow).filter(AssignmentRow.course_id == course.id).all()
    scores: List[AssignmentScore] = []
    for asgn in assignments:
        grade = db.query(GradeRow).filter(
            GradeRow.student_id == student_id,
            GradeRow.assignment_id == asgn.id,
        ).first()
        if grade:
            scores.append(AssignmentScore(
                assignment_id=asgn.id,
                score=float(grade.score),
                max_score=float(asgn.max_score),
                weight=float(asgn.weight),
                name=asgn.name,
                type=asgn.type,
            ))
    return Student.compute_course_grade(
        scores, course.id, course.name, course.code,
        course.credits, semester, course.grading_scheme or "weighted",
    )


def _compute_gpa(db: Session, student_id: int) -> Optional[float]:
    enrollments = db.query(EnrollmentRow).filter(EnrollmentRow.student_id == student_id).all()
    if not enrollments:
        return None
    course_grades = []
    for enr in enrollments:
        course = db.query(CourseRow).filter(CourseRow.id == enr.course_id).first()
        if not course:
            continue
        course_grades.append(_compute_course_grade(db, student_id, course, enr.semester))
    dummy = Student(student_id, "", "", "", 0, "")
    return dummy.calculate_gpa(course_grades)


class CreateStudentBody(BaseModel):
    name: str
    email: str
    student_id: str
    year: int
    major: str


class UpdateStudentBody(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    year: Optional[int] = None
    major: Optional[str] = None


@router.get("/students")
def list_students(
    search: Optional[str] = Query(None),
    major: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(StudentRow)
    if search:
        q = q.filter(StudentRow.name.ilike(f"%{search}%"))
    if major:
        q = q.filter(StudentRow.major.ilike(f"%{major}%"))
    if year is not None:
        q = q.filter(StudentRow.year == year)
    students = q.order_by(StudentRow.name).all()
    return [_fmt_student(s, _compute_gpa(db, s.id)) for s in students]


@router.post("/students", status_code=201)
def create_student(body: CreateStudentBody, db: Session = Depends(get_db)):
    row = StudentRow(
        name=body.name, email=body.email, student_id=body.student_id,
        year=body.year, major=body.major,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _fmt_student(row, None)


@router.get("/students/{student_id}")
def get_student(student_id: int, db: Session = Depends(get_db)):
    s = db.query(StudentRow).filter(StudentRow.id == student_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    return _fmt_student(s, _compute_gpa(db, s.id))


@router.put("/students/{student_id}")
def update_student(student_id: int, body: UpdateStudentBody, db: Session = Depends(get_db)):
    s = db.query(StudentRow).filter(StudentRow.id == student_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    if body.name is not None:
        s.name = body.name
    if body.email is not None:
        s.email = body.email
    if body.year is not None:
        s.year = body.year
    if body.major is not None:
        s.major = body.major
    db.commit()
    db.refresh(s)
    return _fmt_student(s, _compute_gpa(db, s.id))


@router.delete("/students/{student_id}", status_code=204)
def delete_student(student_id: int, db: Session = Depends(get_db)):
    s = db.query(StudentRow).filter(StudentRow.id == student_id).first()
    if s:
        db.delete(s)
        db.commit()


@router.get("/students/{student_id}/gpa")
def get_student_gpa(student_id: int, db: Session = Depends(get_db)):
    s = db.query(StudentRow).filter(StudentRow.id == student_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    enrollments = db.query(EnrollmentRow).filter(EnrollmentRow.student_id == student_id).all()
    course_grades = []
    for enr in enrollments:
        course = db.query(CourseRow).filter(CourseRow.id == enr.course_id).first()
        if not course:
            continue
        course_grades.append(_compute_course_grade(db, student_id, course, enr.semester))
    dummy = Student(student_id, "", "", "", 0, "")
    gpa = dummy.calculate_gpa(course_grades) or 0.0
    letter = score_to_letter((gpa / 4) * 100)
    breakdown = [
        {
            "course_name": c.course_name,
            "grade": c.display_label or c.letter_grade,
            "grade_points": c.grade_points,
            "credits": c.credits,
            "grading_scheme": c.grading_scheme,
        }
        for c in course_grades if c.letter_grade is not None
    ]
    return {
        "student_id": student_id,
        "gpa": gpa,
        "total_courses": len(enrollments),
        "completed_courses": len(breakdown),
        "letter_grade": letter,
        "grade_points_breakdown": breakdown,
    }


@router.get("/students/{student_id}/courses")
def get_student_courses(student_id: int, db: Session = Depends(get_db)):
    enrollments = db.query(EnrollmentRow).filter(EnrollmentRow.student_id == student_id).all()
    result = []
    for enr in enrollments:
        course = db.query(CourseRow).filter(CourseRow.id == enr.course_id).first()
        if not course:
            continue
        gi = _compute_course_grade(db, student_id, course, enr.semester)
        result.append({
            "course_id": gi.course_id,
            "course_name": gi.course_name,
            "course_code": gi.course_code,
            "semester": gi.semester,
            "current_grade": gi.percentage,
            "letter_grade": gi.letter_grade,
            "display_label": gi.display_label,
            "grading_scheme": gi.grading_scheme,
            "credits": gi.credits,
        })
    return result
