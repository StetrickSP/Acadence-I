import { Router, type IRouter } from "express";
import { eq, ilike, and, sql } from "drizzle-orm";
import { db, studentsTable, enrollmentsTable, coursesTable, assignmentsTable, gradesTable } from "@workspace/db";
import type { GradingScheme } from "@workspace/db";
import {
  ListStudentsQueryParams,
  CreateStudentBody,
  GetStudentParams,
  UpdateStudentParams,
  UpdateStudentBody,
  DeleteStudentParams,
} from "@workspace/api-zod";
import { scoreToLetter, toPercent, letterToPoints } from "../lib/gradeUtils";
import { StudentModel } from "../domain/StudentModel";
import type { AssignmentScore } from "../domain/GradeBook";

const router: IRouter = Router();

// Helper: compute GPA for a student using per-course GradeBook
async function computeStudentGpa(studentId: number): Promise<number | null> {
  const enrollments = await db
    .select({ courseId: enrollmentsTable.courseId })
    .from(enrollmentsTable)
    .where(eq(enrollmentsTable.studentId, studentId));

  if (enrollments.length === 0) return null;

  const courseGrades = [];

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

    const scores: AssignmentScore[] = [];
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
        scores.push({
          assignmentId: asgn.id,
          score: Number(gradeRows[0].score),
          maxScore: Number(asgn.maxScore),
          weight: Number(asgn.weight),
          name: asgn.name,
          type: asgn.type,
        });
      }
    }

    const gradeInfo = StudentModel.computeCourseGrade(
      scores,
      course[0].id,
      course[0].name,
      course[0].code,
      course[0].credits,
      course[0].semester,
      course[0].gradingScheme as GradingScheme,
    );
    courseGrades.push(gradeInfo);
  }

  // Use StudentModel to calculate GPA (excludes pass/fail courses)
  const dummy = new StudentModel(studentId, "", "", "", 0, "");
  return dummy.calculateGPA(courseGrades);
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

  const courseGrades = [];

  for (const enr of enrollments) {
    const course = await db.select().from(coursesTable).where(eq(coursesTable.id, enr.courseId)).limit(1);
    if (!course[0]) continue;

    const assignments = await db.select().from(assignmentsTable).where(eq(assignmentsTable.courseId, enr.courseId));
    const scores: AssignmentScore[] = [];
    for (const asgn of assignments) {
      const gradeRows = await db.select().from(gradesTable).where(and(eq(gradesTable.studentId, id), eq(gradesTable.assignmentId, asgn.id))).limit(1);
      if (gradeRows[0]) {
        scores.push({
          assignmentId: asgn.id,
          score: Number(gradeRows[0].score),
          maxScore: Number(asgn.maxScore),
          weight: Number(asgn.weight),
          name: asgn.name,
          type: asgn.type,
        });
      }
    }

    const gradeInfo = StudentModel.computeCourseGrade(
      scores,
      course[0].id,
      course[0].name,
      course[0].code,
      course[0].credits,
      course[0].semester,
      course[0].gradingScheme as GradingScheme,
    );
    courseGrades.push(gradeInfo);
  }

  const dummy = new StudentModel(id, "", "", "", 0, "");
  const gpa = dummy.calculateGPA(courseGrades) ?? 0;
  const letter = scoreToLetter((gpa / 4) * 100);

  const breakdown = courseGrades
    .filter((c) => c.letterGrade !== null)
    .map((c) => ({
      course_name: c.courseName,
      grade: c.displayLabel ?? c.letterGrade,
      grade_points: c.gradePoints,
      credits: c.credits,
      grading_scheme: c.gradingScheme,
    }));

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
    const scores: AssignmentScore[] = [];
    for (const asgn of assignments) {
      const gradeRows = await db.select().from(gradesTable).where(and(eq(gradesTable.studentId, id), eq(gradesTable.assignmentId, asgn.id))).limit(1);
      if (gradeRows[0]) {
        scores.push({
          assignmentId: asgn.id,
          score: Number(gradeRows[0].score),
          maxScore: Number(asgn.maxScore),
          weight: Number(asgn.weight),
          name: asgn.name,
          type: asgn.type,
        });
      }
    }

    const gradeInfo = StudentModel.computeCourseGrade(
      scores,
      course[0].id,
      course[0].name,
      course[0].code,
      course[0].credits,
      enr.semester,
      course[0].gradingScheme as GradingScheme,
    );

    result.push({
      course_id: gradeInfo.courseId,
      course_name: gradeInfo.courseName,
      course_code: gradeInfo.courseCode,
      semester: gradeInfo.semester,
      current_grade: gradeInfo.percentage,
      letter_grade: gradeInfo.letterGrade,
      display_label: gradeInfo.displayLabel,
      grading_scheme: gradeInfo.gradingScheme,
      credits: gradeInfo.credits,
    });
  }

  res.json(result);
});

export default router;
