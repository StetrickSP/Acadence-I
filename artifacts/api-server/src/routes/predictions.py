"""Prediction routes — grade prediction + at-risk by course."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.db.models import AssignmentRow, GradeRow, EnrollmentRow, StudentRow
from src.domain.grade_utils import to_percent, score_to_letter, risk_level

router = APIRouter()


def predict_final_score(midterm_pct, assignment_avg_pct, completion_rate: float):
    """Linear-weighted grade prediction: midterm 35%, assignments 45%, completion 20%."""
    components = []
    if midterm_pct is not None:
        components.append({"value": midterm_pct, "weight": 0.35})
    if assignment_avg_pct is not None:
        components.append({"value": assignment_avg_pct, "weight": 0.45})
    components.append({"value": completion_rate * 100, "weight": 0.20})
    total_weight = sum(c["weight"] for c in components)
    score = sum(c["value"] * (c["weight"] / total_weight) for c in components)
    confidence = min(100, round(total_weight * 90 + completion_rate * 10))
    return {"score": max(0.0, min(100.0, score)), "confidence": confidence}


class PredictGradeBody(BaseModel):
    student_id: int
    course_id: int
    midterm_score: Optional[float] = None
    assignment_completion_rate: Optional[float] = None


@router.post("/predictions/grade")
def predict_grade(body: PredictGradeBody, db: Session = Depends(get_db)):
    assignments = db.query(AssignmentRow).filter(AssignmentRow.course_id == body.course_id).all()
    midterm_pct = body.midterm_score
    assignment_total = 0.0
    assignment_count = 0
    submitted_count = 0
    for asgn in assignments:
        grade = db.query(GradeRow).filter(
            GradeRow.student_id == body.student_id,
            GradeRow.assignment_id == asgn.id,
        ).first()
        if grade:
            pct = to_percent(float(grade.score), float(asgn.max_score))
            if asgn.type == "midterm" and midterm_pct is None:
                midterm_pct = pct
            else:
                assignment_total += pct
                assignment_count += 1
            submitted_count += 1
    completion_rate = (
        body.assignment_completion_rate
        if body.assignment_completion_rate is not None
        else (submitted_count / len(assignments) if assignments else 0)
    )
    assignment_avg = assignment_total / assignment_count if assignment_count > 0 else None
    pred = predict_final_score(midterm_pct, assignment_avg, completion_rate)
    score = pred["score"]
    letter = score_to_letter(score)
    factors = [
        {"factor": "Midterm Performance", "weight": 0.35, "value": midterm_pct or 0},
        {"factor": "Assignment Average", "weight": 0.45, "value": assignment_avg or 0},
        {"factor": "Completion Rate", "weight": 0.20, "value": completion_rate * 100},
    ]
    return {
        "student_id": body.student_id,
        "course_id": body.course_id,
        "predicted_score": round(score * 10) / 10,
        "predicted_letter": letter,
        "confidence": pred["confidence"],
        "risk_level": risk_level(score),
        "factors": factors,
    }


@router.get("/predictions/at-risk/{course_id}")
def at_risk_by_course(course_id: int, db: Session = Depends(get_db)):
    enrollments = db.query(EnrollmentRow).filter(EnrollmentRow.course_id == course_id).all()
    assignments = db.query(AssignmentRow).filter(AssignmentRow.course_id == course_id).all()
    result = []
    for enr in enrollments:
        student = db.query(StudentRow).filter(StudentRow.id == enr.student_id).first()
        if not student:
            continue
        midterm_pct = None
        assignment_total = 0.0
        assignment_count = 0
        submitted_count = 0
        current_weighted = 0.0
        current_total_weight = 0.0
        for asgn in assignments:
            grade = db.query(GradeRow).filter(
                GradeRow.student_id == enr.student_id,
                GradeRow.assignment_id == asgn.id,
            ).first()
            if grade:
                pct = to_percent(float(grade.score), float(asgn.max_score))
                if asgn.type == "midterm" and midterm_pct is None:
                    midterm_pct = pct
                else:
                    assignment_total += pct
                    assignment_count += 1
                current_weighted += pct * float(asgn.weight)
                current_total_weight += float(asgn.weight)
                submitted_count += 1
        completion_rate = submitted_count / len(assignments) if assignments else 0
        assignment_avg = assignment_total / assignment_count if assignment_count > 0 else None
        pred = predict_final_score(midterm_pct, assignment_avg, completion_rate)
        current_score = round(current_weighted / current_total_weight * 10) / 10 if current_total_weight > 0 else None
        result.append({
            "student_id": student.id,
            "student_name": student.name,
            "predicted_score": round(pred["score"] * 10) / 10,
            "predicted_letter": score_to_letter(pred["score"]),
            "risk_level": risk_level(pred["score"]),
            "confidence": pred["confidence"],
            "current_score": current_score,
        })
    result.sort(key=lambda x: x["predicted_score"])
    return result
