"""Analytics routes — grade distribution, at-risk, performance, trends, completion."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.services.analytics_service import PandasAnalyticsService

router = APIRouter()


@router.get("/analytics/grade-distribution")
def grade_distribution(course_id: int = Query(...), db: Session = Depends(get_db)):
    svc = PandasAnalyticsService(db)
    return svc.grade_distribution(course_id=course_id)


@router.get("/analytics/at-risk")
def at_risk_students(
    course_id: Optional[int] = Query(None),
    threshold: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    svc = PandasAnalyticsService(db)
    return svc.at_risk_students(course_id=course_id, threshold=threshold)


@router.get("/analytics/course-performance")
def course_performance(db: Session = Depends(get_db)):
    svc = PandasAnalyticsService(db)
    return svc.course_performance()


@router.get("/analytics/semester-trends")
def semester_trends(student_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    svc = PandasAnalyticsService(db)
    return svc.semester_trends(student_id=student_id)


@router.get("/analytics/assignment-completion")
def assignment_completion(course_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    svc = PandasAnalyticsService(db)
    return svc.assignment_completion(course_id=course_id)
