"""Shared ownership helpers — ensure the caller owns a course before mutating it."""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.db.models import CourseRow


def get_owned_course(db: Session, course_id: int, clerk_user_id: str) -> CourseRow:
    """Return the CourseRow only if the caller is the owner, else raise 403/404.

    Ownership is strict — courses without an owner are NOT accessible via this
    helper.  Legacy courses must be claimed first (see GET /courses/full which
    atomically claims all unowned courses for the first instructor to load them).
    """
    c = db.query(CourseRow).filter(CourseRow.id == course_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    if c.owner_clerk_id != clerk_user_id:
        raise HTTPException(status_code=403, detail="Not your course")
    return c
