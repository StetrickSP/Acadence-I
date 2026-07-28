import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { GradeBadge } from '@/components/grade-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, Plus, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { useListStudents, useCreateStudent, getListStudentsQueryKey } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const studentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  student_id: z.string().min(1, 'Student ID is required'),
  year: z.coerce.number().min(1).max(6),
  major: z.string().min(1, 'Major is required'),
});

export default function Students() {
  const [search, setSearch] = useState('');
  const [major, setMajor] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: students, isLoading } = useListStudents({
    search: search || undefined,
    major: major || undefined,
    year: year ? Number(year) : undefined,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createStudent = useCreateStudent();

  const form = useForm<z.infer<typeof studentSchema>>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      name: '',
      email: '',
      student_id: '',
      year: 1,
      major: '',
    },
  });

  const onSubmit = (data: z.infer<typeof studentSchema>) => {
    createStudent.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
          toast({ title: 'Student created successfully' });
          setDialogOpen(false);
          form.reset();
        },
        onError: () => {
          toast({ title: 'Failed to create student', variant: 'destructive' });
        },
      }
    );
  };

  return (
    <AppShell>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">Students</h1>
            <p className="text-muted-foreground">Manage student records and track performance</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-student">
                <Plus className="w-4 h-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Student</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-student-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-student-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="student_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Student ID</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-student-id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Year</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={6} {...field} data-testid="input-student-year" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="major"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Major</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-student-major" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={createStudent.isPending} data-testid="button-submit-student">
                    {createStudent.isPending ? 'Creating...' : 'Create Student'}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or ID..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-students"
                />
              </div>
              <Select value={major} onValueChange={setMajor}>
                <SelectTrigger data-testid="select-major">
                  <SelectValue placeholder="Filter by major" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Majors</SelectItem>
                  <SelectItem value="Computer Science">Computer Science</SelectItem>
                  <SelectItem value="Mathematics">Mathematics</SelectItem>
                  <SelectItem value="Physics">Physics</SelectItem>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Biology">Biology</SelectItem>
                </SelectContent>
              </Select>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger data-testid="select-year">
                  <SelectValue placeholder="Filter by year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="1">Year 1</SelectItem>
                  <SelectItem value="2">Year 2</SelectItem>
                  <SelectItem value="3">Year 3</SelectItem>
                  <SelectItem value="4">Year 4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Students Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : students && students.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {students.map((student) => (
              <Link key={student.id} href={`/students/${student.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full" data-testid={`card-student-${student.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate mb-1">{student.name}</h3>
                        <p className="text-sm text-muted-foreground font-mono">{student.student_id}</p>
                      </div>
                      {student.gpa !== null && student.gpa !== undefined && (
                        <div className="text-right">
                          <p className="text-2xl font-mono font-bold text-primary">{student.gpa.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">GPA</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Major</span>
                        <span className="font-medium text-foreground">{student.major}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Year</span>
                        <span className="font-medium text-foreground">Year {student.year}</span>
                      </div>
                      {student.gpa !== null && student.gpa !== undefined && student.gpa < 2.0 && (
                        <div className="flex items-center gap-2 mt-3 p-2 rounded bg-destructive/10 text-destructive text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="font-medium">At Risk</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No students found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or add a new student</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
