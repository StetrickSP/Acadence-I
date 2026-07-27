import { Person } from "./Person";

export class Instructor extends Person {
  private courseNames: string[];

  constructor(id: number, name: string, email: string, courseNames: string[] = []) {
    super(id, name, email);
    this.courseNames = courseNames;
  }

  getRole(): string {
    return "instructor";
  }

  getCourses(): string[] {
    return [...this.courseNames];
  }
}
