"""Analytics routes — grade distribution, at-risk, performance, trends, completion."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.db.models import CourseRow, EnrollmentRow
from src.services.analytics_service import PandasAnalyticsService
from src.auth.clerk import require_auth
from src.auth.ownership import get_owned_course

router = APIRouter()


def _caller_course_ids(db: Session, clerk_user_id: str) -> set:
    """Return the set of course IDs this instructor may access (owned + legacy NULL)."""
    rows = db.query(CourseRow.id).filter(CourseRow.owner_clerk_id == clerk_user_id).all()
    return {r.id for r in rows}


def _scoped_svc(db: Session, clerk_user_id: str) -> PandasAnalyticsService:
    """Return an analytics service pre-scoped to the caller's accessible courses."""
    return PandasAnalyticsService(db, allowed_course_ids=_caller_course_ids(db, clerk_user_id))


@router.get("/analytics/grade-distribution")
def grade_distribution(request: Request, course_id: int = Query(...), db: Session = Depends(get_db)):
    clerk_user_id = require_auth(request)
    get_owned_course(db, course_id, clerk_user_id)  # 403/404 if not owner
    svc = _scoped_svc(db, clerk_user_id)
    return svc.grade_distribution(course_id=course_id)


@router.get("/analytics/at-risk")
def at_risk_students(
    request: Request,
    course_id: Optional[int] = Query(None),
    threshold: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    clerk_user_id = require_auth(request)
    if course_id is not None:
        get_owned_course(db, course_id, clerk_user_id)
    svc = _scoped_svc(db, clerk_user_id)
    return svc.at_risk_students(course_id=course_id, threshold=threshold)


@router.get("/analytics/course-performance")
def course_performance(request: Request, db: Session = Depends(get_db)):
    clerk_user_id = require_auth(request)
    svc = _scoped_svc(db, clerk_user_id)
    return svc.course_performance()


@router.get("/analytics/semester-trends")
def semester_trends(
    request: Request,
    student_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Return semester GPA trends scoped to the caller's courses.

    When student_id is provided, verifies the student is enrolled in at least
    one of the caller's courses, then returns trends only for those courses
    (a shared student won't leak another instructor's course data).

    When student_id is omitted, aggregates across all students in the caller's
    courses only.
    """
    clerk_user_id = require_auth(request)

    if student_id is not None:
        # Verify the student belongs to at least one of the caller's courses
        allowed = _caller_course_ids(db, clerk_user_id)
        enrolled = db.query(EnrollmentRow).filter(
            EnrollmentRow.student_id == student_id,
            EnrollmentRow.course_id.in_(allowed),
        ).first()
        if not enrolled:
            raise HTTPException(status_code=403, detail="Student not in your courses")

    # Service is pre-scoped → master DataFrame only contains caller's courses,
    # so semester GPA is computed only from those courses regardless of student_id.
    svc = _scoped_svc(db, clerk_user_id)
    return svc.semester_trends(student_id=student_id)


@router.get("/analytics/assignment-completion")
def assignment_completion(
    request: Request,
    course_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    clerk_user_id = require_auth(request)
    if course_id is not None:
        get_owned_course(db, course_id, clerk_user_id)
    # Service is pre-scoped → only caller's assignments are included
    svc = _scoped_svc(db, clerk_user_id)
    return svc.assignment_completion(course_id=course_id)
