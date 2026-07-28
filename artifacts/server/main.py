"""FastAPI entry-point for the University Grade Tracker API."""
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from src.auth.clerk import _NoStudentException

from src.routes.students import router as students_router
from src.routes.courses import router as courses_router
from src.routes.enrollments import router as enrollments_router
from src.routes.assignments import router as assignments_router
from src.routes.grades import router as grades_router
from src.routes.analytics import router as analytics_router
from src.routes.predictions import router as predictions_router
from src.routes.dashboard import router as dashboard_router
from src.routes.me import router as me_router
from src.routes.import_export import router as import_export_router
from src.routes.reports import router as reports_router
from src.routes.sessions import router as sessions_router

app = FastAPI(title="University Grade Tracker API", version="2.0.0")


@app.exception_handler(_NoStudentException)
async def no_student_handler(request: Request, exc: _NoStudentException):
    """Return a flat 403 body so the frontend hook can read body.isAdmin directly."""
    return JSONResponse(status_code=403, content={"isAdmin": True})


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    """Return 422 for FK / unique-constraint violations instead of a bare 500."""
    return JSONResponse(
        status_code=422,
        content={"detail": "Database integrity error — check foreign keys and unique constraints."},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers under /api
prefix = "/api"
app.include_router(students_router, prefix=prefix)
app.include_router(courses_router, prefix=prefix)
app.include_router(enrollments_router, prefix=prefix)
app.include_router(assignments_router, prefix=prefix)
app.include_router(grades_router, prefix=prefix)
app.include_router(analytics_router, prefix=prefix)
app.include_router(predictions_router, prefix=prefix)
app.include_router(dashboard_router, prefix=prefix)
app.include_router(me_router, prefix=prefix)
app.include_router(import_export_router, prefix=prefix)
app.include_router(reports_router, prefix=prefix)
app.include_router(sessions_router, prefix=prefix)


@app.get("/api/healthz")
def healthz():
    return {"status": "ok", "runtime": "python/fastapi"}
