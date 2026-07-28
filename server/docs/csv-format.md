# CSV Import Format

## Overview

The grade import endpoints accept CSV files with the following format.

---

## Required columns

| Column            | Description                                                           |
|-------------------|-----------------------------------------------------------------------|
| `student_id`      | Student identifier (e.g. `S001`, `S002`). Must match the database.   |
| `assignment_name` | Assignment name exactly as it appears in the course. Case-insensitive.|
| `score`           | Numeric score (0 – max_score). Decimals are accepted.                 |

## Optional columns

| Column  | Description                                                                                   |
|---------|-----------------------------------------------------------------------------------------------|
| `type`  | `midterm`, `final`, `assignment`, `quiz`, `homework`, `project`, or `exam`. Informational only.|

## Header row

The header row is **optional**. If omitted, the parser auto-detects the file as
headerless provided it has exactly **3 or 4 columns**, which are then mapped
positionally to `student_id`, `assignment_name`, `score` (and optionally `type`).

Files with a header row continue to work in any column order (existing behaviour).

If a headerless file has a column count other than 3 or 4, the import fails with:

```
CSV has no recognisable header row. Add a first row: student_id,assignment_name,score,type
```

---

## Single import endpoint

```
POST /api/import/grades
Content-Type: multipart/form-data

Fields:
  file       — the CSV file
  course_id  — integer ID of the course
```

---

## Batch import endpoint

```
POST /api/import/batch
Content-Type: multipart/form-data

Fields:
  files       — one or more CSV files (repeat the field for each file)
  course_ids  — comma-separated course IDs matching each file in order
                e.g. "1,2,3" for three files belonging to courses 1, 2, 3
```

---

## Sample CSVs

### Midterm grades (`midterm_cs101.csv`)

```csv
student_id,assignment_name,score,type
S001,Midterm Exam,85,midterm
S002,Midterm Exam,72,midterm
S003,Midterm Exam,91,midterm
S004,Midterm Exam,60,midterm
S005,Midterm Exam,55,midterm
```

### Assignment grades (`assignments_cs101.csv`)

```csv
student_id,assignment_name,score,type
S001,Assignment 1,90,assignment
S002,Assignment 1,78,assignment
S003,Assignment 1,85,assignment
S001,Assignment 2,88,assignment
S002,Assignment 2,70,assignment
```

### Mixed grades (`mixed_cs101.csv`)

```csv
student_id,assignment_name,score
S001,Midterm Exam,85
S001,Assignment 1,90
S001,Assignment 2,88
S002,Midterm Exam,72
S002,Assignment 1,78
```

---

## Export endpoints

### Grades CSV export

```
GET /api/export/grades?course_id=1
```

Returns a CSV with columns:
`student_id`, `student_name`, `course_code`, `course_name`, `assignment_name`,
`assignment_type`, `score`, `max_score`, `percentage`, `letter_grade`

### JSON report export

```
GET /api/export/report?course_id=1
```

Returns a JSON document with:
- `course` — course metadata
- `summary` — average, median, std deviation, pass rate, at-risk count
- `grade_distribution` — letter grade buckets with counts and percentages
- `students` — per-student breakdown sorted by grade (descending), including GPA impact

---

## Validation rules

1. `student_id` must match a student in the database (exact, case-insensitive).
2. `assignment_name` must match an assignment in the specified course.
3. `score` must be a non-negative number ≤ `max_score` for the assignment.
4. Invalid rows are skipped and reported in the `errors` array; the rest of the file is still processed.
5. Duplicate rows (same student + assignment) are **upserted** — the existing score is updated.

---

## curl examples

```bash
# Single import
curl -s -X POST http://localhost:8080/api/import/grades \
  -F "file=@midterm_cs101.csv" \
  -F "course_id=1"

# Grades CSV export
curl -s "http://localhost:8080/api/export/grades?course_id=1" -o grades_course_1.csv

# JSON report
curl -s "http://localhost:8080/api/export/report?course_id=1" | python3 -m json.tool

# Batch import (two files for courses 1 and 2)
curl -s -X POST http://localhost:8080/api/import/batch \
  -F "files=@midterm_cs101.csv" \
  -F "files=@assignments_cs102.csv" \
  -F "course_ids=1,2"
```
