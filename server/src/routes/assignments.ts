import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, assignmentsTable } from "@workspace/db";
import {
  ListAssignmentsQueryParams,
  CreateAssignmentBody,
  GetAssignmentParams,
  UpdateAssignmentParams,
  UpdateAssignmentBody,
  DeleteAssignmentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/assignments", async (req, res): Promise<void> => {
  const query = ListAssignmentsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { course_id, type } = query.data as { course_id?: number; type?: string };
  const conditions = [];
  if (course_id !== undefined) conditions.push(eq(assignmentsTable.courseId, course_id));
  if (type) conditions.push(eq(assignmentsTable.type, type));

  const assignments = await db
    .select()
    .from(assignmentsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(assignmentsTable.courseId, assignmentsTable.createdAt);

  res.json(
    assignments.map((a) => ({
      ...a,
      course_id: a.courseId,
      max_score: Number(a.maxScore),
      weight: Number(a.weight),
      due_date: a.dueDate ?? null,
      created_at: a.createdAt.toISOString(),
    })),
  );
});

router.post("/assignments", async (req, res): Promise<void> => {
  const parsed = CreateAssignmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data as { course_id: number; name: string; type: string; max_score: number; weight: number; due_date?: string; description?: string };

  const [assignment] = await db
    .insert(assignmentsTable)
    .values({
      courseId: d.course_id,
      name: d.name,
      type: d.type,
      maxScore: String(d.max_score),
      weight: String(d.weight),
      dueDate: d.due_date ?? null,
      description: d.description ?? null,
    })
    .returning();

  res.status(201).json({
    ...assignment,
    course_id: assignment.courseId,
    max_score: Number(assignment.maxScore),
    weight: Number(assignment.weight),
    due_date: assignment.dueDate ?? null,
    created_at: assignment.createdAt.toISOString(),
  });
});

router.get("/assignments/:id", async (req, res): Promise<void> => {
  const params = GetAssignmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [assignment] = await db
    .select()
    .from(assignmentsTable)
    .where(eq(assignmentsTable.id, params.data.id));

  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }

  res.json({
    ...assignment,
    course_id: assignment.courseId,
    max_score: Number(assignment.maxScore),
    weight: Number(assignment.weight),
    due_date: assignment.dueDate ?? null,
    created_at: assignment.createdAt.toISOString(),
  });
});

router.put("/assignments/:id", async (req, res): Promise<void> => {
  const params = UpdateAssignmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAssignmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  const d = parsed.data as Record<string, unknown>;
  if (d.name) updates.name = d.name;
  if (d.type) updates.type = d.type;
  if (d.max_score !== undefined) updates.maxScore = String(d.max_score);
  if (d.weight !== undefined) updates.weight = String(d.weight);
  if (d.due_date !== undefined) updates.dueDate = d.due_date;
  if (d.description !== undefined) updates.description = d.description;

  const [assignment] = await db
    .update(assignmentsTable)
    .set(updates)
    .where(eq(assignmentsTable.id, params.data.id))
    .returning();

  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }

  res.json({
    ...assignment,
    course_id: assignment.courseId,
    max_score: Number(assignment.maxScore),
    weight: Number(assignment.weight),
    due_date: assignment.dueDate ?? null,
    created_at: assignment.createdAt.toISOString(),
  });
});

router.delete("/assignments/:id", async (req, res): Promise<void> => {
  const params = DeleteAssignmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(assignmentsTable).where(eq(assignmentsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
