# Acadence — User Manual

> **Acadence** is a university grade-management platform. This guide covers everything instructors and students need to use the system day-to-day.

---

## Table of Contents

- [Glossary](#glossary)
- [Instructor Guide](#instructor-guide)
  1. [Logging In](#1-logging-in)
  2. [The Faculty Dashboard](#2-the-faculty-dashboard)
  3. [Creating a Course](#3-creating-a-course)
  4. [Adding Students to a Course](#4-adding-students-to-a-course)
  5. [Creating Assignments](#5-creating-assignments)
  6. [Entering Grades](#6-entering-grades)
  7. [Importing Grades via CSV](#7-importing-grades-via-csv)
  8. [Recording Attendance](#8-recording-attendance)
  9. [Reading Analytics](#9-reading-analytics)
  10. [Viewing Grade Predictions](#10-viewing-grade-predictions)
  11. [Exporting Reports](#11-exporting-reports)
- [Student Guide](#student-guide)
  1. [Logging In and Claiming Your Account](#1-logging-in-and-claiming-your-account)
  2. [Viewing Your Enrolled Courses](#2-viewing-your-enrolled-courses)
  3. [Checking Your Grade Breakdown](#3-checking-your-grade-breakdown)
  4. [Understanding Your GPA](#4-understanding-your-gpa)
  5. [Checking Your At-Risk Status](#5-checking-your-at-risk-status)
  6. [Downloading Report Charts](#6-downloading-report-charts)

---

## Glossary

| Term | Definition |
|---|---|
| **Weighted Grade** | A final grade computed by multiplying each assignment score by its weight and summing the results. Weights are defined per assignment by the instructor. |
| **GPA** | Grade Point Average — a 4.0-scale representation of a student's overall academic performance, computed from final letter grades across all enrolled courses. |
| **At-Risk** | A student is flagged as at-risk when their predicted final grade falls below the course's passing threshold (default 60%). |
| **Grading Scheme** | The formula used to convert raw scores to a final grade. Acadence supports Weighted, Curved, and Pass/Fail schemes. |
| **Pass/Fail Scheme** | A grading scheme where any final score at or above the threshold earns a "Pass" and anything below earns a "Fail". |
| **Curved Grading** | A weighted average adjusted by a curve offset defined by the instructor. |
| **Confidence** | In the predictions module, confidence is the model's self-assessed reliability (0–100%). Low confidence means there is not enough grade data to make an accurate prediction. |
| **Session** | A single class meeting (lecture, lab, etc.) that can have its own attendance record. |
| **Enrollment** | The association between a student and a course for a specific semester. |

---

## Instructor Guide

### 1. Logging In

1. Open the Acadence URL in your browser.
2. Click **Sign In**.
3. Enter your institutional email address and password, or use the **Continue with Google** option if your institution has enabled it.
4. After signing in you are redirected to the **Faculty Dashboard**.

> **Note**: If you see a "Claim your account" prompt instead of the dashboard, your email is registered as a student. Contact your administrator.

---

### 2. The Faculty Dashboard

The dashboard is your home screen. It shows:

- **Summary cards** — total student count, number of active courses, overall mean GPA, and the number of at-risk students.
- **Recent Activity** — a live feed of the latest grade entries and new enrollments.
- **Top Performers** — a ranked list of students by cumulative GPA.

Use the **sidebar navigation** on the left to move between Courses, Students, Grades, Analytics, Predictions, and Import/Export.

---

### 3. Creating a Course

1. In the sidebar, click **Courses**.
2. Click the **+ New Course** button (top right).
3. Fill in the form:
   - **Course Code** — e.g. `CS 101`
   - **Course Name** — e.g. `Introduction to Computing`
   - **Semester** — e.g. `Fall 2026`
   - **Credits** — number of credit hours
   - **Instructor** — your name or the assigned instructor
   - **Grading Scheme** — choose Weighted, Curved, or Pass/Fail
   - **Description** — optional free-text description
4. Click **Create Course**.

The new course appears in your course list. You can edit or delete it at any time from the course's detail page.

---

### 4. Adding Students to a Course

**Enrolling an existing student:**

1. Open the course from the **Courses** list.
2. Click the **Roster** tab.
3. Click **Add Student**, search by name or student ID, select the student, and click **Enroll**.

**Creating a new student record:**

1. In the sidebar, click **Students**.
2. Click **+ New Student**.
3. Fill in: Name, Email, Student ID (university-issued), Year, and Major.
4. Click **Create Student**.
5. Enroll the student in the relevant course using the steps above.

**Removing a student from a course:**

1. Open the course → **Roster** tab.
2. Find the student row and click the **×** (remove) icon.
3. Confirm the removal in the dialog.

> Removing a student from a course deletes their enrollment but does **not** delete their grade records.

---

### 5. Creating Assignments

1. Open the course → **Assignments** tab.
2. Click **+ New Assignment**.
3. Fill in:
   - **Name** — e.g. `Midterm Exam`
   - **Type** — e.g. `Exam`, `Homework`, `Quiz`, `Project`
   - **Max Score** — maximum achievable score (e.g. `100`)
   - **Weight** — decimal weight used in weighted grading (e.g. `0.3` for 30%)
   - **Due Date** — optional
   - **Description** — optional
4. Click **Create Assignment**.

> For Weighted grading schemes, the sum of all assignment weights in the course should equal **1.0**. Acadence does not automatically enforce this — please double-check your weights.

---

### 6. Entering Grades

**Entering a single grade:**

1. Open the course → **Grades** tab (or navigate to **Grades** in the sidebar and filter by course).
2. Find the row for the student and assignment you want to grade.
3. Click the cell under the assignment column for that student.
4. Type the score and optional feedback, then press **Enter** or click **Save**.

**Bulk grade entry:**

1. Navigate to **Grades** in the sidebar.
2. Use the **Course** and **Assignment** dropdowns to filter.
3. Enter scores for all students in the visible table.
4. Click **Save All** to commit the batch.

---

### 7. Importing Grades via CSV

Use CSV import to enter grades for many students at once.

#### Preparing your CSV file

Your file must have a header row with these exact column names (order does not matter):

```
student_id,assignment_name,score,feedback
```

- `student_id` — the student's university-issued ID (not their database ID)
- `assignment_name` — must match the assignment name in Acadence exactly (case-sensitive)
- `score` — a number ≤ the assignment's max score
- `feedback` — optional; leave the cell empty if not used

**Example:**

```csv
student_id,assignment_name,score,feedback
S1001,Midterm Exam,82,Good work on part 2
S1002,Midterm Exam,76,
S1003,Midterm Exam,91,Excellent
```

> **Tip**: If student IDs start with a leading zero (e.g. `0042`), format that column as **Text** in your spreadsheet app before saving as CSV to prevent the zeros from being stripped.

#### Uploading the file

1. In the sidebar, click **Import / Export**.
2. Click **Import Grades**.
3. Select the target **Course** from the dropdown.
4. Click **Choose File** and select your CSV.
5. Click **Upload**. A success message confirms how many records were processed.

#### Batch import (multiple files)

1. On the **Import / Export** page, click **Batch Import**.
2. Select multiple CSV files.
3. Click **Upload All**. Files are processed in parallel.

> Always verify your grades after a batch import — files with structural errors may be skipped without a visible per-file error message.

---

### 8. Recording Attendance

1. Open the course → **Attendance** tab.
2. Click **+ New Session** to create a class session (name, date, time slot).
3. After creating the session, open it to see the student roster.
4. For each student, set their status: **Present**, **Absent**, **Late**, or **Excused**.
5. Click **Save** when done.

You can edit session details or delete a session from the session list in the **Attendance** tab.

---

### 9. Reading Analytics

1. In the sidebar, click **Analytics**.
2. Use the **Course** dropdown to scope results to a single course or leave it blank for all courses.

Available views:

| View | What it shows |
|---|---|
| **Grade Distribution** | Bar chart of letter-grade counts (A, B, C, D, F) |
| **At-Risk Students** | List of students predicted or currently below the passing threshold |
| **Course Performance** | Table of mean score, median, and pass rate per course |
| **Assignment Completion** | Percentage of students who have a grade for each assignment |
| **Semester Trends** | Per-semester GPA trend for an individual student |

---

### 10. Viewing Grade Predictions

1. In the sidebar, click **Predictions**.
2. Select a **Course** from the dropdown.
3. The table shows each student's:
   - **Predicted Final Grade** — letter grade the model expects they will earn
   - **Confidence** — how reliable the prediction is (higher = more data = more reliable)
   - **At-Risk** — flagged in red if the predicted grade is below the passing threshold

> Predictions with **Confidence below ~40%** should be treated as rough estimates. The model needs at least 5 grade records per course to produce useful predictions.

---

### 11. Exporting Reports

**Export grades as CSV:**

1. Go to **Import / Export** in the sidebar.
2. Select the **Course**.
3. Click **Export Grades (CSV)**. The file downloads immediately.

**Export full course report (JSON):**

1. Go to **Import / Export**.
2. Select the **Course**.
3. Click **Export Report (JSON)** for a machine-readable full report.

**Download PNG chart:**

1. Go to **Analytics**.
2. Select the desired chart view.
3. Click the **Download PNG** button below the chart (where available).

Available charts for download: Grade Distribution, GPA Trend, Performance Radar, Course Difficulty comparison.

---

## Student Guide

### 1. Logging In and Claiming Your Account

**First-time login:**

1. Open the Acadence URL in your browser.
2. Click **Sign In** and enter your email and password (or use Google sign-in).
3. If your account has not been linked yet, you will see the **"Claim Your Account"** page.
4. Enter your **Student ID** (the ID on your university card or issued by your registrar).
5. Click **Claim Account**.

Once claimed, you will be taken to your student portal automatically.

> **Having trouble?** Make sure the email you signed in with matches the email your instructor used when creating your student record. If the claim fails, contact your instructor or administrator.

**Subsequent logins:**

After claiming, sign in normally — you will land directly on your student portal.

---

### 2. Viewing Your Enrolled Courses

1. After logging in, click **My Courses** in the navigation (or on the portal home page).
2. Each card shows the course name, code, semester, and your current average.
3. Click a course card to see its full detail view.

---

### 3. Checking Your Grade Breakdown

1. From **My Courses**, click on a course.
2. The **Grades** tab lists every assignment with:
   - Assignment name and type
   - Maximum possible score
   - Your score (or blank if not yet graded)
   - Any feedback left by your instructor
3. The **weighted average** or **final grade** is shown at the top of the tab, calculated using the course's grading scheme.

---

### 4. Understanding Your GPA

1. From the student portal home page, your **cumulative GPA** is displayed on the summary card.
2. Click **GPA Breakdown** (or navigate to the GPA section) to see a per-course table with:
   - Course name and semester
   - Final letter grade
   - Grade points contributed

GPA is calculated on a standard 4.0 scale:

| Letter | Points |
|---|---|
| A | 4.0 |
| A- | 3.7 |
| B+ | 3.3 |
| B | 3.0 |
| B- | 2.7 |
| C+ | 2.3 |
| C | 2.0 |
| C- | 1.7 |
| D | 1.0 |
| F | 0.0 |

Cumulative GPA = sum of (grade points × credits) ÷ total credits.

---

### 5. Checking Your At-Risk Status

1. On the student portal home page, look for the **At-Risk** indicator on any course card.
2. A course marked **At Risk** means the system predicts your final grade may fall below the passing threshold.
3. Click the course card → **Predictions** tab to see:
   - Your predicted final grade
   - The confidence level of the prediction
   - A best-case projection (if you score full marks on remaining assignments)

Use the at-risk indicator as an early warning. Speak with your instructor if you are flagged, especially early in the semester when confidence is still low.

---

### 6. Downloading Report Charts

1. Navigate to your student portal.
2. Click **Reports** or the chart icon on any course card.
3. Available charts:
   - **GPA Trend** — your semester-by-semester GPA as a line chart
   - **Performance Radar** — your scores by assignment type (Exams, Homework, Quizzes, etc.)
4. Click **Download PNG** beneath any chart to save it to your device.

> Charts require enough historical data to be meaningful. If a chart appears blank, you may not have grades entered for that course yet, or the course has fewer than the minimum required semesters of data.
