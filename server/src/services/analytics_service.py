"""Pandas-based analytics engine for grade data."""
from __future__ import annotations

from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from src.db.models import AssignmentRow, CourseRow, EnrollmentRow, GradeRow, StudentRow
from src.domain.grade_utils import letter_to_points, risk_level, score_to_letter, to_percent


class PandasAnalyticsService:
    """Loads grade data into DataFrames and exposes analytics methods."""

    def __init__(self, db: Session) -> None:
        self._db = db
        self._df: Optional[pd.DataFrame] = None  # lazy-loaded master frame

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _load_master_df(self) -> pd.DataFrame:
        """Load and join grades / assignments / enrollments / courses into one DataFrame."""
        if self._df is not None:
            return self._df

        grades = self._db.query(
            GradeRow.id.label("grade_id"),
            GradeRow.student_id,
            GradeRow.assignment_id,
            GradeRow.score,
        ).all()

        assignments = self._db.query(
            AssignmentRow.id.label("assignment_id"),
            AssignmentRow.course_id,
            AssignmentRow.name.label("assignment_name"),
            AssignmentRow.type.label("assignment_type"),
            AssignmentRow.max_score,
            AssignmentRow.weight,
        ).all()

        enrollments = self._db.query(
            EnrollmentRow.id.label("enrollment_id"),
            EnrollmentRow.student_id,
            EnrollmentRow.course_id,
            EnrollmentRow.semester,
        ).all()

        courses = self._db.query(
            CourseRow.id.label("course_id"),
            CourseRow.name.label("course_name"),
            CourseRow.semester.label("course_semester"),
            CourseRow.credits,
        ).all()

        students = self._db.query(
            StudentRow.id.label("student_id"),
            StudentRow.name.label("student_name"),
        ).all()

        if not grades or not assignments:
            self._df = pd.DataFrame(columns=[
                "grade_id", "student_id", "assignment_id", "score",
                "course_id", "assignment_name", "assignment_type",
                "max_score", "weight", "course_name", "course_semester",
                "credits", "student_name", "pct",
            ])
            return self._df

        df_grades = pd.DataFrame(grades, columns=["grade_id", "student_id", "assignment_id", "score"])
        df_asgn = pd.DataFrame(assignments, columns=[
            "assignment_id", "course_id", "assignment_name", "assignment_type", "max_score", "weight"
        ])
        df_enr = pd.DataFrame(enrollments, columns=[
            "enrollment_id", "student_id", "course_id", "semester"
        ])
        df_courses = pd.DataFrame(courses, columns=[
            "course_id", "course_name", "course_semester", "credits"
        ])
        df_students = pd.DataFrame(students, columns=["student_id", "student_name"])

        # Cast numeric columns
        for col in ("score", "max_score", "weight"):
            if col in df_grades.columns:
                df_grades[col] = df_grades[col].astype(float)
            if col in df_asgn.columns:
                df_asgn[col] = df_asgn[col].astype(float)

        # Join grades → assignments
        df = df_grades.merge(df_asgn, on="assignment_id", how="left")
        # Join → courses
        df = df.merge(df_courses, on="course_id", how="left")
        # Join → students
        df = df.merge(df_students, on="student_id", how="left")

        # Compute percentage
        df["pct"] = df.apply(
            lambda r: to_percent(r["score"], r["max_score"]), axis=1
        )

        # Attach enrollment semester (for trend analysis)
        df_enr_slim = df_enr[["student_id", "course_id", "semester"]].rename(
            columns={"semester": "enr_semester"}
        )
        df = df.merge(df_enr_slim, on=["student_id", "course_id"], how="left")

        self._df = df
        return self._df

    def _enrollments_df(self) -> pd.DataFrame:
        rows = self._db.query(
            EnrollmentRow.student_id,
            EnrollmentRow.course_id,
            EnrollmentRow.semester,
        ).all()
        return pd.DataFrame(rows, columns=["student_id", "course_id", "semester"])

    # ------------------------------------------------------------------
    # Public analytics methods
    # ------------------------------------------------------------------

    def grade_distribution(self, course_id: Optional[int] = None) -> dict:
        """Return histogram bucket counts and letter-grade counts for a course."""
        df = self._load_master_df()

        if course_id is not None:
            df = df[df["course_id"] == course_id]

        pcts = df["pct"].dropna().tolist()

        # Build 10-point buckets using pd.cut
        # 11 edges → 10 intervals, so we need exactly 10 labels
        bins = list(range(0, 91, 10)) + [101]  # [0,10,20,...,90,101]
        labels = [f"{lo}-{lo + 9}" for lo in range(0, 90, 10)] + ["90-100"]
        # bins has 11 values → 10 intervals, labels has 10 values ✓

        if pcts:
            series = pd.Series(pcts)
            cut = pd.cut(series, bins=bins, labels=labels, right=False, include_lowest=True)
            bucket_counts = cut.value_counts().reindex(labels, fill_value=0)
            total = len(pcts)
            result_buckets = [
                {
                    "range": lbl,
                    "count": int(bucket_counts[lbl]),
                    "percentage": round((int(bucket_counts[lbl]) / total) * 1000) / 10,
                }
                for lbl in labels
            ]
            # Letter grades
            letter_series = series.map(score_to_letter)
            letter_counts_raw = letter_series.value_counts()
            letter_counts = [
                {
                    "letter": l,
                    "count": int(letter_counts_raw.get(l, 0)),
                    "percentage": round((int(letter_counts_raw.get(l, 0)) / total) * 1000) / 10,
                }
                for l in ["A", "B", "C", "D", "F"]
            ]
        else:
            result_buckets = [{"range": lbl, "count": 0, "percentage": 0.0} for lbl in labels]
            letter_counts = [{"letter": l, "count": 0, "percentage": 0.0} for l in ["A", "B", "C", "D", "F"]]

        return {"course_id": course_id, "buckets": result_buckets, "letter_counts": letter_counts}

    def pass_fail_rates(self, course_id: Optional[int] = None) -> list[dict]:
        """Return pass/fail rate per course (or a single course) computed via DataFrame."""
        df = self._load_master_df()
        if course_id is not None:
            df = df[df["course_id"] == course_id]

        if df.empty:
            return []

        grouped = df.groupby(["course_id", "course_name"])
        results = []
        for (cid, cname), group in grouped:
            pcts = group["pct"].dropna()
            total = len(pcts)
            if total == 0:
                continue
            passing = (pcts >= 60).sum()
            pass_rate = round((passing / total) * 1000) / 10
            fail_rate = round(((total - passing) / total) * 1000) / 10
            results.append({
                "course_id": int(cid),
                "course_name": cname,
                "pass_rate": pass_rate,
                "fail_rate": fail_rate,
                "total_grades": total,
            })
        return results

    def at_risk_students(
        self,
        course_id: Optional[int] = None,
        threshold: Optional[float] = None,
    ) -> list[dict]:
        """Identify at-risk students starting from the enrollment×assignment grid.

        Students with zero submitted grades are included (current_grade=0, full
        missing count) so they are never silently omitted.
        """
        min_pct = threshold if threshold is not None else 70.0

        # --- build enrollment grid ---
        enr_q = self._db.query(
            EnrollmentRow.student_id,
            EnrollmentRow.course_id,
        )
        if course_id is not None:
            enr_q = enr_q.filter(EnrollmentRow.course_id == course_id)
        enrollments = enr_q.all()

        if not enrollments:
            return []

        asgn_q = self._db.query(
            AssignmentRow.id.label("assignment_id"),
            AssignmentRow.course_id,
            AssignmentRow.max_score,
            AssignmentRow.weight,
        )
        if course_id is not None:
            asgn_q = asgn_q.filter(AssignmentRow.course_id == course_id)
        assignments = asgn_q.all()

        if not assignments:
            return []

        df_enr = pd.DataFrame(enrollments, columns=["student_id", "course_id"])
        df_asgn = pd.DataFrame(assignments, columns=["assignment_id", "course_id", "max_score", "weight"])
        df_asgn["max_score"] = df_asgn["max_score"].astype(float)
        df_asgn["weight"] = df_asgn["weight"].astype(float)

        # Cross-join: every enrolled student × every assignment in their course
        grid = df_enr.merge(df_asgn, on="course_id", how="inner")

        # Left-join with actual grade rows
        grade_q = self._db.query(
            GradeRow.student_id,
            GradeRow.assignment_id,
            GradeRow.score,
        )
        if course_id is not None:
            grade_q = grade_q.join(
                AssignmentRow, GradeRow.assignment_id == AssignmentRow.id
            ).filter(AssignmentRow.course_id == course_id)
        grades = grade_q.all()

        df_grades = pd.DataFrame(grades, columns=["student_id", "assignment_id", "score"])
        if not df_grades.empty:
            df_grades["score"] = df_grades["score"].astype(float)

        grid = grid.merge(df_grades, on=["student_id", "assignment_id"], how="left")
        grid["submitted"] = grid["score"].notna().astype(int)
        grid["pct"] = grid.apply(
            lambda r: to_percent(r["score"], r["max_score"]) if pd.notna(r["score"]) else None,
            axis=1,
        )

        # Per (student, course): weighted grade and missing count
        def agg_student_course(g: pd.DataFrame) -> pd.Series:
            submitted_rows = g[g["submitted"] == 1]
            missing = int((g["submitted"] == 0).sum())
            if len(submitted_rows) > 0:
                total_weight = submitted_rows["weight"].sum()
                weighted_sum = (submitted_rows["pct"] * submitted_rows["weight"]).sum()
                current_pct = weighted_sum / total_weight if total_weight > 0 else 0.0
            else:
                # No submissions at all — treat as 0%
                current_pct = 0.0
            return pd.Series({"current_pct": current_pct, "missing": missing, "total_assignments": len(g)})

        grp = grid.groupby(["student_id", "course_id"]).apply(agg_student_course).reset_index()

        # Keep only at-risk rows
        at_risk = grp[grp["current_pct"] < min_pct].copy()

        if at_risk.empty:
            return []

        # Attach student and course names
        students_q = self._db.query(StudentRow.id.label("student_id"), StudentRow.name.label("student_name")).all()
        courses_q = self._db.query(CourseRow.id.label("course_id"), CourseRow.name.label("course_name")).all()
        df_students = pd.DataFrame(students_q, columns=["student_id", "student_name"])
        df_courses = pd.DataFrame(courses_q, columns=["course_id", "course_name"])

        at_risk = at_risk.merge(df_students, on="student_id", how="left")
        at_risk = at_risk.merge(df_courses, on="course_id", how="left")

        result = []
        for _, row in at_risk.iterrows():
            pct = float(row["current_pct"])
            result.append({
                "student_id": int(row["student_id"]),
                "student_name": row["student_name"],
                "current_grade": round(pct * 10) / 10,
                "letter_grade": score_to_letter(pct),
                "course_name": row["course_name"],
                "course_id": int(row["course_id"]),
                "assignments_missing": int(row["missing"]),
                "risk_level": risk_level(pct),
            })
        return result

    def semester_trends(self, student_id: Optional[int] = None) -> list[dict]:
        """Return semester-over-semester GPA trend using groupby + mean."""
        df = self._load_master_df()

        if student_id is not None:
            df = df[df["student_id"] == student_id]

        if df.empty:
            return []

        # Use enrollment semester; fall back to course_semester
        df = df.copy()
        df["sem"] = df["enr_semester"].fillna(df["course_semester"])

        # Compute weighted percentage per (student, course)
        df["weighted_score"] = df["pct"] * df["weight"]
        grp = df.groupby(["student_id", "course_id", "course_name", "credits", "sem"]).agg(
            total_weight=("weight", "sum"),
            weighted_sum=("weighted_score", "sum"),
        ).reset_index()
        grp = grp[grp["total_weight"] > 0].copy()
        grp["course_pct"] = grp["weighted_sum"] / grp["total_weight"]
        grp["letter"] = grp["course_pct"].map(score_to_letter)
        grp["gp"] = grp["letter"].map(letter_to_points)
        grp["quality_points"] = grp["gp"] * grp["credits"]

        # Semester-level aggregation
        sem_grp = grp.groupby("sem").agg(
            total_quality_points=("quality_points", "sum"),
            total_credits=("credits", "sum"),
            course_count=("course_id", "nunique"),
        ).reset_index()

        sem_grp = sem_grp[sem_grp["total_credits"] > 0].copy()
        sem_grp["gpa"] = (sem_grp["total_quality_points"] / sem_grp["total_credits"]).round(2)

        sem_grp = sem_grp.sort_values("sem")

        return [
            {
                "semester": row["sem"],
                "gpa": float(row["gpa"]),
                "courses_taken": int(row["course_count"]),
                "student_id": student_id,
            }
            for _, row in sem_grp.iterrows()
        ]

    def assignment_completion_correlation(
        self, course_id: Optional[int] = None
    ) -> dict:
        """Correlation between assignment completion rate and final grade using df.corr()."""
        df = self._load_master_df()

        if course_id is not None:
            df = df[df["course_id"] == course_id]

        if df.empty:
            return {"correlation": None, "data_points": 0}

        # Enrollment counts per course
        enr_df = self._enrollments_df()
        enr_counts = enr_df.groupby("course_id")["student_id"].count().rename("enrolled")

        # Completion rate per (student, course): submitted / total_assignments
        total_asgn = (
            df[["course_id", "assignment_id"]]
            .drop_duplicates()
            .groupby("course_id")["assignment_id"]
            .count()
            .rename("total_assignments")
        )
        submitted = (
            df.groupby(["student_id", "course_id"])["assignment_id"]
            .count()
            .rename("submitted")
        )

        comp = submitted.reset_index().merge(
            total_asgn.reset_index(), on="course_id", how="left"
        )
        comp["completion_rate"] = comp["submitted"] / comp["total_assignments"]

        # Final grade per (student, course)
        df_w = df.copy()
        df_w["weighted_score"] = df_w["pct"] * df_w["weight"]
        final_grade = df_w.groupby(["student_id", "course_id"]).agg(
            total_weight=("weight", "sum"),
            weighted_sum=("weighted_score", "sum"),
        ).reset_index()
        final_grade = final_grade[final_grade["total_weight"] > 0].copy()
        final_grade["final_grade"] = final_grade["weighted_sum"] / final_grade["total_weight"]

        merged = comp.merge(final_grade[["student_id", "course_id", "final_grade"]], on=["student_id", "course_id"])
        if len(merged) < 2:
            return {"correlation": None, "data_points": len(merged)}

        corr_matrix = merged[["completion_rate", "final_grade"]].corr()
        corr_value = corr_matrix.loc["completion_rate", "final_grade"]

        return {
            "correlation": None if pd.isna(corr_value) else round(float(corr_value), 4),
            "data_points": len(merged),
        }

    def course_performance(self) -> list[dict]:
        """Per-course averages and pass rates using DataFrame groupby."""
        df = self._load_master_df()

        courses_q = self._db.query(
            CourseRow.id.label("course_id"),
            CourseRow.name.label("course_name"),
            CourseRow.semester,
        ).all()
        courses_df = pd.DataFrame(courses_q, columns=["course_id", "course_name", "semester"])

        enr_counts = (
            self._enrollments_df()
            .groupby("course_id")["student_id"]
            .count()
            .rename("student_count")
            .reset_index()
        )

        result = []
        for _, crow in courses_df.iterrows():
            cid = crow["course_id"]
            cdf = df[df["course_id"] == cid]
            enr_count = int(
                enr_counts.loc[enr_counts["course_id"] == cid, "student_count"].sum()
            )
            pcts = cdf["pct"].dropna()
            if len(pcts) > 0:
                avg = float(pcts.mean())
                pass_rate = float((pcts >= 60).mean() * 100)
            else:
                avg = 0.0
                pass_rate = 0.0

            result.append({
                "course_id": int(cid),
                "course_name": crow["course_name"],
                "average_grade": round(avg * 10) / 10,
                "pass_rate": round(pass_rate * 10) / 10,
                "student_count": enr_count,
                "semester": crow["semester"],
                "difficulty_score": round((100 - avg) * 10) / 10 if avg > 0 else None,
            })

        return sorted(result, key=lambda x: x["course_name"])

    def assignment_completion(self, course_id: Optional[int] = None) -> list[dict]:
        """Per-assignment completion stats using DataFrame operations."""
        q = self._db.query(AssignmentRow)
        if course_id is not None:
            q = q.filter(AssignmentRow.course_id == course_id)
        assignments = q.all()

        df = self._load_master_df()
        enr_df = self._enrollments_df()

        result = []
        for asgn in assignments:
            adf = df[df["assignment_id"] == asgn.id]
            submitted = len(adf)
            total = int(
                enr_df[enr_df["course_id"] == asgn.course_id]["student_id"].count()
            )
            completion_rate = round((submitted / total) * 1000) / 10 if total > 0 else 0.0
            avg_score = (
                round(float(adf["pct"].mean()) * 10) / 10
                if submitted > 0
                else None
            )
            result.append({
                "assignment_id": asgn.id,
                "assignment_name": asgn.name,
                "type": asgn.type,
                "submitted_count": submitted,
                "total_enrolled": total,
                "completion_rate": completion_rate,
                "average_score": avg_score,
            })
        return result
