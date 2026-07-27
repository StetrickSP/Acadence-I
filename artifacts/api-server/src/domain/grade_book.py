"""Abstract GradeBook — SP1 OOP domain model."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List


@dataclass
class AssignmentScore:
    assignment_id: int
    score: float
    max_score: float
    weight: float
    name: str
    type: str


@dataclass
class GradeResult:
    percentage: float
    letter_grade: str
    grade_points: float
    display_label: str


class GradeBook(ABC):
    """Abstract base class for all grading schemes."""

    @abstractmethod
    def calculate_grade(self, scores: List[AssignmentScore]) -> GradeResult:
        """Calculate the final grade for a set of assignment scores."""
        ...

    @property
    @abstractmethod
    def scheme_name(self) -> str:
        """Return the grading scheme identifier."""
        ...

    def _score_to_letter(self, pct: float) -> str:
        if pct >= 90:
            return "A"
        if pct >= 80:
            return "B"
        if pct >= 70:
            return "C"
        if pct >= 60:
            return "D"
        return "F"

    def _letter_to_points(self, letter: str) -> float:
        return {"A": 4.0, "B": 3.0, "C": 2.0, "D": 1.0, "F": 0.0}.get(letter, 0.0)

    def _weighted_percentage(self, scores: List[AssignmentScore]) -> float:
        weighted_sum = 0.0
        total_weight = 0.0
        for s in scores:
            if s.max_score > 0:
                pct = (s.score / s.max_score) * 100
                weighted_sum += pct * s.weight
                total_weight += s.weight
        if total_weight == 0:
            return 0.0
        return weighted_sum / total_weight
