"""Analytics routes — grade distribution, at-risk, performance, trends, completion."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.db.models import GradeRow, AssignmentRow, CourseRow, EnrollmentRow, StudentRow
from src.domain.grade_utils import to_percent, score_to_letter, letter_to_points, risk_level

router = APIRouter()


@router.get("/analytics/grade-distribution")
def grade_distribution(course_id: int = Query(...), db: Session = Depends(get_db)):
    data = (
        db.query(GradeRow.score, AssignmentRow.max_score)
        .join(AssignmentRow, GradeRow.assignment_id == AssignmentRow.id)
        .filter(AssignmentRow.course_id == course_id)
        .all()
    )
    pcts = [to_percent(float(s), float(m)) for s, m in data]
    buckets = [
        {"range": f"{lo}-{hi - 1}", "min": lo, "max": hi}
        for lo, hi in [(i * 10, i * 10 + 10) for i in range(10)]
    ]
    buckets[-1]["range"] = "90-100"
    buckets[-1]["max"] = 101
    result_buckets = []
    for b in buckets:
        c = sum(1 for p in pcts if b["min"] <= p < b["max"])
        result_buckets.append({
            "range": b["range"],
            "count": c,
            "percentage": round((c / len(pcts)) * 1000) / 10 if pcts else 0,
        })
    letter_map = {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
    for p in pcts:
        letter_map[score_to_letter(p)] += 1
    letter_counts = [
        {
            "letter": l,
            "count": c,
            "percentage": round((c / len(pcts)) * 1000) / 10 if pcts else 0,
        }
        for l, c in letter_map.items()
    ]
    return {"course_id": course_id, "buckets": result_buckets, "letter_counts": letter_counts}


@router.get("/analytics/at-risk")
def at_risk_students(
    course_id: Optional[int] = Query(None),
    threshold: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    min_pct = threshold if threshold is not None else 70.0
    courses = (
        db.query(CourseRow).filter(CourseRow.id == course_id).all()
        if course_id
        else db.query(CourseRow).all()
    )
    result = []
    for course in courses:
        enrollments = db.query(EnrollmentRow).filter(EnrollmentRow.course_id == course.id).all()
        assignments = db.query(AssignmentRow).filter(AssignmentRow.course_id == course.id).all()
        for enr in enrollments:
            student = db.query(StudentRow).filter(StudentRow.id == enr.student_id).first()
            if not student:
                continue
            weighted_score = 0.0
            total_weight = 0.0
            missing = 0
            for asgn in assignments:
                grade = db.query(GradeRow).filter(
                    GradeRow.student_id == enr.student_id,
                    GradeRow.assignment_id == asgn.id,
                ).first()
                if grade:
                    pct = to_percent(float(grade.score), float(asgn.max_score))
                    weighted_score += pct * float(asgn.weight)
                    total_weight += float(asgn.weight)
                else:
                    missing += 1
            if total_weight > 0:
                current_pct = weighted_score / total_weight
                if current_pct < min_pct:
                    result.append({
                        "student_id": student.id,
                        "student_name": student.name,
                        "current_grade": round(current_pct * 10) / 10,
                        "letter_grade": score_to_letter(current_pct),
                        "course_name": course.name,
                        "course_id": course.id,
                        "assignments_missing": missing,
                        "risk_level": risk_level(current_pct),
                    })
            elif assignments:
                result.append({
                    "student_id": student.id,
                    "student_name": student.name,
                    "current_grade": 0.0,
                    "letter_grade": "F",
                    "course_name": course.name,
                    "course_id": course.id,
                    "assignments_missing": len(assignments),
                    "risk_level": "high",
                })
    return result


@router.get("/analytics/course-performance")
def course_performance(db: Session = Depends(get_db)):
    courses = db.query(CourseRow).order_by(CourseRow.name).all()
    result = []
    for c in courses:
        enr_count = db.query(EnrollmentRow).filter(EnrollmentRow.course_id == c.id).count()
        data = (
            db.query(GradeRow.score, AssignmentRow.max_score)
            .join(AssignmentRow, GradeRow.assignment_id == AssignmentRow.id)
            .filter(AssignmentRow.course_id == c.id)
            .all()
        )
        pcts = [to_percent(float(s), float(m)) for s, m in data]
        avg = sum(pcts) / len(pcts) if pcts else 0
        passing = sum(1 for p in pcts if p >= 60)
        pass_rate = (passing / len(pcts)) * 100 if pcts else 0
        result.append({
            "course_id": c.id,
            "course_name": c.name,
            "average_grade": round(avg * 10) / 10,
            "pass_rate": round(pass_rate * 10) / 10,
            "student_count": enr_count,
            "semester": c.semester,
            "difficulty_score": round((100 - avg) * 10) / 10 if avg > 0 else None,
        })
    return result


@router.get("/analytics/semester-trends")
def semester_trends(student_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    enrollments = (
        db.query(EnrollmentRow).filter(EnrollmentRow.student_id == student_id).all()
        if student_id
        else db.query(EnrollmentRow).all()
    )
    semester_map: dict = {}
    for enr in enrollments:
        course = db.query(CourseRow).filter(CourseRow.id == enr.course_id).first()
        if not course:
            continue
        assignments = db.query(AssignmentRow).filter(AssignmentRow.course_id == enr.course_id).all()
        weighted_score = 0.0
        total_weight = 0.0
        for asgn in assignments:
            q = db.query(GradeRow).filter(GradeRow.assignment_id == asgn.id)
            if student_id:
                q = q.filter(GradeRow.student_id == student_id)
            grades = q.all()
            if grades:
                avg_pct = sum(to_percent(float(g.score), float(asgn.max_score)) for g in grades) / len(grades)
                weighted_score += avg_pct * float(asgn.weight)
                total_weight += float(asgn.weight)
        if total_weight > 0:
            final_pct = weighted_score / total_weight
            gp = letter_to_points(score_to_letter(final_pct))
            existing = semester_map.get(enr.semester, {"totalPoints": 0.0, "totalCredits": 0, "courseCount": 0})
            semester_map[enr.semester] = {
                "totalPoints": existing["totalPoints"] + gp * course.credits,
                "totalCredits": existing["totalCredits"] + course.credits,
                "courseCount": existing["courseCount"] + 1,
            }
    return sorted(
        [
            {
                "semester": sem,
                "gpa": round((d["totalPoints"] / d["totalCredits"]) * 100) / 100 if d["totalCredits"] > 0 else 0,
                "courses_taken": d["courseCount"],
                "student_id": student_id,
            }
            for sem, d in semester_map.items()
        ],
        key=lambda x: x["semester"],
    )


@router.get("/analytics/assignment-completion")
def assignment_completion(course_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    q = db.query(AssignmentRow)
    if course_id is not None:
        q = q.filter(AssignmentRow.course_id == course_id)
    assignments = q.all()
    result = []
    for asgn in assignments:
        total = db.query(EnrollmentRow).filter(EnrollmentRow.course_id == asgn.course_id).count()
        submitted = db.query(GradeRow).filter(GradeRow.assignment_id == asgn.id).count()
        completion_rate = round((submitted / total) * 1000) / 10 if total > 0 else 0
        scores = db.query(GradeRow.score).filter(GradeRow.assignment_id == asgn.id).all()
        avg_score = None
        if scores:
            pcts = [to_percent(float(s[0]), float(asgn.max_score)) for s in scores]
            avg_score = round(sum(pcts) / len(pcts) * 10) / 10
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
