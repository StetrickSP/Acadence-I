import { useParams, Link } from 'wouter';
import { AppShell } from '@/components/app-shell';
import { GradeBadge } from '@/components/grade-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, Calendar, BookOpen, TrendingUp } from 'lucide-react';
import { useGetStudent, useGetStudentGpa, useGetStudentCourses } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function StudentDetail() {
  const params = useParams();
  const studentId = Number(params.id);

  const { data: student, isLoading: studentLoading } = useGetStudent(studentId);
  const { data: gpa, isLoading: gpaLoading } = useGetStudentGpa(studentId);
  const { data: courses, isLoading: coursesLoading } = useGetStudentCourses(studentId);

  if (studentLoading) {
    return (
      <AppShell>
        <div className="p-6 lg:p-8 space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!student) {
    return (
      <AppShell>
        <div className="p-6 lg:p-8">
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-semibold text-foreground mb-2">Student not found</h3>
              <p className="text-muted-foreground mb-4">The student you're looking for doesn't exist.</p>
              <Link href="/students">
                <Button>Back to Students</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/students">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">{student.name}</h1>
            <p className="text-muted-foreground font-mono">{student.student_id}</p>
          </div>
        </div>

        {/* Student Info Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Email</p>
              </div>
              <p className="text-sm text-foreground break-all">{student.email}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Major</p>
              </div>
              <p className="text-sm font-semibold text-foreground">{student.major}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Year</p>
              </div>
              <p className="text-sm font-semibold text-foreground">Year {student.year}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Current GPA</p>
              </div>
              {gpaLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-mono font-bold text-primary">{gpa?.gpa.toFixed(2) || 'N/A'}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* GPA Details */}
        {!gpaLoading && gpa && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">GPA Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3 mb-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Overall GPA</p>
                  <p className="text-3xl font-mono font-bold text-primary">{gpa.gpa.toFixed(2)}</p>
                  <GradeBadge letter={gpa.letter_grade} size="md" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Courses</p>
                  <p className="text-3xl font-mono font-bold text-foreground">{gpa.total_courses}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Completed Courses</p>
                  <p className="text-3xl font-mono font-bold text-foreground">{gpa.completed_courses}</p>
                </div>
              </div>

              {gpa.grade_points_breakdown && gpa.grade_points_breakdown.length > 0 && (
                <div>
                  <h4 className="font-semibold text-foreground mb-3">Grade Points Breakdown</h4>
                  <div className="space-y-2">
                    {gpa.grade_points_breakdown.map((course, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{course.course_name}</p>
                          <p className="text-xs text-muted-foreground">{course.credits} credits</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <GradeBadge letter={course.grade} size="sm" />
                          <p className="text-sm font-mono font-semibold text-foreground w-12 text-right">
                            {course.grade_points.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Enrolled Courses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Enrolled Courses</CardTitle>
          </CardHeader>
          <CardContent>
            {coursesLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : courses && courses.length > 0 ? (
              <div className="space-y-3">
                {courses.map((course) => (
                  <Link key={course.course_id} href={`/courses/${course.course_id}`}>
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`card-course-${course.course_id}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <p className="font-semibold text-foreground">{course.course_name}</p>
                          <span className="text-sm font-mono text-muted-foreground">{course.course_code}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{course.semester}</span>
                          <span>•</span>
                          <span>{course.credits} credits</span>
                        </div>
                      </div>
                      <div className="text-right">
                        {course.current_grade !== null && course.current_grade !== undefined ? (
                          <>
                            <p className="text-xl font-mono font-bold text-primary mb-1">{course.current_grade.toFixed(1)}%</p>
                            {course.letter_grade && <GradeBadge letter={course.letter_grade} size="sm" />}
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">No grade yet</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No enrolled courses</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
