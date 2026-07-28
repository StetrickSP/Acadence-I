# Acadence — System Reference

> **Audience**: developers and technical contributors.  
> For end-user instructions see [`USER_MANUAL.md`](USER_MANUAL.md).  
> For live, auto-generated API docs open `/api/docs` (Swagger UI) while the backend is running.

---

## Table of Contents

1. [SP1 — Authentication & Identity](#sp1--authentication--identity)
2. [SP2 — Student & Enrollment Management](#sp2--student--enrollment-management)
3. [SP3 — Course & Assignment Management](#sp3--course--assignment-management)
4. [SP4 — Grade Entry & Grading Schemes](#sp4--grade-entry--grading-schemes)
5. [SP5 — CSV Import / Export](#sp5--csv-import--export)
6. [SP6 — Analytics & Reporting](#sp6--analytics--reporting)
7. [SP7 — Grade Predictions & At-Risk Detection](#sp7--grade-predictions--at-risk-detection)

---

## SP1 — Authentication & Identity

### Purpose

Handles user authentication via Clerk, maps authenticated users to the correct role (instructor or student), and manages the student-account claiming flow.

### Key Files

| File | Description |
|---|---|
| `artifacts/server/src/auth/clerk.py` | Clerk JWT verification; raises `_NoStudentException` for instructor-role tokens |
| `artifacts/server/src/routes/me.py` | Student self-service endpoints (profile, claim, grades, GPA) |
| `artifacts/client/src/pages/login.tsx` | Clerk-powered sign-in page |
| `artifacts/client/src/pages/claim.tsx` | Student account claiming UI |
| `artifacts/client/src/hooks/` | `useAuth` and related hooks wrapping Clerk's React SDK |

### Design

- All backend endpoints verify the Clerk JWT on every request.
- The backend distinguishes two roles by whether the Clerk user's email maps to a `StudentRow.clerk_user_id`:
  - **Instructor** — any verified Clerk user not linked to a student record.
  - **Student** — any Clerk user whose `clerk_user_id` matches a `StudentRow`.
- When a student first logs in, they must **claim** their pre-created student account by submitting their `student_id`. This one-time link stores `clerk_user_id` on the `StudentRow`.
- The `_NoStudentException` path returns `{ "isAdmin": true }` with HTTP 403 so the frontend can redirect instructors to the faculty dashboard.

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/me/claim` | Link the authenticated Clerk user to a student record by `student_id` |
| `GET` | `/api/me/profile` | Return the current student's profile (name, email, major, year) |
| `GET` | `/api/me/courses` | List courses the student is enrolled in |
| `GET` | `/api/me/grades` | Full grade breakdown across all enrolled courses |
| `GET` | `/api/me/gpa` | Computed GPA and per-course breakdown |
| `GET` | `/api/me/predictions` | Risk levels and best-case grade projections for all courses |

### Known Limitations

- A student email must match exactly one student record; partial matches or multiple records for the same person cause claim failures.
- The `DEMO_AUTH_KEY` header bypasses Clerk verification entirely — this must never be enabled in production.

---

## SP2 — Student & Enrollment Management

### Purpose

CRUD operations for student records and the many-to-many enrollment relationship between students and courses.

### Key Files

| File | Description |
|---|---|
| `artifacts/server/src/routes/students.py` | Student CRUD + GPA and course-list endpoints |
| `artifacts/server/src/routes/enrollments.py` | Enrollment creation and deletion |
| `artifacts/server/src/db/models.py` | `StudentRow`, `EnrollmentRow` SQLAlchemy models |

### Data Models

**StudentRow**: `id`, `name`, `email`, `student_id` (university ID), `year`, `major`, `clerk_user_id` (nullable until claimed).

**EnrollmentRow**: `id`, `student_id` (FK → StudentRow), `course_id` (FK → CourseRow), `semester`.

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/students` | List all students; supports search and filter query params |
| `POST` | `/api/students` | Create a new student record |
| `POST` | `/api/students/find-or-create` | Idempotent lookup-or-create by `student_id` or email |
| `GET` | `/api/students/rankings` | Rank students within a course by computed grade |
| `GET` | `/api/students/{id}` | Retrieve a single student with GPA |
| `PUT` | `/api/students/{id}` | Update student profile fields |
| `DELETE` | `/api/students/{id}` | Delete a student record |
| `GET` | `/api/students/{id}/gpa` | GPA breakdown by course for a student |
| `GET` | `/api/students/{id}/courses` | Courses and current grades for a student |
| `GET` | `/api/enrollments` | List all enrollments (filterable by course or student) |
| `POST` | `/api/enrollments` | Enroll a student in a course (idempotent) |
| `DELETE` | `/api/enrollments/{id}` | Unenroll a student |

### Known Limitations

- Deleting a student cascades to grades and enrollments; this is irreversible.
- `find-or-create` matches on `student_id` first, then email; a mismatch between the two can create duplicate records.

---

## SP3 — Course & Assignment Management

### Purpose

CRUD for course records (code, name, semester, grading scheme) and for assignments within a course (type, weight, max score, due date).

### Key Files

| File | Description |
|---|---|
| `artifacts/server/src/routes/courses.py` | Course CRUD + roster, computed grades, stats |
| `artifacts/server/src/routes/assignments.py` | Assignment CRUD |
| `artifacts/server/src/domain/` | Grading-scheme class hierarchy (Weighted, Curved, Pass/Fail) |
| `artifacts/server/src/db/models.py` | `CourseRow`, `AssignmentRow` models |

### Grading Scheme Hierarchy

```
GradingScheme (abstract)
├── WeightedGradingScheme     — weighted average of assignment-type buckets
├── CurvedGradingScheme       — weighted average then adjusted by a curve offset
└── PassFailGradingScheme     — score ≥ threshold → Pass, else Fail
```

The scheme is stored as a string on `CourseRow.grading_scheme` and instantiated at query time.

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/courses` | List courses with student counts and class averages |
| `POST` | `/api/courses` | Create a course |
| `GET` | `/api/courses/full` | Hydrated payload for the faculty dashboard (courses + assignments + students + sessions) |
| `GET` | `/api/courses/{id}` | Get a single course |
| `PUT` | `/api/courses/{id}` | Update course metadata |
| `DELETE` | `/api/courses/{id}` | Delete a course |
| `GET` | `/api/courses/{id}/computed-grades` | Final letter grades for all enrolled students |
| `GET` | `/api/courses/{id}/students` | Roster of enrolled students |
| `GET` | `/api/courses/{id}/stats` | Statistical breakdown (mean, median, std dev, letter-grade counts) |
| `GET` | `/api/assignments` | List assignments (filterable by `course_id`) |
| `POST` | `/api/assignments` | Create an assignment |
| `GET` | `/api/assignments/{id}` | Get a single assignment |
| `PUT` | `/api/assignments/{id}` | Update an assignment |
| `DELETE` | `/api/assignments/{id}` | Delete an assignment |

### Known Limitations

- Assignment weights under WeightedGradingScheme must sum to 1.0 per type; the backend does not enforce this and will silently produce incorrect final grades if weights are wrong.
- Changing a course's grading scheme after grades are entered recalculates all final grades immediately on the next read.

---

## SP4 — Grade Entry & Grading Schemes

### Purpose

Record individual scores for student–assignment pairs, apply the course's grading scheme to compute final grades, and support session-based attendance tracking.

### Key Files

| File | Description |
|---|---|
| `artifacts/server/src/routes/grades.py` | Grade CRUD + upsert |
| `artifacts/server/src/routes/sessions.py` | Session and attendance endpoints |
| `artifacts/server/src/db/models.py` | `GradeRow`, `SessionRow`, `AttendanceRecordRow` models |
| `artifacts/server/src/domain/` | Grading-scheme classes used during final-grade computation |

### Data Models

**GradeRow**: `id`, `student_id`, `assignment_id`, `score`, `feedback`, `submitted_at`.

**SessionRow**: `id`, `course_id`, `name`, `date`, `time_slot`.

**AttendanceRecordRow**: `id`, `session_id`, `student_id`, `status` (`present` | `absent` | `late` | `excused`).

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/grades` | List grades (filterable by student, course, assignment) |
| `POST` | `/api/grades` | Create a new grade record |
| `PUT` | `/api/grades/{id}` | Update score or feedback |
| `DELETE` | `/api/grades/{id}` | Remove a grade |
| `POST` | `/api/grades/upsert` | Create or update grade for a (student, assignment) pair |
| `GET` | `/api/sessions` | List sessions (filterable by `course_id`) |
| `POST` | `/api/sessions` | Create a new class session |
| `PUT` | `/api/sessions/{id}` | Update session details |
| `DELETE` | `/api/sessions/{id}` | Delete a session |
| `POST` | `/api/attendance` | Upsert an attendance record for a student in a session |

### Known Limitations

- `upsert` matches on `(student_id, assignment_id)`; passing a mismatched pair creates a second record instead of updating.
- Attendance is tracked per-session but is not currently factored into grade calculations.

---

## SP5 — CSV Import / Export

### Purpose

Bulk grade ingestion from instructor-prepared CSV files, batch-processing of multiple files concurrently, and export of grades or full course reports.

### Key Files

| File | Description |
|---|---|
| `artifacts/server/src/routes/import_export.py` | All import/export endpoint handlers |
| `artifacts/server/src/services/` | CSV parsing and validation helpers (Pandas-based) |
| `artifacts/client/src/pages/import-export.tsx` | Frontend upload/download UI |

### Expected CSV Format (grade import)

| Column | Type | Notes |
|---|---|---|
| `student_id` | string | Must match an existing `StudentRow.student_id` |
| `assignment_name` | string | Must match an existing `AssignmentRow.name` in the target course |
| `score` | numeric | Floating-point value ≤ assignment `max_score` |
| `feedback` | string | Optional; free text |

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/import/grades` | Upload a single CSV to upsert grades for a course (`course_id` query param required) |
| `GET` | `/api/export/grades` | Download current grades for a course as CSV |
| `GET` | `/api/export/report` | Download a full course report as JSON |
| `POST` | `/api/import/batch` | Upload multiple CSV files; processed concurrently |

### Known Limitations

- Files with no header row are accepted without error and produce no grade records — no warning is returned to the caller.
- Student IDs that are all digits may be misinterpreted as integers by some spreadsheet tools, stripping leading zeros; instruct users to format those cells as text.
- There is no hard server-side limit on CSV file size; very large files can exhaust server memory.
- Batch import returns a combined success response even if individual files fail silently.

---

## SP6 — Analytics & Reporting

### Purpose

Aggregate grade data into performance metrics (distribution, trends, at-risk lists) and render server-side PNG charts for download.

### Key Files

| File | Description |
|---|---|
| `artifacts/server/src/routes/analytics.py` | Analytics query endpoints |
| `artifacts/server/src/routes/reports.py` | Matplotlib-based chart generation |
| `artifacts/server/src/routes/dashboard.py` | Faculty dashboard summary endpoints |
| `artifacts/server/src/services/` | Pandas aggregation helpers |
| `artifacts/client/src/pages/analytics.tsx` | Analytics dashboard page |

### API Endpoints — Analytics

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/analytics/grade-distribution` | Letter-grade distribution for a course (`course_id` required) |
| `GET` | `/api/analytics/at-risk` | Students below the at-risk threshold (`course_id` optional) |
| `GET` | `/api/analytics/course-performance` | Aggregated mean, median, pass-rate for all courses |
| `GET` | `/api/analytics/semester-trends` | Per-semester GPA trend for a student (`student_id` required) |
| `GET` | `/api/analytics/assignment-completion` | Completion rates per assignment in a course |
| `GET` | `/api/dashboard/summary` | Global totals: student count, course count, mean GPA, at-risk count |
| `GET` | `/api/dashboard/recent-activity` | Combined feed of recent grade entries and enrollments |
| `GET` | `/api/dashboard/top-performers` | Students ranked by overall GPA |

### API Endpoints — Chart Reports

Charts are returned as `image/png` and can be embedded in `<img>` tags or downloaded directly.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/reports/grade-distribution/{course_id}.png` | Bar chart of letter-grade distribution |
| `GET` | `/api/reports/gpa-trend/{student_id}.png` | Line chart of semester-by-semester GPA |
| `GET` | `/api/reports/radar/{student_id}.png` | Radar chart of performance by assignment type |
| `GET` | `/api/reports/course-difficulty.png` | Horizontal bar chart comparing course-level averages |

### Known Limitations

- Charts are generated on every request with no caching; high-traffic usage will increase CPU load.
- The radar chart requires at least three distinct assignment types; fewer types produce a degenerate chart.
- Semester-trends require at least two semesters of data to show a meaningful trend line.

---

## SP7 — Grade Predictions & At-Risk Detection

### Purpose

Use historical and current grade data to predict each student's final grade and flag students at risk of failing, using a per-course linear regression model.

### Key Files

| File | Description |
|---|---|
| `artifacts/server/src/routes/predictions.py` | Prediction endpoint handlers |
| `artifacts/server/src/services/` | ML model training and inference (scikit-learn) |
| `artifacts/client/src/pages/predictions.tsx` | Predictions dashboard page |

### Design

1. On each prediction request, all current `GradeRow` records for the target course are loaded into a Pandas DataFrame.
2. A `LinearRegression` model is trained on the available scores vs. final weighted grade.
3. For each student with at least one grade, the model predicts their final weighted score.
4. Students predicted below the configurable at-risk threshold (default 60%) are flagged.
5. A confidence value (0–100%) is derived from the model's R² score.

The model is **ephemeral** — it is retrained on each call and not persisted to disk.

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/predictions/grade` | Predict a single student's final grade given current scores |
| `GET` | `/api/predictions/at-risk/{course_id}` | Return predicted outcomes and at-risk flags for all students in a course |
| `GET` | `/api/me/predictions` | Student-facing view of their own risk levels and best-case projections |

### Known Limitations

- With fewer than 5 grade records in a course the model is unreliable; predictions are still returned but confidence is low.
- Students who have not yet received any grades are excluded from predictions rather than shown as 0%.
- Confidence can display as 0% when the R² score is negative (i.e., the model performs worse than a mean baseline); this is a known display issue.
- The linear regression assumes a linear relationship between midterm and final performance; non-linear grade trajectories (e.g., students who improve dramatically late in the semester) may be predicted inaccurately.
