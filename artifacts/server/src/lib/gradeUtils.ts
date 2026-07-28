/** Convert a percentage (0-100) to a letter grade */
export function scoreToLetter(pct: number): string {
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

/** Convert letter grade to 4-point GPA scale */
export function letterToPoints(letter: string): number {
  const map: Record<string, number> = { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0 };
  return map[letter] ?? 0.0;
}

/** Compute percentage from score/maxScore */
export function toPercent(score: number, maxScore: number): number {
  if (maxScore === 0) return 0;
  return (score / maxScore) * 100;
}

/** Classify risk level from percentage */
export function riskLevel(pct: number): "high" | "medium" | "low" {
  if (pct < 60) return "high";
  if (pct < 70) return "medium";
  return "low";
}
