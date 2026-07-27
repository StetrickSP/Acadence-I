import { useParams, Link } from 'wouter';
import { AppShell } from '@/components/app-shell';
import { GradeBadge } from '@/components/grade-badge';
import { RiskBadge } from '@/components/risk-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, BookOpen, TrendingUp } from 'lucide-react';
import {
  useGetCourse,
  useGetCourseStats,
  useGetCourseStudents,
  useGetAtRiskStudents,
  usePredictAtRisk,
  useGetGradeDistribution,
} from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

export default function CourseDetail() {
  const params = useParams();
  const courseId = Number(params.id);

  const { data: course, isLoading: courseLoading } = useGetCourse(courseId);
  const { data: stats, isLoading: statsLoading } = useGetCourseStats(courseId);
  const { data: students } = useGetCourseStudents(courseId);
  const { data: atRiskStudents } = useGetAtRiskStudents({ course_id: courseId });
  const { data: predictions } = usePredictAtRisk(courseId);
  const { data: distribution } = useGetGradeDistribution({ course_id: courseId });

  if (courseLoading) {
    return (
      <AppShell>
        <div className="p-6 lg:p-8 space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-6 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  if (!course) {
    return (
      <AppShell>
        <div className="p-6 lg:p-8">
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-semibold mb-2">Course not found</h3>
              <Link href="/courses"><Button>Back to Courses</Button></Link>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const letterColors: Record<string, string> = {
    A: '#22c55e', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444',
  };

  return (
    <AppShell>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/courses">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-display font-bold text-foreground">{course.name}</h1>
              <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{course.code}</span>
            </div>
            <p className="text-muted-foreground">{course.instructor} · {course.semester} · {course.credits} credits</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statsLoading ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : stats ? (
            <>
              <Card><CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-1">Enrolled Students</p>
                <p className="text-3xl font-mono font-bold text-primary">{stats.student_count}</p>
              </CardContent></Card>
              <Card><CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-1">Average Grade</p>
                <p className="text-3xl font-mono font-bold text-primary">{stats.average_grade?.toFixed(1)}%</p>
              </CardContent></Card>
              <Card><CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-1">Pass Rate</p>
                <p className="text-3xl font-mono font-bold text-emerald-600">{stats.pass_rate?.toFixed(1)}%</p>
              </CardContent></Card>
              <Card><CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-1">Std Deviation</p>
                <p className="text-3xl font-mono font-bold text-foreground">{stats.std_deviation ?? 'N/A'}</p>
              </CardContent></Card>
            </>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Grade Distribution Chart */}
          {distribution && distribution.letter_counts && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display">Grade Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={distribution.letter_counts}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="letter" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {distribution.letter_counts.map((entry) => (
                        <Cell key={entry.letter} fill={letterColors[entry.letter] ?? '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* At-Risk Students */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">At-Risk Students</CardTitle>
            </CardHeader>
            <CardContent>
              {atRiskStudents && atRiskStudents.length > 0 ? (
                <div className="space-y-3">
                  {atRiskStudents.filter((s) => s.course_id === courseId).map((s) => (
                    <Link key={s.student_id} href={`/students/${s.student_id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.student_name}</p>
                          <p className="text-xs text-muted-foreground">{s.assignments_missing} missing assignments</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <GradeBadge letter={s.letter_grade} size="sm" />
                          <RiskBadge level={s.risk_level} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8 text-sm">No at-risk students 🎉</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Predictions */}
        {predictions && predictions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Predicted Final Grades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {predictions.map((p) => (
                  <Link key={p.student_id} href={`/students/${p.student_id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.student_name}</p>
                        <p className="text-xs text-muted-foreground">Current: {p.current_score?.toFixed(1) ?? 'N/A'}%</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-mono font-bold text-primary">{p.predicted_score.toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">{p.confidence}% confidence</p>
                        </div>
                        <GradeBadge letter={p.predicted_letter} size="sm" />
                        <RiskBadge level={p.risk_level} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Student List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Enrolled Students ({students?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {students && students.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {students.map((s) => (
                  <Link key={s.id} href={`/students/${s.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {s.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.major} · Year {s.year}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No students enrolled</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
