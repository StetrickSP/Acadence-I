"""Import / Export routes.

POST /api/import/grades     — upload a single grade CSV
GET  /api/export/grades     — download grades as CSV
GET  /api/export/report     — download course report as JSON
POST /api/import/batch      — upload multiple CSVs concurrently
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
import io

from src.db.session import get_db, SessionLocal
from src.services.file_io import FileIOService
from sqlalchemy.orm import Session

router = APIRouter()
_svc = FileIOService()


# ---------------------------------------------------------------------------
# POST /api/import/grades
# ---------------------------------------------------------------------------

@router.post("/import/grades")
async def import_grades(
    file: UploadFile = File(..., description="CSV file with columns: student_id, assignment_name, score[, type]"),
    course_id: int = Form(..., description="Course ID these grades belong to"),
    db: Session = Depends(get_db),
):
    """Import grades from a CSV file into a specific course.

    Rows are upserted: existing (student, assignment) entries are updated
    rather than duplicated.  Invalid rows are reported in the `errors` list.
    """
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    result = _svc.parse_grade_csv(content, course_id, db)
    return result.to_dict()


# ---------------------------------------------------------------------------
# GET /api/export/grades
# ---------------------------------------------------------------------------

@router.get("/export/grades")
def export_grades_csv(
    course_id: Optional[int] = Query(None, description="Filter by course ID (omit for all courses)"),
    db: Session = Depends(get_db),
):
    """Stream all grade data as a downloadable CSV file."""
    csv_text = _svc.export_grades_csv(course_id, db)
    filename = f"grades_course_{course_id}.csv" if course_id else "grades_all.csv"

    return StreamingResponse(
        io.BytesIO(csv_text.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ---------------------------------------------------------------------------
# GET /api/export/report
# ---------------------------------------------------------------------------

@router.get("/export/report")
def export_report_json(
    course_id: int = Query(..., description="Course to generate the report for"),
    db: Session = Depends(get_db),
):
    """Return a structured JSON report: summary stats, grade distribution,
    per-student breakdown with GPA impact, and at-risk list."""
    report = _svc.export_report_json(course_id, db)
    if "error" in report:
        raise HTTPException(status_code=404, detail=report["error"])
    return report


# ---------------------------------------------------------------------------
# POST /api/import/batch
# ---------------------------------------------------------------------------

@router.post("/import/batch")
async def batch_import_grades(
    files: List[UploadFile] = File(..., description="One or more CSV files (field name: files)"),
    course_ids: str = Form(..., description="Comma-separated course IDs matching each file in order"),
):
    """Process multiple grade CSV files concurrently (ThreadPoolExecutor, max 4 workers).

    Each file is processed independently — a failure in one file does not
    abort the others.  Returns a per-file result array.

    `course_ids` is a comma-separated list matching the order of `files`.
    Example: if you upload 3 files for courses 1, 2, 3 → course_ids="1,2,3"
    """
    cid_list_str = [s.strip() for s in course_ids.split(",")]

    if len(cid_list_str) != len(files):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Number of course_ids ({len(cid_list_str)}) must match "
                f"number of files ({len(files)})"
            ),
        )

    try:
        parsed_ids = [int(c) for c in cid_list_str]
    except ValueError:
        raise HTTPException(status_code=400, detail="course_ids must be integers")

    # Read all file bytes before spawning threads (UploadFile is not thread-safe).
    # Empty files become per-file fatal_error entries — they do NOT abort the whole batch.
    from src.services.file_io import BatchFileResult as _BFR

    all_items: list[tuple[int, str, bytes | None, int]] = []
    for idx, (uf, cid) in enumerate(zip(files, parsed_ids)):
        content = await uf.read()
        filename = uf.filename or f"file_{idx}.csv"
        all_items.append((idx, filename, content if content else None, cid))

    # Split into work items (non-empty) and immediate per-file fatal results (empty)
    work_items: list[tuple[int, str, bytes, int]] = []
    immediate_errors: list[_BFR] = []
    for idx, filename, content, cid in all_items:
        if content is None:
            immediate_errors.append(
                _BFR(pos_index=idx, filename=filename, course_id=cid, fatal_error="File is empty")
            )
        else:
            work_items.append((idx, filename, content, cid))

    processed = _svc.batch_import(work_items, db_factory=SessionLocal) if work_items else []

    # Merge and sort by original submission index for stable, position-based ordering
    all_results = sorted([*immediate_errors, *processed], key=lambda r: r.pos_index)
    return [r.to_dict() for r in all_results]
