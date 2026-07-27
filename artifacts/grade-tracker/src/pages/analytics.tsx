import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GradeBadge } from '@/components/grade-badge';
import { RiskBadge } from '@/components/risk-badge';
import { Link } from 'wouter';
import {
  useGetCoursePerformance,
  useGetAtRiskStudents,
  useGetGradeDistribution,
  useGetAssignmentCompletion,
  useListCourses,
} from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const LETTER_COLORS: Record<string, string> = {
  A: '#22c55e', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444',
};

export default function Analytics() {
  const [selectedCourse, setSelectedCourse] = useState<string>('');

  const { data: courses } = useListCourses({});
  const { data: coursePerformance, isLoading: perfLoading } = useGetCoursePerformance();
  const { data: atRisk, isLoading: atRiskLoading } = useGetAtRiskStudents({
    course_id: selectedCourse ? Number(selectedCourse) : undefined,
  });
  const distCourseId = selectedCourse ? Number(selectedCourse) : (courses?.[0]?.id ?? 0);
  const { data: distribution } = useGetGradeDistribution({ course_id: distCourseId });
  const { data: completion } = useGetAssignmentCompletion({
    course_id: selectedCourse ? Number(selectedCourse) : undefined,
  });

  return (
    <AppShell>
      <div className="p-6 lg:p-8 space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">Analytics</h1>
            <p className="text-muted-foreground">Deep insights into academic performance</p>
          </div>
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="All Courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.code} — {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Course Performance Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Course Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {perfLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : coursePerformance && coursePerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={coursePerformance} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="course_name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                    formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name === 'average_grade' ? 'Avg Grade' : 'Pass Rate']}
                  />
                  <Legend formatter={(v) => v === 'average_grade' ? 'Average Grade' : 'Pass Rate'} />
                  <Bar dataKey="average_grade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="average_grade" />
                  <Bar dataKey="pass_rate" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="pass_rate" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No course data available</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Grade Distribution Pie */}
          {distribution && distribution.letter_counts && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display">Grade Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={distribution.letter_counts.filter((l) => l.count > 0)}
                      dataKey="count"
                      nameKey="letter"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ letter, percentage }) => `${letter} ${percentage?.toFixed(0)}%`}
                    >
                      {distribution.letter_counts.map((entry) => (
                        <Cell key={entry.letter} fill={LETTER_COLORS[entry.letter] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Assignment Completion */}
          {completion && completion.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display">Assignment Completion Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[220px] overflow-y-auto">
                  {completion.map((a) => (
                    <div key={a.assignment_id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground font-medium truncate max-w-[60%]">{a.assignment_name}</span>
                        <span className="text-muted-foreground font-mono text-xs">{a.completion_rate}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-500"
                          style={{ width: `${a.completion_rate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* At-Risk Students Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">At-Risk Students</CardTitle>
          </CardHeader>
          <CardContent>
            {atRiskLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : atRisk && atRisk.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Student</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium hidden sm:table-cell">Course</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Grade</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">Letter</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">Risk</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium hidden md:table-cell">Missing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {atRisk.map((s) => (
                      <tr key={`${s.student_id}-${s.course_id}`} className="hover:bg-muted/30">
                        <td className="px-3 py-3">
                          <Link href={`/students/${s.student_id}`}>
                            <span className="font-medium text-primary hover:underline cursor-pointer">{s.student_name}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">{s.course_name}</td>
                        <td className="px-3 py-3 text-right font-mono font-semibold">{s.current_grade?.toFixed(1)}%</td>
                        <td className="px-3 py-3 text-center"><GradeBadge letter={s.letter_grade} size="sm" /></td>
                        <td className="px-3 py-3 text-center"><RiskBadge level={s.risk_level} /></td>
                        <td className="px-3 py-3 text-right text-muted-foreground hidden md:table-cell">{s.assignments_missing}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-10">
                🎉 No at-risk students detected
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
