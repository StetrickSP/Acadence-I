"""ML-based grade prediction service using scikit-learn Ridge regression."""
from __future__ import annotations

import numpy as np
from typing import Optional
from sqlalchemy.orm import Session

from src.db.models import AssignmentRow, GradeRow, EnrollmentRow, SessionRow, AttendanceRecordRow
from src.domain.grade_utils import to_percent, risk_level, composite_risk

# Minimum training samples required to use the ML model
MIN_TRAINING_SAMPLES = 10

# Heuristic weights used as fallback
_HEURISTIC_WEIGHTS = {
    "midterm": 0.35,
    "assignments": 0.45,
    "completion": 0.20,
}


def _get_attendance_rate(student_id: int, course_id: int, db: Session) -> float:
    """
    Compute attendance rate for a student in a course.
    Returns fraction 0.0–1.0. Returns 1.0 (neutral) if no sessions recorded.
    """
    sessions = db.query(SessionRow).filter(SessionRow.course_id == course_id).all()
    if not sessions:
        return 1.0  # no sessions recorded — treat as neutral

    session_ids = [s.id for s in sessions]
    present_count = (
        db.query(AttendanceRecordRow)
        .filter(
            AttendanceRecordRow.session_id.in_(session_ids),
            AttendanceRecordRow.student_id == student_id,
            AttendanceRecordRow.status.in_(["present", "late"]),
        )
        .count()
    )
    return present_count / len(sessions)


def _heuristic_predict(
    midterm_pct: Optional[float],
    assignment_avg_pct: Optional[float],
    completion_rate: float,
) -> dict:
    """Original fixed-weight linear heuristic — used as fallback."""
    components = []
    if midterm_pct is not None:
        components.append({"value": midterm_pct, "weight": _HEURISTIC_WEIGHTS["midterm"]})
    if assignment_avg_pct is not None:
        components.append({"value": assignment_avg_pct, "weight": _HEURISTIC_WEIGHTS["assignments"]})
    components.append({"value": completion_rate * 100, "weight": _HEURISTIC_WEIGHTS["completion"]})
    total_weight = sum(c["weight"] for c in components)
    score = sum(c["value"] * (c["weight"] / total_weight) for c in components)
    # Heuristic confidence: clamp to 5–30% to distinguish from ML mode
    confidence = max(5, min(30, round(total_weight * 25 + completion_rate * 5)))
    return {"score": max(0.0, min(100.0, score)), "confidence": confidence}


def _build_student_features(
    student_id: int,
    course_id: int,
    db: Session,
) -> Optional[tuple[float, float, float, float]]:
    """
    Return (midterm_pct, assignment_avg_pct, completion_rate, attendance_rate) for a student/course.
    Returns None if the student has no grade data at all.
    """
    assignments = db.query(AssignmentRow).filter(AssignmentRow.course_id == course_id).all()
    if not assignments:
        return None

    midterm_pct: Optional[float] = None
    assignment_total = 0.0
    assignment_count = 0
    submitted_count = 0

    for asgn in assignments:
        grade = (
            db.query(GradeRow)
            .filter(GradeRow.student_id == student_id, GradeRow.assignment_id == asgn.id)
            .first()
        )
        if grade:
            pct = to_percent(float(grade.score), float(asgn.max_score))
            if asgn.type == "midterm" and midterm_pct is None:
                midterm_pct = pct
            else:
                assignment_total += pct
                assignment_count += 1
            submitted_count += 1

    completion_rate = submitted_count / len(assignments)
    assignment_avg = assignment_total / assignment_count if assignment_count > 0 else 0.0
    attendance_rate = _get_attendance_rate(student_id, course_id, db)

    return (
        midterm_pct if midterm_pct is not None else 0.0,
        assignment_avg,
        completion_rate,
        attendance_rate,
    )


def _collect_training_data(
    course_id: Optional[int],
    db: Session,
) -> tuple[list[list[float]], list[float]]:
    """
    Collect (X, y) training pairs from historical GradeRow data.

    For each enrolled student (optionally filtered to one course), compute
    features and use the current weighted score as the target label.

    Features: [midterm_pct, assignment_avg_pct, completion_rate*100, attendance_rate*100]
    Only students whose grades give us enough signal (at least one grade) are included.
    """
    X: list[list[float]] = []
    y: list[float] = []

    # Determine which (student_id, course_id) pairs to iterate
    query = db.query(EnrollmentRow)
    if course_id is not None:
        query = query.filter(EnrollmentRow.course_id == course_id)
    enrollments = query.all()

    for enr in enrollments:
        assignments = (
            db.query(AssignmentRow)
            .filter(AssignmentRow.course_id == enr.course_id)
            .all()
        )
        if not assignments:
            continue

        midterm_pct: Optional[float] = None
        assignment_total = 0.0
        assignment_count = 0
        submitted_count = 0
        weighted_total = 0.0
        weight_sum = 0.0

        for asgn in assignments:
            grade = (
                db.query(GradeRow)
                .filter(
                    GradeRow.student_id == enr.student_id,
                    GradeRow.assignment_id == asgn.id,
                )
                .first()
            )
            if grade:
                pct = to_percent(float(grade.score), float(asgn.max_score))
                w = float(asgn.weight)
                if asgn.type == "midterm" and midterm_pct is None:
                    midterm_pct = pct
                else:
                    assignment_total += pct
                    assignment_count += 1
                weighted_total += pct * w
                weight_sum += w
                submitted_count += 1

        if submitted_count == 0:
            continue  # no data for this student in this course

        completion_rate = submitted_count / len(assignments)
        assignment_avg = assignment_total / assignment_count if assignment_count > 0 else 0.0
        target = weighted_total / weight_sum if weight_sum > 0 else None
        if target is None:
            continue

        attendance_rate = _get_attendance_rate(enr.student_id, enr.course_id, db)

        X.append([
            midterm_pct if midterm_pct is not None else 0.0,
            assignment_avg,
            completion_rate * 100,
            attendance_rate * 100,
        ])
        y.append(target)

    return X, y


class GradePredictionModel:
    """
    Wraps a scikit-learn Ridge regressor for grade prediction.

    Usage:
        model = GradePredictionModel(db, course_id=42)
        result = model.predict(student_id=7, course_id=42)
    """

    def __init__(self, db: Session, course_id: Optional[int] = None):
        self._db = db
        self._course_id = course_id
        self._model = None
        self._r2: float = 0.0
        self._trained_globally = False
        self._n_samples = 0
        self._train()

    def _train(self):
        """Train Ridge regressor on available data; fall back to global if course has too few rows."""
        from sklearn.linear_model import Ridge
        from sklearn.preprocessing import StandardScaler
        from sklearn.pipeline import Pipeline
        from sklearn.metrics import r2_score

        X, y = _collect_training_data(self._course_id, self._db)

        # If course-specific data is insufficient, try global
        if len(X) < MIN_TRAINING_SAMPLES and self._course_id is not None:
            X, y = _collect_training_data(None, self._db)
            self._trained_globally = True

        self._n_samples = len(X)

        if self._n_samples < MIN_TRAINING_SAMPLES:
            # Not enough data anywhere — stay in heuristic mode
            self._model = None
            return

        X_arr = np.array(X)
        y_arr = np.array(y)

        pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("ridge", Ridge(alpha=1.0)),
        ])
        pipeline.fit(X_arr, y_arr)

        y_pred = pipeline.predict(X_arr)
        self._r2 = float(r2_score(y_arr, y_pred))
        self._model = pipeline

    @property
    def is_ml_active(self) -> bool:
        return self._model is not None

    @property
    def confidence_from_r2(self) -> int:
        """Map R² (−∞..1] to a 10–100 confidence score.

        Uses a minimum display floor of 10% when the ML model is active,
        to distinguish from heuristic mode (which is capped at 30%).
        """
        if self._model is None:
            return 0
        # R² can be negative; clamp to [0, 1] then scale to 0–100
        # Apply a minimum floor of 10 so a low-but-positive R² doesn't show 0%
        raw = max(0.0, self._r2) * 100
        return max(10, min(100, round(raw)))

    def predict(
        self,
        student_id: int,
        course_id: int,
        midterm_pct: Optional[float] = None,
        assignment_avg_pct: Optional[float] = None,
        completion_rate: Optional[float] = None,
    ) -> dict:
        """
        Predict final score for a student in a course.

        Returns a dict with keys:
            predicted_score, confidence, risk_level, risk_reason, attendance_rate, factors
        """
        # Gather live student features from DB if not provided
        features = _build_student_features(student_id, course_id, self._db)

        if features is not None:
            db_midterm, db_asgn_avg, db_completion, db_attendance = features
            # Override with any caller-supplied values
            if midterm_pct is None:
                midterm_pct = db_midterm
            if assignment_avg_pct is None:
                assignment_avg_pct = db_asgn_avg
            if completion_rate is None:
                completion_rate = db_completion
            attendance_rate = db_attendance
        else:
            midterm_pct = midterm_pct or 0.0
            assignment_avg_pct = assignment_avg_pct or 0.0
            completion_rate = completion_rate or 0.0
            attendance_rate = _get_attendance_rate(student_id, course_id, self._db)

        factors = [
            {"factor": "Midterm Performance", "weight": 0.35, "value": round(midterm_pct or 0, 2)},
            {"factor": "Assignment Average", "weight": 0.45, "value": round(assignment_avg_pct or 0, 2)},
            {"factor": "Completion Rate", "weight": 0.20, "value": round((completion_rate or 0) * 100, 2)},
            {"factor": "Attendance Rate", "weight": 0.00, "value": round((attendance_rate or 1.0) * 100, 2)},
        ]

        if not self.is_ml_active:
            # Fallback heuristic
            pred = _heuristic_predict(midterm_pct, assignment_avg_pct, completion_rate or 0.0)
            risk = composite_risk(pred["score"], attendance_rate)
            return {
                "predicted_score": max(0.0, min(100.0, pred["score"])),
                "confidence": pred["confidence"],
                "risk_level": risk["risk_level"],
                "risk_reason": risk["risk_reason"],
                "attendance_rate": attendance_rate,
                "factors": factors,
            }

        feature_vec = np.array([[
            midterm_pct or 0.0,
            assignment_avg_pct or 0.0,
            (completion_rate or 0.0) * 100,
            (attendance_rate or 1.0) * 100,
        ]])
        raw_score = float(self._model.predict(feature_vec)[0])
        score = max(0.0, min(100.0, raw_score))
        risk = composite_risk(score, attendance_rate)

        return {
            "predicted_score": score,
            "confidence": self.confidence_from_r2,
            "risk_level": risk["risk_level"],
            "risk_reason": risk["risk_reason"],
            "attendance_rate": attendance_rate,
            "factors": factors,
        }
