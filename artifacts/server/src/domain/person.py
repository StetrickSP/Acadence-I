"""Abstract Person class — SP1 OOP domain model."""
from abc import ABC, abstractmethod


class Person(ABC):
    """Abstract base class for all people in the system."""

    def __init__(self, id: int, name: str, email: str):
        self.id = id
        self.name = name
        self.email = email

    @abstractmethod
    def get_role(self) -> str:
        """Return the role string for this person."""
        ...
