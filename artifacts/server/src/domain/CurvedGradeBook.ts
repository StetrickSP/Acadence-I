import { GradeBook, AssignmentScore, GradeResult } from "./GradeBook";

export class CurvedGradeBook extends GradeBook {
  constructor(private readonly curveOffset: number = 5) {
    super();
  }

  get schemeName(): string {
    return "curved";
  }

  calculateGrade(scores: AssignmentScore[]): GradeResult {
    if (scores.length === 0) {
      return { percentage: 0, letterGrade: "F", gradePoints: 0.0, displayLabel: "F (Curved)" };
    }
    const rawPct = this.weightedPercentage(scores);
    const curvedPct = Math.min(100, rawPct + this.curveOffset);
    const letter = this.scoreToLetter(curvedPct);
    return {
      percentage: Math.round(curvedPct * 10) / 10,
      letterGrade: letter,
      gradePoints: this.letterToPoints(letter),
      displayLabel: `${letter} (Curved +${this.curveOffset}%)`,
    };
  }
}
