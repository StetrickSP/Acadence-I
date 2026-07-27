"""Instructor domain model — extends Person."""
from typing import List
from .person import Person


class Instructor(Person):
    def __init__(self, id: int, name: str, email: str, course_names: List[str] = None):
        super().__init__(id, name, email)
        self.course_names: List[str] = course_names or []

    def get_role(self) -> str:
        return "instructor"

    def get_courses(self) -> List[str]:
        return self.course_names
