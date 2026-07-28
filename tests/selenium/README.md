# SP7 — Selenium Data-Entry Test Suite

Automated browser tests that exercise the five core data-entry forms in
Acadence using Selenium + headless Chromium.

---

## Prerequisites

These are already installed in the Replit environment:

| Requirement       | Installed via            |
|-------------------|--------------------------|
| `chromium`        | Nix (`chromium`)         |
| `chromedriver`    | Nix (`chromedriver`)     |
| `selenium`        | pip                      |
| `pytest`          | pip                      |
| `pytest-html`     | pip                      |

---

## Running the tests

**Start the dev server first** (both workflows must be running):

```
# In the Replit workflow panel, ensure these are active:
#   artifacts/server: API Server
#   artifacts/client: web
```

**Run all five tests:**

```bash
pytest tests/selenium/ -v
```

**Run with an HTML report:**

```bash
pytest tests/selenium/ -v --html=tests/selenium/report.html --self-contained-html
```

**Point at a different URL** (e.g. a deployed environment):

```bash
BASE_URL=https://your-app.example.com pytest tests/selenium/ -v
```

By default the suite reads `REPLIT_DEV_DOMAIN` from the environment to
build the URL automatically.

---

## Test files

| File | Form tested | Key `data-testid` used |
|---|---|---|
| `test_course_form.py`     | Create course     | `button-add-course`, `input-course-code`, `button-submit-course`, `card-course-*` |
| `test_student_form.py`    | Add student       | `button-add-student`, `input-student-name`, `button-submit-student`, `card-student-*` |
| `test_assignment_form.py` | Add assignment    | `button-add-assignment`, `input-assignment-name`, `button-submit-assignment`, `card-assignment-*` |
| `test_grade_form.py`      | Record grade      | `button-add-grade`, `input-grade-score`, `button-submit-grade`, `row-grade-*` |
| `test_csv_import.py`      | CSV upload        | `input[type=file][accept=.csv]` + import result text |

---

## Fixtures

`fixtures/sample_grades.csv` — a small valid CSV with 5 grade rows used by
the CSV import test. Columns: `student_id`, `assignment_name`, `score`.

---

## Architecture notes

- `conftest.py` starts a single headless Chrome session scoped to the entire
  test run (scope=`session`), logs in once as `teacher@gmail.com / 1111`, and
  yields the driver to all tests.
- Tests are **order-independent** for reading (they navigate to their own
  page), but the create-course test must succeed before grade entry can select
  a course-linked assignment. Run the full suite in one `pytest` call to keep
  the session state.
- The `data-testid` attributes on form elements are defined in the
  corresponding `artifacts/client/src/pages/` files.
