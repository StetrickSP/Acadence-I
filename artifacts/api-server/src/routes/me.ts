import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { getAuth, createClerkClient } from "@clerk/express";
import { db, studentsTable, enrollmentsTable, coursesTable, assignmentsTable, gradesTable } from "@workspace/db";
import type { GradingScheme } from "@workspace/db";
import { StudentModel } from "../domain/StudentModel";
import type { AssignmentScore } from "../domain/GradeBook";
import { GradeBookFactory } from "../domain/GradeBookFactory";
import { riskLevel } from "../lib/gradeUtils";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const router: IRouter = Router();

/**
 * Resolve the signed-in user to a student record.
 * First tries clerkUserId match, then falls back to email match with auto-link.
 */
async function resolveStudent(clerkUserId: string, clerkEmail: string | null | undefined) {
  // 1. Try by clerkUserId
  const byClerkId = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.clerkUserId, clerkUserId))
    .limit(1);
  if (byClerkId[0]) return byClerkId[0];

  // 2. Fallback: email match + auto-link
  if (clerkEmail) {
    const byEmail = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.email, clerkEmail))
      .limit(1);
    if (byEmail[0]) {
      // Auto-link: write clerkUserId for future fast lookups
      const [linked] = await db
        .update(studentsTable)
        .set({ clerkUserId })
        .where(eq(studentsTable.id, byEmail[0].id))
        .returning();
      return linked;
    }
  }

  return null;
}

/**
 * Load all course grades for a student, using per-course GradeBook.
 */
async function loadStudentCourseGrades(studentId: number) {
  const enrollments = await db
    .select()
    .from(enrollmentsTable)
    .where(eq(enrollmentsTable.studentId, studentId));

  const courseGrades = [];

  for (const enr of enrollments) {
    const courseRows = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.id, enr.courseId))
      .limit(1);
    if (!courseRows[0]) continue;
    const course = courseRows[0];

    const assignments = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.courseId, course.id));

    const scores: AssignmentScore[] = [];
    for (const asgn of assignments) {
      const gradeRows = await db
        .select()
        .from(gradesTable)
        .where(and(eq(gradesTable.studentId, studentId), eq(gradesTable.assignmentId, asgn.id)))
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
      course.id,
      course.name,
      course.code,
      course.credits,
      enr.semester,
      course.gradingScheme as GradingScheme,
    );

    courseGrades.push({ ...gradeInfo, assignments, scores });
  }

  return courseGrades;
}

/**
 * Fetch the signed-in user's primary email from Clerk's backend API.
 * Session claims don't include email by default, so we call the Users API instead.
 */
async function getClerkEmail(userId: string): Promise<string | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
    return primary?.emailAddress ?? null;
  } catch {
    return null;
  }
}

// Middleware: require a signed-in Clerk user (any authenticated user)
async function requireAuth(req: any, res: any, next: any) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  req.clerkUserId = userId;
  next();
}

// Middleware: require a signed-in Clerk user who matches a student record
async function requireStudent(req: any, res: any, next: any) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  // Fetch email from Clerk's backend API (not session claims, which don't include it by default)
  const clerkEmail = await getClerkEmail(userId);

  const student = await resolveStudent(userId, clerkEmail);
  if (!student) {
    res.status(403).json({ error: "No student record linked to this account", isAdmin: true });
    return;
  }

  req.student = student;
  next();
}

/**
 * POST /api/me/claim
 * Link the signed-in Clerk account to a student record by human-readable Student ID.
 * Returns 404 if the student ID doesn't exist, 409 if already claimed by another account.
 */
router.post("/me/claim", requireAuth, async (req: any, res): Promise<void> => {
  const clerkUserId: string = req.clerkUserId;
  const { studentId } = req.body ?? {};

  if (!studentId || typeof studentId !== "string") {
    res.status(400).json({ error: "studentId is required" });
    return;
  }

  // If this Clerk account is already linked to a student, return that profile
  const alreadyClaimed = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.clerkUserId, clerkUserId))
    .limit(1);
  if (alreadyClaimed[0]) {
    const s = alreadyClaimed[0];
    res.json({ id: s.id, name: s.name, email: s.email, studentId: s.studentId, year: s.year, major: s.major, role: "student" });
    return;
  }

  // Find student record by student ID (case-insensitive)
  const rows = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.studentId, studentId.trim().toUpperCase()))
    .limit(1);

  if (!rows[0]) {
    res.status(404).json({ error: "No student found with that ID" });
    return;
  }

  // Already claimed by a different Clerk account
  if (rows[0].clerkUserId && rows[0].clerkUserId !== clerkUserId) {
    res.status(409).json({ error: "This student account is already linked to another login" });
    return;
  }

  const [linked] = await db
    .update(studentsTable)
    .set({ clerkUserId })
    .where(eq(studentsTable.id, rows[0].id))
    .returning();

  res.json({
    id: linked.id,
    name: linked.name,
    email: linked.email,
    studentId: linked.studentId,
    year: linked.year,
    major: linked.major,
    role: "student",
  });
});

/** GET /api/me/profile */
router.get("/me/profile", requireStudent, async (req: any, res): Promise<void> => {
  const s = req.student;
  res.json({
    id: s.id,
    name: s.name,
    email: s.email,
    studentId: s.studentId,
    year: s.year,
    major: s.major,
    role: "student",
  });
});

/** GET /api/me/courses */
router.get("/me/courses", requireStudent, async (req: any, res): Promise<void> => {
  const courseGrades = await loadStudentCourseGrades(req.student.id);
  res.json(
    courseGrades.map((cg) => ({
      course_id: cg.courseId,
      course_name: cg.courseName,
      course_code: cg.courseCode,
      credits: cg.credits,
      semester: cg.semester,
      grading_scheme: cg.gradingScheme,
      current_grade: cg.percentage,
      letter_grade: cg.letterGrade,
      display_label: cg.displayLabel,
    })),
  );
});

/** GET /api/me/grades */
router.get("/me/grades", requireStudent, async (req: any, res): Promise<void> => {
  const studentId = req.student.id;
  const courseGrades = await loadStudentCourseGrades(studentId);

  const result = courseGrades.map((cg) => ({
    course_id: cg.courseId,
    course_name: cg.courseName,
    course_code: cg.courseCode,
    grading_scheme: cg.gradingScheme,
    current_grade: cg.percentage,
    letter_grade: cg.letterGrade,
    display_label: cg.displayLabel,
    assignments: cg.assignments.map((asgn) => {
      const score = cg.scores.find((s) => s.assignmentId === asgn.id);
      return {
        id: asgn.id,
        name: asgn.name,
        type: asgn.type,
        max_score: Number(asgn.maxScore),
        weight: Number(asgn.weight),
        due_date: asgn.dueDate,
        score: score?.score ?? null,
        percentage: score ? Math.round((score.score / score.maxScore) * 1000) / 10 : null,
        submitted: !!score,
      };
    }),
  }));

  res.json(result);
});

/** GET /api/me/gpa */
router.get("/me/gpa", requireStudent, async (req: any, res): Promise<void> => {
  const s = req.student;
  const courseGrades = await loadStudentCourseGrades(s.id);

  const studentModel = new StudentModel(s.id, s.name, s.email, s.studentId, s.year, s.major, s.clerkUserId);
  const gpa = studentModel.calculateGPA(courseGrades);

  res.json({
    student_id: s.id,
    gpa,
    total_courses: courseGrades.length,
    completed_courses: courseGrades.filter((c) => c.percentage !== null).length,
    courses: courseGrades.map((c) => ({
      course_id: c.courseId,
      course_name: c.courseName,
      letter_grade: c.letterGrade,
      display_label: c.displayLabel,
      grade_points: c.gradePoints,
      credits: c.credits,
      grading_scheme: c.gradingScheme,
      included_in_gpa: c.gradingScheme !== "pass_fail",
    })),
  });
});

/** GET /api/me/predictions */
router.get("/me/predictions", requireStudent, async (req: any, res): Promise<void> => {
  const studentId = req.student.id;
  const courseGrades = await loadStudentCourseGrades(studentId);

  const predictions = courseGrades.map((cg) => {
    const risk = cg.percentage !== null ? riskLevel(cg.percentage) : "high";
    const unsubmitted = cg.assignments.filter((a) => !cg.scores.find((s) => s.assignmentId === a.id));
    const remainingWeight = unsubmitted.reduce((sum, a) => sum + Number(a.weight), 0);

    // Predict best-case: score 100 on all remaining
    let bestCasePct: number | null = null;
    if (cg.percentage !== null && remainingWeight > 0) {
      const submittedWeight = 1 - remainingWeight;
      const submittedContrib = submittedWeight > 0 ? (cg.percentage / 100) * submittedWeight : 0;
      bestCasePct = Math.min(100, ((submittedContrib + remainingWeight) / 1) * 100);
    }

    return {
      course_id: cg.courseId,
      course_name: cg.courseName,
      course_code: cg.courseCode,
      grading_scheme: cg.gradingScheme,
      current_grade: cg.percentage,
      letter_grade: cg.letterGrade,
      display_label: cg.displayLabel,
      risk_level: risk,
      remaining_assignments: unsubmitted.length,
      best_case_grade: bestCasePct !== null ? Math.round(bestCasePct * 10) / 10 : null,
    };
  });

  res.json(predictions);
});

export default router;
