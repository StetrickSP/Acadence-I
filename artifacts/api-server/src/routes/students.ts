import { Router, type IRouter } from "express";
import { eq, ilike, and, sql } from "drizzle-orm";
import { db, studentsTable, enrollmentsTable, coursesTable, assignmentsTable, gradesTable } from "@workspace/db";
import {
  ListStudentsQueryParams,
  CreateStudentBody,
  GetStudentParams,
  UpdateStudentParams,
  UpdateStudentBody,
  DeleteStudentParams,
} from "@workspace/api-zod";
import { scoreToLetter, toPercent, letterToPoints } from "../lib/gradeUtils";

const router: IRouter = Router();

// Helper: compute GPA for a student
async function computeStudentGpa(studentId: number): Promise<number | null> {
  const enrollments = await db
    .select({ courseId: enrollmentsTable.courseId })
    .from(enrollmentsTable)
    .where(eq(enrollmentsTable.studentId, studentId));

  if (enrollments.length === 0) return null;

  let totalPoints = 0;
  let totalCredits = 0;

  for (const enr of enrollments) {
    const course = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.id, enr.courseId))
      .limit(1);
    if (!course[0]) continue;

    const assignments = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.courseId, enr.courseId));

    let weightedScore = 0;
    let totalWeight = 0;
    for (const asgn of assignments) {
      const gradeRows = await db
        .select()
        .from(gradesTable)
        .where(
          and(
            eq(gradesTable.studentId, studentId),
            eq(gradesTable.assignmentId, asgn.id),
          ),
        )
        .limit(1);
      if (gradeRows[0]) {
        const pct = toPercent(Number(gradeRows[0].score), Number(asgn.maxScore));
        weightedScore += pct * Number(asgn.weight);
        totalWeight += Number(asgn.weight);
      }
    }
    if (totalWeight > 0) {
      const finalPct = weightedScore / totalWeight;
      const letter = scoreToLetter(finalPct);
      totalPoints += letterToPoints(letter) * course[0].credits;
      totalCredits += course[0].credits;
    }
  }

  if (totalCredits === 0) return null;
  return Math.round((totalPoints / totalCredits) * 100) / 100;
}

router.get("/students", async (req, res): Promise<void> => {
  const query = ListStudentsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { search, major, year } = query.data;

  const conditions = [];
  if (search) conditions.push(ilike(studentsTable.name, `%${search}%`));
  if (major) conditions.push(ilike(studentsTable.major, `%${major}%`));
  if (year !== undefined) conditions.push(eq(studentsTable.year, year));

  const students = await db
    .select()
    .from(studentsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(studentsTable.name);

  const result = await Promise.all(
    students.map(async (s) => ({
      ...s,
      gpa: await computeStudentGpa(s.id),
      created_at: s.createdAt.toISOString(),
      student_id: s.studentId,
    })),
  );

  res.json(result);
});

router.post("/students", async (req, res): Promise<void> => {
  const parsed = CreateStudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, student_id, year, major } = parsed.data as { name: string; email: string; student_id: string; year: number; major: string };
  const [student] = await db
    .insert(studentsTable)
    .values({ name, email, studentId: student_id, year, major })
    .returning();

  res.status(201).json({ ...student, student_id: student.studentId, gpa: null, created_at: student.createdAt.toISOString() });
});

router.get("/students/:id", async (req, res): Promise<void> => {
  const params = GetStudentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, params.data.id));

  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const gpa = await computeStudentGpa(student.id);
  res.json({ ...student, student_id: student.studentId, gpa, created_at: student.createdAt.toISOString() });
});

router.put("/students/:id", async (req, res): Promise<void> => {
  const params = UpdateStudentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateStudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  const d = parsed.data as Record<string, unknown>;
  if (d.name) updates.name = d.name;
  if (d.email) updates.email = d.email;
  if (d.year !== undefined) updates.year = d.year;
  if (d.major) updates.major = d.major;

  const [student] = await db
    .update(studentsTable)
    .set(updates)
    .where(eq(studentsTable.id, params.data.id))
    .returning();

  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const gpa = await computeStudentGpa(student.id);
  res.json({ ...student, student_id: student.studentId, gpa, created_at: student.createdAt.toISOString() });
});

router.delete("/students/:id", async (req, res): Promise<void> => {
  const params = DeleteStudentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(studentsTable).where(eq(studentsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/students/:id/gpa", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const enrollments = await db
    .select({ courseId: enrollmentsTable.courseId })
    .from(enrollmentsTable)
    .where(eq(enrollmentsTable.studentId, id));

  let totalPoints = 0;
  let totalCredits = 0;
  const breakdown = [];

  for (const enr of enrollments) {
    const course = await db.select().from(coursesTable).where(eq(coursesTable.id, enr.courseId)).limit(1);
    if (!course[0]) continue;

    const assignments = await db.select().from(assignmentsTable).where(eq(assignmentsTable.courseId, enr.courseId));
    let weightedScore = 0;
    let totalWeight = 0;
    for (const asgn of assignments) {
      const gradeRows = await db.select().from(gradesTable).where(and(eq(gradesTable.studentId, id), eq(gradesTable.assignmentId, asgn.id))).limit(1);
      if (gradeRows[0]) {
        const pct = toPercent(Number(gradeRows[0].score), Number(asgn.maxScore));
        weightedScore += pct * Number(asgn.weight);
        totalWeight += Number(asgn.weight);
      }
    }
    if (totalWeight > 0) {
      const finalPct = weightedScore / totalWeight;
      const letter = scoreToLetter(finalPct);
      const gp = letterToPoints(letter);
      totalPoints += gp * course[0].credits;
      totalCredits += course[0].credits;
      breakdown.push({ course_name: course[0].name, grade: letter, grade_points: gp, credits: course[0].credits });
    }
  }

  const gpa = totalCredits > 0 ? Math.round((totalPoints / totalCredits) * 100) / 100 : 0;
  const letter = scoreToLetter((gpa / 4) * 100);

  res.json({
    student_id: id,
    gpa,
    total_courses: enrollments.length,
    completed_courses: breakdown.length,
    letter_grade: letter,
    grade_points_breakdown: breakdown,
  });
});

router.get("/students/:id/courses", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const enrollments = await db
    .select()
    .from(enrollmentsTable)
    .where(eq(enrollmentsTable.studentId, id));

  const result = [];
  for (const enr of enrollments) {
    const course = await db.select().from(coursesTable).where(eq(coursesTable.id, enr.courseId)).limit(1);
    if (!course[0]) continue;

    const assignments = await db.select().from(assignmentsTable).where(eq(assignmentsTable.courseId, enr.courseId));
    let weightedScore = 0;
    let totalWeight = 0;
    for (const asgn of assignments) {
      const gradeRows = await db.select().from(gradesTable).where(and(eq(gradesTable.studentId, id), eq(gradesTable.assignmentId, asgn.id))).limit(1);
      if (gradeRows[0]) {
        const pct = toPercent(Number(gradeRows[0].score), Number(asgn.maxScore));
        weightedScore += pct * Number(asgn.weight);
        totalWeight += Number(asgn.weight);
      }
    }

    let currentGrade: number | null = null;
    let letterGrade: string | null = null;
    if (totalWeight > 0) {
      currentGrade = Math.round((weightedScore / totalWeight) * 10) / 10;
      letterGrade = scoreToLetter(currentGrade);
    }

    result.push({
      course_id: course[0].id,
      course_name: course[0].name,
      course_code: course[0].code,
      semester: enr.semester,
      current_grade: currentGrade,
      letter_grade: letterGrade,
      credits: course[0].credits,
    });
  }

  res.json(result);
});

export default router;
