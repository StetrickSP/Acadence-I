"""Matplotlib chart export endpoints — PNG report downloads."""
from __future__ import annotations

import io
from typing import List, Optional

import matplotlib
matplotlib.use("Agg")  # non-interactive backend, must be set before pyplot import
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.db.models import CourseRow, StudentRow
from src.services.analytics_service import PandasAnalyticsService
from src.auth.clerk import require_auth, get_student_from_request

router = APIRouter()

_PALETTE = ["#4f86c6", "#f4a942", "#6bbf76", "#e5635a", "#a57bc9"]
_BG = "#f8f9fa"
_GRID_COLOR = "#dee2e6"


def _png_response(fig: plt.Figure) -> Response:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return Response(content=buf.read(), media_type="image/png")


# ---------------------------------------------------------------------------
# 1. Grade Distribution bar chart
# ---------------------------------------------------------------------------

@router.get("/reports/grade-distribution/{course_id}.png")
def grade_distribution_chart(course_id: int, request: Request, db: Session = Depends(get_db)):
    """Return a Matplotlib bar chart PNG of grade distribution for a course.

    Requires a valid Clerk session (student or admin). Any authenticated user
    may view a course's distribution chart.
    """
    require_auth(request)  # raises 401 if not signed in
    course = db.query(CourseRow).filter(CourseRow.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    svc = PandasAnalyticsService(db)
    data = svc.grade_distribution(course_id=course_id)

    buckets = data["buckets"]
    labels = [b["range"] for b in buckets]
    counts = [b["count"] for b in buckets]

    fig, ax = plt.subplots(figsize=(10, 5))
    fig.patch.set_facecolor(_BG)
    ax.set_facecolor(_BG)

    bars = ax.bar(labels, counts, color=_PALETTE[0], edgecolor="white", linewidth=0.8, zorder=3)

    # Annotate non-zero bars
    for bar, count in zip(bars, counts):
        if count > 0:
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.1,
                str(count),
                ha="center", va="bottom", fontsize=9, color="#333333",
            )

    ax.set_xlabel("Score Range (%)", fontsize=11, labelpad=8)
    ax.set_ylabel("Number of Students", fontsize=11, labelpad=8)
    ax.set_title(
        f"Grade Distribution — {course.name}",
        fontsize=14, fontweight="bold", pad=14,
    )
    ax.yaxis.grid(True, color=_GRID_COLOR, linestyle="--", linewidth=0.7, zorder=0)
    ax.set_axisbelow(True)
    ax.tick_params(axis="x", rotation=35, labelsize=9)
    ax.tick_params(axis="y", labelsize=9)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)

    fig.tight_layout()
    return _png_response(fig)


# ---------------------------------------------------------------------------
# 2. GPA Trend line chart
# ---------------------------------------------------------------------------

@router.get("/reports/gpa-trend/{student_id}.png")
def gpa_trend_chart(student_id: int, request: Request, db: Session = Depends(get_db)):
    """Return a Matplotlib line chart PNG of semester GPA trend for a student.

    Requires a valid Clerk session. Students may only view their own report;
    the path student_id must match the authenticated student's internal DB id.
    """
    auth_student = get_student_from_request(request, db)  # raises 401/403 if not authenticated
    if auth_student.id != student_id:
        raise HTTPException(status_code=403, detail="You may only download your own GPA report")
    student = auth_student  # already loaded; avoid a second DB hit

    svc = PandasAnalyticsService(db)
    trends = svc.semester_trends(student_id=student_id)

    if not trends:
        # Return a placeholder chart when no data exists yet
        fig, ax = plt.subplots(figsize=(8, 4))
        fig.patch.set_facecolor(_BG)
        ax.set_facecolor(_BG)
        ax.text(0.5, 0.5, "No semester data available yet",
                ha="center", va="center", fontsize=13, color="#888888",
                transform=ax.transAxes)
        ax.set_title(f"GPA Trend — {student.name}", fontsize=14, fontweight="bold", pad=14)
        for spine in ax.spines.values():
            spine.set_visible(False)
        ax.set_xticks([])
        ax.set_yticks([])
        return _png_response(fig)

    semesters = [t["semester"] for t in trends]
    gpas = [t["gpa"] for t in trends]

    fig, ax = plt.subplots(figsize=(max(7, len(semesters) * 1.4), 5))
    fig.patch.set_facecolor(_BG)
    ax.set_facecolor(_BG)

    ax.plot(semesters, gpas, color=_PALETTE[0], linewidth=2.5, marker="o",
            markersize=7, markerfacecolor="white", markeredgewidth=2.5, zorder=3)

    # Annotate each point
    for sem, gpa in zip(semesters, gpas):
        ax.annotate(
            f"{gpa:.2f}",
            (sem, gpa),
            textcoords="offset points", xytext=(0, 10),
            ha="center", fontsize=9, color="#333333",
        )

    # Reference line at 2.0 (academic standing)
    ax.axhline(2.0, color="#e5635a", linestyle="--", linewidth=1, alpha=0.7, zorder=2,
               label="Min. Standing (2.0)")

    ax.set_ylim(0, 4.2)
    ax.set_xlabel("Semester", fontsize=11, labelpad=8)
    ax.set_ylabel("GPA", fontsize=11, labelpad=8)
    ax.set_title(f"GPA Trend — {student.name}", fontsize=14, fontweight="bold", pad=14)
    ax.yaxis.grid(True, color=_GRID_COLOR, linestyle="--", linewidth=0.7, zorder=0)
    ax.set_axisbelow(True)
    ax.tick_params(axis="x", rotation=30, labelsize=9)
    ax.tick_params(axis="y", labelsize=9)
    ax.legend(fontsize=9)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)

    fig.tight_layout()
    return _png_response(fig)


# ---------------------------------------------------------------------------
# 3. Radar chart — performance by assignment type
# ---------------------------------------------------------------------------

@router.get("/reports/radar/{student_id}.png")
def radar_chart(student_id: int, request: Request, db: Session = Depends(get_db)):
    """Return a Matplotlib radar chart PNG of performance by assignment type for a student.

    Requires a valid Clerk session. Students may only view their own report;
    the path student_id must match the authenticated student's internal DB id.
    """
    auth_student = get_student_from_request(request, db)  # raises 401/403 if not authenticated
    if auth_student.id != student_id:
        raise HTTPException(status_code=403, detail="You may only download your own performance report")
    student = auth_student  # already loaded; avoid a second DB hit

    svc = PandasAnalyticsService(db)
    df = svc._load_master_df()
    student_df = df[df["student_id"] == student_id]

    if student_df.empty:
        fig, ax = plt.subplots(figsize=(6, 5))
        fig.patch.set_facecolor(_BG)
        ax.set_facecolor(_BG)
        ax.text(0.5, 0.5, "No assignment data available yet",
                ha="center", va="center", fontsize=13, color="#888888",
                transform=ax.transAxes)
        ax.set_title(f"Performance by Type — {student.name}", fontsize=14, fontweight="bold", pad=14)
        for spine in ax.spines.values():
            spine.set_visible(False)
        ax.set_xticks([])
        ax.set_yticks([])
        return _png_response(fig)

    type_avg = (
        student_df.groupby("assignment_type")["pct"]
        .mean()
        .dropna()
        .sort_index()
    )

    if len(type_avg) < 3:
        # Fall back to a simple horizontal bar chart when too few categories for radar
        fig, ax = plt.subplots(figsize=(7, max(3, len(type_avg) * 1.2 + 1)))
        fig.patch.set_facecolor(_BG)
        ax.set_facecolor(_BG)
        colors = _PALETTE[: len(type_avg)]
        bars = ax.barh(type_avg.index.tolist(), type_avg.values, color=colors,
                       edgecolor="white", linewidth=0.8, zorder=3)
        for bar, val in zip(bars, type_avg.values):
            ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height() / 2,
                    f"{val:.1f}%", va="center", fontsize=9, color="#333333")
        ax.set_xlim(0, 110)
        ax.set_xlabel("Average Score (%)", fontsize=11, labelpad=8)
        ax.set_title(f"Performance by Assignment Type — {student.name}",
                     fontsize=13, fontweight="bold", pad=12)
        ax.xaxis.grid(True, color=_GRID_COLOR, linestyle="--", linewidth=0.7, zorder=0)
        ax.set_axisbelow(True)
        for spine in ("top", "right"):
            ax.spines[spine].set_visible(False)
        fig.tight_layout()
        return _png_response(fig)

    # Build radar
    categories = type_avg.index.tolist()
    values = type_avg.values.tolist()
    N = len(categories)

    angles = np.linspace(0, 2 * np.pi, N, endpoint=False).tolist()
    # Close the polygon
    values_plot = values + [values[0]]
    angles_plot = angles + [angles[0]]

    fig, ax = plt.subplots(figsize=(7, 7), subplot_kw=dict(polar=True))
    fig.patch.set_facecolor(_BG)
    ax.set_facecolor(_BG)

    ax.plot(angles_plot, values_plot, color=_PALETTE[0], linewidth=2, zorder=3)
    ax.fill(angles_plot, values_plot, color=_PALETTE[0], alpha=0.25, zorder=2)

    ax.set_xticks(angles)
    ax.set_xticklabels(categories, fontsize=10)
    ax.set_ylim(0, 100)
    ax.set_yticks([20, 40, 60, 80, 100])
    ax.set_yticklabels(["20", "40", "60", "80", "100"], fontsize=7, color="#888888")
    ax.yaxis.grid(True, color=_GRID_COLOR, linestyle="--", linewidth=0.7)
    ax.xaxis.grid(True, color=_GRID_COLOR, linestyle="-", linewidth=0.5)
    ax.spines["polar"].set_visible(False)

    ax.set_title(
        f"Performance by Assignment Type\n{student.name}",
        fontsize=13, fontweight="bold", pad=20,
    )

    fig.tight_layout()
    return _png_response(fig)


# ---------------------------------------------------------------------------
# 4. Course Difficulty horizontal bar chart
# ---------------------------------------------------------------------------

@router.get("/reports/course-difficulty.png")
def course_difficulty_chart(
    request: Request,
    course_ids: Optional[str] = Query(None, description="Comma-separated course IDs to filter"),
    db: Session = Depends(get_db),
):
    """Return a Matplotlib horizontal bar chart comparing difficulty scores across courses.

    Requires a valid Clerk session. Any authenticated user may view this chart.
    Optional ?course_ids=1,2,3 to filter to specific courses.
    """
    require_auth(request)

    svc = PandasAnalyticsService(db)
    performance = svc.course_performance()

    # Filter by course IDs if provided
    if course_ids:
        try:
            id_set = {int(x.strip()) for x in course_ids.split(",") if x.strip()}
            performance = [p for p in performance if p["course_id"] in id_set]
        except ValueError:
            pass

    # Only include courses that have a difficulty score
    performance = [p for p in performance if p.get("difficulty_score") is not None]

    if not performance:
        fig, ax = plt.subplots(figsize=(9, 4))
        fig.patch.set_facecolor(_BG)
        ax.set_facecolor(_BG)
        ax.text(0.5, 0.5, "No course data available yet",
                ha="center", va="center", fontsize=13, color="#888888",
                transform=ax.transAxes)
        ax.set_title("Course Difficulty Comparison", fontsize=14, fontweight="bold", pad=14)
        for spine in ax.spines.values():
            spine.set_visible(False)
        ax.set_xticks([])
        ax.set_yticks([])
        return _png_response(fig)

    # Sort by difficulty descending so hardest courses are at the top
    performance = sorted(performance, key=lambda x: x["difficulty_score"], reverse=True)

    names = [p["course_name"] for p in performance]
    scores = [p["difficulty_score"] for p in performance]

    # Colour-map: higher difficulty → warmer colour
    norm_scores = np.array(scores, dtype=float)
    max_s = float(max(norm_scores)) if max(norm_scores) > 0 else 1.0
    colors = [_PALETTE[min(4, int((s / max_s) * 4))] for s in norm_scores]

    fig_height = max(4, len(names) * 0.6 + 1.5)
    fig, ax = plt.subplots(figsize=(10, fig_height))
    fig.patch.set_facecolor(_BG)
    ax.set_facecolor(_BG)

    bars = ax.barh(names, scores, color=colors, edgecolor="white", linewidth=0.8, zorder=3)

    # Annotate each bar
    for bar, score in zip(bars, scores):
        ax.text(
            bar.get_width() + 0.5,
            bar.get_y() + bar.get_height() / 2,
            f"{score:.1f}",
            va="center", fontsize=9, color="#333333",
        )

    ax.set_xlim(0, max(scores) * 1.15 if scores else 100)
    ax.set_xlabel("Difficulty Score (100 − avg grade %)", fontsize=11, labelpad=8)
    ax.set_title("Course Difficulty Comparison", fontsize=14, fontweight="bold", pad=14)
    ax.xaxis.grid(True, color=_GRID_COLOR, linestyle="--", linewidth=0.7, zorder=0)
    ax.set_axisbelow(True)
    ax.tick_params(axis="y", labelsize=9)
    ax.tick_params(axis="x", labelsize=9)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)

    fig.tight_layout()
    return _png_response(fig)
