import { Router, type IRouter } from "express";
import { eq, ilike, and, sql, avg, max, min, count } from "drizzle-orm";
import { db, coursesTable, enrollmentsTable, studentsTable, assignmentsTable, gradesTable } from "@workspace/db";
import {
  ListCoursesQueryParams,
  CreateCourseBody,
  GetCourseParams,
  UpdateCourseParams,
  UpdateCourseBody,
  DeleteCourseParams,
} from "@workspace/api-zod";
import { scoreToLetter, toPercent, letterToPoints } from "../lib/gradeUtils";

const router: IRouter = Router();

router.get("/courses", async (req, res): Promise<void> => {
  const query = ListCoursesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { semester, search } = query.data;
  const conditions = [];
  if (semester) conditions.push(eq(coursesTable.semester, semester));
  if (search) conditions.push(ilike(coursesTable.name, `%${search}%`));

  const courses = await db
    .select()
    .from(coursesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(coursesTable.name);

  const result = await Promise.all(
    courses.map(async (c) => {
      const enrollmentCount = await db
        .select({ cnt: count() })
        .from(enrollmentsTable)
        .where(eq(enrollmentsTable.courseId, c.id));

      // Compute average grade across all grades in this course
      const gradeData = await db
        .select({ score: gradesTable.score, maxScore: assignmentsTable.maxScore })
        .from(gradesTable)
        .innerJoin(assignmentsTable, eq(gradesTable.assignmentId, assignmentsTable.id))
        .where(eq(assignmentsTable.courseId, c.id));

      let avgGrade: number | null = null;
      if (gradeData.length > 0) {
        const pcts = gradeData.map((g) => toPercent(Number(g.score), Number(g.maxScore)));
        avgGrade = Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10;
      }

      return {
        ...c,
        student_count: Number(enrollmentCount[0]?.cnt ?? 0),
        average_grade: avgGrade,
        created_at: c.createdAt.toISOString(),
      };
    }),
  );

  res.json(result);
});

router.post("/courses", async (req, res): Promise<void> => {
  const parsed = CreateCourseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data as { code: string; name: string; credits: number; semester: string; instructor: string; description?: string };
  const [course] = await db
    .insert(coursesTable)
    .values({ code: d.code, name: d.name, credits: d.credits, semester: d.semester, instructor: d.instructor, description: d.description ?? null })
    .returning();

  res.status(201).json({ ...course, student_count: 0, average_grade: null, created_at: course.createdAt.toISOString() });
});

router.get("/courses/:id", async (req, res): Promise<void> => {
  const params = GetCourseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, params.data.id));
  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  const enrollmentCount = await db.select({ cnt: count() }).from(enrollmentsTable).where(eq(enrollmentsTable.courseId, course.id));
  const gradeData = await db
    .select({ score: gradesTable.score, maxScore: assignmentsTable.maxScore })
    .from(gradesTable)
    .innerJoin(assignmentsTable, eq(gradesTable.assignmentId, assignmentsTable.id))
    .where(eq(assignmentsTable.courseId, course.id));

  let avgGrade: number | null = null;
  if (gradeData.length > 0) {
    const pcts = gradeData.map((g) => toPercent(Number(g.score), Number(g.maxScore)));
    avgGrade = Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10;
  }

  res.json({ ...course, student_count: Number(enrollmentCount[0]?.cnt ?? 0), average_grade: avgGrade, created_at: course.createdAt.toISOString() });
});

router.put("/courses/:id", async (req, res): Promise<void> => {
  const params = UpdateCourseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCourseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  const d = parsed.data as Record<string, unknown>;
  if (d.name) updates.name = d.name;
  if (d.credits !== undefined) updates.credits = d.credits;
  if (d.semester) updates.semester = d.semester;
  if (d.instructor) updates.instructor = d.instructor;
  if (d.description !== undefined) updates.description = d.description;

  const [course] = await db.update(coursesTable).set(updates).where(eq(coursesTable.id, params.data.id)).returning();
  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  res.json({ ...course, student_count: null, average_grade: null, created_at: course.createdAt.toISOString() });
});

router.delete("/courses/:id", async (req, res): Promise<void> => {
  const params = DeleteCourseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(coursesTable).where(eq(coursesTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/courses/:id/students", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const rows = await db
    .select({ student: studentsTable })
    .from(enrollmentsTable)
    .innerJoin(studentsTable, eq(enrollmentsTable.studentId, studentsTable.id))
    .where(eq(enrollmentsTable.courseId, id));

  res.json(rows.map((r) => ({ ...r.student, student_id: r.student.studentId, gpa: null, created_at: r.student.createdAt.toISOString() })));
});

router.get("/courses/:id/stats", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const enrollmentCount = await db.select({ cnt: count() }).from(enrollmentsTable).where(eq(enrollmentsTable.courseId, id));
  const studentCount = Number(enrollmentCount[0]?.cnt ?? 0);

  const gradeData = await db
    .select({ score: gradesTable.score, maxScore: assignmentsTable.maxScore })
    .from(gradesTable)
    .innerJoin(assignmentsTable, eq(gradesTable.assignmentId, assignmentsTable.id))
    .where(eq(assignmentsTable.courseId, id));

  if (gradeData.length === 0) {
    res.json({ course_id: id, average_grade: 0, median_grade: 0, pass_rate: 0, fail_rate: 0, highest_grade: 0, lowest_grade: 0, student_count: studentCount, std_deviation: null });
    return;
  }

  const pcts = gradeData.map((g) => toPercent(Number(g.score), Number(g.maxScore)));
  pcts.sort((a, b) => a - b);

  const mean = pcts.reduce((a, b) => a + b, 0) / pcts.length;
  const median = pcts.length % 2 === 0 ? (pcts[pcts.length / 2 - 1] + pcts[pcts.length / 2]) / 2 : pcts[Math.floor(pcts.length / 2)];
  const passing = pcts.filter((p) => p >= 60).length;
  const variance = pcts.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / pcts.length;
  const stdDev = Math.sqrt(variance);

  res.json({
    course_id: id,
    average_grade: Math.round(mean * 10) / 10,
    median_grade: Math.round(median * 10) / 10,
    pass_rate: Math.round((passing / pcts.length) * 1000) / 10,
    fail_rate: Math.round(((pcts.length - passing) / pcts.length) * 1000) / 10,
    highest_grade: Math.round(pcts[pcts.length - 1] * 10) / 10,
    lowest_grade: Math.round(pcts[0] * 10) / 10,
    student_count: studentCount,
    std_deviation: Math.round(stdDev * 10) / 10,
  });
});

export default router;
