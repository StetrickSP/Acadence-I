import { GradeBook, AssignmentScore, GradeResult } from "./GradeBook";

export class WeightedGradeBook extends GradeBook {
  get schemeName(): string {
    return "weighted";
  }

  calculateGrade(scores: AssignmentScore[]): GradeResult {
    if (scores.length === 0) {
      return { percentage: 0, letterGrade: "F", gradePoints: 0.0, displayLabel: "F" };
    }
    const pct = this.weightedPercentage(scores);
    const letter = this.scoreToLetter(pct);
    return {
      percentage: Math.round(pct * 10) / 10,
      letterGrade: letter,
      gradePoints: this.letterToPoints(letter),
      displayLabel: letter,
    };
  }
}
