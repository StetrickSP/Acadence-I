import type { GradingScheme } from "@workspace/db";
import { GradeBook } from "./GradeBook";
import { WeightedGradeBook } from "./WeightedGradeBook";
import { CurvedGradeBook } from "./CurvedGradeBook";
import { PassFailGradeBook } from "./PassFailGradeBook";

export class GradeBookFactory {
  static create(scheme: GradingScheme | null | undefined): GradeBook {
    switch (scheme) {
      case "curved":
        return new CurvedGradeBook(5);
      case "pass_fail":
        return new PassFailGradeBook(60);
      case "weighted":
      default:
        return new WeightedGradeBook();
    }
  }
}
