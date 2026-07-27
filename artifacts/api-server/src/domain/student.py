"""Student domain model — extends Person."""
from typing import List, Optional
from .person import Person
from .grade_book import AssignmentScore
from .grade_book_factory import GradeBookFactory


class CourseGradeInfo:
    def __init__(
        self,
        course_id: int,
        course_name: str,
        course_code: str,
        credits: int,
        semester: str,
        grading_scheme: str,
        percentage: Optional[float],
        letter_grade: Optional[str],
        grade_points: Optional[float],
        display_label: Optional[str],
    ):
        self.course_id = course_id
        self.course_name = course_name
        self.course_code = course_code
        self.credits = credits
        self.semester = semester
        self.grading_scheme = grading_scheme
        self.percentage = percentage
        self.letter_grade = letter_grade
        self.grade_points = grade_points
        self.display_label = display_label


class Student(Person):
    def __init__(
        self,
        id: int,
        name: str,
        email: str,
        student_id: str,
        year: int,
        major: str,
        clerk_user_id: Optional[str] = None,
    ):
        super().__init__(id, name, email)
        self.student_id = student_id
        self.year = year
        self.major = major
        self.clerk_user_id = clerk_user_id

    def get_role(self) -> str:
        return "student"

    def calculate_gpa(self, courses: List[CourseGradeInfo]) -> Optional[float]:
        """Calculate GPA across all courses, excluding pass/fail."""
        total_points = 0.0
        total_credits = 0
        for c in courses:
            if c.grading_scheme == "pass_fail":
                continue
            if c.grade_points is not None and c.letter_grade is not None:
                total_points += c.grade_points * c.credits
                total_credits += c.credits
        if total_credits == 0:
            return None
        return round((total_points / total_credits) * 100) / 100

    @staticmethod
    def compute_course_grade(
        scores: List[AssignmentScore],
        course_id: int,
        course_name: str,
        course_code: str,
        credits: int,
        semester: str,
        grading_scheme: str,
    ) -> CourseGradeInfo:
        """Compute grade info for a single course using the appropriate GradeBook."""
        grade_book = GradeBookFactory.create(grading_scheme)

        if not scores:
            return CourseGradeInfo(
                course_id=course_id,
                course_name=course_name,
                course_code=course_code,
                credits=credits,
                semester=semester,
                grading_scheme=grading_scheme,
                percentage=None,
                letter_grade=None,
                grade_points=None,
                display_label=None,
            )

        result = grade_book.calculate_grade(scores)
        return CourseGradeInfo(
            course_id=course_id,
            course_name=course_name,
            course_code=course_code,
            credits=credits,
            semester=semester,
            grading_scheme=grading_scheme,
            percentage=result.percentage,
            letter_grade=result.letter_grade,
            grade_points=result.grade_points,
            display_label=result.display_label,
        )
