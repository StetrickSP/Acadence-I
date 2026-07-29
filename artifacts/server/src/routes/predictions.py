"""Prediction routes — grade prediction + at-risk by course + cross-course alerts."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.db.models import AssignmentRow, GradeRow, EnrollmentRow, StudentRow, CourseRow
from src.domain.grade_utils import to_percent, score_to_letter, risk_level
from src.services.prediction_service import GradePredictionModel

router = APIRouter()


class PredictGradeBody(BaseModel):
    student_id: int
    course_id: int
    midterm_score: Optional[float] = None
    assignment_completion_rate: Optional[float] = None


@router.post("/predictions/grade")
def predict_grade(body: PredictGradeBody, db: Session = Depends(get_db)):
    model = GradePredictionModel(db, course_id=body.course_id)
    result = model.predict(
        student_id=body.student_id,
        course_id=body.course_id,
        midterm_pct=body.midterm_score,
        completion_rate=body.assignment_completion_rate,
    )
    score = result["predicted_score"]
    return {
        "student_id": body.student_id,
        "course_id": body.course_id,
        "predicted_score": round(score * 10) / 10,
        "predicted_letter": score_to_letter(score),
        "confidence": result["confidence"],
        "risk_level": result["risk_level"],
        "risk_reason": result.get("risk_reason"),
        "attendance_rate": result.get("attendance_rate"),
        "factors": result["factors"],
    }


@router.get("/predictions/at-risk/{course_id}")
def at_risk_by_course(course_id: int, db: Session = Depends(get_db)):
    enrollments = db.query(EnrollmentRow).filter(EnrollmentRow.course_id == course_id).all()
    assignments = db.query(AssignmentRow).filter(AssignmentRow.course_id == course_id).all()

    # Train one model per course call (shared across all students in the course)
    model = GradePredictionModel(db, course_id=course_id)

    result = []
    for enr in enrollments:
        student = db.query(StudentRow).filter(StudentRow.id == enr.student_id).first()
        if not student:
            continue

        # Compute current actual score (weighted) for display
        current_weighted = 0.0
        current_total_weight = 0.0
        for asgn in assignments:
            grade = db.query(GradeRow).filter(
                GradeRow.student_id == enr.student_id,
                GradeRow.assignment_id == asgn.id,
            ).first()
            if grade:
                pct = to_percent(float(grade.score), float(asgn.max_score))
                current_weighted += pct * float(asgn.weight)
                current_total_weight += float(asgn.weight)

        current_score = (
            round(current_weighted / current_total_weight * 10) / 10
            if current_total_weight > 0
            else None
        )

        pred = model.predict(student_id=enr.student_id, course_id=course_id)
        predicted_score = round(pred["predicted_score"] * 10) / 10

        result.append({
            "student_id": student.id,
            "student_name": student.name,
            "predicted_score": predicted_score,
            "predicted_letter": score_to_letter(predicted_score),
            "risk_level": pred["risk_level"],
            "risk_reason": pred.get("risk_reason"),
            "attendance_rate": pred.get("attendance_rate"),
            "confidence": pred["confidence"],
            "current_score": current_score,
        })

    result.sort(key=lambda x: x["predicted_score"])
    return result


@router.get("/predictions/alerts")
def get_alerts(db: Session = Depends(get_db)):
    """
    Aggregate at-risk students (high or medium risk) across all courses.
    Returns a sorted list — high risk first, then medium — with name, course, predicted
    grade, attendance rate, and the reason the risk was triggered.
    """
    enrollments = db.query(EnrollmentRow).all()

    # Build a model cache per course to avoid re-training for each student
    model_cache: dict[int, GradePredictionModel] = {}

    alerts = []
    for enr in enrollments:
        student = db.query(StudentRow).filter(StudentRow.id == enr.student_id).first()
        if not student:
            continue

        course = db.query(CourseRow).filter(CourseRow.id == enr.course_id).first()
        if not course:
            continue

        if enr.course_id not in model_cache:
            model_cache[enr.course_id] = GradePredictionModel(db, course_id=enr.course_id)
        model = model_cache[enr.course_id]

        pred = model.predict(student_id=enr.student_id, course_id=enr.course_id)

        if pred["risk_level"] in ("high", "medium"):
            predicted_score = round(pred["predicted_score"] * 10) / 10
            alerts.append({
                "student_id": student.id,
                "student_name": student.name,
                "course_id": course.id,
                "course_name": course.name,
                "course_code": course.code,
                "predicted_score": predicted_score,
                "predicted_letter": score_to_letter(predicted_score),
                "attendance_rate": pred.get("attendance_rate"),
                "risk_level": pred["risk_level"],
                "risk_reason": pred.get("risk_reason"),
                "confidence": pred["confidence"],
            })

    # Sort: high risk first, then medium; within same level sort by predicted score ascending
    risk_order = {"high": 0, "medium": 1}
    alerts.sort(key=lambda x: (risk_order.get(x["risk_level"], 2), x["predicted_score"]))
    return alerts
