import { Router, type IRouter } from "express";
import { count, desc } from "drizzle-orm";
import { db, studentsTable, coursesTable, enrollmentsTable, gradesTable, assignmentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { scoreToLetter, toPercent, riskLevel } from "../lib/gradeUtils";
import { GetRecentActivityQueryParams, GetTopPerformersQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

// GET /dashboard/summary
router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const [totalStudents, totalCourses, totalEnrollments, totalGrades] = await Promise.all([
    db.select({ cnt: count() }).from(studentsTable),
    db.select({ cnt: count() }).from(coursesTable),
    db.select({ cnt: count() }).from(enrollmentsTable),
    db.select({ cnt: count() }).from(gradesTable),
  ]);

  // All grade percentages
  const gradeData = await db
    .select({ score: gradesTable.score, maxScore: assignmentsTable.maxScore })
    .from(gradesTable)
    .innerJoin(assignmentsTable, eq(gradesTable.assignmentId, assignmentsTable.id));

  const pcts = gradeData.map((g) => toPercent(Number(g.score), Number(g.maxScore)));
  const avgPct = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
  const passing = pcts.filter((p) => p >= 60).length;
  const passRate = pcts.length > 0 ? (passing / pcts.length) * 100 : 0;
  const avgGpa = Math.round((avgPct / 100) * 4 * 100) / 100;

  // Grade distribution overview
  const letterMap: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  pcts.forEach((p) => { letterMap[scoreToLetter(p)]++; });
  const gradeDistOverview = Object.entries(letterMap).map(([letter, c]) => ({
    letter,
    count: c,
    percentage: pcts.length > 0 ? Math.round((c / pcts.length) * 1000) / 10 : 0,
  }));

  // At-risk count (students with weighted avg < 70%)
  const courses = await db.select().from(coursesTable);
  let atRiskCount = 0;
  const seen = new Set<string>();

  for (const course of courses) {
    const enrollments = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.courseId, course.id));
    const assignments = await db.select().from(assignmentsTable).where(eq(assignmentsTable.courseId, course.id));
    for (const enr of enrollments) {
      let weightedScore = 0;
      let totalWeight = 0;
      for (const asgn of assignments) {
        const grade = await db.select().from(gradesTable).where(and(eq(gradesTable.studentId, enr.studentId), eq(gradesTable.assignmentId, asgn.id))).limit(1);
        if (grade[0]) {
          const pct = toPercent(Number(grade[0].score), Number(asgn.maxScore));
          weightedScore += pct * Number(asgn.weight);
          totalWeight += Number(asgn.weight);
        }
      }
      if (totalWeight > 0 && weightedScore / totalWeight < 70) {
        const key = `${enr.studentId}`;
        if (!seen.has(key)) { seen.add(key); atRiskCount++; }
      }
    }
  }

  res.json({
    total_students: Number(totalStudents[0]?.cnt ?? 0),
    total_courses: Number(totalCourses[0]?.cnt ?? 0),
    total_enrollments: Number(totalEnrollments[0]?.cnt ?? 0),
    total_grades: Number(totalGrades[0]?.cnt ?? 0),
    average_gpa: avgGpa,
    at_risk_count: atRiskCount,
    pass_rate: Math.round(passRate * 10) / 10,
    grade_distribution_overview: gradeDistOverview,
  });
});

// GET /dashboard/recent-activity?limit=N
router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const query = GetRecentActivityQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const limit = (query.data as { limit?: number }).limit ?? 10;

  const recentGrades = await db
    .select({
      id: gradesTable.id,
      score: gradesTable.score,
      submittedAt: gradesTable.submittedAt,
      studentName: studentsTable.name,
      assignmentName: assignmentsTable.name,
    })
    .from(gradesTable)
    .leftJoin(studentsTable, eq(gradesTable.studentId, studentsTable.id))
    .leftJoin(assignmentsTable, eq(gradesTable.assignmentId, assignmentsTable.id))
    .orderBy(desc(gradesTable.submittedAt))
    .limit(Math.ceil(limit / 2));

  const recentEnrollments = await db
    .select({
      id: enrollmentsTable.id,
      enrolledAt: enrollmentsTable.enrolledAt,
      studentName: studentsTable.name,
      courseName: coursesTable.name,
    })
    .from(enrollmentsTable)
    .leftJoin(studentsTable, eq(enrollmentsTable.studentId, studentsTable.id))
    .leftJoin(coursesTable, eq(enrollmentsTable.courseId, coursesTable.id))
    .orderBy(desc(enrollmentsTable.enrolledAt))
    .limit(Math.ceil(limit / 2));

  const items = [
    ...recentGrades.map((g) => ({
      id: g.id,
      type: "grade_submitted",
      description: `${g.studentName ?? "Student"} submitted ${g.assignmentName ?? "assignment"} — ${Number(g.score).toFixed(1)} pts`,
      timestamp: g.submittedAt.toISOString(),
      entity_id: g.id,
      entity_type: "grade",
    })),
    ...recentEnrollments.map((e) => ({
      id: e.id,
      type: "enrollment",
      description: `${e.studentName ?? "Student"} enrolled in ${e.courseName ?? "course"}`,
      timestamp: e.enrolledAt.toISOString(),
      entity_id: e.id,
      entity_type: "enrollment",
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  res.json(items);
});

// GET /dashboard/top-performers?limit=N
router.get("/dashboard/top-performers", async (req, res): Promise<void> => {
  const query = GetTopPerformersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const limit = (query.data as { limit?: number }).limit ?? 10;

  const students = await db.select().from(studentsTable).orderBy(studentsTable.name);

  const scored = await Promise.all(
    students.map(async (s) => {
      const enrollments = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.studentId, s.id));
      let totalPoints = 0;
      let totalCredits = 0;

      for (const enr of enrollments) {
        const course = await db.select().from(coursesTable).where(eq(coursesTable.id, enr.courseId)).limit(1);
        if (!course[0]) continue;
        const assignments = await db.select().from(assignmentsTable).where(eq(assignmentsTable.courseId, enr.courseId));
        let weightedScore = 0;
        let totalWeight = 0;
        for (const asgn of assignments) {
          const grade = await db.select().from(gradesTable).where(and(eq(gradesTable.studentId, s.id), eq(gradesTable.assignmentId, asgn.id))).limit(1);
          if (grade[0]) {
            const pct = toPercent(Number(grade[0].score), Number(asgn.maxScore));
            weightedScore += pct * Number(asgn.weight);
            totalWeight += Number(asgn.weight);
          }
        }
        if (totalWeight > 0) {
          const letter = scoreToLetter(weightedScore / totalWeight);
          const gp = letter === "A" ? 4.0 : letter === "B" ? 3.0 : letter === "C" ? 2.0 : letter === "D" ? 1.0 : 0.0;
          totalPoints += gp * course[0].credits;
          totalCredits += course[0].credits;
        }
      }

      return { student: s, gpa: totalCredits > 0 ? Math.round((totalPoints / totalCredits) * 100) / 100 : null };
    }),
  );

  const ranked = scored
    .filter((s) => s.gpa !== null)
    .sort((a, b) => (b.gpa ?? 0) - (a.gpa ?? 0))
    .slice(0, limit)
    .map((s, i) => ({
      student_id: s.student.id,
      student_name: s.student.name,
      gpa: s.gpa!,
      major: s.student.major,
      year: s.student.year,
      rank: i + 1,
    }));

  res.json(ranked);
});

export default router;
