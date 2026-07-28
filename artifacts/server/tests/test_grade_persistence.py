"""
Tests: grade scores persist to the DB and survive a simulated server restart.

"Server restart" is modelled by closing the test session and opening a brand-new
one against the same engine — exactly what happens when uvicorn restarts and a
fresh SQLAlchemy session is handed to the next request.
"""
import pytest
from sqlalchemy.orm import sessionmaker

from src.db.models import GradeRow


# ── helpers ───────────────────────────────────────────────────────────────────

def fresh_session(engine):
    """Return a new session that is independent of the current test session."""
    S = sessionmaker(bind=engine)
    return S()


# ── tests ─────────────────────────────────────────────────────────────────────

class TestGradePersistence:
    """Grade rows survive after the DB session is torn down and recreated."""

    def test_create_grade_is_readable_in_new_session(
        self, client, engine, seed_course, seed_student, seed_assignment
    ):
        """POST /grades → grade row exists when queried from a fresh session."""
        course = seed_course
        student = seed_student
        assignment = seed_assignment

        # Enrol the student so FK constraints are met
        client.post("/api/enrollments", json={
            "student_id": student["id"],
            "course_id": course["id"],
            "semester": "2025-2",
        })

        # Create the grade
        r = client.post("/api/grades", json={
            "student_id": student["id"],
            "assignment_id": assignment["id"],
            "score": 87.5,
        })
        assert r.status_code == 201, r.text
        grade_id = r.json()["id"]

        # Simulate restart: open a completely new session against the same engine
        new_session = fresh_session(engine)
        try:
            row = new_session.query(GradeRow).filter(GradeRow.id == grade_id).first()
            assert row is not None, "Grade row not found after simulated restart"
            assert float(row.score) == pytest.approx(87.5)
        finally:
            new_session.close()

    def test_update_grade_persists_across_sessions(
        self, client, engine, seed_course, seed_student, seed_assignment
    ):
        """PUT /grades/upsert → updated score survives a fresh DB session."""
        course = seed_course
        student = seed_student
        assignment = seed_assignment

        client.post("/api/enrollments", json={
            "student_id": student["id"],
            "course_id": course["id"],
            "semester": "2025-2",
        })

        # Create initial grade
        r = client.post("/api/grades", json={
            "student_id": student["id"],
            "assignment_id": assignment["id"],
            "score": 50.0,
        })
        assert r.status_code == 201
        grade_id = r.json()["id"]

        # Update via upsert (same path the context uses)
        r2 = client.put("/api/grades/upsert", json={
            "student_id": student["id"],
            "assignment_id": assignment["id"],
            "score": 95.0,
        })
        assert r2.status_code == 200, r2.text
        assert r2.json()["score"] == pytest.approx(95.0)

        # Verify the updated value is present in a fresh session
        new_session = fresh_session(engine)
        try:
            row = new_session.query(GradeRow).filter(GradeRow.id == grade_id).first()
            assert row is not None
            assert float(row.score) == pytest.approx(95.0), (
                f"Expected 95.0 after update, got {row.score}"
            )
        finally:
            new_session.close()

    def test_upsert_creates_when_no_existing_grade(
        self, client, engine, seed_course, seed_student, seed_assignment
    ):
        """PUT /grades/upsert creates a new row when none exists yet."""
        course = seed_course
        student = seed_student
        assignment = seed_assignment

        client.post("/api/enrollments", json={
            "student_id": student["id"],
            "course_id": course["id"],
            "semester": "2025-2",
        })

        r = client.put("/api/grades/upsert", json={
            "student_id": student["id"],
            "assignment_id": assignment["id"],
            "score": 73.0,
        })
        assert r.status_code == 200, r.text
        grade_id = r.json()["id"]

        # Verify in a fresh session
        new_session = fresh_session(engine)
        try:
            row = new_session.query(GradeRow).filter(GradeRow.id == grade_id).first()
            assert row is not None
            assert float(row.score) == pytest.approx(73.0)
        finally:
            new_session.close()

    def test_put_grade_by_id_persists(
        self, client, engine, seed_course, seed_student, seed_assignment
    ):
        """PUT /grades/{id} with a new score → value committed to DB."""
        course = seed_course
        student = seed_student
        assignment = seed_assignment

        client.post("/api/enrollments", json={
            "student_id": student["id"],
            "course_id": course["id"],
            "semester": "2025-2",
        })

        # Create
        r = client.post("/api/grades", json={
            "student_id": student["id"],
            "assignment_id": assignment["id"],
            "score": 60.0,
        })
        assert r.status_code == 201
        grade_id = r.json()["id"]

        # Update by PK
        r2 = client.put(f"/api/grades/{grade_id}", json={"score": 82.0})
        assert r2.status_code == 200, r2.text

        new_session = fresh_session(engine)
        try:
            row = new_session.query(GradeRow).filter(GradeRow.id == grade_id).first()
            assert float(row.score) == pytest.approx(82.0)
        finally:
            new_session.close()

    def test_list_grades_reflects_persisted_data(
        self, client, seed_course, seed_student, seed_assignment
    ):
        """GET /grades returns the grade that was just committed."""
        course = seed_course
        student = seed_student
        assignment = seed_assignment

        client.post("/api/enrollments", json={
            "student_id": student["id"],
            "course_id": course["id"],
            "semester": "2025-2",
        })

        client.post("/api/grades", json={
            "student_id": student["id"],
            "assignment_id": assignment["id"],
            "score": 91.0,
        })

        r = client.get(f"/api/grades?student_id={student['id']}")
        assert r.status_code == 200
        grades = r.json()
        assert any(g["score"] == pytest.approx(91.0) for g in grades), (
            f"Expected 91.0 in returned grades; got {grades}"
        )
