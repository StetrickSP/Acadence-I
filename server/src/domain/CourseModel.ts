import type { Course } from "@workspace/db";
import type { GradingScheme } from "@workspace/db";
import { GradeBook } from "./GradeBook";
import { GradeBookFactory } from "./GradeBookFactory";

export class CourseModel {
  private roster: number[] = [];
  private gradeBook: GradeBook;

  constructor(private readonly record: Course) {
    this.gradeBook = GradeBookFactory.create(record.gradingScheme as GradingScheme);
  }

  get id(): number { return this.record.id; }
  get name(): string { return this.record.name; }
  get code(): string { return this.record.code; }
  get credits(): number { return this.record.credits; }
  get semester(): string { return this.record.semester; }
  get instructor(): string { return this.record.instructor; }
  get gradingScheme(): GradingScheme { return this.record.gradingScheme as GradingScheme; }

  enroll(studentId: number): void {
    if (!this.roster.includes(studentId)) {
      this.roster.push(studentId);
    }
  }

  unenroll(studentId: number): void {
    this.roster = this.roster.filter((id) => id !== studentId);
  }

  getRoster(): number[] {
    return [...this.roster];
  }

  getGradeBook(): GradeBook {
    return this.gradeBook;
  }
}
