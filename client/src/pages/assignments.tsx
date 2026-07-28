import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
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
import { Plus, FileText } from 'lucide-react';
import {
  useListAssignments, useCreateAssignment, useListCourses, getListAssignmentsQueryKey,
} from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const assignmentSchema = z.object({
  course_id: z.coerce.number().min(1, 'Course is required'),
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  max_score: z.coerce.number().min(1, 'Max score must be > 0'),
  weight: z.coerce.number().min(0).max(1, 'Weight must be 0–1'),
  due_date: z.string().optional(),
  description: z.string().optional(),
});

const typeColors: Record<string, string> = {
  midterm: 'bg-orange-100 text-orange-700 border border-orange-200',
  final: 'bg-red-100 text-red-700 border border-red-200',
  assignment: 'bg-blue-100 text-blue-700 border border-blue-200',
  quiz: 'bg-purple-100 text-purple-700 border border-purple-200',
  project: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
};

export default function Assignments() {
  const [filterCourseId, setFilterCourseId] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: assignments, isLoading } = useListAssignments({
    course_id: filterCourseId ? Number(filterCourseId) : undefined,
    type: filterType || undefined,
  });
  const { data: courses } = useListCourses({});

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createAssignment = useCreateAssignment();

  const form = useForm<z.infer<typeof assignmentSchema>>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: { course_id: 0, name: '', type: '', max_score: 100, weight: 0.1, due_date: '', description: '' },
  });

  const onSubmit = (data: z.infer<typeof assignmentSchema>) => {
    createAssignment.mutate(
      { data: { course_id: data.course_id, name: data.name, type: data.type, max_score: data.max_score, weight: data.weight, due_date: data.due_date || undefined, description: data.description || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAssignmentsQueryKey() });
          toast({ title: 'Assignment created' });
          setDialogOpen(false);
          form.reset();
        },
        onError: () => toast({ title: 'Failed to create assignment', variant: 'destructive' }),
      },
    );
  };

  return (
    <AppShell>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">Assignments</h1>
            <p className="text-muted-foreground">Manage course assignments, quizzes, and exams</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-assignment">
                <Plus className="w-4 h-4" /> Add Assignment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Assignment</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="course_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course</FormLabel>
                      <Select onValueChange={field.onChange} value={String(field.value)}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {courses?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.code} — {c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl><Input placeholder="Midterm Exam" {...field} data-testid="input-assignment-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {['assignment', 'quiz', 'midterm', 'final', 'project'].map((t) => (
                              <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="max_score" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Score</FormLabel>
                        <FormControl><Input type="number" {...field} data-testid="input-max-score" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="weight" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (0–1)</FormLabel>
                        <FormControl><Input type="number" step="0.01" min="0" max="1" {...field} data-testid="input-weight" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="due_date" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl><Textarea {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={createAssignment.isPending} data-testid="button-submit-assignment">
                    {createAssignment.isPending ? 'Creating...' : 'Create Assignment'}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Select value={filterCourseId} onValueChange={setFilterCourseId}>
                <SelectTrigger><SelectValue placeholder="Filter by course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.code} — {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger><SelectValue placeholder="Filter by type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {['assignment', 'quiz', 'midterm', 'final', 'project'].map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Assignments List */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : assignments && assignments.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {assignments.map((a) => (
              <Card key={a.id} data-testid={`card-assignment-${a.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate mb-1">{a.name}</h3>
                      <p className="text-xs text-muted-foreground">Course ID: {a.course_id}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ml-2 shrink-0 ${typeColors[a.type] ?? 'bg-muted text-muted-foreground'}`}>
                      {a.type}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Max Score</p>
                      <p className="font-mono font-semibold text-foreground">{a.max_score}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Weight</p>
                      <p className="font-mono font-semibold text-foreground">{(a.weight * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Due Date</p>
                      <p className="font-medium text-foreground text-xs">{a.due_date ?? '—'}</p>
                    </div>
                  </div>
                  {a.description && (
                    <p className="mt-3 text-xs text-muted-foreground line-clamp-2">{a.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No assignments found</h3>
              <p className="text-muted-foreground">Create your first assignment to get started</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
