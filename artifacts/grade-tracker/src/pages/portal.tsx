import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { GradeBadge } from "@/components/grade-badge";
import { RiskBadge } from "@/components/risk-badge";
import { StatCard } from "@/components/stat-card";
import { BookOpen, TrendingUp, AlertTriangle, User, ChevronDown, ChevronUp } from "lucide-react";
import type { StudentIdentity } from "@/hooks/useStudentIdentity";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const apiBase = `${BASE_URL}/api`;

interface CourseGrade {
  course_id: number;
  course_name: string;
  course_code: string;
  credits: number;
  semester: string;
  grading_scheme: string;
  current_grade: number | null;
  letter_grade: string | null;
  display_label: string | null;
}

interface AssignmentGrade {
  id: number;
  name: string;
  type: string;
  max_score: number;
  weight: number;
  due_date: string | null;
  score: number | null;
  percentage: number | null;
  submitted: boolean;
}

interface CourseGradeDetail extends CourseGrade {
  assignments: AssignmentGrade[];
}

interface GpaResponse {
  gpa: number | null;
  total_courses: number;
  completed_courses: number;
  courses: Array<{
    course_id: number;
    course_name: string;
    letter_grade: string | null;
    display_label: string | null;
    grade_points: number | null;
    credits: number;
    grading_scheme: string;
    included_in_gpa: boolean;
  }>;
}

interface PredictionItem {
  course_id: number;
  course_name: string;
  course_code: string;
  grading_scheme: string;
  current_grade: number | null;
  letter_grade: string | null;
  display_label: string | null;
  risk_level: "high" | "medium" | "low";
  remaining_assignments: number;
  best_case_grade: number | null;
}

const schemeLabel: Record<string, string> = {
  weighted: "Weighted",
  curved: "Curved",
  pass_fail: "Pass/Fail",
};

const schemeBadgeClass: Record<string, string> = {
  weighted: "bg-blue-50 text-blue-700 border-blue-200",
  curved: "bg-purple-50 text-purple-700 border-purple-200",
  pass_fail: "bg-orange-50 text-orange-700 border-orange-200",
};

function CourseCard({ course, detail, prediction }: {
  course: CourseGrade;
  detail: CourseGradeDetail | undefined;
  prediction: PredictionItem | undefined;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {course.course_code}
              </span>
              <Badge
                variant="outline"
                className={`text-xs px-1.5 py-0 ${schemeBadgeClass[course.grading_scheme] ?? ""}`}
              >
                {schemeLabel[course.grading_scheme] ?? course.grading_scheme}
              </Badge>
              {prediction && <RiskBadge level={prediction.risk_level} />}
            </div>
            <p className="font-semibold text-foreground text-sm leading-tight">
              {course.course_name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {course.semester} · {course.credits} credit{course.credits !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {course.display_label ? (
              course.grading_scheme === "pass_fail" ? (
                <span
                  className={`text-sm font-bold px-2 py-0.5 rounded ${course.display_label === "Pass" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                >
                  {course.display_label}
                </span>
              ) : (
                <GradeBadge letter={course.letter_grade ?? "?"} />
              )
            ) : (
              <span className="text-xs text-muted-foreground">No grades yet</span>
            )}
            {open ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
        {course.current_grade !== null && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Current</span>
              <span>{course.current_grade.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${course.current_grade >= 90 ? "bg-green-500" : course.current_grade >= 70 ? "bg-blue-500" : course.current_grade >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                style={{ width: `${Math.min(100, course.current_grade)}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>

      {open && detail && (
        <CardContent className="pt-0 pb-4">
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Assignment Breakdown
            </p>
            <div className="space-y-1.5">
              {detail.assignments.map((asgn) => (
                <div key={asgn.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <span className="truncate text-foreground">{asgn.name}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">
                      ({Math.round(asgn.weight * 100)}% weight)
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    {asgn.submitted ? (
                      <span className="font-mono text-xs">
                        {asgn.score}/{asgn.max_score}
                        <span className="ml-1 text-muted-foreground">
                          ({asgn.percentage?.toFixed(0)}%)
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Not submitted</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {prediction && prediction.best_case_grade !== null && (
              <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                Best possible final grade:{" "}
                <span className="font-semibold text-foreground">
                  {prediction.best_case_grade.toFixed(1)}%
                </span>
                {prediction.remaining_assignments > 0 && (
                  <span className="ml-1">
                    ({prediction.remaining_assignments} remaining assignment
                    {prediction.remaining_assignments !== 1 ? "s" : ""})
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface PortalProps {
  profile: StudentIdentity;
}

export default function Portal({ profile }: PortalProps) {
  const { data: gpaData, isLoading: gpaLoading } = useQuery<GpaResponse>({
    queryKey: ["me/gpa"],
    queryFn: () => fetch(`${apiBase}/me/gpa`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: courses, isLoading: coursesLoading } = useQuery<CourseGrade[]>({
    queryKey: ["me/courses"],
    queryFn: () => fetch(`${apiBase}/me/courses`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: grades, isLoading: gradesLoading } = useQuery<CourseGradeDetail[]>({
    queryKey: ["me/grades"],
    queryFn: () => fetch(`${apiBase}/me/grades`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: predictions } = useQuery<PredictionItem[]>({
    queryKey: ["me/predictions"],
    queryFn: () => fetch(`${apiBase}/me/predictions`, { credentials: "include" }).then((r) => r.json()),
  });

  const atRiskCount = predictions?.filter((p) => p.risk_level === "high").length ?? 0;

  return (
    <PortalShell>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">My Portal</h1>
            <p className="text-muted-foreground mt-0.5">
              {profile.name} · {profile.major} · Year {profile.year}
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              Student ID: {profile.studentId}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          {gpaLoading ? (
            <>
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </>
          ) : (
            <>
              <StatCard
                title="Cumulative GPA"
                value={gpaData?.gpa !== null && gpaData?.gpa !== undefined ? gpaData.gpa.toFixed(2) : "N/A"}
                icon={TrendingUp}
                variant="primary"
              />
              <StatCard
                title="Enrolled Courses"
                value={gpaData?.total_courses ?? 0}
                icon={BookOpen}
                variant="default"
              />
              <StatCard
                title="At-Risk Courses"
                value={atRiskCount}
                icon={AlertTriangle}
                variant={atRiskCount > 0 ? "destructive" : "default"}
              />
            </>
          )}
        </div>

        {/* Courses */}
        <div>
          <h2 className="text-lg font-display font-semibold mb-4">My Courses</h2>

          {coursesLoading || gradesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : courses && courses.length > 0 ? (
            <div className="space-y-3">
              {courses.map((course) => (
                <CourseCard
                  key={course.course_id}
                  course={course}
                  detail={grades?.find((g) => g.course_id === course.course_id)}
                  prediction={predictions?.find((p) => p.course_id === course.course_id)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                You are not enrolled in any courses yet.
              </CardContent>
            </Card>
          )}
        </div>

        {/* GPA Breakdown */}
        {gpaData && gpaData.courses.length > 0 && (
          <div>
            <h2 className="text-lg font-display font-semibold mb-4">GPA Breakdown</h2>
            <Card>
              <CardContent className="pt-4">
                <div className="divide-y">
                  {gpaData.courses.map((c) => (
                    <div key={c.course_id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <span className="font-medium text-foreground">{c.course_name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {c.credits} credit{c.credits !== 1 ? "s" : ""}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-xs px-1.5 py-0 ${schemeBadgeClass[c.grading_scheme] ?? ""}`}
                          >
                            {schemeLabel[c.grading_scheme] ?? c.grading_scheme}
                          </Badge>
                          {!c.included_in_gpa && (
                            <span className="text-xs text-muted-foreground italic">
                              (not in GPA)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {c.display_label ? (
                          <span className="font-semibold text-foreground">{c.display_label}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {c.included_in_gpa && c.grade_points !== null && (
                          <div className="text-xs text-muted-foreground">
                            {c.grade_points.toFixed(1)} pts
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
