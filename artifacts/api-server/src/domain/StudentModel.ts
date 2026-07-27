import { Person } from "./Person";
import { GradeBook, AssignmentScore } from "./GradeBook";
import { GradeBookFactory } from "./GradeBookFactory";
import type { GradingScheme } from "@workspace/db";

export interface CourseGradeInfo {
  courseId: number;
  courseName: string;
  courseCode: string;
  credits: number;
  semester: string;
  gradingScheme: GradingScheme;
  percentage: number | null;
  letterGrade: string | null;
  gradePoints: number | null;
  displayLabel: string | null;
}

export class StudentModel extends Person {
  constructor(
    id: number,
    name: string,
    email: string,
    public readonly studentId: string,
    public readonly year: number,
    public readonly major: string,
    public readonly clerkUserId: string | null = null,
  ) {
    super(id, name, email);
  }

  getRole(): string {
    return "student";
  }

  /**
   * Calculate GPA across all courses using their respective grading schemes.
   * Pass/Fail courses are excluded from GPA calculation.
   */
  calculateGPA(courses: CourseGradeInfo[]): number | null {
    let totalPoints = 0;
    let totalCredits = 0;

    for (const c of courses) {
      if (c.gradingScheme === "pass_fail") continue; // Excluded from GPA
      if (c.gradePoints !== null && c.letterGrade !== null) {
        totalPoints += c.gradePoints * c.credits;
        totalCredits += c.credits;
      }
    }

    if (totalCredits === 0) return null;
    return Math.round((totalPoints / totalCredits) * 100) / 100;
  }

  /**
   * Compute grade info for a single course using the appropriate GradeBook.
   */
  static computeCourseGrade(
    scores: AssignmentScore[],
    courseId: number,
    courseName: string,
    courseCode: string,
    credits: number,
    semester: string,
    gradingScheme: GradingScheme,
  ): CourseGradeInfo {
    const gradeBook: GradeBook = GradeBookFactory.create(gradingScheme);

    if (scores.length === 0) {
      return {
        courseId,
        courseName,
        courseCode,
        credits,
        semester,
        gradingScheme,
        percentage: null,
        letterGrade: null,
        gradePoints: null,
        displayLabel: null,
      };
    }

    const result = gradeBook.calculateGrade(scores);
    return {
      courseId,
      courseName,
      courseCode,
      credits,
      semester,
      gradingScheme,
      percentage: result.percentage,
      letterGrade: result.letterGrade,
      gradePoints: result.gradePoints,
      displayLabel: result.displayLabel,
    };
  }
}
