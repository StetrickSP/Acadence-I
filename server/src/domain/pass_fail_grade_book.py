"""PassFailGradeBook — pass/fail grading scheme."""
from typing import List
from .grade_book import GradeBook, AssignmentScore, GradeResult


class PassFailGradeBook(GradeBook):
    def __init__(self, passing_threshold: float = 60.0):
        self.passing_threshold = passing_threshold

    @property
    def scheme_name(self) -> str:
        return "pass_fail"

    def calculate_grade(self, scores: List[AssignmentScore]) -> GradeResult:
        if not scores:
            return GradeResult(percentage=0.0, letter_grade="F", grade_points=0.0, display_label="Fail")
        pct = self._weighted_percentage(scores)
        passed = pct >= self.passing_threshold
        return GradeResult(
            percentage=round(pct * 10) / 10,
            letter_grade="P" if passed else "F",
            grade_points=0.0,  # Pass/Fail does not contribute to GPA
            display_label="Pass" if passed else "Fail",
        )
