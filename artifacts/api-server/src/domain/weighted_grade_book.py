"""WeightedGradeBook — standard weighted average grading scheme."""
from typing import List
from .grade_book import GradeBook, AssignmentScore, GradeResult


class WeightedGradeBook(GradeBook):
    @property
    def scheme_name(self) -> str:
        return "weighted"

    def calculate_grade(self, scores: List[AssignmentScore]) -> GradeResult:
        if not scores:
            return GradeResult(percentage=0.0, letter_grade="F", grade_points=0.0, display_label="F")
        pct = self._weighted_percentage(scores)
        letter = self._score_to_letter(pct)
        return GradeResult(
            percentage=round(pct * 10) / 10,
            letter_grade=letter,
            grade_points=self._letter_to_points(letter),
            display_label=letter,
        )
