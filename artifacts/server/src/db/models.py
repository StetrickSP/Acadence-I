"""SQLAlchemy ORM models matching the existing PostgreSQL schema."""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Numeric, Text, ForeignKey, TIMESTAMP
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class StudentRow(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    email = Column(Text, nullable=False, unique=True)
    student_id = Column("student_id", Text, nullable=False, unique=True)
    year = Column(Integer, nullable=False)
    major = Column(Text, nullable=False)
    clerk_user_id = Column("clerk_user_id", Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)

    enrollments = relationship("EnrollmentRow", back_populates="student")
    grades = relationship("GradeRow", back_populates="student")


class CourseRow(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True)
    code = Column(Text, nullable=False, unique=True)
    name = Column(Text, nullable=False)
    credits = Column(Integer, nullable=False)
    semester = Column(Text, nullable=False)
    instructor = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    grading_scheme = Column("grading_scheme", Text, nullable=True, default="weighted")
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)

    enrollments = relationship("EnrollmentRow", back_populates="course")
    assignments = relationship("AssignmentRow", back_populates="course")


class EnrollmentRow(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True)
    student_id = Column("student_id", Integer, ForeignKey("students.id"), nullable=False)
    course_id = Column("course_id", Integer, ForeignKey("courses.id"), nullable=False)
    semester = Column(Text, nullable=False)
    enrolled_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)

    student = relationship("StudentRow", back_populates="enrollments")
    course = relationship("CourseRow", back_populates="enrollments")


class AssignmentRow(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True)
    course_id = Column("course_id", Integer, ForeignKey("courses.id"), nullable=False)
    name = Column(Text, nullable=False)
    type = Column(Text, nullable=False)
    max_score = Column("max_score", Numeric, nullable=False)
    weight = Column(Numeric, nullable=False)
    due_date = Column("due_date", Text, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)

    course = relationship("CourseRow", back_populates="assignments")
    grades = relationship("GradeRow", back_populates="assignment")


class GradeRow(Base):
    __tablename__ = "grades"

    id = Column(Integer, primary_key=True)
    student_id = Column("student_id", Integer, ForeignKey("students.id"), nullable=False)
    assignment_id = Column("assignment_id", Integer, ForeignKey("assignments.id"), nullable=False)
    score = Column(Numeric, nullable=False)
    feedback = Column(Text, nullable=True)
    submitted_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)

    student = relationship("StudentRow", back_populates="grades")
    assignment = relationship("AssignmentRow", back_populates="grades")
