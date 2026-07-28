import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, Plus, Users, TrendingUp, BookOpen, Pencil } from 'lucide-react';
import {
  useListCourses, useCreateCourse, useUpdateCourse,
  getListCoursesQueryKey, getGetCourseQueryKey,
} from '@workspace/api-client-react';
import type { Course } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const GRADING_SCHEMES = [
  { value: 'weighted', label: 'Weighted' },
  { value: 'curved', label: 'Curved (+5%)' },
  { value: 'pass_fail', label: 'Pass / Fail' },
];

const schemeBadgeClass: Record<string, string> = {
  weighted: 'bg-blue-50 text-blue-700 border-blue-200',
  curved: 'bg-purple-50 text-purple-700 border-purple-200',
  pass_fail: 'bg-orange-50 text-orange-700 border-orange-200',
};

const courseSchema = z.object({
  code: z.string().min(1, 'Course code is required'),
  name: z.string().min(1, 'Course name is required'),
  credits: z.coerce.number().min(1).max(6),
  semester: z.string().min(1, 'Semester is required'),
  instructor: z.string().min(1, 'Instructor is required'),
  description: z.string().optional(),
  grading_scheme: z.string().default('weighted'),
});

const editCourseSchema = z.object({
  name: z.string().min(1, 'Course name is required'),
  credits: z.coerce.number().min(1).max(6),
  semester: z.string().min(1, 'Semester is required'),
  instructor: z.string().min(1, 'Instructor is required'),
  description: z.string().optional(),
  grading_scheme: z.string().default('weighted'),
});

type CourseFormData = z.infer<typeof courseSchema>;
type EditCourseFormData = z.infer<typeof editCourseSchema>;

function EditCourseDialog({ course, onClose }: { course: Course; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateCourse = useUpdateCourse();

  const form = useForm<EditCourseFormData>({
    resolver: zodResolver(editCourseSchema),
    defaultValues: {
      name: course.name,
      credits: course.credits,
      semester: course.semester,
      instructor: course.instructor,
      description: course.description ?? '',
      grading_scheme: course.grading_scheme ?? 'weighted',
    },
  });

  const onSubmit = (data: EditCourseFormData) => {
    updateCourse.mutate(
      { id: course.id, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCourseQueryKey(course.id) });
          toast({ title: 'Course updated successfully' });
          onClose();
        },
        onError: () => {
          toast({ title: 'Failed to update course', variant: 'destructive' });
        },
      }
    );
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit Course — {course.code}</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Course Name</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-edit-course-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="credits"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credits</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={6} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="semester"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Semester</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="instructor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Instructor</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="grading_scheme"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grading Scheme</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-edit-grading-scheme">
                      <SelectValue placeholder="Select grading scheme" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {GRADING_SCHEMES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={updateCourse.isPending} data-testid="button-submit-edit-course">
            {updateCourse.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Form>
    </DialogContent>
  );
}

export default function Courses() {
  const [search, setSearch] = useState('');
  const [semester, setSemester] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);

  const { data: courses, isLoading } = useListCourses({
    search: search || undefined,
    semester: semester || undefined,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createCourse = useCreateCourse();

  const form = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      code: '',
      name: '',
      credits: 3,
      semester: '',
      instructor: '',
      description: '',
      grading_scheme: 'weighted',
    },
  });

  const onSubmit = (data: CourseFormData) => {
    createCourse.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
          toast({ title: 'Course created successfully' });
          setDialogOpen(false);
          form.reset();
        },
        onError: () => {
          toast({ title: 'Failed to create course', variant: 'destructive' });
        },
      }
    );
  };

  return (
    <AppShell>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">Courses</h1>
            <p className="text-muted-foreground">Manage course catalog and enrollment</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-course">
                <Plus className="w-4 h-4" />
                Add Course
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Course</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Course Code</FormLabel>
                        <FormControl>
                          <Input placeholder="CS-101" {...field} data-testid="input-course-code" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Course Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Introduction to Computer Science" {...field} data-testid="input-course-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="credits"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Credits</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={6} {...field} data-testid="input-course-credits" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="semester"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Semester</FormLabel>
                          <FormControl>
                            <Input placeholder="Fall 2024" {...field} data-testid="input-course-semester" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="instructor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instructor</FormLabel>
                        <FormControl>
                          <Input placeholder="Dr. Sarah Johnson" {...field} data-testid="input-course-instructor" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="grading_scheme"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grading Scheme</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-grading-scheme">
                              <SelectValue placeholder="Select grading scheme" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GRADING_SCHEMES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea {...field} data-testid="input-course-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={createCourse.isPending} data-testid="button-submit-course">
                    {createCourse.isPending ? 'Creating...' : 'Create Course'}
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by course code or name..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-courses"
                />
              </div>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger data-testid="select-semester">
                  <SelectValue placeholder="Filter by semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Semesters</SelectItem>
                  <SelectItem value="Fall 2024">Fall 2024</SelectItem>
                  <SelectItem value="Spring 2024">Spring 2024</SelectItem>
                  <SelectItem value="Fall 2023">Fall 2023</SelectItem>
                  <SelectItem value="Spring 2023">Spring 2023</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Courses Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : courses && courses.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <div key={course.id} className="relative group">
                <Link href={`/courses/${course.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full" data-testid={`card-course-${course.id}`}>
                    <CardContent className="p-6">
                      <div className="mb-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-foreground text-lg">{course.code}</h3>
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={`text-xs px-1.5 py-0 ${schemeBadgeClass[course.grading_scheme ?? 'weighted'] ?? ''}`}
                            >
                              {GRADING_SCHEMES.find((s) => s.value === (course.grading_scheme ?? 'weighted'))?.label ?? course.grading_scheme}
                            </Badge>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                              {course.credits} credits
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-foreground mb-1">{course.name}</p>
                        <p className="text-xs text-muted-foreground">{course.semester}</p>
                      </div>

                      <div className="space-y-2 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 text-sm">
                          <BookOpen className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{course.instructor}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{course.student_count || 0} students</span>
                        </div>
                        {course.average_grade !== null && course.average_grade !== undefined && (
                          <div className="flex items-center gap-2 text-sm">
                            <TrendingUp className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Avg: <span className="font-mono font-semibold text-primary">{course.average_grade.toFixed(1)}%</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                {/* Edit button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-background/80 hover:bg-background"
                  data-testid={`button-edit-course-${course.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditCourse(course as Course);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No courses found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or add a new course</p>
            </CardContent>
          </Card>
        )}

        {/* Edit Course Dialog */}
        <Dialog open={!!editCourse} onOpenChange={(open) => { if (!open) setEditCourse(null); }}>
          {editCourse && (
            <EditCourseDialog course={editCourse} onClose={() => setEditCourse(null)} />
          )}
        </Dialog>
      </div>
    </AppShell>
  );
}
