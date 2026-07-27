import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, enrollmentsTable, studentsTable, coursesTable } from "@workspace/db";
import {
  ListEnrollmentsQueryParams,
  CreateEnrollmentBody,
  DeleteEnrollmentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/enrollments", async (req, res): Promise<void> => {
  const query = ListEnrollmentsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { student_id, course_id, semester } = query.data as { student_id?: number; course_id?: number; semester?: string };
  const conditions = [];
  if (student_id !== undefined) conditions.push(eq(enrollmentsTable.studentId, student_id));
  if (course_id !== undefined) conditions.push(eq(enrollmentsTable.courseId, course_id));
  if (semester) conditions.push(eq(enrollmentsTable.semester, semester));

  const rows = await db
    .select({
      enrollment: enrollmentsTable,
      studentName: studentsTable.name,
      courseName: coursesTable.name,
    })
    .from(enrollmentsTable)
    .leftJoin(studentsTable, eq(enrollmentsTable.studentId, studentsTable.id))
    .leftJoin(coursesTable, eq(enrollmentsTable.courseId, coursesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(enrollmentsTable.enrolledAt);

  res.json(
    rows.map((r) => ({
      ...r.enrollment,
      student_id: r.enrollment.studentId,
      course_id: r.enrollment.courseId,
      enrolled_at: r.enrollment.enrolledAt.toISOString(),
      student_name: r.studentName ?? null,
      course_name: r.courseName ?? null,
    })),
  );
});

router.post("/enrollments", async (req, res): Promise<void> => {
  const parsed = CreateEnrollmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data as { student_id: number; course_id: number; semester: string };

  const [enrollment] = await db
    .insert(enrollmentsTable)
    .values({ studentId: d.student_id, courseId: d.course_id, semester: d.semester })
    .returning();

  // Fetch names
  const student = await db.select({ name: studentsTable.name }).from(studentsTable).where(eq(studentsTable.id, d.student_id)).limit(1);
  const course = await db.select({ name: coursesTable.name }).from(coursesTable).where(eq(coursesTable.id, d.course_id)).limit(1);

  res.status(201).json({
    ...enrollment,
    student_id: enrollment.studentId,
    course_id: enrollment.courseId,
    enrolled_at: enrollment.enrolledAt.toISOString(),
    student_name: student[0]?.name ?? null,
    course_name: course[0]?.name ?? null,
  });
});

router.delete("/enrollments/:id", async (req, res): Promise<void> => {
  const params = DeleteEnrollmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(enrollmentsTable).where(eq(enrollmentsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
