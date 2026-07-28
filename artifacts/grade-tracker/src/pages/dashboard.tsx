import { AppShell } from '@/components/app-shell';
import { StatCard } from '@/components/stat-card';
import { GradeBadge } from '@/components/grade-badge';
import { RiskBadge } from '@/components/risk-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BookOpen, FileText, TrendingUp, AlertTriangle, CheckCircle2, Clock, ArrowUpRight, ArrowRight } from 'lucide-react';
import { useGetDashboardSummary, useGetRecentActivity, useGetTopPerformers, useListCourses, useListEnrollments } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'wouter';
import { useUser } from '@clerk/react';
import { useMemo } from 'react';

// Cycling palette for course code badges
const COURSE_COLORS = [
  { badge: 'bg-teal-100 text-teal-700',   ring: 'bg-teal-50',  icon: 'text-teal-400'   },
  { badge: 'bg-blue-100 text-blue-700',   ring: 'bg-blue-50',  icon: 'text-blue-400'   },
  { badge: 'bg-purple-100 text-purple-700', ring: 'bg-purple-50', icon: 'text-purple-400' },
  { badge: 'bg-amber-100 text-amber-700', ring: 'bg-amber-50', icon: 'text-amber-400'  },
  { badge: 'bg-rose-100 text-rose-700',   ring: 'bg-rose-50',  icon: 'text-rose-400'   },
  { badge: 'bg-green-100 text-green-700', ring: 'bg-green-50', icon: 'text-green-400'  },
];

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export default function Dashboard() {
  const { user } = useUser();
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: activities, isLoading: activitiesLoading } = useGetRecentActivity({ limit: 10 });
  const { data: topPerformers, isLoading: performersLoading } = useGetTopPerformers({ limit: 5 });
  const { data: courses, isLoading: coursesLoading } = useListCourses({});
  const { data: enrollments } = useListEnrollments({});

  // Enrollment count per course
  const enrollmentsByCourse = useMemo(() => {
    const map: Record<number, number> = {};
    for (const e of enrollments ?? []) {
      map[e.course_id] = (map[e.course_id] ?? 0) + 1;
    }
    return map;
  }, [enrollments]);

  // Display name: first name only for the greeting
  const firstName = user?.firstName
    || user?.fullName?.split(' ')[0]
    || user?.primaryEmailAddress?.emailAddress?.split('@')[0]
    || 'there';

  // Mock GPA trend data (in real app, would come from API)
  const gpaTrend = [
    { semester: 'Fall 22', gpa: 3.2 },
    { semester: 'Spring 23', gpa: 3.3 },
    { semester: 'Fall 23', gpa: 3.4 },
    { semester: 'Spring 24', gpa: 3.5 },
    { semester: 'Fall 24', gpa: summary?.average_gpa || 3.52 },
  ];

  return (
    <AppShell>
      <div className="p-6 lg:p-8 space-y-8">

        {/* ── Hero Banner ─────────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden min-h-[200px] flex items-end">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700" />
          {/* Subtle dot grid overlay */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
          {/* Right-side decorative glow */}
          <div className="absolute right-0 top-0 w-2/5 h-full bg-gradient-to-l from-primary/20 to-transparent" />

          <div className="relative z-10 p-8">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-teal-500/20 text-teal-300 border border-teal-500/40 mb-5">
              FACULTY DASHBOARD
            </span>
            <h1 className="text-3xl lg:text-4xl font-display font-bold text-white mb-3 leading-tight">
              Good {getTimeOfDay()}, {firstName}.
            </h1>
            <p className="text-slate-300 text-sm max-w-md leading-relaxed">
              Choose a course below to manage its grades, review performance, or run predictions.
            </p>
          </div>
        </div>

        {/* ── Stats Grid ──────────────────────────────────────────────── */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {summaryLoading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : (
            <>
              <StatCard
                title="Total Students"
                value={summary?.total_students || 0}
                icon={Users}
                variant="primary"
              />
              <StatCard
                title="Total Courses"
                value={summary?.total_courses || 0}
                icon={BookOpen}
                variant="default"
              />
              <StatCard
                title="Average GPA"
                value={(summary?.average_gpa || 0).toFixed(2)}
                icon={TrendingUp}
                variant="default"
              />
              <StatCard
                title="At-Risk Students"
                value={summary?.at_risk_count || 0}
                icon={AlertTriangle}
                variant="destructive"
              />
            </>
          )}
        </div>

        {/* ── Your Courses ─────────────────────────────────────────────── */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-5">
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Your Courses</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Each course has its own grade book and performance report.
              </p>
            </div>
            <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Click a box to open
            </span>
          </div>

          {coursesLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-44" />)}
            </div>
          ) : courses && courses.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {courses.map((course, i) => {
                const palette = COURSE_COLORS[i % COURSE_COLORS.length];
                const studentCount = enrollmentsByCourse[course.id] ?? 0;
                return (
                  <Link key={course.id} href={`/courses/${course.id}`}>
                    <div className="group relative bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden h-44 flex flex-col justify-between">
                      {/* Decorative circle */}
                      <div className={`absolute -bottom-6 -right-6 w-24 h-24 rounded-full ${palette.ring} opacity-60`} />

                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${palette.badge}`}>
                            {course.code}
                          </span>
                          <BookOpen className={`w-4 h-4 ${palette.icon} opacity-70`} />
                        </div>
                        <h3 className="font-display font-bold text-foreground text-base leading-snug line-clamp-2">
                          {course.name}
                        </h3>
                      </div>

                      <div className="relative z-10 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {studentCount > 0 ? `${studentCount} student${studentCount !== 1 ? 's' : ''}` : 'No enrollments'}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No courses yet. Create one to get started.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Charts Row ───────────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* GPA Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Semester GPA Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={gpaTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="semester" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis domain={[0, 4.0]} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Line type="monotone" dataKey="gpa" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Grade Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Grade Distribution Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : (
                <div className="space-y-4">
                  {summary?.grade_distribution_overview?.map((grade) => (
                    <div key={grade.letter} className="flex items-center gap-4">
                      <GradeBadge letter={grade.letter} size="md" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground">{grade.count} students</span>
                          <span className="text-sm font-mono text-muted-foreground">{grade.percentage?.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-500"
                            style={{ width: `${grade.percentage || 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Activity + Top Performers ────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activitiesLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {activities?.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                      <div className="mt-0.5">
                        {activity.type === 'grade_submitted' && <FileText className="w-4 h-4 text-primary" />}
                        {activity.type === 'enrollment' && <Users className="w-4 h-4 text-chart-3" />}
                        {activity.type === 'assignment_created' && <CheckCircle2 className="w-4 h-4 text-chart-2" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Performers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Top Performers</CardTitle>
            </CardHeader>
            <CardContent>
              {performersLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {topPerformers?.map((performer, index) => (
                    <Link key={performer.student_id} href={`/students/${performer.student_id}`}>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`card-performer-${performer.student_id}`}>
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                          #{index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{performer.student_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {performer.major} • Year {performer.year}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-mono font-bold text-primary">{performer.gpa.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">GPA</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </AppShell>
  );
}
