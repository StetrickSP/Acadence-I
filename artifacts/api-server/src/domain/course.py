"""Course domain model with enrollment management."""
from typing import List, Optional
from .grade_book import GradeBook
from .grade_book_factory import GradeBookFactory


class Course:
    def __init__(
        self,
        id: int,
        code: str,
        name: str,
        credits: int,
        semester: str,
        instructor: str,
        grading_scheme: str = "weighted",
        description: Optional[str] = None,
    ):
        self.id = id
        self.code = code
        self.name = name
        self.credits = credits
        self.semester = semester
        self.instructor = instructor
        self.grading_scheme = grading_scheme
        self.description = description
        self._roster: List[int] = []  # student IDs

    def enroll(self, student_id: int) -> None:
        """Add a student to this course's roster."""
        if student_id not in self._roster:
            self._roster.append(student_id)

    def unenroll(self, student_id: int) -> None:
        """Remove a student from this course's roster."""
        if student_id in self._roster:
            self._roster.remove(student_id)

    def get_roster(self) -> List[int]:
        """Return the list of enrolled student IDs."""
        return list(self._roster)

    def get_grade_book(self) -> GradeBook:
        """Return the appropriate GradeBook for this course's grading scheme."""
        return GradeBookFactory.create(self.grading_scheme)
