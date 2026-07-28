import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, gradesTable, studentsTable, assignmentsTable, coursesTable } from "@workspace/db";
import {
  ListGradesQueryParams,
  CreateGradeBody,
  UpdateGradeParams,
  UpdateGradeBody,
  DeleteGradeParams,
} from "@workspace/api-zod";
import { scoreToLetter, toPercent } from "../lib/gradeUtils";

const router: IRouter = Router();

router.get("/grades", async (req, res): Promise<void> => {
  const query = ListGradesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { student_id, course_id, assignment_id } = query.data as { student_id?: number; course_id?: number; assignment_id?: number };
  const conditions = [];
  if (student_id !== undefined) conditions.push(eq(gradesTable.studentId, student_id));
  if (assignment_id !== undefined) conditions.push(eq(gradesTable.assignmentId, assignment_id));

  let rows;
  if (course_id !== undefined) {
    // Join through assignments to filter by course
    rows = await db
      .select({
        grade: gradesTable,
        studentName: studentsTable.name,
        assignmentName: assignmentsTable.name,
        maxScore: assignmentsTable.maxScore,
        courseId: assignmentsTable.courseId,
      })
      .from(gradesTable)
      .leftJoin(studentsTable, eq(gradesTable.studentId, studentsTable.id))
      .leftJoin(assignmentsTable, eq(gradesTable.assignmentId, assignmentsTable.id))
      .where(
        and(
          eq(assignmentsTable.courseId, course_id),
          ...(student_id !== undefined ? [eq(gradesTable.studentId, student_id)] : []),
          ...(assignment_id !== undefined ? [eq(gradesTable.assignmentId, assignment_id)] : []),
        ),
      )
      .orderBy(gradesTable.submittedAt);
  } else {
    rows = await db
      .select({
        grade: gradesTable,
        studentName: studentsTable.name,
        assignmentName: assignmentsTable.name,
        maxScore: assignmentsTable.maxScore,
        courseId: assignmentsTable.courseId,
      })
      .from(gradesTable)
      .leftJoin(studentsTable, eq(gradesTable.studentId, studentsTable.id))
      .leftJoin(assignmentsTable, eq(gradesTable.assignmentId, assignmentsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(gradesTable.submittedAt);
  }

  res.json(
    rows.map((r) => {
      const pct = r.maxScore ? toPercent(Number(r.grade.score), Number(r.maxScore)) : null;
      return {
        ...r.grade,
        student_id: r.grade.studentId,
        assignment_id: r.grade.assignmentId,
        score: Number(r.grade.score),
        percentage: pct !== null ? Math.round(pct * 10) / 10 : null,
        letter_grade: pct !== null ? scoreToLetter(pct) : null,
        submitted_at: r.grade.submittedAt.toISOString(),
        student_name: r.studentName ?? null,
        assignment_name: r.assignmentName ?? null,
        course_id: r.courseId ?? null,
      };
    }),
  );
});

router.post("/grades", async (req, res): Promise<void> => {
  const parsed = CreateGradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data as { student_id: number; assignment_id: number; score: number; feedback?: string };

  const [grade] = await db
    .insert(gradesTable)
    .values({
      studentId: d.student_id,
      assignmentId: d.assignment_id,
      score: String(d.score),
      feedback: d.feedback ?? null,
    })
    .returning();

  const asgn = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, d.assignment_id)).limit(1);
  const pct = asgn[0] ? toPercent(Number(grade.score), Number(asgn[0].maxScore)) : null;

  res.status(201).json({
    ...grade,
    student_id: grade.studentId,
    assignment_id: grade.assignmentId,
    score: Number(grade.score),
    percentage: pct !== null ? Math.round(pct * 10) / 10 : null,
    letter_grade: pct !== null ? scoreToLetter(pct) : null,
    submitted_at: grade.submittedAt.toISOString(),
    student_name: null,
    assignment_name: null,
    course_id: asgn[0]?.courseId ?? null,
  });
});

router.put("/grades/:id", async (req, res): Promise<void> => {
  const params = UpdateGradeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateGradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data as { score?: number; feedback?: string };
  const updates: Record<string, unknown> = {};
  if (d.score !== undefined) updates.score = String(d.score);
  if (d.feedback !== undefined) updates.feedback = d.feedback;

  const [grade] = await db.update(gradesTable).set(updates).where(eq(gradesTable.id, params.data.id)).returning();
  if (!grade) {
    res.status(404).json({ error: "Grade not found" });
    return;
  }

  const asgn = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, grade.assignmentId)).limit(1);
  const pct = asgn[0] ? toPercent(Number(grade.score), Number(asgn[0].maxScore)) : null;

  res.json({
    ...grade,
    student_id: grade.studentId,
    assignment_id: grade.assignmentId,
    score: Number(grade.score),
    percentage: pct !== null ? Math.round(pct * 10) / 10 : null,
    letter_grade: pct !== null ? scoreToLetter(pct) : null,
    submitted_at: grade.submittedAt.toISOString(),
    student_name: null,
    assignment_name: null,
    course_id: asgn[0]?.courseId ?? null,
  });
});

router.delete("/grades/:id", async (req, res): Promise<void> => {
  const params = DeleteGradeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(gradesTable).where(eq(gradesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
