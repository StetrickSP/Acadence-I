"""Dashboard routes — summary, recent activity, top performers."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from src.db.session import get_db
from src.db.models import StudentRow, CourseRow, EnrollmentRow, GradeRow, AssignmentRow
from src.domain.grade_utils import to_percent, score_to_letter

router = APIRouter()


@router.get("/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    total_students = db.query(StudentRow).count()
    total_courses = db.query(CourseRow).count()
    total_enrollments = db.query(EnrollmentRow).count()
    total_grades = db.query(GradeRow).count()

    data = (
        db.query(GradeRow.score, AssignmentRow.max_score)
        .join(AssignmentRow, GradeRow.assignment_id == AssignmentRow.id)
        .all()
    )
    pcts = [to_percent(float(s), float(m)) for s, m in data]
    avg_pct = sum(pcts) / len(pcts) if pcts else 0
    passing = sum(1 for p in pcts if p >= 60)
    pass_rate = (passing / len(pcts)) * 100 if pcts else 0
    avg_gpa = round((avg_pct / 100) * 4 * 100) / 100

    letter_map = {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
    for p in pcts:
        letter_map[score_to_letter(p)] += 1
    grade_dist = [
        {
            "letter": l,
            "count": c,
            "percentage": round((c / len(pcts)) * 1000) / 10 if pcts else 0,
        }
        for l, c in letter_map.items()
    ]

    courses = db.query(CourseRow).all()
    at_risk_count = 0
    seen = set()
    for course in courses:
        enrollments = db.query(EnrollmentRow).filter(EnrollmentRow.course_id == course.id).all()
        assignments = db.query(AssignmentRow).filter(AssignmentRow.course_id == course.id).all()
        for enr in enrollments:
            ws = 0.0
            tw = 0.0
            for asgn in assignments:
                grade = db.query(GradeRow).filter(
                    GradeRow.student_id == enr.student_id,
                    GradeRow.assignment_id == asgn.id,
                ).first()
                if grade:
                    pct = to_percent(float(grade.score), float(asgn.max_score))
                    ws += pct * float(asgn.weight)
                    tw += float(asgn.weight)
            if tw > 0 and ws / tw < 70 and enr.student_id not in seen:
                seen.add(enr.student_id)
                at_risk_count += 1

    return {
        "total_students": total_students,
        "total_courses": total_courses,
        "total_enrollments": total_enrollments,
        "total_grades": total_grades,
        "average_gpa": avg_gpa,
        "at_risk_count": at_risk_count,
        "pass_rate": round(pass_rate * 10) / 10,
        "grade_distribution_overview": grade_dist,
    }


@router.get("/dashboard/recent-activity")
def recent_activity(limit: int = Query(default=10), db: Session = Depends(get_db)):
    half = max(1, limit // 2)
    recent_grades = (
        db.query(GradeRow, StudentRow.name, AssignmentRow.name)
        .outerjoin(StudentRow, GradeRow.student_id == StudentRow.id)
        .outerjoin(AssignmentRow, GradeRow.assignment_id == AssignmentRow.id)
        .order_by(desc(GradeRow.submitted_at))
        .limit(half)
        .all()
    )
    recent_enrollments = (
        db.query(EnrollmentRow, StudentRow.name, CourseRow.name)
        .outerjoin(StudentRow, EnrollmentRow.student_id == StudentRow.id)
        .outerjoin(CourseRow, EnrollmentRow.course_id == CourseRow.id)
        .order_by(desc(EnrollmentRow.enrolled_at))
        .limit(half)
        .all()
    )
    items = [
        {
            "id": g.id,
            "type": "grade_submitted",
            "description": f"{sname or 'Student'} submitted {aname or 'assignment'} — {float(g.score):.1f} pts",
            "timestamp": g.submitted_at.isoformat(),
            "entity_id": g.id,
            "entity_type": "grade",
        }
        for g, sname, aname in recent_grades
    ] + [
        {
            "id": e.id,
            "type": "enrollment",
            "description": f"{sname or 'Student'} enrolled in {cname or 'course'}",
            "timestamp": e.enrolled_at.isoformat(),
            "entity_id": e.id,
            "entity_type": "enrollment",
        }
        for e, sname, cname in recent_enrollments
    ]
    items.sort(key=lambda x: x["timestamp"], reverse=True)
    return items[:limit]


@router.get("/dashboard/top-performers")
def top_performers(limit: int = Query(default=10), db: Session = Depends(get_db)):
    students = db.query(StudentRow).order_by(StudentRow.name).all()
    scored = []
    for s in students:
        enrollments = db.query(EnrollmentRow).filter(EnrollmentRow.student_id == s.id).all()
        total_points = 0.0
        total_credits = 0
        for enr in enrollments:
            course = db.query(CourseRow).filter(CourseRow.id == enr.course_id).first()
            if not course:
                continue
            assignments = db.query(AssignmentRow).filter(AssignmentRow.course_id == enr.course_id).all()
            ws = 0.0
            tw = 0.0
            for asgn in assignments:
                grade = db.query(GradeRow).filter(
                    GradeRow.student_id == s.id,
                    GradeRow.assignment_id == asgn.id,
                ).first()
                if grade:
                    pct = to_percent(float(grade.score), float(asgn.max_score))
                    ws += pct * float(asgn.weight)
                    tw += float(asgn.weight)
            if tw > 0:
                letter = score_to_letter(ws / tw)
                gp = {"A": 4.0, "B": 3.0, "C": 2.0, "D": 1.0, "F": 0.0}.get(letter, 0.0)
                total_points += gp * course.credits
                total_credits += course.credits
        if total_credits > 0:
            scored.append({"student": s, "gpa": round((total_points / total_credits) * 100) / 100})

    scored.sort(key=lambda x: x["gpa"], reverse=True)
    return [
        {
            "student_id": x["student"].id,
            "student_name": x["student"].name,
            "gpa": x["gpa"],
            "major": x["student"].major,
            "year": x["student"].year,
            "rank": i + 1,
        }
        for i, x in enumerate(scored[:limit])
    ]
