"""
Tests: attendance sessions and records persist to the DB and survive a
simulated server restart.

"Server restart" is modelled the same way as in test_grade_persistence: a
brand-new SQLAlchemy session is opened against the same engine after the
writing session commits.
"""
import pytest
from sqlalchemy.orm import sessionmaker

from src.db.models import SessionRow, AttendanceRecordRow


# ── helpers ───────────────────────────────────────────────────────────────────

def fresh_session(engine):
    S = sessionmaker(bind=engine)
    return S()


# ── tests ─────────────────────────────────────────────────────────────────────

class TestSessionPersistence:
    """Attendance sessions survive after the DB session is recycled."""

    def test_create_session_persists(self, client, engine, seed_course):
        """POST /sessions → session row is present in a fresh session."""
        course = seed_course

        r = client.post("/api/sessions", json={
            "course_id": course["id"],
            "name": "Week 1 Lecture",
            "date": "2025-09-01",
            "time_slot": "09:00-10:30",
        })
        assert r.status_code == 201, r.text
        session_id = r.json()["id"]

        new_db = fresh_session(engine)
        try:
            row = new_db.query(SessionRow).filter(SessionRow.id == session_id).first()
            assert row is not None, "Session not found after simulated restart"
            assert row.name == "Week 1 Lecture"
            assert row.date == "2025-09-01"
            assert row.time_slot == "09:00-10:30"
        finally:
            new_db.close()

    def test_attendance_record_persists(
        self, client, engine, seed_course, seed_student
    ):
        """POST /sessions/{id}/attendance → record survives a fresh session."""
        course = seed_course
        student = seed_student

        # Enrol student
        client.post("/api/enrollments", json={
            "student_id": student["id"],
            "course_id": course["id"],
            "semester": "2025-2",
        })

        # Create session
        r = client.post("/api/sessions", json={
            "course_id": course["id"],
            "name": "Week 2 Lecture",
            "date": "2025-09-08",
        })
        assert r.status_code == 201
        session_id = r.json()["id"]

        # Mark attendance
        r2 = client.post(f"/api/sessions/{session_id}/attendance", json={
            "student_db_id": student["id"],
            "status": "present",
        })
        assert r2.status_code == 200, r2.text
        record_id = r2.json()["id"]

        # Verify in a fresh session
        new_db = fresh_session(engine)
        try:
            rec = new_db.query(AttendanceRecordRow).filter(
                AttendanceRecordRow.id == record_id
            ).first()
            assert rec is not None, "Attendance record not found after simulated restart"
            assert rec.status == "present"
            assert rec.session_id == session_id
            assert rec.student_id == student["id"]
        finally:
            new_db.close()

    def test_update_attendance_persists(
        self, client, engine, seed_course, seed_student
    ):
        """Updating attendance status from absent → present is committed."""
        course = seed_course
        student = seed_student

        client.post("/api/enrollments", json={
            "student_id": student["id"],
            "course_id": course["id"],
            "semester": "2025-2",
        })

        r = client.post("/api/sessions", json={
            "course_id": course["id"],
            "name": "Week 3 Lecture",
            "date": "2025-09-15",
        })
        session_id = r.json()["id"]

        # Mark absent first
        r2 = client.post(f"/api/sessions/{session_id}/attendance", json={
            "student_db_id": student["id"],
            "status": "absent",
        })
        record_id = r2.json()["id"]

        # Upsert → present
        r3 = client.post(f"/api/sessions/{session_id}/attendance", json={
            "student_db_id": student["id"],
            "status": "present",
        })
        assert r3.status_code == 200, r3.text
        assert r3.json()["status"] == "present"

        # Verify updated value in fresh session
        new_db = fresh_session(engine)
        try:
            rec = new_db.query(AttendanceRecordRow).filter(
                AttendanceRecordRow.id == record_id
            ).first()
            assert rec is not None
            assert rec.status == "present", (
                f"Expected 'present' after upsert, got '{rec.status}'"
            )
        finally:
            new_db.close()

    def test_multiple_attendance_records_all_persist(
        self, client, engine, seed_course
    ):
        """All records for a session survive when multiple students are marked."""
        course = seed_course

        # Create two students
        s1 = client.post("/api/students", json={
            "student_id": "MULTI-S1",
            "name": "Bob Multi",
            "email": "bob.multi@example.com",
            "year": 1,
            "major": "Math",
        }).json()
        s2 = client.post("/api/students", json={
            "student_id": "MULTI-S2",
            "name": "Carol Multi",
            "email": "carol.multi@example.com",
            "year": 1,
            "major": "Math",
        }).json()

        for sid in (s1["id"], s2["id"]):
            client.post("/api/enrollments", json={
                "student_id": sid,
                "course_id": course["id"],
                "semester": "2025-2",
            })

        # Create session
        r = client.post("/api/sessions", json={
            "course_id": course["id"],
            "name": "Multi-student Session",
            "date": "2025-09-22",
        })
        session_id = r.json()["id"]

        # Mark both
        for sid, status in ((s1["id"], "present"), (s2["id"], "late")):
            client.post(f"/api/sessions/{session_id}/attendance", json={
                "student_db_id": sid,
                "status": status,
            })

        # Verify both records in a fresh session
        new_db = fresh_session(engine)
        try:
            records = (
                new_db.query(AttendanceRecordRow)
                .filter(AttendanceRecordRow.session_id == session_id)
                .all()
            )
            assert len(records) == 2
            statuses = {r.student_id: r.status for r in records}
            assert statuses[s1["id"]] == "present"
            assert statuses[s2["id"]] == "late"
        finally:
            new_db.close()

    def test_get_session_returns_attendance_after_mark(
        self, client, seed_course, seed_student
    ):
        """GET /sessions/{id} returns attendance records in its payload."""
        course = seed_course
        student = seed_student

        client.post("/api/enrollments", json={
            "student_id": student["id"],
            "course_id": course["id"],
            "semester": "2025-2",
        })

        r = client.post("/api/sessions", json={
            "course_id": course["id"],
            "name": "Read-back Session",
            "date": "2025-09-29",
        })
        session_id = r.json()["id"]

        client.post(f"/api/sessions/{session_id}/attendance", json={
            "student_db_id": student["id"],
            "status": "excused",
        })

        # Re-fetch the session and check embedded attendance
        r2 = client.get(f"/api/sessions/{session_id}")
        assert r2.status_code == 200
        data = r2.json()
        assert len(data["attendance"]) == 1
        assert data["attendance"][0]["status"] == "excused"
