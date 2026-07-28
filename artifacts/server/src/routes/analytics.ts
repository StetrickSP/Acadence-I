import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import {
  db, gradesTable, assignmentsTable, coursesTable, enrollmentsTable, studentsTable,
} from "@workspace/db";
import {
  GetGradeDistributionQueryParams,
  GetAtRiskStudentsQueryParams,
  GetSemesterTrendsQueryParams,
  GetAssignmentCompletionQueryParams,
} from "@workspace/api-zod";
import { scoreToLetter, toPercent, letterToPoints, riskLevel } from "../lib/gradeUtils";

const router: IRouter = Router();

// GET /analytics/grade-distribution?course_id=X
router.get("/analytics/grade-distribution", async (req, res): Promise<void> => {
  const query = GetGradeDistributionQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { course_id } = query.data as { course_id: number };

  const gradeData = await db
    .select({ score: gradesTable.score, maxScore: assignmentsTable.maxScore })
    .from(gradesTable)
    .innerJoin(assignmentsTable, eq(gradesTable.assignmentId, assignmentsTable.id))
    .where(eq(assignmentsTable.courseId, course_id));

  const pcts = gradeData.map((g) => toPercent(Number(g.score), Number(g.maxScore)));

  // Build 10-point buckets
  const bucketDefs = [
    { range: "0-9", min: 0, max: 10 },
    { range: "10-19", min: 10, max: 20 },
    { range: "20-29", min: 20, max: 30 },
    { range: "30-39", min: 30, max: 40 },
    { range: "40-49", min: 40, max: 50 },
    { range: "50-59", min: 50, max: 60 },
    { range: "60-69", min: 60, max: 70 },
    { range: "70-79", min: 70, max: 80 },
    { range: "80-89", min: 80, max: 90 },
    { range: "90-100", min: 90, max: 101 },
  ];

  const buckets = bucketDefs.map((b) => {
    const c = pcts.filter((p) => p >= b.min && p < b.max).length;
    return { range: b.range, count: c, percentage: pcts.length > 0 ? Math.round((c / pcts.length) * 1000) / 10 : 0 };
  });

  // Letter grade counts
  const letterMap: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  pcts.forEach((p) => { letterMap[scoreToLetter(p)]++; });
  const letterCounts = Object.entries(letterMap).map(([letter, c]) => ({
    letter,
    count: c,
    percentage: pcts.length > 0 ? Math.round((c / pcts.length) * 1000) / 10 : 0,
  }));

  res.json({ course_id, buckets, letter_counts: letterCounts });
});

// GET /analytics/at-risk?course_id=X&threshold=Y
router.get("/analytics/at-risk", async (req, res): Promise<void> => {
  const query = GetAtRiskStudentsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { course_id, threshold } = query.data as { course_id?: number; threshold?: number };
  const minPct = threshold ?? 70; // default: below 70% is at risk

  const courses = course_id
    ? await db.select().from(coursesTable).where(eq(coursesTable.id, course_id))
    : await db.select().from(coursesTable);

  const result = [];

  for (const course of courses) {
    const enrollments = await db
      .select()
      .from(enrollmentsTable)
      .where(eq(enrollmentsTable.courseId, course.id));

    for (const enr of enrollments) {
      const student = await db.select().from(studentsTable).where(eq(studentsTable.id, enr.studentId)).limit(1);
      if (!student[0]) continue;

      const assignments = await db.select().from(assignmentsTable).where(eq(assignmentsTable.courseId, course.id));
      let weightedScore = 0;
      let totalWeight = 0;
      let missing = 0;

      for (const asgn of assignments) {
        const grade = await db.select().from(gradesTable).where(and(eq(gradesTable.studentId, enr.studentId), eq(gradesTable.assignmentId, asgn.id))).limit(1);
        if (grade[0]) {
          const pct = toPercent(Number(grade[0].score), Number(asgn.maxScore));
          weightedScore += pct * Number(asgn.weight);
          totalWeight += Number(asgn.weight);
        } else {
          missing++;
        }
      }

      if (totalWeight > 0) {
        const currentPct = weightedScore / totalWeight;
        if (currentPct < minPct) {
          const letter = scoreToLetter(currentPct);
          result.push({
            student_id: student[0].id,
            student_name: student[0].name,
            current_grade: Math.round(currentPct * 10) / 10,
            letter_grade: letter,
            course_name: course.name,
            course_id: course.id,
            assignments_missing: missing,
            risk_level: riskLevel(currentPct),
          });
        }
      } else if (assignments.length > 0) {
        // Has assignments but no grades at all — high risk
        result.push({
          student_id: student[0].id,
          student_name: student[0].name,
          current_grade: 0,
          letter_grade: "F",
          course_name: course.name,
          course_id: course.id,
          assignments_missing: assignments.length,
          risk_level: "high" as const,
        });
      }
    }
  }

  res.json(result);
});

// GET /analytics/course-performance
router.get("/analytics/course-performance", async (req, res): Promise<void> => {
  const courses = await db.select().from(coursesTable).orderBy(coursesTable.name);

  const result = await Promise.all(
    courses.map(async (c) => {
      const enrollmentCount = await db.select({ cnt: count() }).from(enrollmentsTable).where(eq(enrollmentsTable.courseId, c.id));
      const gradeData = await db
        .select({ score: gradesTable.score, maxScore: assignmentsTable.maxScore })
        .from(gradesTable)
        .innerJoin(assignmentsTable, eq(gradesTable.assignmentId, assignmentsTable.id))
        .where(eq(assignmentsTable.courseId, c.id));

      const pcts = gradeData.map((g) => toPercent(Number(g.score), Number(g.maxScore)));
      const avg = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
      const passing = pcts.filter((p) => p >= 60).length;
      const passRate = pcts.length > 0 ? (passing / pcts.length) * 100 : 0;

      return {
        course_id: c.id,
        course_name: c.name,
        average_grade: Math.round(avg * 10) / 10,
        pass_rate: Math.round(passRate * 10) / 10,
        student_count: Number(enrollmentCount[0]?.cnt ?? 0),
        semester: c.semester,
        difficulty_score: avg > 0 ? Math.round((100 - avg) * 10) / 10 : null,
      };
    }),
  );

  res.json(result);
});

// GET /analytics/semester-trends?student_id=X
router.get("/analytics/semester-trends", async (req, res): Promise<void> => {
  const query = GetSemesterTrendsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { student_id } = query.data as { student_id?: number };

  // Group enrollments by semester
  const enrollments = student_id
    ? await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.studentId, student_id))
    : await db.select().from(enrollmentsTable);

  // Build map: semester -> {totalPoints, totalCredits}
  const semesterMap: Map<string, { totalPoints: number; totalCredits: number; courseCount: number }> = new Map();

  for (const enr of enrollments) {
    const course = await db.select().from(coursesTable).where(eq(coursesTable.id, enr.courseId)).limit(1);
    if (!course[0]) continue;

    const assignments = await db.select().from(assignmentsTable).where(eq(assignmentsTable.courseId, enr.courseId));
    let weightedScore = 0;
    let totalWeight = 0;

    for (const asgn of assignments) {
      const studentFilter = student_id ? and(eq(gradesTable.studentId, student_id), eq(gradesTable.assignmentId, asgn.id)) : eq(gradesTable.assignmentId, asgn.id);
      const grades = await db.select().from(gradesTable).where(studentFilter);
      if (grades.length > 0) {
        const avgPct = grades.reduce((sum, g) => sum + toPercent(Number(g.score), Number(asgn.maxScore)), 0) / grades.length;
        weightedScore += avgPct * Number(asgn.weight);
        totalWeight += Number(asgn.weight);
      }
    }

    if (totalWeight > 0) {
      const finalPct = weightedScore / totalWeight;
      const letter = scoreToLetter(finalPct);
      const gp = letterToPoints(letter);
      const existing = semesterMap.get(enr.semester) ?? { totalPoints: 0, totalCredits: 0, courseCount: 0 };
      semesterMap.set(enr.semester, {
        totalPoints: existing.totalPoints + gp * course[0].credits,
        totalCredits: existing.totalCredits + course[0].credits,
        courseCount: existing.courseCount + 1,
      });
    }
  }

  const result = Array.from(semesterMap.entries())
    .map(([semester, data]) => ({
      semester,
      gpa: data.totalCredits > 0 ? Math.round((data.totalPoints / data.totalCredits) * 100) / 100 : 0,
      courses_taken: data.courseCount,
      student_id: student_id ?? null,
    }))
    .sort((a, b) => a.semester.localeCompare(b.semester));

  res.json(result);
});

// GET /analytics/assignment-completion?course_id=X
router.get("/analytics/assignment-completion", async (req, res): Promise<void> => {
  const query = GetAssignmentCompletionQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { course_id } = query.data as { course_id?: number };

  const assignments = course_id
    ? await db.select().from(assignmentsTable).where(eq(assignmentsTable.courseId, course_id))
    : await db.select().from(assignmentsTable);

  const result = await Promise.all(
    assignments.map(async (asgn) => {
      const enrollmentCount = await db.select({ cnt: count() }).from(enrollmentsTable).where(eq(enrollmentsTable.courseId, asgn.courseId));
      const total = Number(enrollmentCount[0]?.cnt ?? 0);
      const submitted = await db.select({ cnt: count() }).from(gradesTable).where(eq(gradesTable.assignmentId, asgn.id));
      const submittedCount = Number(submitted[0]?.cnt ?? 0);
      const completionRate = total > 0 ? Math.round((submittedCount / total) * 1000) / 10 : 0;

      const gradeData = await db.select({ score: gradesTable.score }).from(gradesTable).where(eq(gradesTable.assignmentId, asgn.id));
      let avgScore: number | null = null;
      if (gradeData.length > 0) {
        const pcts = gradeData.map((g) => toPercent(Number(g.score), Number(asgn.maxScore)));
        avgScore = Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10;
      }

      return {
        assignment_id: asgn.id,
        assignment_name: asgn.name,
        type: asgn.type,
        submitted_count: submittedCount,
        total_enrolled: total,
        completion_rate: completionRate,
        average_score: avgScore,
      };
    }),
  );

  res.json(result);
});

export default router;
