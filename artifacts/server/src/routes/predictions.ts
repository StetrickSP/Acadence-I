import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, gradesTable, assignmentsTable, enrollmentsTable, studentsTable, coursesTable } from "@workspace/db";
import { PredictGradeBody, PredictAtRiskParams } from "@workspace/api-zod";
import { scoreToLetter, toPercent, riskLevel } from "../lib/gradeUtils";

const router: IRouter = Router();

/**
 * Simple linear-weighted grade prediction model.
 * Weights: midterm (35%), assignment avg (45%), completion rate (20%)
 */
function predictFinalScore(
  midtermPct: number | null,
  assignmentAvgPct: number | null,
  completionRate: number, // 0-1
): { score: number; confidence: number } {
  const components: { value: number; weight: number }[] = [];

  if (midtermPct !== null) components.push({ value: midtermPct, weight: 0.35 });
  if (assignmentAvgPct !== null) components.push({ value: assignmentAvgPct, weight: 0.45 });
  components.push({ value: completionRate * 100, weight: 0.20 });

  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const score = components.reduce((s, c) => s + c.value * (c.weight / totalWeight), 0);
  // Confidence based on how much data we have
  const confidence = Math.min(100, Math.round(totalWeight * 90 + completionRate * 10));

  return { score: Math.max(0, Math.min(100, score)), confidence };
}

// POST /predictions/grade
router.post("/predictions/grade", async (req, res): Promise<void> => {
  const parsed = PredictGradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data as {
    student_id: number;
    course_id: number;
    midterm_score?: number | null;
    assignment_completion_rate?: number | null;
  };

  // Fetch actual grades for this student/course
  const assignments = await db.select().from(assignmentsTable).where(eq(assignmentsTable.courseId, d.course_id));

  let midtermPct: number | null = d.midterm_score ?? null;
  let assignmentTotal = 0;
  let assignmentCount = 0;
  let submittedCount = 0;

  for (const asgn of assignments) {
    const grade = await db.select().from(gradesTable).where(and(eq(gradesTable.studentId, d.student_id), eq(gradesTable.assignmentId, asgn.id))).limit(1);
    if (grade[0]) {
      const pct = toPercent(Number(grade[0].score), Number(asgn.maxScore));
      if (asgn.type === "midterm" && midtermPct === null) midtermPct = pct;
      else {
        assignmentTotal += pct;
        assignmentCount++;
      }
      submittedCount++;
    }
  }

  const completionRate = d.assignment_completion_rate ?? (assignments.length > 0 ? submittedCount / assignments.length : 0);
  const assignmentAvg = assignmentCount > 0 ? assignmentTotal / assignmentCount : null;

  const { score, confidence } = predictFinalScore(midtermPct, assignmentAvg, completionRate);
  const letter = scoreToLetter(score);

  const factors = [
    { factor: "Midterm Performance", weight: 0.35, value: midtermPct ?? 0 },
    { factor: "Assignment Average", weight: 0.45, value: assignmentAvg ?? 0 },
    { factor: "Completion Rate", weight: 0.20, value: completionRate * 100 },
  ];

  res.json({
    student_id: d.student_id,
    course_id: d.course_id,
    predicted_score: Math.round(score * 10) / 10,
    predicted_letter: letter,
    confidence,
    risk_level: riskLevel(score),
    factors,
  });
});

// GET /predictions/at-risk/:courseId
router.get("/predictions/at-risk/:courseId", async (req, res): Promise<void> => {
  const params = PredictAtRiskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const courseId = params.data.courseId;
  const enrollments = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.courseId, courseId));
  const assignments = await db.select().from(assignmentsTable).where(eq(assignmentsTable.courseId, courseId));

  const result = [];

  for (const enr of enrollments) {
    const student = await db.select().from(studentsTable).where(eq(studentsTable.id, enr.studentId)).limit(1);
    if (!student[0]) continue;

    let midtermPct: number | null = null;
    let assignmentTotal = 0;
    let assignmentCount = 0;
    let submittedCount = 0;
    let currentWeightedScore = 0;
    let currentTotalWeight = 0;

    for (const asgn of assignments) {
      const grade = await db.select().from(gradesTable).where(and(eq(gradesTable.studentId, enr.studentId), eq(gradesTable.assignmentId, asgn.id))).limit(1);
      if (grade[0]) {
        const pct = toPercent(Number(grade[0].score), Number(asgn.maxScore));
        if (asgn.type === "midterm" && midtermPct === null) midtermPct = pct;
        else { assignmentTotal += pct; assignmentCount++; }
        currentWeightedScore += pct * Number(asgn.weight);
        currentTotalWeight += Number(asgn.weight);
        submittedCount++;
      }
    }

    const completionRate = assignments.length > 0 ? submittedCount / assignments.length : 0;
    const assignmentAvg = assignmentCount > 0 ? assignmentTotal / assignmentCount : null;
    const { score, confidence } = predictFinalScore(midtermPct, assignmentAvg, completionRate);

    const currentScore = currentTotalWeight > 0 ? Math.round((currentWeightedScore / currentTotalWeight) * 10) / 10 : null;

    result.push({
      student_id: student[0].id,
      student_name: student[0].name,
      predicted_score: Math.round(score * 10) / 10,
      predicted_letter: scoreToLetter(score),
      risk_level: riskLevel(score),
      confidence,
      current_score: currentScore,
    });
  }

  // Sort by predicted score ascending (most at-risk first)
  result.sort((a, b) => a.predicted_score - b.predicted_score);

  res.json(result);
});

export default router;
