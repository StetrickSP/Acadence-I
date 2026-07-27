/**
 * Manually authored hooks for endpoints not yet in the generated client.
 */
import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

export interface CourseRankingEntry {
  rank: number;
  student_id: number;
  student_name: string;
  score: number | null;
  letter_grade: string;
}

export const getCourseRankings = (courseId: number): Promise<CourseRankingEntry[]> =>
  customFetch<CourseRankingEntry[]>(`/api/students/rankings?course_id=${courseId}`);

export const useGetCourseRankings = (
  courseId: number,
  options?: Omit<UseQueryOptions<CourseRankingEntry[], Error>, "queryKey" | "queryFn">,
): UseQueryResult<CourseRankingEntry[], Error> =>
  useQuery<CourseRankingEntry[], Error>({
    queryKey: ["courseRankings", courseId],
    queryFn: () => getCourseRankings(courseId),
    enabled: courseId > 0,
    ...options,
  });
