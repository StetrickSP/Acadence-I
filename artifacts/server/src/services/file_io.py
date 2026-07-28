"""FileIOService — CSV import/export and JSON report generation.

CSV format (import):
  Required columns : student_id, assignment_name, score
  Optional columns : type  (midterm | final | assignment)
                     course_id  (used by batch import; overrides the per-request course_id)
  Rows are upserted: existing (student, assignment) grade is updated, not duplicated.

Thread safety:
  batch_import() creates a fresh SQLAlchemy Session per thread via the provided
  db_factory callable. No Session is shared across threads.
"""
from __future__ import annotations

import csv
import io
import logging
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from sqlalchemy.orm import Session

from src.db.models import StudentRow, CourseRow, AssignmentRow, GradeRow, EnrollmentRow
from src.domain.grade_utils import to_percent, score_to_letter, letter_to_points, risk_level
from src.domain.student import Student
from src.domain.grade_book import AssignmentScore

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class RowError:
    row: int
    message: str

    def to_dict(self) -> dict:
        return {"row": self.row, "message": self.message}


@dataclass
class ParseResult:
    imported: int = 0   # new grade rows inserted
    updated: int = 0    # existing grade rows upserted
    skipped: int = 0    # rows skipped due to validation errors
    errors: list[RowError] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "imported": self.imported,
            "updated": self.updated,
            "skipped": self.skipped,
            "errors": [e.to_dict() for e in self.errors],
        }


@dataclass
class BatchFileResult:
    pos_index: int          # original submission order (0-based); used for stable sort
    filename: str
    course_id: Optional[int]
    imported: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[RowError] = field(default_factory=list)
    fatal_error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "filename": self.filename,
            "course_id": self.course_id,
            "imported": self.imported,
            "updated": self.updated,
            "skipped": self.skipped,
            "errors": [e.to_dict() for e in self.errors],
            "fatal_error": self.fatal_error,
        }


# ---------------------------------------------------------------------------
# Required / allowed CSV columns
# ---------------------------------------------------------------------------

REQUIRED_COLS = {"student_id", "assignment_name", "score"}
ALLOWED_TYPES = {"midterm", "final", "assignment", "quiz", "homework", "project", "exam"}


# ---------------------------------------------------------------------------
# FileIOService
# ---------------------------------------------------------------------------

class FileIOService:
    """Encapsulates all file I/O operations for the grade tracker."""

    # ------------------------------------------------------------------
    # CSV Import
    # ------------------------------------------------------------------

    def parse_grade_csv(
        self,
        file_bytes: bytes,
        course_id: int,
        db: Session,
        *,
        thread_name: str = "main",
    ) -> ParseResult:
        """Parse a grade CSV, validate every row, and upsert valid rows.

        Parameters
        ----------
        file_bytes : bytes
            Raw bytes of the uploaded CSV file.
        course_id : int
            The course these grades belong to; used to resolve assignment names.
        db : Session
            An open SQLAlchemy session (caller manages lifecycle).
        thread_name : str
            For logging; identifies which thread handled this file in batch mode.
        """
        result = ParseResult()
        logger.info("[%s] Starting CSV import for course_id=%s", thread_name, course_id)

        try:
            text = file_bytes.decode("utf-8-sig")  # strip BOM if present
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1")

        # ── Header detection ──────────────────────────────────────────────
        # Peek at the first row with csv.reader to decide whether a header
        # is present.  If the first row does NOT contain the required column
        # names but has exactly 3 or 4 fields we treat the file as headerless
        # and inject the canonical positional header before re-parsing.
        first_line_io = io.StringIO(text)
        sniffer = csv.reader(first_line_io)
        try:
            first_row = next(sniffer)
        except StopIteration:
            result.errors.append(RowError(0, "CSV file is empty"))
            return result

        first_row_lower = {cell.strip().lower() for cell in first_row}
        has_header = bool(REQUIRED_COLS & first_row_lower)

        if not has_header:
            col_count = len(first_row)
            if col_count == 3:
                synthetic_header = "student_id,assignment_name,score\n"
            elif col_count == 4:
                synthetic_header = "student_id,assignment_name,score,type\n"
            else:
                result.errors.append(RowError(
                    0,
                    "CSV has no recognisable header row. "
                    "Add a first row: student_id,assignment_name,score,type",
                ))
                return result
            text = synthetic_header + text

        reader = csv.DictReader(io.StringIO(text))

        # Validate headers (covers edge-cases like a header row with wrong names)
        if not reader.fieldnames:
            result.errors.append(RowError(0, "CSV file is empty or has no header row"))
            return result

        headers = {h.strip().lower() for h in reader.fieldnames}
        missing = REQUIRED_COLS - headers
        if missing:
            result.errors.append(RowError(
                0,
                f"Missing required columns: {', '.join(sorted(missing))}. "
                "Expected header row: student_id,assignment_name,score,type",
            ))
            return result

        # Build lookup caches for this course
        assignments_by_name: dict[str, AssignmentRow] = {
            a.name.strip().lower(): a
            for a in db.query(AssignmentRow).filter(AssignmentRow.course_id == course_id).all()
        }
        students_by_sid: dict[str, StudentRow] = {
            s.student_id.strip().upper(): s
            for s in db.query(StudentRow).all()
        }

        for row_num, raw_row in enumerate(reader, start=2):
            # Normalise keys
            row = {k.strip().lower(): (v or "").strip() for k, v in raw_row.items()}
            errors_before = len(result.errors)

            # --- Validate required fields ---
            sid = row.get("student_id", "").upper()
            asgn_name = row.get("assignment_name", "")
            score_str = row.get("score", "")
            row_type = row.get("type", "").lower() or None

            if not sid:
                result.errors.append(RowError(row_num, "student_id is blank"))
                result.skipped += 1
                continue
            if not asgn_name:
                result.errors.append(RowError(row_num, "assignment_name is blank"))
                result.skipped += 1
                continue
            if not score_str:
                result.errors.append(RowError(row_num, "score is blank"))
                result.skipped += 1
                continue

            # --- Validate score is numeric and in range ---
            try:
                score = float(score_str)
            except ValueError:
                result.errors.append(RowError(row_num, f"score '{score_str}' is not a number"))
                result.skipped += 1
                continue
            if score < 0:
                result.errors.append(RowError(row_num, f"score {score} is negative"))
                result.skipped += 1
                continue

            # --- Validate type if provided ---
            if row_type and row_type not in ALLOWED_TYPES:
                result.errors.append(RowError(row_num, f"type '{row_type}' not in {sorted(ALLOWED_TYPES)}"))
                result.skipped += 1
                continue

            # --- Resolve student ---
            student = students_by_sid.get(sid)
            if not student:
                result.errors.append(RowError(row_num, f"No student with student_id '{sid}'"))
                result.skipped += 1
                continue

            # --- Resolve assignment ---
            assignment = assignments_by_name.get(asgn_name.strip().lower())
            if not assignment:
                result.errors.append(RowError(row_num, f"No assignment named '{asgn_name}' in this course"))
                result.skipped += 1
                continue

            # --- Validate score does not exceed max_score ---
            max_score = float(assignment.max_score)
            if score > max_score:
                result.errors.append(RowError(
                    row_num,
                    f"score {score} exceeds max_score {max_score} for '{asgn_name}'"
                ))
                result.skipped += 1
                continue

            # --- Upsert grade ---
            existing = db.query(GradeRow).filter(
                GradeRow.student_id == student.id,
                GradeRow.assignment_id == assignment.id,
            ).first()

            if existing:
                existing.score = str(score)
                result.updated += 1   # upserted — existing row refreshed
            else:
                db.add(GradeRow(
                    student_id=student.id,
                    assignment_id=assignment.id,
                    score=str(score),
                ))
                result.imported += 1

        try:
            db.commit()
        except Exception as exc:
            db.rollback()
            result.errors.append(RowError(0, f"Database commit failed: {exc}"))

        logger.info(
            "[%s] CSV import done: imported=%d skipped=%d errors=%d",
            thread_name, result.imported, result.skipped, len(result.errors),
        )
        return result

    # ------------------------------------------------------------------
    # CSV Export
    # ------------------------------------------------------------------

    def export_grades_csv(self, course_id: Optional[int], db: Session) -> str:
        """Return a CSV string of all grades (optionally filtered by course).

        Columns: student_id, student_name, course_code, course_name,
                 assignment_name, assignment_type, score, max_score,
                 percentage, letter_grade
        """
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "student_id", "student_name", "course_code", "course_name",
            "assignment_name", "assignment_type", "score", "max_score",
            "percentage", "letter_grade",
        ])

        q = (
            db.query(GradeRow, StudentRow, AssignmentRow, CourseRow)
            .join(StudentRow, GradeRow.student_id == StudentRow.id)
            .join(AssignmentRow, GradeRow.assignment_id == AssignmentRow.id)
            .join(CourseRow, AssignmentRow.course_id == CourseRow.id)
        )
        if course_id is not None:
            q = q.filter(CourseRow.id == course_id)
        q = q.order_by(CourseRow.code, StudentRow.name, AssignmentRow.name)

        for grade, student, asgn, course in q.all():
            score = float(grade.score)
            max_s = float(asgn.max_score)
            pct = round(to_percent(score, max_s) * 10) / 10 if max_s > 0 else 0.0
            writer.writerow([
                student.student_id,
                student.name,
                course.code,
                course.name,
                asgn.name,
                asgn.type,
                score,
                max_s,
                pct,
                score_to_letter(pct),
            ])

        return buf.getvalue()

    # ------------------------------------------------------------------
    # JSON Report Export
    # ------------------------------------------------------------------

    def export_report_json(self, course_id: int, db: Session) -> dict[str, Any]:
        """Build a structured JSON report for a course using GradeBook domain classes."""
        course = db.query(CourseRow).filter(CourseRow.id == course_id).first()
        if not course:
            return {"error": f"Course {course_id} not found"}

        enrollments = db.query(EnrollmentRow).filter(EnrollmentRow.course_id == course_id).all()
        assignments = db.query(AssignmentRow).filter(AssignmentRow.course_id == course_id).all()
        scheme = course.grading_scheme or "weighted"

        student_rows = []
        all_pcts: list[float] = []

        for enr in enrollments:
            student = db.query(StudentRow).filter(StudentRow.id == enr.student_id).first()
            if not student:
                continue

            scores: list[AssignmentScore] = []
            for asgn in assignments:
                grade = db.query(GradeRow).filter(
                    GradeRow.student_id == student.id,
                    GradeRow.assignment_id == asgn.id,
                ).first()
                if grade:
                    scores.append(AssignmentScore(
                        assignment_id=asgn.id,
                        score=float(grade.score),
                        max_score=float(asgn.max_score),
                        weight=float(asgn.weight),
                        name=asgn.name,
                        type=asgn.type,
                    ))

            gi = Student.compute_course_grade(
                scores, course.id, course.name, course.code,
                course.credits, enr.semester, scheme,
            )

            pct = gi.percentage
            if pct is not None:
                all_pcts.append(pct)

            gp = gi.grade_points or 0.0
            gpa_impact = round(gp * course.credits, 2) if gi.letter_grade else None

            student_rows.append({
                "student_id": student.student_id,
                "student_name": student.name,
                "major": student.major,
                "year": student.year,
                "current_grade": pct,
                "letter_grade": gi.letter_grade,
                "display_label": gi.display_label,
                "grade_points": gp,
                "gpa_impact_points": gpa_impact,
                "assignments_submitted": len(scores),
                "assignments_total": len(assignments),
                "risk_level": risk_level(pct) if pct is not None else "high",
                "at_risk": (pct is not None and pct < 70) or pct is None,
            })

        # Summary statistics
        n = len(all_pcts)
        avg = sum(all_pcts) / n if n else 0.0
        sorted_pcts = sorted(all_pcts)
        median = (
            (sorted_pcts[n // 2 - 1] + sorted_pcts[n // 2]) / 2
            if n >= 2 and n % 2 == 0
            else sorted_pcts[n // 2] if n
            else 0.0
        )
        variance = sum((p - avg) ** 2 for p in all_pcts) / n if n else 0.0
        passing = sum(1 for p in all_pcts if p >= 60)

        # Grade distribution buckets
        letter_map: dict[str, int] = {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
        for p in all_pcts:
            letter_map[score_to_letter(p)] += 1

        return {
            "course": {
                "id": course.id,
                "code": course.code,
                "name": course.name,
                "credits": course.credits,
                "semester": course.semester,
                "instructor": course.instructor,
                "grading_scheme": scheme,
            },
            "summary": {
                "total_students": len(enrollments),
                "students_graded": n,
                "average_grade": round(avg * 10) / 10,
                "median_grade": round(median * 10) / 10,
                "std_deviation": round(math.sqrt(variance) * 10) / 10,
                "highest_grade": round(sorted_pcts[-1] * 10) / 10 if sorted_pcts else None,
                "lowest_grade": round(sorted_pcts[0] * 10) / 10 if sorted_pcts else None,
                "pass_rate": round((passing / n) * 1000) / 10 if n else 0.0,
                "fail_rate": round(((n - passing) / n) * 1000) / 10 if n else 0.0,
                "at_risk_count": sum(1 for s in student_rows if s["at_risk"]),
            },
            "grade_distribution": [
                {
                    "letter": letter,
                    "count": cnt,
                    "percentage": round((cnt / n) * 1000) / 10 if n else 0.0,
                }
                for letter, cnt in letter_map.items()
            ],
            "students": sorted(student_rows, key=lambda s: (s["current_grade"] or 0), reverse=True),
        }

    # ------------------------------------------------------------------
    # Batch Import
    # ------------------------------------------------------------------

    def batch_import(
        self,
        files: list[tuple[int, str, bytes, int]],
        db_factory: Callable[[], Session],
    ) -> list[BatchFileResult]:
        """Process multiple CSV files concurrently with ThreadPoolExecutor.

        Parameters
        ----------
        files : list of (pos_index, filename, file_bytes, course_id)
            pos_index is the 0-based submission order and is used to restore
            original order in the response regardless of completion order or
            duplicate filenames.
        db_factory : callable that returns a fresh SQLAlchemy Session
            Each thread creates its own session; no Session is shared.
        """
        def _process_one(item: tuple[int, str, bytes, int]) -> BatchFileResult:
            pos_index, filename, file_bytes, course_id = item
            thread_name = f"worker-{pos_index}"
            result = BatchFileResult(pos_index=pos_index, filename=filename, course_id=course_id)
            db = db_factory()
            try:
                parse = self.parse_grade_csv(file_bytes, course_id, db, thread_name=thread_name)
                result.imported = parse.imported
                result.updated = parse.updated
                result.skipped = parse.skipped
                result.errors = parse.errors
            except Exception as exc:
                result.fatal_error = str(exc)
                logger.exception("[%s] Fatal error processing '%s'", thread_name, filename)
            finally:
                db.close()
            return result

        max_workers = min(4, len(files))
        results: list[BatchFileResult] = []
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(_process_one, item): item for item in files}
            for future in as_completed(futures):
                results.append(future.result())

        # Sort by original submission order (pos_index), not by completion order
        results.sort(key=lambda r: r.pos_index)
        return results
