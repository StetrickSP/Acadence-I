"""Grade utility functions — port of gradeUtils.ts"""


def score_to_letter(pct: float) -> str:
    """Convert a percentage (0-100) to a letter grade."""
    if pct >= 90:
        return "A"
    if pct >= 80:
        return "B"
    if pct >= 70:
        return "C"
    if pct >= 60:
        return "D"
    return "F"


def letter_to_points(letter: str) -> float:
    """Convert letter grade to 4-point GPA scale."""
    return {"A": 4.0, "B": 3.0, "C": 2.0, "D": 1.0, "F": 0.0}.get(letter, 0.0)


def to_percent(score: float, max_score: float) -> float:
    """Compute percentage from score/max_score."""
    if max_score == 0:
        return 0.0
    return (score / max_score) * 100


def risk_level(pct: float) -> str:
    """Classify risk level from percentage."""
    if pct < 60:
        return "high"
    if pct < 70:
        return "medium"
    return "low"


def composite_risk(predicted_score: float, attendance_rate: float) -> dict:
    """
    Composite risk classification based on predicted grade and attendance rate.

    Returns a dict with:
        risk_level: "high" | "medium" | "low"
        risk_reason: "grade" | "attendance" | "both" | None
    """
    grade_high = predicted_score < 60
    grade_medium = 60 <= predicted_score < 70
    attendance_high = attendance_rate < 0.80      # below 80%
    attendance_medium = 0.80 <= attendance_rate < 0.85  # borderline 80–85%

    if grade_high and attendance_high:
        return {"risk_level": "high", "risk_reason": "both"}
    if grade_high:
        return {"risk_level": "high", "risk_reason": "grade"}
    if attendance_high:
        return {"risk_level": "high", "risk_reason": "attendance"}
    if grade_medium and attendance_medium:
        return {"risk_level": "medium", "risk_reason": "both"}
    if grade_medium:
        return {"risk_level": "medium", "risk_reason": "grade"}
    if attendance_medium:
        return {"risk_level": "medium", "risk_reason": "attendance"}
    return {"risk_level": "low", "risk_reason": None}
