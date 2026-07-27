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
