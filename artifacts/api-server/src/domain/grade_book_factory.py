"""GradeBookFactory — selects the correct GradeBook subclass at runtime."""
from .grade_book import GradeBook
from .weighted_grade_book import WeightedGradeBook
from .curved_grade_book import CurvedGradeBook
from .pass_fail_grade_book import PassFailGradeBook


class GradeBookFactory:
    @staticmethod
    def create(grading_scheme: str) -> GradeBook:
        if grading_scheme == "curved":
            return CurvedGradeBook()
        if grading_scheme == "pass_fail":
            return PassFailGradeBook()
        return WeightedGradeBook()  # default
