import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'wouter';
import { AppShell } from '@/components/app-shell';
import { GradeBadge } from '@/components/grade-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Trophy, Plus, Trash2, Users, BookOpen,
  BarChart2, Brain, Calendar, AlertTriangle, ClipboardList, FileText,
  GraduationCap, TrendingUp, ChevronLeft, Download, Upload,
  CheckCircle2, Activity, Target, Shield, Check, X,
} from 'lucide-react';
import {
  useGetCourse,
  useGetCourseStats,
  useGetAtRiskStudents,
  usePredictAtRisk,
  useGetCourseRankings,
  useGetComputedGrades,
  useListEnrollments,
  useCreateEnrollment,
  useDeleteEnrollment,
  useListStudents,
  useListAssignments,
  useCreateAssignment,
  useDeleteAssignment,
  useListGrades,
  useCreateGrade,
  useUpdateGrade,
  getGetCourseStatsQueryKey,
  getGetCourseStudentsQueryKey,
  getGetComputedGradesQueryKey,
  getListEnrollmentsQueryKey,
  getListAssignmentsQueryKey,
  getListGradesQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, LabelList,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────────────────────────

type TabKey = 'overview' | 'enrollment' | 'grades' | 'attendance' | 'visualization' | 'prediction';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview',      label: 'Overview',              icon: <GraduationCap className="w-4 h-4" /> },
  { key: 'enrollment',    label: 'Enrollment Management', icon: <Users className="w-4 h-4" /> },
  { key: 'grades',        label: 'Grade Management',      icon: <ClipboardList className="w-4 h-4" /> },
  { key: 'attendance',    label: 'Attendance Report',     icon: <Calendar className="w-4 h-4" /> },
  { key: 'visualization', label: 'Visualization Reports', icon: <BarChart2 className="w-4 h-4" /> },
  { key: 'prediction',    label: 'AI Prediction',         icon: <Brain className="w-4 h-4" /> },
];

// ─── Attendance localStorage ──────────────────────────────────────────────────

interface AttendanceRecord { studentId: number; present: boolean }
interface AttendanceSession {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  records: AttendanceRecord[];
}

function getAttendanceSessions(courseId: number): AttendanceSession[] {
  try { return JSON.parse(localStorage.getItem(`attendance_${courseId}`) ?? '[]'); }
  catch { return []; }
}
function saveAttendanceSessions(courseId: number, sessions: AttendanceSession[]) {
  localStorage.setItem(`attendance_${courseId}`, JSON.stringify(sessions));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="text-muted-foreground mb-3">{icon}</div>
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
      {hint && <p className="text-sm text-muted-foreground max-w-xs">{hint}</p>}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ courseId, stats, statsLoading }: { courseId: number; stats: any; statsLoading: boolean }) {
  const { data: assignments } = useListAssignments({ course_id: courseId });
  const upcoming = assignments
    ?.filter((a) => a.due_date && new Date(a.due_date) >= new Date())
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0];

  if (statsLoading) {
    return <div className="grid gap-4 md:grid-cols-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Course Performance</p>
            <p className="text-3xl font-mono font-bold text-emerald-600">{(stats?.pass_rate ?? 0).toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Pass Rate</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Average Grade</p>
            <p className="text-3xl font-mono font-bold text-primary">{(stats?.average_grade ?? 0).toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Class average</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Next Milestone</p>
            {upcoming ? (
              <>
                <p className="text-base font-semibold text-foreground leading-tight">{upcoming.name}</p>
                <p className="text-xs text-muted-foreground mt-1">Due {upcoming.due_date}</p>
              </>
            ) : <p className="text-sm text-muted-foreground mt-2">No upcoming assignments</p>}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground mb-1">Enrolled Students</p>
          <p className="text-2xl font-mono font-bold">{stats?.student_count ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground mb-1">Median Grade</p>
          <p className="text-2xl font-mono font-bold">{stats?.median_grade != null ? `${stats.median_grade.toFixed(1)}%` : '—'}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground mb-1">Std Deviation</p>
          <p className="text-2xl font-mono font-bold">{stats?.std_deviation ?? '—'}</p>
        </CardContent></Card>
      </div>
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-5 flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Course-specific workspace</p>
            <p className="text-xs text-muted-foreground mt-1">Use the tabs above to manage enrollment, record grades, view visualizations, and AI-driven grade predictions for this course.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Enrollment Tab ───────────────────────────────────────────────────────────

function EnrollmentTab({ courseId, course }: { courseId: number; course: any }) {
  const [enrollOpen, setEnrollOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: enrollments, isLoading } = useListEnrollments({ course_id: courseId });
  const { data: allStudents } = useListStudents({});
  const createEnrollment = useCreateEnrollment();
  const deleteEnrollment = useDeleteEnrollment();

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const enrolledIds = new Set((enrollments ?? []).map((e) => e.student_id));
  const unenrolledStudents = (allStudents ?? []).filter((s) => !enrolledIds.has(s.id));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetCourseStatsQueryKey(courseId) });
    qc.invalidateQueries({ queryKey: getGetCourseStudentsQueryKey(courseId) });
    qc.invalidateQueries({ queryKey: getListEnrollmentsQueryKey({ course_id: courseId }) });
  };

  const onEnroll = () => {
    if (!selectedStudentId) return;
    createEnrollment.mutate(
      { data: { student_id: Number(selectedStudentId), course_id: courseId, semester: course.semester } },
      {
        onSuccess: () => { invalidate(); toast({ title: 'Student enrolled' }); setEnrollOpen(false); setSelectedStudentId(''); },
        onError: () => toast({ title: 'Failed to enroll student', variant: 'destructive' }),
      },
    );
  };

  const onUnenroll = (enrollmentId: number) => {
    deleteEnrollment.mutate({ id: enrollmentId }, {
      onSuccess: () => { invalidate(); toast({ title: 'Student unenrolled' }); },
      onError: () => toast({ title: 'Failed to unenroll', variant: 'destructive' }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Enrolled Students ({enrollments?.length ?? 0})</h2>
        <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-teal-700 hover:bg-teal-800 text-white" size="sm">
              <Plus className="w-4 h-4" /> Enroll Student
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Enroll a Student</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {unenrolledStudents.length === 0
                    ? <SelectItem value="none" disabled>All students are enrolled</SelectItem>
                    : unenrolledStudents.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button className="w-full bg-teal-700 hover:bg-teal-800" onClick={onEnroll}
                disabled={!selectedStudentId || createEnrollment.isPending || unenrolledStudents.length === 0}>
                {createEnrollment.isPending ? 'Enrolling...' : 'Enroll Student'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        {isLoading ? (
          <CardContent className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}</CardContent>
        ) : enrollments && enrollments.length > 0 ? (
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Student</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Semester</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Enrolled</th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {enrollments.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{e.student_name ?? `Student #${e.student_id}`}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{e.semester}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">{new Date(e.enrolled_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onUnenroll(e.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        ) : (
          <CardContent><EmptyState icon={<Users className="w-10 h-10" />} title="No students enrolled" hint="Click 'Enroll Student' to add students to this course." /></CardContent>
        )}
      </Card>
    </div>
  );
}

// ─── Grade Management Tab ─────────────────────────────────────────────────────

function GradeManagementTab({ courseId }: { courseId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: assignments = [] } = useListAssignments({ course_id: courseId });
  const { data: grades = [] } = useListGrades({ course_id: courseId });
  const { data: enrollments = [] } = useListEnrollments({ course_id: courseId });
  const { data: computedGrades = [] } = useGetComputedGrades(courseId);

  const createAssignment = useCreateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const createGrade = useCreateGrade();
  const updateGrade = useUpdateGrade();

  // Inline add-assignment form state
  const [newName, setNewName] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newMax, setNewMax] = useState('100');

  // Local edits map: key = `${studentId}_${assignmentId}` → input string
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});

  // Panel open/close
  const [panelOpen, setPanelOpen] = useState(true);

  const invalidateGrades = useCallback(() => {
    qc.invalidateQueries({ queryKey: getListGradesQueryKey({ course_id: courseId }) });
    qc.invalidateQueries({ queryKey: getGetComputedGradesQueryKey(courseId) });
    qc.invalidateQueries({ queryKey: getGetCourseStatsQueryKey(courseId) });
  }, [qc, courseId]);

  // Build lookup: existing grade by studentId_assignmentId
  const gradeMap = new Map<string, { id: number; score: number }>();
  grades.forEach((g) => gradeMap.set(`${g.student_id}_${g.assignment_id}`, { id: g.id, score: g.score }));

  // Build lookup: computed grade by studentId
  const computedMap = new Map(computedGrades.map((g) => [g.student_id, g]));

  // Get display value for a cell
  const getCellValue = (studentId: number, assignmentId: number): string => {
    const key = `${studentId}_${assignmentId}`;
    if (key in localEdits) return localEdits[key];
    return gradeMap.has(key) ? String(gradeMap.get(key)!.score) : '';
  };

  const onCellChange = (studentId: number, assignmentId: number, val: string) => {
    setLocalEdits((prev) => ({ ...prev, [`${studentId}_${assignmentId}`]: val }));
  };

  const onCellBlur = (studentId: number, assignmentId: number) => {
    const key = `${studentId}_${assignmentId}`;
    const val = localEdits[key];
    if (val === undefined) return;
    const score = parseFloat(val);
    if (val.trim() === '' || isNaN(score)) {
      setLocalEdits((prev) => { const next = { ...prev }; delete next[key]; return next; });
      return;
    }
    const existing = gradeMap.get(key);
    if (existing && existing.score === score) {
      setLocalEdits((prev) => { const next = { ...prev }; delete next[key]; return next; });
      return;
    }
    if (existing) {
      updateGrade.mutate({ id: existing.id, data: { score } }, {
        onSuccess: () => {
          invalidateGrades();
          setLocalEdits((prev) => { const next = { ...prev }; delete next[key]; return next; });
        },
        onError: () => toast({ title: 'Failed to save grade', variant: 'destructive' }),
      });
    } else {
      createGrade.mutate({ data: { student_id: studentId, assignment_id: assignmentId, score } }, {
        onSuccess: () => {
          invalidateGrades();
          setLocalEdits((prev) => { const next = { ...prev }; delete next[key]; return next; });
        },
        onError: () => toast({ title: 'Failed to save grade', variant: 'destructive' }),
      });
    }
  };

  const onDeleteAssignment = (id: number) => {
    deleteAssignment.mutate({ id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAssignmentsQueryKey({ course_id: courseId }) }),
      onError: () => toast({ title: 'Failed to delete assignment', variant: 'destructive' }),
    });
  };

  const onAddAssignment = () => {
    if (!newName.trim()) return;
    const weight = parseFloat(newWeight) / 100;
    const max = parseFloat(newMax);
    if (isNaN(weight) || isNaN(max) || max <= 0) return;
    createAssignment.mutate(
      { data: { course_id: courseId, name: newName.trim(), type: 'assignment', max_score: max, weight } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListAssignmentsQueryKey({ course_id: courseId }) });
          qc.invalidateQueries({ queryKey: getListAssignmentsQueryKey() });
          setNewName(''); setNewWeight(''); setNewMax('100');
          toast({ title: 'Assignment created' });
        },
        onError: () => toast({ title: 'Failed to create assignment', variant: 'destructive' }),
      },
    );
  };

  const totalWeight = assignments.reduce((s, a) => s + a.weight, 0);
  const totalWeightPct = Math.round(totalWeight * 100);

  const exportToJson = () => {
    const data = grades.map((g) => ({
      student: g.student_name,
      assignment: g.assignment_name,
      score: g.score,
      percentage: g.percentage,
      letter: g.letter_grade,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `grades_course_${courseId}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const importRef = useRef<HTMLInputElement>(null);
  const onImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.trim().split('\n');
        if (lines.length < 2) { toast({ title: 'CSV is empty', variant: 'destructive' }); return; }
        toast({ title: `CSV loaded: ${lines.length - 1} row(s). Manual import via this view coming soon.` });
      } catch {
        toast({ title: 'Failed to read CSV', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex gap-4 min-h-0">
      {/* ── Left: Spreadsheet ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
          {assignments.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={<FileText className="w-10 h-10" />} title="No assignments yet" hint="Add assignments in the panel on the right." />
            </div>
          ) : enrollments.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={<Users className="w-10 h-10" />} title="No students enrolled" hint="Enroll students first using the Enrollment Management tab." />
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 bg-background z-10 text-left px-4 py-3 text-foreground font-semibold min-w-[160px] border-r border-border">
                    Student
                  </th>
                  {assignments.map((a) => (
                    <th key={a.id} className="text-center px-3 py-2 text-foreground font-medium min-w-[110px]">
                      <div className="font-semibold">{a.name}</div>
                      <div className="text-xs text-muted-foreground font-normal">
                        W: {(a.weight * 100).toFixed(0)}% | Max: {a.max_score}
                      </div>
                    </th>
                  ))}
                  <th className="text-center px-3 py-2 text-foreground font-semibold min-w-[90px]">Weighted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {enrollments.map((enr) => {
                  const comp = computedMap.get(enr.student_id);
                  return (
                    <tr key={enr.student_id} className="hover:bg-muted/30 transition-colors">
                      <td className="sticky left-0 bg-background z-10 px-4 py-3 border-r border-border">
                        <p className="font-medium text-foreground leading-tight">{enr.student_name ?? `Student #${enr.student_id}`}</p>
                      </td>
                      {assignments.map((a) => (
                        <td key={a.id} className="px-2 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            max={a.max_score}
                            step="0.5"
                            value={getCellValue(enr.student_id, a.id)}
                            onChange={(e) => onCellChange(enr.student_id, a.id, e.target.value)}
                            onBlur={() => onCellBlur(enr.student_id, a.id)}
                            className="w-20 h-8 text-center text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            placeholder="—"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center font-mono font-semibold text-foreground">
                        {comp?.percentage != null ? `${comp.percentage.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-muted-foreground">
            Weighted grades calculated: Earned / Max × Assignment Weight (scaled to 100% total distribution).
          </p>
          <div className="flex gap-2 shrink-0">
            <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={onImportCsv} />
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => importRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" /> Import CSV Files
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportToJson}>
              <Download className="w-3.5 h-3.5" /> Export to JSON
            </Button>
          </div>
        </div>
      </div>

      {/* ── Right: Assignment Distribution Panel ── */}
      {panelOpen && (
        <div className="w-72 shrink-0 flex flex-col gap-3">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Assignment Distribution</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${totalWeightPct === 100 ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'}`}>
                    Total: {totalWeightPct}%
                  </span>
                  <button onClick={() => setPanelOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Create, edit, or delete assignments. Total weights are scaled proportionally to calculate weighted grades.
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {/* Assignment cards */}
              {assignments.map((a) => (
                <div key={a.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between mb-1.5">
                    <span className="font-semibold text-sm text-foreground">{a.name}</span>
                    <button onClick={() => onDeleteAssignment(a.id)} className="text-muted-foreground hover:text-destructive transition-colors ml-2 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    W%: <span className="font-semibold text-foreground">{(a.weight * 100).toFixed(0)}</span>
                    <span className="mx-2 text-border">|</span>
                    Max Pts: <span className="font-semibold text-foreground">{a.max_score}</span>
                  </p>
                </div>
              ))}

              {/* Inline add form */}
              <div className="pt-1 border-t border-border space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="col-span-3 h-8 text-xs px-2 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <input
                    type="number"
                    placeholder="W%"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    className="h-8 text-xs px-2 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={newMax}
                    onChange={(e) => setNewMax(e.target.value)}
                    className="h-8 text-xs px-2 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 col-span-2"
                  />
                </div>
                <Button
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white text-sm h-9"
                  onClick={onAddAssignment}
                  disabled={createAssignment.isPending || !newName.trim()}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {createAssignment.isPending ? 'Adding…' : '+ Add Assignment'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Collapsed panel toggle */}
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1 h-fit mt-1"
        >
          <BookOpen className="w-3.5 h-3.5" /> Assignments
        </button>
      )}
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

interface NewSessionForm { title: string; date: string; startTime: string; endTime: string }

function AttendanceTab({ courseId }: { courseId: number }) {
  const { data: enrollments = [] } = useListEnrollments({ course_id: courseId });
  const [sessions, setSessions] = useState<AttendanceSession[]>(() => getAttendanceSessions(courseId));
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [markingSession, setMarkingSession] = useState<AttendanceSession | null>(null);
  const [form, setForm] = useState<NewSessionForm>({ title: '', date: '', startTime: '09:00', endTime: '11:00' });

  const persist = (updated: AttendanceSession[]) => {
    setSessions(updated);
    saveAttendanceSessions(courseId, updated);
  };

  const onCreateSession = () => {
    if (!form.title.trim() || !form.date) return;
    const newSession: AttendanceSession = {
      id: `${Date.now()}`,
      title: form.title.trim(),
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      records: enrollments.map((e) => ({ studentId: e.student_id, present: false })),
    };
    persist([...sessions, newSession]);
    setForm({ title: '', date: '', startTime: '09:00', endTime: '11:00' });
    setNewSessionOpen(false);
  };

  const toggleAttendance = (session: AttendanceSession, studentId: number) => {
    const updated = sessions.map((s) =>
      s.id === session.id
        ? { ...s, records: s.records.map((r) => r.studentId === studentId ? { ...r, present: !r.present } : r) }
        : s
    );
    persist(updated);
    setMarkingSession(updated.find((s) => s.id === session.id) ?? null);
  };

  const deleteSession = (id: string) => persist(sessions.filter((s) => s.id !== id));

  const attendancePct = (session: AttendanceSession) => {
    if (session.records.length === 0) return 0;
    return Math.round((session.records.filter((r) => r.present).length / session.records.length) * 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Attendance Report</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Mark one attendance status for each student enrolled in this course.</p>
        </div>
        <Dialog open={newSessionOpen} onOpenChange={setNewSessionOpen}>
          <DialogTrigger asChild>
            <Button className="bg-teal-700 hover:bg-teal-800 text-white gap-2">
              <Plus className="w-4 h-4" /> New Session
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Attendance Session</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">Session Title</label>
                <Input placeholder="Lecture 1: Intro to …" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Date</label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">Start Time</label>
                  <Input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">End Time</label>
                  <Input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
                </div>
              </div>
              <Button className="w-full bg-teal-700 hover:bg-teal-800" onClick={onCreateSession} disabled={!form.title.trim() || !form.date}>
                Create Session
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {sessions.length === 0 ? (
        <Card><CardContent>
          <EmptyState icon={<Calendar className="w-10 h-10" />} title="No sessions yet" hint="Click '+ New Session' to record your first attendance session." />
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => {
            const pct = attendancePct(s);
            const pctColor = pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500';
            return (
              <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setMarkingSession(s)}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start text-xs text-muted-foreground mb-2">
                    <span>{s.date}</span>
                    <span>{s.startTime} – {s.endTime}</span>
                  </div>
                  <p className="font-bold text-foreground text-base mb-4 leading-tight">{s.title}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{s.records.length} rostered</span>
                    <span className={`text-sm font-semibold ${pctColor}`}>{pct}% attendance</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Attendance Marking Dialog */}
      <Dialog open={!!markingSession} onOpenChange={(o) => { if (!o) setMarkingSession(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{markingSession?.title}</DialogTitle>
            <p className="text-sm text-muted-foreground">{markingSession?.date} · {markingSession?.startTime}–{markingSession?.endTime}</p>
          </DialogHeader>
          {markingSession && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {markingSession.records.map((r) => {
                const enr = enrollments.find((e) => e.student_id === r.studentId);
                return (
                  <div key={r.studentId} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30">
                    <span className="font-medium text-sm">{enr?.student_name ?? `Student #${r.studentId}`}</span>
                    <button
                      onClick={() => toggleAttendance(markingSession, r.studentId)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${r.present ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}
                    >
                      {r.present ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t">
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { if (markingSession) { deleteSession(markingSession.id); setMarkingSession(null); } }}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete Session
            </Button>
            <Button size="sm" className="bg-teal-700 hover:bg-teal-800 text-white" onClick={() => setMarkingSession(null)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Visualization Tab ─────────────────────────────────────────────────────────

type ChartKey = 'distribution' | 'gpa_trend' | 'difficulty' | 'radar';

const CHART_ITEMS: { key: ChartKey; label: string; sub: string; icon: React.ReactNode; iconBg: string }[] = [
  { key: 'distribution', label: 'Grade Distribution', sub: 'Histogram of scores', icon: <BarChart2 className="w-4 h-4" />, iconBg: 'bg-teal-100 text-teal-700' },
  { key: 'gpa_trend',    label: 'GPA Trend',          sub: 'Student performance line', icon: <Activity className="w-4 h-4" />, iconBg: 'bg-blue-100 text-blue-700' },
  { key: 'difficulty',   label: 'Course Difficulty',  sub: 'Assignment averages comparison', icon: <Target className="w-4 h-4" />, iconBg: 'bg-purple-100 text-purple-700' },
  { key: 'radar',        label: 'Performance Radar',  sub: 'Skill distribution metrics', icon: <Shield className="w-4 h-4" />, iconBg: 'bg-amber-100 text-amber-700' },
];

const TEAL = '#0d9488';

function VisualizationTab({ courseId }: { courseId: number }) {
  const [activeChart, setActiveChart] = useState<ChartKey>('distribution');

  const { data: computedGrades = [] } = useGetComputedGrades(courseId);
  const { data: grades = [] } = useListGrades({ course_id: courseId });
  const { data: assignments = [] } = useListAssignments({ course_id: courseId });
  const { data: rankings = [] } = useGetCourseRankings(courseId);

  // --- Grade Distribution buckets (0–20%, 21–40%, …, 81–100%) ---
  const BUCKETS = [
    { label: '0-20%', min: 0, max: 20 },
    { label: '21-40%', min: 21, max: 40 },
    { label: '41-60%', min: 41, max: 60 },
    { label: '61-80%', min: 61, max: 80 },
    { label: '81-100%', min: 81, max: 101 },
  ];
  const bucketData = BUCKETS.map((b) => ({
    label: b.label,
    count: computedGrades.filter((g) => g.percentage != null && g.percentage >= b.min && g.percentage < b.max).length,
  }));

  // --- GPA Trend: class average per assignment in chronological order ---
  const trendData = assignments.map((a) => {
    const aGrades = grades.filter((g) => g.assignment_id === a.id);
    const avg = aGrades.length > 0 ? aGrades.reduce((s, g) => s + (g.percentage ?? 0), 0) / aGrades.length : 0;
    return { name: a.name.length > 10 ? a.name.slice(0, 10) + '…' : a.name, avg: Math.round(avg * 10) / 10 };
  });

  // --- Course Difficulty: average score per assignment ---
  const difficultyData = assignments.map((a) => {
    const aGrades = grades.filter((g) => g.assignment_id === a.id);
    const avg = aGrades.length > 0 ? aGrades.reduce((s, g) => s + (g.percentage ?? 0), 0) / aGrades.length : 0;
    return { name: a.name.length > 10 ? a.name.slice(0, 10) + '…' : a.name, avg: Math.round(avg * 10) / 10 };
  });

  // --- Performance Radar: average score % per assignment type ---
  const typeGroups: Record<string, number[]> = {};
  grades.forEach((g) => {
    const a = assignments.find((a) => a.id === g.assignment_id);
    if (!a || g.percentage == null) return;
    if (!typeGroups[a.type]) typeGroups[a.type] = [];
    typeGroups[a.type].push(g.percentage);
  });
  const radarData = Object.entries(typeGroups).map(([type, vals]) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    avg: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10) / 10,
  }));

  const tooltipStyle = { backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' };

  const renderChart = () => {
    if (activeChart === 'distribution') {
      const hasData = bucketData.some((b) => b.count > 0);
      return (
        <div>
          {hasData ? (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={bucketData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill={TEAL} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-center text-xs text-muted-foreground mt-1 italic">Distribution of calculated student performance scores (0% – 100%).</p>
            </>
          ) : (
            <EmptyState icon={<BarChart2 className="w-10 h-10" />} title="No grade data yet" hint="Record grades to see the distribution histogram." />
          )}
        </div>
      );
    }
    if (activeChart === 'gpa_trend') {
      const hasData = trendData.some((d) => d.avg > 0);
      return hasData ? (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} unit="%" />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, 'Class Avg']} />
            <Line type="monotone" dataKey="avg" stroke={TEAL} strokeWidth={2.5} dot={{ fill: TEAL, r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : <EmptyState icon={<Activity className="w-10 h-10" />} title="No trend data yet" hint="Record grades across multiple assignments to see the trend." />;
    }
    if (activeChart === 'difficulty') {
      const hasData = difficultyData.some((d) => d.avg > 0);
      return hasData ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={difficultyData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} unit="%" axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, 'Avg Score']} />
            <Bar dataKey="avg" fill="#7c3aed" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="avg" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : <EmptyState icon={<Target className="w-10 h-10" />} title="No difficulty data yet" hint="Record grades to compare assignment difficulty." />;
    }
    if (activeChart === 'radar') {
      const hasData = radarData.length >= 3;
      return hasData ? (
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="type" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
            <Radar dataKey="avg" stroke={TEAL} fill={TEAL} fillOpacity={0.25} strokeWidth={2} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, 'Avg Score']} />
          </RadarChart>
        </ResponsiveContainer>
      ) : <EmptyState icon={<Shield className="w-10 h-10" />} title={radarData.length < 3 ? 'Need 3+ assignment types' : 'No data yet'} hint="Add assignments of different types (midterm, final, quiz, etc.) and record grades." />;
    }
    return null;
  };

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-foreground">Visualization Analytics</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Review dynamic diagrams and charts computed instantly from the student roster and current assignments.</p>
      </div>

      <div className="grid grid-cols-[200px_1fr_220px] gap-4">
        {/* Left nav */}
        <div className="space-y-2">
          {CHART_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveChart(item.key)}
              className={`w-full text-left rounded-xl border p-3 transition-colors ${
                activeChart === item.key ? 'border-teal-500 bg-teal-50/50' : 'border-border hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.iconBg}`}>{item.icon}</span>
                <div>
                  <p className={`text-sm font-semibold leading-tight ${activeChart === item.key ? 'text-teal-800' : 'text-foreground'}`}>{item.label}</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">{item.sub}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Center chart */}
        <div className="rounded-xl border border-border bg-background p-4 min-h-[300px] flex flex-col justify-center">
          {renderChart()}
        </div>

        {/* Right rankings */}
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-sm text-foreground">Classroom Rankings</span>
            </div>
            <span className="text-xs border border-teal-500 text-teal-700 px-2 py-0.5 rounded-full font-medium">Final Grade</span>
          </div>
          {rankings.length > 0 ? (
            <div className="space-y-2">
              {rankings.map((r) => {
                const rankColors = ['bg-amber-400 text-white', 'bg-slate-400 text-white', 'bg-orange-400 text-white'];
                const rankBg = rankColors[r.rank - 1] ?? 'bg-muted text-muted-foreground';
                const scoreColor = (r.score ?? 0) >= 80 ? 'text-teal-600' : (r.score ?? 0) >= 60 ? 'text-amber-600' : 'text-red-500';
                return (
                  <div key={r.student_id} className={`flex items-center gap-2 p-2.5 rounded-lg ${r.rank === 1 ? 'border border-teal-400 bg-teal-50/40' : 'hover:bg-muted/30'}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${rankBg}`}>{r.rank}</span>
                    <span className="flex-1 text-sm font-medium text-foreground truncate">{r.student_name}</span>
                    <span className={`text-sm font-bold font-mono ${scoreColor}`}>{r.score != null ? `${r.score.toFixed(1)}%` : '—'}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={<Trophy className="w-8 h-8" />} title="No rankings yet" hint="Record grades to see rankings." />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI Prediction Tab ─────────────────────────────────────────────────────────

function PredictionTab({ courseId }: { courseId: number }) {
  const { data: predictions = [] } = usePredictAtRisk(courseId);

  // Compute attendance rate per student from localStorage
  const sessions = getAttendanceSessions(courseId);
  const getAttendanceRate = (studentId: number): number | null => {
    if (sessions.length === 0) return null;
    const total = sessions.length;
    const present = sessions.filter((s) => s.records.find((r) => r.studentId === studentId)?.present).length;
    return Math.round((present / total) * 100);
  };

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-foreground">AI Student Risk Prediction</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Utilize course assignment scores and session attendance to predict final grades and detect early at-risk indicators.</p>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-6">
        {/* Left sidebar */}
        <div className="space-y-3">
          <Card className="border-border">
            <CardContent className="p-4">
              <h3 className="font-bold text-foreground mb-2">Risk Intelligence</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Calculations and triggers are processed locally based on standard educational cohort modeling averages.
              </p>
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span className="text-xs font-bold text-red-700">At-Risk Alert Rule</span>
                </div>
                <p className="text-xs text-red-700 leading-relaxed">
                  A student is flagged at-risk if predicted final grade falls <strong>under 60%</strong> OR attendance rate is <strong>80% or below</strong>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right table */}
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          {predictions.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">Student Name</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">Attendance Rate</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">Predicted Final Grade</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">Risk Assessment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {predictions.map((p) => {
                  const attRate = getAttendanceRate(p.student_id);
                  const attColor = attRate === null ? 'text-muted-foreground' : attRate >= 80 ? 'text-emerald-600' : 'text-red-500';
                  const isAtRisk = p.predicted_score < 60 || (attRate !== null && attRate <= 80);
                  return (
                    <tr key={p.student_id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4 font-medium text-foreground">
                        <Link href={`/students/${p.student_id}`}>
                          <span className="hover:underline cursor-pointer">{p.student_name}</span>
                        </Link>
                      </td>
                      <td className={`px-5 py-4 font-semibold font-mono ${attColor}`}>
                        {attRate !== null ? `${attRate}%` : <span className="text-muted-foreground text-xs italic">No sessions</span>}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-teal-700 font-mono">
                          {p.predicted_score.toFixed(1)}% ({p.predicted_letter})
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {isAtRisk ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
                            <AlertTriangle className="w-3 h-3" /> At Risk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Good Standing
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8">
              <EmptyState icon={<Brain className="w-10 h-10" />} title="No predictions available" hint="Enroll students and record grades to generate AI predictions." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CourseDetail() {
  const params = useParams();
  const courseId = Number(params.id);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const { data: course, isLoading: courseLoading } = useGetCourse(courseId);
  const { data: stats, isLoading: statsLoading } = useGetCourseStats(courseId);

  const schemeBadgeClass: Record<string, string> = {
    weighted: 'bg-blue-50 text-blue-700 border-blue-200',
    curved: 'bg-purple-50 text-purple-700 border-purple-200',
    pass_fail: 'bg-orange-50 text-orange-700 border-orange-200',
  };
  const schemeLabel: Record<string, string> = { weighted: 'Weighted', curved: 'Curved', pass_fail: 'Pass/Fail' };

  if (courseLoading) {
    return (
      <AppShell>
        <div className="p-6 lg:p-8 space-y-6">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-10 w-full" />
          <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
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

  const scheme = course.grading_scheme ?? 'weighted';

  return (
    <AppShell>
      <div className="p-6 lg:p-8 space-y-0">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-teal-800 via-teal-700 to-teal-600 p-6 mb-0 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <Link href="/courses">
                  <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10 shrink-0">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                </Link>
                <span className="font-mono text-xs bg-white/20 text-white px-2.5 py-1 rounded-md tracking-wider">{course.code}</span>
                <Badge variant="outline" className={`text-xs border ${schemeBadgeClass[scheme] ?? ''}`}>{schemeLabel[scheme] ?? scheme}</Badge>
              </div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-white leading-tight mb-2">{course.name}</h1>
              <p className="text-teal-100 text-sm">{course.instructor} · {course.semester} · {course.credits} credit{course.credits !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex gap-3 shrink-0">
              <div className="bg-white/15 rounded-xl p-4 text-center min-w-[90px]">
                <p className="text-2xl font-mono font-bold text-white">{statsLoading ? '—' : (stats?.student_count ?? 0)}</p>
                <p className="text-xs text-teal-100 mt-0.5">Students</p>
              </div>
              <div className="bg-white/15 rounded-xl p-4 text-center min-w-[90px]">
                <p className="text-2xl font-mono font-bold text-white">{statsLoading ? '—' : stats?.average_grade != null ? `${stats.average_grade.toFixed(0)}%` : '—'}</p>
                <p className="text-xs text-teal-100 mt-0.5">Avg GPA</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="bg-background border-b border-border sticky top-0 z-10">
          <div className="flex overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key ? 'border-teal-600 text-teal-700' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="pt-6">
          {activeTab === 'overview'      && <OverviewTab courseId={courseId} stats={stats} statsLoading={statsLoading} />}
          {activeTab === 'enrollment'    && <EnrollmentTab courseId={courseId} course={course} />}
          {activeTab === 'grades'        && <GradeManagementTab courseId={courseId} />}
          {activeTab === 'attendance'    && <AttendanceTab courseId={courseId} />}
          {activeTab === 'visualization' && <VisualizationTab courseId={courseId} />}
          {activeTab === 'prediction'    && <PredictionTab courseId={courseId} />}
        </div>
      </div>
    </AppShell>
  );
}
