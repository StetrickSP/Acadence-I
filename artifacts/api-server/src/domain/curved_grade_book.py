"""CurvedGradeBook — weighted grading with a configurable curve offset."""
from typing import List
from .grade_book import GradeBook, AssignmentScore, GradeResult


class CurvedGradeBook(GradeBook):
    def __init__(self, curve_offset: float = 5.0):
        self.curve_offset = curve_offset

    @property
    def scheme_name(self) -> str:
        return "curved"

    def calculate_grade(self, scores: List[AssignmentScore]) -> GradeResult:
        if not scores:
            return GradeResult(percentage=0.0, letter_grade="F", grade_points=0.0, display_label="F (Curved)")
        raw_pct = self._weighted_percentage(scores)
        curved_pct = min(100.0, raw_pct + self.curve_offset)
        letter = self._score_to_letter(curved_pct)
        return GradeResult(
            percentage=round(curved_pct * 10) / 10,
            letter_grade=letter,
            grade_points=self._letter_to_points(letter),
            display_label=f"{letter} (Curved +{int(self.curve_offset)}%)",
        )
