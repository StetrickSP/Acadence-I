"""Prediction routes — grade prediction + at-risk by course."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.db.models import AssignmentRow, GradeRow, EnrollmentRow, StudentRow
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
            "confidence": pred["confidence"],
            "current_score": current_score,
        })

    result.sort(key=lambda x: x["predicted_score"])
    return result
