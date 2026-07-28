"""
Shared pytest fixtures.

We spin up an in-memory SQLite database for every test session so no
real PostgreSQL instance is needed.  The DATABASE_URL env-var must be
set *before* the app modules are imported (session.py raises at import
time otherwise), so we patch it here at collection time.
"""
import os
import pytest

# ── patch env before any app import ──────────────────────────────────────────
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("CLERK_SECRET_KEY", "sk_test_dummy")

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from src.db.models import Base
from src.db.session import get_db
from main import app

from starlette.testclient import TestClient


# ── per-test SQLite engine ────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def engine():
    """Single in-memory SQLite engine shared across the whole test session."""
    _engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )

    # Enable FK enforcement in SQLite (off by default) so tests mirror
    # PostgreSQL production behaviour for invalid foreign-key references.
    @event.listens_for(_engine, "connect")
    def _set_sqlite_pragma(conn, _rec):
        conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(_engine)
    yield _engine
    _engine.dispose()


@pytest.fixture()
def db_session(engine):
    """Fresh transactional session per test; rolled back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    TestingSession = sessionmaker(bind=connection)
    session = TestingSession()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db_session):
    """FastAPI TestClient with get_db overridden to use the test session."""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass  # rollback handled by db_session fixture

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── convenience factories ─────────────────────────────────────────────────────

@pytest.fixture()
def seed_course(client):
    """Create and return a minimal course via the API."""
    r = client.post("/api/courses", json={
        "code": "TEST-101",
        "name": "Test Course",
        "credits": 3,
        "semester": "2025-2",
        "instructor": "Dr. Test",
        "grading_scheme": "weighted",
    })
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture()
def seed_student(client):
    """Create and return a minimal student via the API."""
    r = client.post("/api/students", json={
        "student_id": "S-TEST-001",
        "name": "Alice Test",
        "email": "alice.test@example.com",
        "year": 2,
        "major": "Computer Science",
    })
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture()
def seed_assignment(client, seed_course):
    """Create and return an assignment belonging to seed_course."""
    r = client.post("/api/assignments", json={
        "course_id": seed_course["id"],
        "name": "Homework 1",
        "type": "homework",
        "max_score": 100,
        "weight": 0.30,
    })
    assert r.status_code == 201, r.text
    return r.json()
