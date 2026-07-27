import {
  db,
  studentsTable,
  coursesTable,
  enrollmentsTable,
  assignmentsTable,
  gradesTable,
} from "@workspace/db";

async function seed() {
  console.log("🌱 Seeding database...");

  // Students
  const students = await db
    .insert(studentsTable)
    .values([
      { name: "Alice Chen", email: "alice.chen@university.edu", studentId: "S001", year: 3, major: "Computer Science" },
      { name: "Brian Taylor", email: "brian.taylor@university.edu", studentId: "S002", year: 2, major: "Mathematics" },
      { name: "Carla Rodriguez", email: "carla.rodriguez@university.edu", studentId: "S003", year: 4, major: "Physics" },
      { name: "David Kim", email: "david.kim@university.edu", studentId: "S004", year: 1, major: "Engineering" },
      { name: "Emma Wilson", email: "emma.wilson@university.edu", studentId: "S005", year: 3, major: "Computer Science" },
    ])
    .returning();

  console.log(`✅ Inserted ${students.length} students`);

  // Courses
  const courses = await db
    .insert(coursesTable)
    .values([
      { code: "CS-301", name: "Algorithms & Data Structures", credits: 4, semester: "Fall 2024", instructor: "Dr. Sarah Johnson", description: "Advanced algorithmic thinking and data structure design." },
      { code: "MATH-201", name: "Linear Algebra", credits: 3, semester: "Fall 2024", instructor: "Prof. Michael Lee", description: "Vectors, matrices, and linear transformations." },
      { code: "CS-401", name: "Machine Learning", credits: 3, semester: "Fall 2024", instructor: "Dr. Rachel Park", description: "Introduction to ML models and statistical learning." },
    ])
    .returning();

  console.log(`✅ Inserted ${courses.length} courses`);

  // Enrollments — all students in CS-301, first 3 in MATH-201, last 3 in CS-401
  const enrollments = await db
    .insert(enrollmentsTable)
    .values([
      // CS-301
      { studentId: students[0].id, courseId: courses[0].id, semester: "Fall 2024" },
      { studentId: students[1].id, courseId: courses[0].id, semester: "Fall 2024" },
      { studentId: students[2].id, courseId: courses[0].id, semester: "Fall 2024" },
      { studentId: students[3].id, courseId: courses[0].id, semester: "Fall 2024" },
      { studentId: students[4].id, courseId: courses[0].id, semester: "Fall 2024" },
      // MATH-201
      { studentId: students[0].id, courseId: courses[1].id, semester: "Fall 2024" },
      { studentId: students[1].id, courseId: courses[1].id, semester: "Fall 2024" },
      { studentId: students[2].id, courseId: courses[1].id, semester: "Fall 2024" },
      // CS-401
      { studentId: students[2].id, courseId: courses[2].id, semester: "Fall 2024" },
      { studentId: students[3].id, courseId: courses[2].id, semester: "Fall 2024" },
      { studentId: students[4].id, courseId: courses[2].id, semester: "Fall 2024" },
    ])
    .returning();

  console.log(`✅ Inserted ${enrollments.length} enrollments`);

  // Assignments
  const assignments = await db
    .insert(assignmentsTable)
    .values([
      // CS-301
      { courseId: courses[0].id, name: "Homework 1: Sorting", type: "assignment", maxScore: "100", weight: "0.15", dueDate: "2024-09-20" },
      { courseId: courses[0].id, name: "Homework 2: Trees", type: "assignment", maxScore: "100", weight: "0.15", dueDate: "2024-10-10" },
      { courseId: courses[0].id, name: "Midterm Exam", type: "midterm", maxScore: "100", weight: "0.30", dueDate: "2024-10-25" },
      { courseId: courses[0].id, name: "Final Exam", type: "final", maxScore: "100", weight: "0.40", dueDate: "2024-12-15" },
      // MATH-201
      { courseId: courses[1].id, name: "Problem Set 1", type: "assignment", maxScore: "50", weight: "0.20", dueDate: "2024-09-25" },
      { courseId: courses[1].id, name: "Problem Set 2", type: "assignment", maxScore: "50", weight: "0.20", dueDate: "2024-10-18" },
      { courseId: courses[1].id, name: "Midterm", type: "midterm", maxScore: "100", weight: "0.30", dueDate: "2024-11-01" },
      { courseId: courses[1].id, name: "Final Exam", type: "final", maxScore: "100", weight: "0.30", dueDate: "2024-12-12" },
      // CS-401
      { courseId: courses[2].id, name: "Lab 1: Regression", type: "assignment", maxScore: "100", weight: "0.20", dueDate: "2024-09-28" },
      { courseId: courses[2].id, name: "Lab 2: Classification", type: "assignment", maxScore: "100", weight: "0.20", dueDate: "2024-10-22" },
      { courseId: courses[2].id, name: "Midterm Project", type: "midterm", maxScore: "100", weight: "0.30", dueDate: "2024-11-08" },
      { courseId: courses[2].id, name: "Final Project", type: "project", maxScore: "100", weight: "0.30", dueDate: "2024-12-18" },
    ])
    .returning();

  console.log(`✅ Inserted ${assignments.length} assignments`);

  // cs301 assignments
  const cs301 = assignments.slice(0, 4);
  const math201 = assignments.slice(4, 8);
  const cs401 = assignments.slice(8, 12);

  // Grades - realistic distributions
  const gradeRows = [
    // Alice (S001) - CS-301: strong student
    { studentId: students[0].id, assignmentId: cs301[0].id, score: "92", feedback: "Excellent implementation" },
    { studentId: students[0].id, assignmentId: cs301[1].id, score: "88" },
    { studentId: students[0].id, assignmentId: cs301[2].id, score: "91", feedback: "Great analysis" },
    // MATH-201
    { studentId: students[0].id, assignmentId: math201[0].id, score: "46" },
    { studentId: students[0].id, assignmentId: math201[1].id, score: "48" },
    { studentId: students[0].id, assignmentId: math201[2].id, score: "87" },

    // Brian (S002) - CS-301: average
    { studentId: students[1].id, assignmentId: cs301[0].id, score: "75" },
    { studentId: students[1].id, assignmentId: cs301[1].id, score: "68", feedback: "Review section 3" },
    { studentId: students[1].id, assignmentId: cs301[2].id, score: "72" },
    // MATH-201
    { studentId: students[1].id, assignmentId: math201[0].id, score: "38" },
    { studentId: students[1].id, assignmentId: math201[1].id, score: "41" },
    { studentId: students[1].id, assignmentId: math201[2].id, score: "65" },

    // Carla (S003) - CS-301: at-risk
    { studentId: students[2].id, assignmentId: cs301[0].id, score: "55", feedback: "Please see office hours" },
    { studentId: students[2].id, assignmentId: cs301[1].id, score: "50" },
    { studentId: students[2].id, assignmentId: cs301[2].id, score: "58", feedback: "Needs improvement" },
    // MATH-201
    { studentId: students[2].id, assignmentId: math201[0].id, score: "30" },
    { studentId: students[2].id, assignmentId: math201[1].id, score: "27" },
    { studentId: students[2].id, assignmentId: math201[2].id, score: "52" },
    // CS-401
    { studentId: students[2].id, assignmentId: cs401[0].id, score: "60" },
    { studentId: students[2].id, assignmentId: cs401[1].id, score: "55" },
    { studentId: students[2].id, assignmentId: cs401[2].id, score: "62" },

    // David (S004) - CS-301: good
    { studentId: students[3].id, assignmentId: cs301[0].id, score: "82" },
    { studentId: students[3].id, assignmentId: cs301[1].id, score: "79" },
    { studentId: students[3].id, assignmentId: cs301[2].id, score: "84" },
    // CS-401
    { studentId: students[3].id, assignmentId: cs401[0].id, score: "78" },
    { studentId: students[3].id, assignmentId: cs401[1].id, score: "82" },
    { studentId: students[3].id, assignmentId: cs401[2].id, score: "79" },

    // Emma (S005) - CS-301: top student
    { studentId: students[4].id, assignmentId: cs301[0].id, score: "98" },
    { studentId: students[4].id, assignmentId: cs301[1].id, score: "95", feedback: "Outstanding work!" },
    { studentId: students[4].id, assignmentId: cs301[2].id, score: "97" },
    // CS-401
    { studentId: students[4].id, assignmentId: cs401[0].id, score: "94" },
    { studentId: students[4].id, assignmentId: cs401[1].id, score: "91" },
    { studentId: students[4].id, assignmentId: cs401[2].id, score: "96", feedback: "Exceptional project!" },
  ];

  const grades = await db.insert(gradesTable).values(gradeRows).returning();
  console.log(`✅ Inserted ${grades.length} grades`);

  console.log("🎉 Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
