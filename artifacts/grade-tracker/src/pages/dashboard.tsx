import { AppShell } from '@/components/app-shell';
import { StatCard } from '@/components/stat-card';
import { GradeBadge } from '@/components/grade-badge';
import { RiskBadge } from '@/components/risk-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BookOpen, FileText, TrendingUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useGetDashboardSummary, useGetRecentActivity, useGetTopPerformers } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'wouter';

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: activities, isLoading: activitiesLoading } = useGetRecentActivity({ limit: 10 });
  const { data: topPerformers, isLoading: performersLoading } = useGetTopPerformers({ limit: 5 });

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
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Academic performance overview and system metrics</p>
        </div>

        {/* Stats Grid */}
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
