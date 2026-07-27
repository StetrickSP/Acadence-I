export interface AssignmentScore {
  assignmentId: number;
  score: number;
  maxScore: number;
  weight: number;
  name: string;
  type: string;
}

export interface GradeResult {
  percentage: number;
  letterGrade: string;
  gradePoints: number;
  displayLabel: string;
}

export abstract class GradeBook {
  abstract calculateGrade(scores: AssignmentScore[]): GradeResult;
  abstract get schemeName(): string;

  protected scoreToLetter(pct: number): string {
    if (pct >= 90) return "A";
    if (pct >= 80) return "B";
    if (pct >= 70) return "C";
    if (pct >= 60) return "D";
    return "F";
  }

  protected letterToPoints(letter: string): number {
    const map: Record<string, number> = { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0 };
    return map[letter] ?? 0.0;
  }

  protected weightedPercentage(scores: AssignmentScore[]): number {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const s of scores) {
      if (s.maxScore > 0) {
        const pct = (s.score / s.maxScore) * 100;
        weightedSum += pct * s.weight;
        totalWeight += s.weight;
      }
    }
    if (totalWeight === 0) return 0;
    return weightedSum / totalWeight;
  }
}
