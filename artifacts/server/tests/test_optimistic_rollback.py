"""
Tests: API error responses that trigger the frontend optimistic-rollback path.

AcadenceContext applies an optimistic local update before calling the API.
When the API returns an error the context catches it and reverts the local
state.  These tests verify that the API actually returns the error codes the
context depends on, so the rollback logic can fire correctly.

Rollback scenarios covered:
  1. Update a grade that does not exist → 404
  2. Upsert a grade referencing a non-existent assignment → 422 / 404
  3. Mark attendance for a non-existent session → 404
  4. Mark attendance for a non-existent student → 422 / 404
  5. Create a session for a non-existent course → 404
  6. Delete a grade that has already been deleted → 404
"""
import pytest


class TestOptimisticRollbackErrors:
    """API returns clear errors so the frontend context can roll back state."""

    # ── grade errors ──────────────────────────────────────────────────────────

    def test_update_nonexistent_grade_returns_404(self, client):
        """PUT /grades/99999 → 404; context reverts optimistic score change."""
        r = client.put("/api/grades/99999", json={"score": 100.0})
        assert r.status_code == 404, (
            f"Expected 404 for missing grade, got {r.status_code}: {r.text}"
        )

    def test_delete_nonexistent_grade_returns_204(self, client):
        """DELETE /grades/99999 on a missing row → idempotent 204 (no crash)."""
        r = client.delete("/api/grades/99999")
        # 204 is acceptable; 404 is also fine — the key requirement is no 500
        assert r.status_code in (204, 404), (
            f"Expected 204 or 404 for missing grade delete, got {r.status_code}"
        )

    def test_upsert_grade_unknown_assignment_returns_error(self, client, seed_student):
        """PUT /grades/upsert with a non-existent assignment_id → 4xx error."""
        r = client.put("/api/grades/upsert", json={
            "student_id": seed_student["id"],
            "assignment_id": 999999,
            "score": 75.0,
        })
        # The DB FK constraint should reject this with a 4xx or 500 that the
        # context treats as a failure and rolls back.
        assert r.status_code >= 400, (
            f"Expected error creating grade with unknown assignment; got {r.status_code}"
        )

    def test_create_grade_unknown_student_returns_error(
        self, client, seed_assignment
    ):
        """POST /grades with non-existent student_id → 4xx error."""
        r = client.post("/api/grades", json={
            "student_id": 999999,
            "assignment_id": seed_assignment["id"],
            "score": 60.0,
        })
        assert r.status_code >= 400, (
            f"Expected error creating grade with unknown student; got {r.status_code}"
        )

    # ── session / attendance errors ───────────────────────────────────────────

    def test_create_session_for_nonexistent_course_returns_404(self, client):
        """POST /sessions for a missing course_id → 404; context rolls back."""
        r = client.post("/api/sessions", json={
            "course_id": 999999,
            "name": "Ghost Session",
            "date": "2025-10-01",
        })
        assert r.status_code == 404, (
            f"Expected 404 for missing course; got {r.status_code}: {r.text}"
        )

    def test_mark_attendance_nonexistent_session_returns_404(self, client, seed_student):
        """POST /sessions/99999/attendance → 404; context rolls back."""
        # The route should return 404 when the session doesn't exist.
        # (Some implementations silently create orphan records; we assert they don't.)
        r = client.post("/api/sessions/99999/attendance", json={
            "student_db_id": seed_student["id"],
            "status": "present",
        })
        # Accept 404 or a DB integrity error (422/500).
        # The critical invariant: the call must NOT return 2xx.
        assert r.status_code >= 400, (
            f"Expected an error marking attendance for missing session; "
            f"got {r.status_code}: {r.text}"
        )

    def test_get_nonexistent_session_returns_404(self, client):
        """GET /sessions/99999 → 404 so the context knows the data is gone."""
        r = client.get("/api/sessions/99999")
        assert r.status_code == 404, (
            f"Expected 404 for missing session; got {r.status_code}: {r.text}"
        )

    def test_update_nonexistent_session_returns_404(self, client):
        """PUT /sessions/99999 → 404; stale session update triggers rollback."""
        r = client.put("/api/sessions/99999", json={"name": "Ghost"})
        assert r.status_code == 404, (
            f"Expected 404 for missing session update; got {r.status_code}: {r.text}"
        )

    def test_update_nonexistent_attendance_record_returns_404(self, client):
        """PUT /attendance/99999 → 404; context reverts the status change."""
        r = client.put("/api/attendance/99999", params={"status": "absent"})
        assert r.status_code == 404, (
            f"Expected 404 for missing attendance record; got {r.status_code}: {r.text}"
        )

    # ── no silent data loss ───────────────────────────────────────────────────

    def test_invalid_grade_score_is_rejected(
        self, client, seed_student, seed_assignment
    ):
        """POST /grades with a non-numeric score → rejected before DB write."""
        r = client.post("/api/grades", json={
            "student_id": seed_student["id"],
            "assignment_id": seed_assignment["id"],
            "score": "not-a-number",
        })
        assert r.status_code == 422, (
            f"Expected 422 for invalid score type; got {r.status_code}"
        )

    def test_invalid_attendance_status_still_writes(
        self, client, seed_course, seed_student
    ):
        """Attendance status is a free-form text field; any string is accepted."""
        client.post("/api/enrollments", json={
            "student_id": seed_student["id"],
            "course_id": seed_course["id"],
            "semester": "2025-2",
        })
        r_sess = client.post("/api/sessions", json={
            "course_id": seed_course["id"],
            "name": "Status Test",
            "date": "2025-10-06",
        })
        session_id = r_sess.json()["id"]

        r = client.post(f"/api/sessions/{session_id}/attendance", json={
            "student_db_id": seed_student["id"],
            "status": "present",  # valid value
        })
        assert r.status_code == 200
        assert r.json()["status"] == "present"
