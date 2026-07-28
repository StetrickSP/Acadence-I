"""Student self-service routes — /api/me/*."""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.db.models import StudentRow, EnrollmentRow, CourseRow, AssignmentRow, GradeRow
from src.domain.student import Student, CourseGradeInfo
from src.domain.grade_book import AssignmentScore
from src.domain.grade_utils import risk_level
from src.auth.clerk import require_auth, get_student_from_request

router = APIRouter()


def _load_course_grades(db: Session, student_id: int) -> List:
    """Load all course grades for a student using the per-course GradeBook."""
    enrollments = db.query(EnrollmentRow).filter(EnrollmentRow.student_id == student_id).all()
    course_grades = []
    for enr in enrollments:
        course = db.query(CourseRow).filter(CourseRow.id == enr.course_id).first()
        if not course:
            continue
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
        gi = Student.compute_course_grade(
            scores, course.id, course.name, course.code,
            course.credits, enr.semester, course.grading_scheme or "weighted",
        )
        course_grades.append((gi, assignments, scores))
    return course_grades


class ClaimBody(BaseModel):
    studentId: str


@router.post("/me/claim")
def claim_student_account(
    body: ClaimBody,
    request: Request,
    db: Session = Depends(get_db),
):
    clerk_user_id = require_auth(request)

    # Already linked?
    already = db.query(StudentRow).filter(StudentRow.clerk_user_id == clerk_user_id).first()
    if already:
        return {"id": already.id, "name": already.name, "email": already.email,
                "studentId": already.student_id, "year": already.year, "major": already.major, "role": "student"}

    row = db.query(StudentRow).filter(StudentRow.student_id == body.studentId.strip().upper()).first()
    if not row:
        raise HTTPException(status_code=404, detail="No student found with that ID")
    if row.clerk_user_id and row.clerk_user_id != clerk_user_id:
        raise HTTPException(status_code=409, detail="This student account is already linked to another login")

    row.clerk_user_id = clerk_user_id
    db.commit()
    db.refresh(row)
    return {"id": row.id, "name": row.name, "email": row.email,
            "studentId": row.student_id, "year": row.year, "major": row.major, "role": "student"}


@router.get("/me/profile")
def me_profile(request: Request, db: Session = Depends(get_db)):
    s = get_student_from_request(request, db)
    return {"id": s.id, "name": s.name, "email": s.email, "studentId": s.student_id,
            "year": s.year, "major": s.major, "role": "student"}


@router.get("/me/courses")
def me_courses(request: Request, db: Session = Depends(get_db)):
    s = get_student_from_request(request, db)
    course_grades = _load_course_grades(db, s.id)
    return [
        {
            "course_id": gi.course_id, "course_name": gi.course_name,
            "course_code": gi.course_code, "credits": gi.credits,
            "semester": gi.semester, "grading_scheme": gi.grading_scheme,
            "current_grade": gi.percentage, "letter_grade": gi.letter_grade,
            "display_label": gi.display_label,
        }
        for gi, _, _ in course_grades
    ]


@router.get("/me/grades")
def me_grades(request: Request, db: Session = Depends(get_db)):
    s = get_student_from_request(request, db)
    course_grades = _load_course_grades(db, s.id)
    result = []
    for gi, assignments, scores in course_grades:
        score_map = {sc.assignment_id: sc for sc in scores}
        result.append({
            "course_id": gi.course_id, "course_name": gi.course_name,
            "course_code": gi.course_code, "grading_scheme": gi.grading_scheme,
            "current_grade": gi.percentage, "letter_grade": gi.letter_grade,
            "display_label": gi.display_label,
            "assignments": [
                {
                    "id": a.id, "name": a.name, "type": a.type,
                    "max_score": float(a.max_score), "weight": float(a.weight),
                    "due_date": a.due_date,
                    "score": score_map[a.id].score if a.id in score_map else None,
                    "percentage": round(score_map[a.id].score / score_map[a.id].max_score * 1000) / 10
                    if a.id in score_map else None,
                    "submitted": a.id in score_map,
                }
                for a in assignments
            ],
        })
    return result


@router.get("/me/gpa")
def me_gpa(request: Request, db: Session = Depends(get_db)):
    s = get_student_from_request(request, db)
    course_grades = _load_course_grades(db, s.id)
    gis = [gi for gi, _, _ in course_grades]
    student_obj = Student(s.id, s.name, s.email, s.student_id, s.year, s.major, s.clerk_user_id)
    gpa = student_obj.calculate_gpa(gis)
    return {
        "student_id": s.id,
        "gpa": gpa,
        "total_courses": len(gis),
        "completed_courses": sum(1 for gi in gis if gi.percentage is not None),
        "courses": [
            {
                "course_id": gi.course_id, "course_name": gi.course_name,
                "letter_grade": gi.letter_grade, "display_label": gi.display_label,
                "grade_points": gi.grade_points, "credits": gi.credits,
                "grading_scheme": gi.grading_scheme,
                "included_in_gpa": gi.grading_scheme != "pass_fail",
            }
            for gi in gis
        ],
    }


@router.get("/me/predictions")
def me_predictions(request: Request, db: Session = Depends(get_db)):
    s = get_student_from_request(request, db)
    course_grades = _load_course_grades(db, s.id)
    result = []
    for gi, assignments, scores in course_grades:
        score_ids = {sc.assignment_id for sc in scores}
        unsubmitted = [a for a in assignments if a.id not in score_ids]
        remaining_weight = sum(float(a.weight) for a in unsubmitted)
        rl = risk_level(gi.percentage) if gi.percentage is not None else "high"
        best_case = None
        if gi.percentage is not None and remaining_weight > 0:
            submitted_weight = 1 - remaining_weight
            submitted_contrib = (gi.percentage / 100) * submitted_weight if submitted_weight > 0 else 0
            best_case = round(min(100.0, (submitted_contrib + remaining_weight) * 100) * 10) / 10
        result.append({
            "course_id": gi.course_id, "course_name": gi.course_name,
            "course_code": gi.course_code, "grading_scheme": gi.grading_scheme,
            "current_grade": gi.percentage, "letter_grade": gi.letter_grade,
            "display_label": gi.display_label, "risk_level": rl,
            "remaining_assignments": len(unsubmitted),
            "best_case_grade": best_case,
        })
    return result
