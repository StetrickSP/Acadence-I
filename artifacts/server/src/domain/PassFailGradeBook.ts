import { GradeBook, AssignmentScore, GradeResult } from "./GradeBook";

export class PassFailGradeBook extends GradeBook {
  constructor(private readonly passingThreshold: number = 60) {
    super();
  }

  get schemeName(): string {
    return "pass_fail";
  }

  calculateGrade(scores: AssignmentScore[]): GradeResult {
    if (scores.length === 0) {
      return { percentage: 0, letterGrade: "F", gradePoints: 0.0, displayLabel: "Fail" };
    }
    const pct = this.weightedPercentage(scores);
    const passed = pct >= this.passingThreshold;
    return {
      percentage: Math.round(pct * 10) / 10,
      letterGrade: passed ? "P" : "F",
      gradePoints: passed ? 0.0 : 0.0, // Pass/Fail doesn't contribute to GPA
      displayLabel: passed ? "Pass" : "Fail",
    };
  }
}
