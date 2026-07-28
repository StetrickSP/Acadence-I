import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { GradeBadge } from '@/components/grade-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, ClipboardList, ArrowUpDown } from 'lucide-react';
import {
  useListGrades, useCreateGrade, useListStudents, useListCourses, useListAssignments,
  useGetComputedGrades,
  getListGradesQueryKey,
} from '@workspace/api-client-react';
import { ImportExportDialog } from '@/components/import-export-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const gradeSchema = z.object({
  student_id: z.coerce.number().min(1, 'Student is required'),
  assignment_id: z.coerce.number().min(1, 'Assignment is required'),
  score: z.coerce.number().min(0, 'Score must be ≥ 0'),
  feedback: z.string().optional(),
});

function ComputedGradeCell({
  studentId,
  courseId,
}: {
  studentId: number;
  courseId: number;
}) {
  const { data: computedGrades } = useGetComputedGrades(courseId);
  const entry = computedGrades?.find((g) => g.student_id === studentId);
  if (!entry || entry.display_label === null) return <span className="text-muted-foreground">—</span>;

  const scheme = entry.grading_scheme;
  if (scheme === 'pass_fail') {
    return (
      <span
        className={`text-xs font-bold px-2 py-0.5 rounded ${
          entry.display_label === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
      >
        {entry.display_label}
      </span>
    );
  }
  return (
    <span className="font-mono text-xs font-semibold text-foreground" title={entry.display_label ?? undefined}>
      {entry.display_label}
    </span>
  );
}

export default function Grades() {
  const [filterStudentId, setFilterStudentId] = useState<string>('');
  const [filterCourseId, setFilterCourseId] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);

  const { data: grades, isLoading } = useListGrades({
    student_id: filterStudentId ? Number(filterStudentId) : undefined,
    course_id: filterCourseId ? Number(filterCourseId) : undefined,
  });
  const { data: students } = useListStudents({});
  const { data: courses } = useListCourses({});
  const { data: assignments } = useListAssignments({
    course_id: filterCourseId ? Number(filterCourseId) : undefined,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createGrade = useCreateGrade();

  const form = useForm<z.infer<typeof gradeSchema>>({
    resolver: zodResolver(gradeSchema),
    defaultValues: { student_id: 0, assignment_id: 0, score: 0, feedback: '' },
  });

  const onSubmit = (data: z.infer<typeof gradeSchema>) => {
    createGrade.mutate(
      { data: { student_id: data.student_id, assignment_id: data.assignment_id, score: data.score, feedback: data.feedback } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGradesQueryKey() });
          toast({ title: 'Grade recorded successfully' });
          setDialogOpen(false);
          form.reset();
        },
        onError: () => toast({ title: 'Failed to record grade', variant: 'destructive' }),
      },
    );
  };

  const activeCourseId = filterCourseId && filterCourseId !== 'all' ? Number(filterCourseId) : null;

  return (
    <AppShell>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">Grades</h1>
            <p className="text-muted-foreground">Record and review student grades</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setImportExportOpen(true)}>
              <ArrowUpDown className="w-4 h-4" /> Import / Export
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-grade">
                <Plus className="w-4 h-4" /> Record Grade
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Grade</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="student_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Student</FormLabel>
                      <Select onValueChange={field.onChange} value={String(field.value)}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {students?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="assignment_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assignment</FormLabel>
                      <Select onValueChange={field.onChange} value={String(field.value)}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select assignment" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {assignments?.map((a) => (
                            <SelectItem key={a.id} value={String(a.id)}>{a.name} (max {a.max_score})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="score" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Score</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} data-testid="input-grade-score" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="feedback" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Feedback (Optional)</FormLabel>
                      <FormControl><Textarea {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={createGrade.isPending} data-testid="button-submit-grade">
                    {createGrade.isPending ? 'Saving...' : 'Record Grade'}
                  </Button>
                </form>
              </Form>
            </DialogContent>
            </Dialog>
          </div>{/* end flex gap-2 */}
        </div>{/* end flex justify-between */}

        <ImportExportDialog
          open={importExportOpen}
          onOpenChange={setImportExportOpen}
          onImportSuccess={() => queryClient.invalidateQueries({ queryKey: getListGradesQueryKey() })}
        />

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Select value={filterStudentId} onValueChange={setFilterStudentId}>
                <SelectTrigger><SelectValue placeholder="Filter by student" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {students?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterCourseId} onValueChange={setFilterCourseId}>
                <SelectTrigger><SelectValue placeholder="Filter by course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.code} — {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Grades Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : grades && grades.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/30">
                    <tr>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Student</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Assignment</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Score</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">%</th>
                      <th className="text-center px-4 py-3 text-muted-foreground font-medium">Grade</th>
                      {activeCourseId && (
                        <th className="text-center px-4 py-3 text-muted-foreground font-medium">Final Grade</th>
                      )}
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {grades.map((grade) => (
                      <tr key={grade.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-grade-${grade.id}`}>
                        <td className="px-4 py-3 font-medium text-foreground">{grade.student_name ?? `Student #${grade.student_id}`}</td>
                        <td className="px-4 py-3 text-muted-foreground">{grade.assignment_name ?? `Assignment #${grade.assignment_id}`}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{grade.score}</td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                          {grade.percentage !== null && grade.percentage !== undefined ? `${grade.percentage.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {grade.letter_grade ? <GradeBadge letter={grade.letter_grade} size="sm" /> : '—'}
                        </td>
                        {activeCourseId && (
                          <td className="px-4 py-3 text-center">
                            <ComputedGradeCell studentId={grade.student_id} courseId={activeCourseId} />
                          </td>
                        )}
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                          {grade.submitted_at ? new Date(grade.submitted_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No grades found</h3>
              <p className="text-muted-foreground">Record the first grade to get started</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
