import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, TrendingUp, CalendarCheck, Clock3, Info,
  UserPlus, FileSpreadsheet, X, User, Users,
  Trash2, Plus, Upload, Download, PanelRight,
  ChevronLeft, ChevronDown, ChevronRight,
  BarChart2, Shield, HelpCircle, Trophy,
  AlertTriangle, CheckCircle2, Calendar, Edit,
  Binary, BarChart3, Blocks, BrainCircuit, BookOpen,
} from 'lucide-react';
import { useAcadence } from '@/context/AcadenceContext';
import {
  gradeLetter, getInitials, computeWeightedScore, computeAttendanceRate,
  computeGpa, computeAverageGpa, parseSimpleCSV, getCourseStyle,
  type GradeMode, type ChartType, type CourseTab, type AttendanceStatus,
  type Assignment, type Session, type Student,
} from '@/lib/acadence-utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCourseHeaderBadge(courseId: string): { bg: string; color: string } {
  const prefix = courseId.substring(0, 2).toLowerCase();
  if (prefix === 'cs') return { bg: 'rgb(204,251,241)', color: 'rgb(15,118,110)' };
  if (prefix === 'ds') return { bg: 'rgb(219,234,254)', color: 'rgb(29,78,216)' };
  if (prefix === 'se') return { bg: 'rgb(237,233,254)', color: 'rgb(109,40,217)' };
  if (prefix === 'ai') return { bg: 'rgb(254,243,199)', color: 'rgb(146,64,14)' };
  return { bg: 'rgb(204,251,241)', color: 'rgb(15,118,110)' };
}

// ─── Canvas chart drawing ────────────────────────────────────────────────────

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, maxVal: number, steps: number) {
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#64748b';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= steps; i++) {
    const val = (maxVal / steps) * i;
    const y = h - 40 - ((h - 70) / steps) * i;
    ctx.beginPath();
    ctx.moveTo(50, y);
    ctx.lineTo(w - 20, y);
    ctx.stroke();
    ctx.fillText(Math.round(val).toString(), 42, y + 3);
  }
}

function drawChart(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  chartType: ChartType,
  students: Student[],
  assignments: Assignment[],
  selectedStudentId: string | null,
) {
  ctx.clearRect(0, 0, w, h);
  if (students.length === 0) return;

  if (chartType === 'histogram') {
    const scores = students.map((s) => computeWeightedScore(s, assignments));
    const bins = [0, 0, 0, 0, 0];
    scores.forEach((s) => {
      if (s <= 20) bins[0]++;
      else if (s <= 40) bins[1]++;
      else if (s <= 60) bins[2]++;
      else if (s <= 80) bins[3]++;
      else bins[4]++;
    });
    const maxBin = Math.max(...bins, 1);
    drawGrid(ctx, w, h, maxBin, maxBin);
    const binLabels = ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'];
    const barWidth = (w - 80) / 5;
    bins.forEach((count, idx) => {
      const barHeight = ((h - 70) / maxBin) * count;
      const x = 60 + idx * barWidth;
      const y = h - 40 - barHeight;
      ctx.fillStyle = '#0f766e';
      ctx.beginPath();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).roundRect(x + 10, y, barWidth - 20, Math.max(barHeight, 0.1), [4, 4, 0, 0]);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(count.toString(), x + barWidth / 2, y - 6);
      ctx.fillStyle = '#475569';
      ctx.font = '10px sans-serif';
      ctx.fillText(binLabels[idx], x + barWidth / 2, h - 20);
    });

  } else if (chartType === 'trend') {
    const scoresData = students.map((s) => ({
      name: s.name.split(' ').pop()!,
      score: computeWeightedScore(s, assignments),
    }));
    drawGrid(ctx, w, h, 100, 5);
    const spacing = (w - 100) / Math.max(scoresData.length - 1, 1);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    scoresData.forEach((d, idx) => {
      const x = 70 + idx * spacing;
      const y = h - 40 - ((h - 70) / 100) * d.score;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    scoresData.forEach((d, idx) => {
      const x = 70 + idx * spacing;
      const y = h - 40 - ((h - 70) / 100) * d.score;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(d.score)}%`, x, y - 10);
      ctx.fillStyle = '#475569';
      ctx.fillText(d.name, x, h - 20);
    });

  } else if (chartType === 'difficulty') {
    const diffData = assignments.map((assign) => {
      const scores = students.map((s) => ((s.scores[assign.id] ?? 0) / (assign.maxPoints || 100)) * 100);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return { name: assign.name, avg };
    });
    drawGrid(ctx, w, h, 100, 5);
    const barWidth = (w - 80) / Math.max(diffData.length, 1);
    diffData.forEach((d, idx) => {
      const barHeight = ((h - 70) / 100) * d.avg;
      const x = 60 + idx * barWidth;
      const y = h - 40 - barHeight;
      ctx.fillStyle = '#7c3aed';
      ctx.beginPath();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).roundRect(x + 10, y, barWidth - 20, Math.max(barHeight, 0.1), [4, 4, 0, 0]);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(d.avg)}%`, x + barWidth / 2, y - 6);
      ctx.fillStyle = '#475569';
      ctx.font = '10px sans-serif';
      ctx.fillText(d.name, x + barWidth / 2, h - 20);
    });

  } else if (chartType === 'radar') {
    if (assignments.length < 3) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Add at least 3 assignments for radar chart', w / 2, h / 2);
      return;
    }
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 55;
    const numAxes = assignments.length;
    const angleStep = (2 * Math.PI) / numAxes;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 0; i < numAxes; i++) {
      const angle = -Math.PI / 2 + i * angleStep;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
      ctx.stroke();
    }
    [0.25, 0.5, 0.75, 1].forEach((scale) => {
      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath();
      for (let i = 0; i < numAxes; i++) {
        const angle = -Math.PI / 2 + i * angleStep;
        const x = cx + radius * scale * Math.cos(angle);
        const y = cy + radius * scale * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    });
    const avgs = assignments.map((assign) => {
      const scores = students.map((s) => ((s.scores[assign.id] ?? 0) / (assign.maxPoints || 100)));
      return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    });
    ctx.fillStyle = 'rgba(15,118,110,0.2)';
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    avgs.forEach((val, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const x = cx + radius * val * Math.cos(angle);
      const y = cy + radius * val * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    assignments.forEach((assign, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const lr = radius + 22;
      ctx.fillText(assign.name, cx + lr * Math.cos(angle), cy + lr * Math.sin(angle));
    });

  } else if (chartType === 'student-detail') {
    const student = selectedStudentId
      ? students.find((s) => s.id === selectedStudentId) || students[0]
      : students[0];
    if (!student || assignments.length === 0) return;
    const barH = 28;
    const gap = 14;
    const totalH = assignments.length * (barH + gap);
    const startY = Math.max((h - totalH) / 2, 30);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(student.name, w / 2, startY - 18);
    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.fillText('Individual assignment performance', w / 2, startY - 4);
    const maxBarWidth = w - 150;
    assignments.forEach((assign, idx) => {
      const score = student.scores[assign.id] ?? 0;
      const maxPts = assign.maxPoints || 100;
      const pct = Math.min(score / maxPts, 1);
      const y = startY + idx * (barH + gap);
      ctx.fillStyle = '#475569';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(assign.name, 98, y + barH / 2 + 4);
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).roundRect(104, y, maxBarWidth, barH, 6);
      ctx.fill();
      if (pct > 0) {
        ctx.fillStyle = pct >= 0.6 ? '#0f766e' : '#ef4444';
        ctx.beginPath();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ctx as any).roundRect(104, y, maxBarWidth * pct, barH, 6);
        ctx.fill();
      }
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${score}/${maxPts} (${Math.round(pct * 100)}%)`, 104 + maxBarWidth * pct + 8, y + barH / 2 + 4);
    });
  }
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ courseId }: { courseId: string }) {
  const { courseData, attendanceState } = useAcadence();
  const course = courseData[courseId];
  if (!course) return null;

  const passRate = course.students.length
    ? Math.round(course.students.filter((s) => computeWeightedScore(s, course.assignments) >= 60).length / course.students.length * 100) + '%'
    : '100%';
  const attendanceRate = course.attendanceRate || '—';
  const avgGpa = computeAverageGpa(course);

  return (
    <div className="space-y-4 view-in">
      <div className="grid md:grid-cols-3 gap-4">
        <article className="canva-card rounded-2xl border border-slate-200 bg-white p-5">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-5">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h2 className="heading-font text-slate-900 font-bold text-lg">Course performance</h2>
          <p className="mt-3 text-3xl font-bold text-teal-700">{passRate}</p>
          <p className="text-slate-500 mt-1 text-xs">Current student pass rate</p>
        </article>
        <article className="canva-card rounded-2xl border border-slate-200 bg-white p-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-5">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <h2 className="heading-font text-slate-900 font-bold text-lg">Attendance health</h2>
          <p className="mt-3 text-3xl font-bold text-blue-700">{attendanceRate}</p>
          <p className="text-slate-500 mt-1 text-xs">Average across recorded sessions</p>
        </article>
        <article className="canva-card rounded-2xl border border-slate-200 bg-white p-5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-5">
            <Clock3 className="w-5 h-5" />
          </div>
          <h2 className="heading-font text-slate-900 font-bold text-lg">Next milestone</h2>
          <p className="mt-3 text-lg font-bold">{course.nextItem || '—'}</p>
          <p className="text-slate-500 mt-1 text-xs">Due during the next teaching week</p>
        </article>
      </div>
      <article className="canva-card rounded-2xl border border-slate-200 bg-white p-5 flex gap-4">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          <Info className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900 text-lg">Course-specific workspace</h2>
          <p className="text-slate-500 mt-1 text-sm leading-relaxed">Grades and attendance entered here apply only to the selected course. Administration and Profile remain separate.</p>
        </div>
      </article>
    </div>
  );
}

// ─── Enrollment Tab ───────────────────────────────────────────────────────────

function EnrollmentTab({ courseId }: { courseId: string }) {
  const { courseData, attendanceState, addStudent, importStudents } = useAcadence();
  const course = courseData[courseId];
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [studentForm, setStudentForm] = useState({ name: '', id: '', email: '' });
  const [csvFeedback, setCsvFeedback] = useState<{ success: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!course) return null;
  const sessions = attendanceState[courseId]?.sessions || [];
  const selectedStudent = course.students.find((s) => s.id === selectedStudentId);

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    addStudent(courseId, { id: studentForm.id, name: studentForm.name, email: studentForm.email, status: 'Enrolled' });
    setStudentForm({ name: '', id: '', email: '' });
    setAddOpen(false);
  };

  const handleCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseSimpleCSV(text);
      if (!parsed.rows.length) { setCsvFeedback({ success: false, msg: 'Invalid or empty CSV.' }); return; }
      const nameH = parsed.headers.find((h) => ['name', 'student name', 'student'].includes(h.toLowerCase().trim()));
      const idH = parsed.headers.find((h) => ['id', 'student id', 'code'].includes(h.toLowerCase().trim()));
      const emailH = parsed.headers.find((h) => ['email', 'email address', 'mail'].includes(h.toLowerCase().trim()));
      if (!nameH) { setCsvFeedback({ success: false, msg: "Could not find a student name column." }); return; }
      const toImport = parsed.rows.map((row, i) => ({
        id: (row[idH || '']?.trim().toUpperCase() || `STU${Date.now() + i}`),
        name: row[nameH]?.trim() || '',
        email: row[emailH || '']?.trim() || '',
        status: 'Enrolled' as const,
      })).filter((s) => s.name);
      const result = importStudents(courseId, toImport);
      setCsvFeedback({ success: true, msg: `✓ ${result.imported} enrolled. ⚠ ${result.skipped} skipped.` });
    };
    reader.readAsText(file);
  };

  // Compute student stats
  let presentCount = 0, absentCount = 0, rate = 100;
  if (selectedStudent) {
    sessions.forEach((s) => {
      if (s.records?.[selectedStudent.id]) {
        const st = s.records[selectedStudent.id];
        if (st === 'present' || st === 'late') presentCount++;
        else if (st === 'absent') absentCount++;
      }
    });
    rate = computeAttendanceRate(selectedStudent.id, sessions);
  }

  return (
    <div className="space-y-4 view-in">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="heading-font text-slate-900 font-bold" style={{ fontSize: 26 }}>Enrollment Management</h2>
          <p className="text-slate-500 mt-1 text-sm">View, track, and confirm student enrollment status and official records.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
          <button onClick={() => setAddOpen(true)} className="inline-flex items-center justify-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors shadow-sm">
            <UserPlus className="w-4 h-4" /> + Add student
          </button>
          <button onClick={() => { setCsvFeedback(null); setCsvOpen(true); }} className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors">
            <FileSpreadsheet className="w-4 h-4" /> Import CSV file
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Student table */}
        <div className="lg:col-span-2 overflow-auto rounded-2xl border border-slate-200 bg-white max-h-[380px]">
          <table className="w-full text-sm table-auto">
            <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
              <tr>
                <th className="text-left p-4 text-xs font-bold text-slate-600">Student Name</th>
                <th className="text-left p-4 text-xs font-bold text-slate-600">Student ID</th>
                <th className="text-left p-4 text-xs font-bold text-slate-600 hidden md:table-cell">Email Address</th>
                <th className="text-right p-4 text-xs font-bold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {course.students.map((student) => (
                <tr
                  key={student.id}
                  className={`border-t border-slate-200 cursor-pointer transition-colors ${selectedStudentId === student.id ? 'bg-teal-50/60' : 'hover:bg-teal-50/40'}`}
                  onClick={() => setSelectedStudentId(student.id === selectedStudentId ? null : student.id)}
                >
                  <td className="p-4 font-semibold text-slate-900">{student.name}</td>
                  <td className="p-4 text-slate-500 font-mono text-xs">{student.id}</td>
                  <td className="p-4 text-slate-600 hidden md:table-cell">{student.email}</td>
                  <td className="p-4 text-right">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${student.status === 'Enrolled' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {student.status}
                    </span>
                  </td>
                </tr>
              ))}
              {course.students.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-slate-400 text-sm">No students added yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Student Detail Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-lg">Student Profile</h3>
            {selectedStudent && (
              <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${selectedStudent.status === 'Enrolled' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                {selectedStudent.status}
              </span>
            )}
          </div>
          {!selectedStudent ? (
            <div className="text-center py-8 text-slate-400 text-xs flex flex-col items-center gap-2">
              <User className="w-8 h-8 text-slate-300" />
              <p>Click a student from the list to view their detailed attendance statistics and class history.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm">
                  {getInitials(selectedStudent.name)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{selectedStudent.name}</h4>
                  <p className="text-xs text-slate-500 font-mono">{selectedStudent.id}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-100">
                  <p className="font-bold text-emerald-700 text-sm">{presentCount}</p>
                  <p className="text-[10px] text-emerald-600 font-semibold">Attended</p>
                </div>
                <div className="bg-rose-50 rounded-xl p-2 border border-rose-100">
                  <p className="font-bold text-rose-700 text-sm">{absentCount}</p>
                  <p className="text-[10px] text-rose-600 font-semibold">Missed</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-2 border border-amber-100">
                  <p className="font-bold text-amber-700 text-sm">{rate}%</p>
                  <p className="text-[10px] text-amber-600 font-semibold">Rate</p>
                </div>
              </div>
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Session History</h5>
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {sessions.length === 0 ? (
                    <p className="text-slate-400 text-center text-xs py-4">No sessions recorded yet.</p>
                  ) : sessions.map((s) => {
                    const status = s.records?.[selectedStudent.id];
                    return (
                      <div key={s.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">{s.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{s.date}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ml-2 shrink-0 ${
                          status === 'present' ? 'bg-green-100 text-green-800' :
                          status === 'absent' ? 'bg-red-100 text-red-800' :
                          status === 'late' ? 'bg-amber-100 text-amber-800' :
                          status === 'excused' ? 'bg-blue-100 text-blue-800' :
                          'bg-slate-100 text-slate-400'
                        }`}>
                          {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unmarked'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Student Modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2"><UserPlus className="w-5 h-5 text-teal-700" /> Add New Student</h3>
              <button type="button" onClick={() => setAddOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Student Name</label>
                <input type="text" required value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-teal-600 bg-slate-50 focus:bg-white" placeholder="e.g., Nguyen Thi C" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Student ID</label>
                <input type="text" required value={studentForm.id} onChange={(e) => setStudentForm({ ...studentForm, id: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-teal-600 bg-slate-50 focus:bg-white" placeholder="e.g., STU015" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email Address</label>
                <input type="email" required value={studentForm.email} onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-teal-600 bg-slate-50 focus:bg-white" placeholder="e.g., nt_c@university.edu" />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-teal-700 text-white font-semibold text-sm hover:bg-teal-800 shadow-sm">Add Student</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {csvOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2"><Upload className="w-5 h-5 text-teal-700" /> Import Student Enrollment CSV</h3>
              <button type="button" onClick={() => setCsvOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
              <p className="font-semibold text-slate-700">Instructions:</p>
              <p>CSV must contain headers: Name, ID, Email. Records will be enrolled into the active course.</p>
            </div>
            <div
              className="border-2 border-dashed border-slate-200 hover:border-teal-500 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-50 hover:bg-teal-50/20"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCsvFile(f); }}
            >
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }} />
              <Users className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="font-semibold text-slate-800 text-sm">Drag and drop your student CSV file here</p>
              <p className="text-xs text-slate-500 mt-1">or click to browse from files</p>
            </div>
            {csvFeedback && (
              <div className={`text-xs rounded-xl p-3 border ${csvFeedback.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {csvFeedback.msg}
              </div>
            )}
            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button type="button" onClick={() => setCsvOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Grade Management Tab ─────────────────────────────────────────────────────

function GradesTab({ courseId }: { courseId: string }) {
  const { courseData, updateScore, addAssignment, deleteAssignment, updateAssignment, importGrades } = useAcadence();
  const course = courseData[courseId];
  const [gradeMode, setGradeMode] = useState<GradeMode>('weighted');
  const [panelOpen, setPanelOpen] = useState(true);
  const [gradeMsg, setGradeMsg] = useState('');
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvFeedback, setCsvFeedback] = useState<{ success: boolean; msg: string } | null>(null);
  const [newAssign, setNewAssign] = useState({ name: '', weight: '', max: '' });
  const csvRef = useRef<HTMLInputElement>(null);

  if (!course) return null;

  const totalWeight = course.assignments.reduce((s, a) => s + a.weight, 0);

  const computeDisplayScore = (student: Student) => {
    const weighted = computeWeightedScore(student, course.assignments);
    if (gradeMode === 'weighted') return { pct: weighted, letter: gradeLetter(weighted) };
    if (gradeMode === 'curved') {
      const max = Math.max(...course.students.map((s) => computeWeightedScore(s, course.assignments)), 1);
      const curved = max > 0 ? (weighted / max) * 100 : weighted;
      return { pct: curved, letter: gradeLetter(curved) };
    }
    return { pct: weighted, letter: weighted >= 60 ? 'Pass' : 'Fail' };
  };

  const handleExportJson = () => {
    const data = { course: course.name, students: course.students.map((s) => ({ name: s.name, id: s.id, scores: s.scores })), exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `grades_${courseId}.json`; a.click();
    URL.revokeObjectURL(url);
    setGradeMsg('✓ Exported to JSON successfully!');
  };

  const handleCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseSimpleCSV(text);
      if (!parsed.rows.length) { setCsvFeedback({ success: false, msg: 'Invalid or empty CSV.' }); return; }
      const nameH = parsed.headers.find((h) => ['name', 'student name', 'student'].includes(h.toLowerCase().trim()));
      if (!nameH) { setCsvFeedback({ success: false, msg: "Could not find a student name column." }); return; }
      const grades: Array<{ studentName: string; assignmentName: string; score: number }> = [];
      parsed.rows.forEach((row) => {
        const studentName = row[nameH]?.trim();
        if (!studentName) return;
        parsed.headers.filter((h) => h !== nameH).forEach((h) => {
          const score = Number(row[h]);
          if (!isNaN(score)) grades.push({ studentName, assignmentName: h, score });
        });
      });
      const result = importGrades(courseId, grades);
      setCsvFeedback({ success: true, msg: `✓ ${result.imported} grades imported. ⚠ ${result.skipped} skipped.` });
    };
    reader.readAsText(file);
  };

  const modeBtn = (id: GradeMode, label: string, desc: string) => (
    <button
      type="button"
      className={`canva-card text-left p-4 rounded-xl transition-all focus:outline-none relative group ${gradeMode === id ? 'border-2 border-teal-600 bg-teal-50/50' : 'border border-slate-200 bg-white hover:bg-slate-50'}`}
      onClick={() => setGradeMode(id)}
      aria-pressed={gradeMode === id}
    >
      <div className="flex justify-between items-start">
        <span className={`font-bold text-sm ${gradeMode === id ? 'text-teal-900' : 'text-slate-800'}`}>{label}</span>
        {gradeMode === id ? <CheckCircle2 className="w-4 h-4 text-teal-600" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300" />}
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-900 text-white text-xs rounded-lg p-2.5 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-20 shadow-xl border border-slate-700">
        {desc}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
      </div>
    </button>
  );

  return (
    <div className="space-y-4 view-in">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-2">
        <div>
          <h2 className="heading-font text-slate-900 font-bold" style={{ fontSize: 26 }}>Grade Management</h2>
          <p className="text-slate-500 mt-1 text-sm">Edit scores and calculate weighted results for this course only.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {course.assignments.map((a) => (
            <span key={a.id} className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {a.name} (W: {a.weight}%, Max: {a.maxPoints}p)
            </span>
          ))}
        </div>
      </div>

      {/* Grade Mode Selector */}
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        {modeBtn('weighted', 'Weighted Grade', 'Standard gradebook calculation based on assignment weights.')}
        {modeBtn('curved', 'Curved Grade', 'Scales student scores relative to the top performer in this class.')}
        {modeBtn('passfail', 'Pass / Fail', 'Simplifies score display to Pass (≥ 60%) or Fail statuses.')}
      </div>

      {/* Grade table + Assignment panel */}
      <div className={`grid gap-6 items-start ${panelOpen ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
        {/* Grade Table */}
        <div className={panelOpen ? 'lg:col-span-2' : ''} style={{ minWidth: 0 }}>
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white max-h-[380px]">
            {course.students.length === 0 || course.assignments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                {course.assignments.length === 0 ? 'Add assignments first.' : 'No students enrolled.'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                  <tr>
                    <th className="text-left p-4 font-semibold">Student</th>
                    {course.assignments.map((a) => (
                      <th key={a.id} className="text-left p-4 min-w-[130px]">
                        <div className="font-semibold">{a.name}</div>
                        <div className="text-[11px] text-slate-400 font-normal">W: {a.weight}% | Max: {a.maxPoints}</div>
                      </th>
                    ))}
                    <th className="text-left p-4 font-semibold">Weighted</th>
                    <th className="text-left p-4 font-semibold">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {course.students.map((student) => {
                    const { pct, letter } = computeDisplayScore(student);
                    const isFail = letter === 'F' || letter === 'Fail';
                    return (
                      <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 min-w-[180px]">
                          <p className="font-semibold text-slate-900">{student.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{student.id}</p>
                        </td>
                        {course.assignments.map((a) => (
                          <td key={a.id} className="p-4">
                            <input
                              type="number" min={0} max={a.maxPoints} step="0.5"
                              value={student.scores[a.id] ?? ''}
                              onChange={(e) => updateScore(courseId, student.id, a.id, Number(e.target.value) || 0)}
                              className="score-input"
                              aria-label={`${student.name} ${a.name} score`}
                            />
                          </td>
                        ))}
                        <td className="p-4 font-semibold text-slate-700">{pct.toFixed(1)}%</td>
                        <td className={`p-4 font-bold ${isFail ? 'text-red-600' : 'text-teal-700'}`}>{letter}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
            <p className="text-sm text-slate-500">{gradeMsg || `Weighted grades calculated — scaled to ${totalWeight}% total distribution.`}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCsvFeedback(null); handleCsvFile(f); setCsvOpen(true); } }} />
              <button onClick={() => { setCsvFeedback(null); setCsvOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50">
                <Upload className="w-4 h-4" /> Import CSV
              </button>
              <button onClick={handleExportJson} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50">
                <Download className="w-4 h-4" /> Export JSON
              </button>
              {!panelOpen && (
                <button onClick={() => setPanelOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50">
                  <PanelRight className="w-4 h-4" /> Show Distribution
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Assignment Panel */}
        {panelOpen && (
          <div className="canva-card rounded-2xl border border-slate-200 bg-white p-5 space-y-4 transition-all duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-lg">Assignment Distribution</h3>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${totalWeight === 100 ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-600'}`}>
                  Total: {totalWeight}%
                </span>
                <button onClick={() => setPanelOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors" aria-label="Collapse panel">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">Create, edit, or delete assignments. Weights are scaled proportionally.</p>
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {course.assignments.map((assign) => (
                <div key={assign.id} className="flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text" defaultValue={assign.name}
                      className="font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-600 focus:bg-white px-1 py-0.5 rounded focus:outline-none truncate flex-1"
                      onBlur={(e) => updateAssignment(courseId, { ...assign, name: e.target.value.trim() || assign.name })}
                    />
                    <button onClick={() => deleteAssignment(courseId, assign.id)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
                    <label className="flex items-center gap-1">W%:
                      <input type="number" min={0} max={100} defaultValue={assign.weight}
                        className="w-10 font-bold text-teal-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-600 focus:bg-white px-0.5 rounded text-center focus:outline-none"
                        onBlur={(e) => updateAssignment(courseId, { ...assign, weight: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                      />
                    </label>
                    <label className="flex items-center gap-1">Max:
                      <input type="number" min={1} max={1000} defaultValue={assign.maxPoints}
                        className="w-12 font-bold text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-600 focus:bg-white px-0.5 rounded text-center focus:outline-none"
                        onBlur={(e) => updateAssignment(courseId, { ...assign, maxPoints: Math.max(1, Math.min(1000, parseInt(e.target.value) || 100)) })}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <form
              className="pt-3 border-t border-slate-100 space-y-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newAssign.name.trim()) return;
                addAssignment(courseId, { name: newAssign.name.trim(), weight: parseInt(newAssign.weight) || 0, maxPoints: parseInt(newAssign.max) || 100 });
                setNewAssign({ name: '', weight: '', max: '' });
              }}
            >
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-2">
                  <input type="text" required value={newAssign.name} onChange={(e) => setNewAssign({ ...newAssign, name: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-teal-600" placeholder="Name" />
                </div>
                <input type="number" required value={newAssign.weight} onChange={(e) => setNewAssign({ ...newAssign, weight: e.target.value })}
                  className="text-xs border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-teal-600" placeholder="W%" />
                <input type="number" required value={newAssign.max} onChange={(e) => setNewAssign({ ...newAssign, max: e.target.value })}
                  className="text-xs border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-teal-600" placeholder="Max" />
              </div>
              <button type="submit" className="w-full inline-flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white transition-colors">
                + Add Assignment
              </button>
            </form>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      {csvOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2"><Upload className="w-5 h-5 text-teal-700" /> Import CSV Grades</h3>
              <button type="button" onClick={() => setCsvOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
              <p className="font-semibold text-slate-700">Instructions:</p>
              <p>CSV must have a header row. One column must be student name, other columns must match assignment names exactly.</p>
            </div>
            <div
              className="border-2 border-dashed border-slate-200 hover:border-teal-500 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-50 hover:bg-teal-50/20"
              onClick={() => csvRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCsvFile(f); }}
            >
              <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }} />
              <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="font-semibold text-slate-800 text-sm">Drag and drop your CSV file here</p>
              <p className="text-xs text-slate-500 mt-1">or click to browse from files</p>
            </div>
            {csvFeedback && (
              <div className={`text-xs rounded-xl p-3 border ${csvFeedback.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {csvFeedback.msg}
              </div>
            )}
            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button type="button" onClick={() => setCsvOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab({ courseId }: { courseId: string }) {
  const { courseData, attendanceState, addSession, updateSession, setAttendance, updateAttendanceRate } = useAcadence();
  const course = courseData[courseId];
  const attendance = attendanceState[courseId] || { sessions: [] };
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionModalMode, setSessionModalMode] = useState<'new' | 'edit'>('new');
  const [sessionForm, setSessionForm] = useState({ name: '', date: '', time: '' });

  if (!course) return null;
  const sessions = attendance.sessions;
  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  // Counts for selected session
  const counts = selectedSession ? {
    present: Object.values(selectedSession.records || {}).filter((v) => v === 'present').length,
    absent: Object.values(selectedSession.records || {}).filter((v) => v === 'absent').length,
    late: Object.values(selectedSession.records || {}).filter((v) => v === 'late').length,
    excused: Object.values(selectedSession.records || {}).filter((v) => v === 'excused').length,
  } : { present: 0, absent: 0, late: 0, excused: 0 };

  const openNewSession = () => {
    setSessionForm({ name: '', date: new Date().toISOString().split('T')[0], time: '' });
    setSessionModalMode('new');
    setSessionModalOpen(true);
  };

  const openEditSession = () => {
    if (!selectedSession) return;
    setSessionForm({ name: selectedSession.name, date: selectedSession.date, time: selectedSession.time });
    setSessionModalMode('edit');
    setSessionModalOpen(true);
  };

  const handleSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionModalMode === 'new') {
      addSession(courseId, { name: sessionForm.name, date: sessionForm.date, time: sessionForm.time });
    } else if (selectedSession) {
      updateSession(courseId, selectedSession.id, sessionForm);
    }
    setSessionModalOpen(false);
  };

  const handleSetAttendance = (studentId: string, status: AttendanceStatus) => {
    if (!selectedSessionId) return;
    setAttendance(courseId, selectedSessionId, studentId, status);
    updateAttendanceRate(courseId);
  };

  return (
    <div className="space-y-6 view-in">
      {!selectedSessionId ? (
        /* Sessions List View */
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="heading-font text-slate-900 font-bold" style={{ fontSize: 26 }}>Attendance Report</h2>
              <p className="text-slate-500 mt-1 text-sm">Mark one attendance status for each student enrolled in this course.</p>
            </div>
            <button onClick={openNewSession} className="inline-flex items-center gap-2 bg-teal-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-teal-800 transition-colors shadow-sm self-start sm:self-auto">
              <Plus className="w-4 h-4" /> New Session
            </button>
          </div>
          {sessions.length === 0 ? (
            <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-semibold">No sessions created yet</p>
              <p className="text-slate-400 text-xs mt-1">Click "New Session" to launch your first session tracker.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((session) => {
                const total = Object.keys(session.records || {}).length;
                const present = Object.values(session.records || {}).filter((v) => v === 'present' || v === 'late' || v === 'excused').length;
                const rate = total > 0 ? Math.round((present / total) * 100) : null;
                return (
                  <button key={session.id} type="button"
                    className="canva-card text-left p-5 rounded-2xl border border-slate-200 bg-white hover:border-teal-500 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-44"
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    <div className="w-full">
                      <div className="flex items-center justify-between mb-2 text-slate-400 font-mono text-[10px]">
                        <span>{session.date}</span>
                        <span>{session.time}</span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm line-clamp-2 mt-1">{session.name}</h4>
                    </div>
                    <div className="flex items-center justify-between mt-4 border-t border-slate-100 pt-3 w-full">
                      <span className="text-xs text-slate-500 font-medium">{total} rostered</span>
                      {rate !== null ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rate >= 85 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {rate}% attendance
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">Unmarked</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Session Marking View */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSelectedSessionId(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-teal-700 transition-all">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-slate-900">{selectedSession?.name}</h3>
                  <button type="button" onClick={openEditSession} className="p-1 hover:bg-slate-100 rounded-lg text-teal-700 hover:text-teal-800 transition-colors" title="Rename Session">
                    <Edit className="w-4 h-4" />
                  </button>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-800 rounded-full">Active</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{selectedSession?.date} · {selectedSession?.time}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center max-w-sm self-end">
              <div className="rounded-xl bg-green-50 px-3 py-1.5 border border-green-100 min-w-[60px]">
                <p className="font-bold text-green-700 text-sm">{counts.present}</p>
                <p className="text-[10px] text-green-600 font-semibold">Present</p>
              </div>
              <div className="rounded-xl bg-red-50 px-3 py-1.5 border border-red-100 min-w-[60px]">
                <p className="font-bold text-red-700 text-sm">{counts.absent}</p>
                <p className="text-[10px] text-red-600 font-semibold">Absent</p>
              </div>
              <div className="rounded-xl bg-amber-50 px-3 py-1.5 border border-amber-100 min-w-[60px]">
                <p className="font-bold text-amber-700 text-sm">{counts.late}</p>
                <p className="text-[10px] text-amber-600 font-semibold">Late</p>
              </div>
              <div className="rounded-xl bg-blue-50 px-3 py-1.5 border border-blue-100 min-w-[60px]">
                <p className="font-bold text-blue-700 text-sm">{counts.excused}</p>
                <p className="text-[10px] text-blue-600 font-semibold">Excused</p>
              </div>
            </div>
          </div>
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white max-h-[380px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                <tr>
                  <th className="text-left p-4 text-xs font-bold">Student name & ID</th>
                  <th className="text-right p-4 text-xs font-bold">Attendance status</th>
                </tr>
              </thead>
              <tbody>
                {course.students.map((student) => {
                  const status = selectedSession?.records?.[student.id];
                  const atBtn = (label: string, s: AttendanceStatus) => (
                    <button
                      key={s} type="button"
                      className={`attendance-button ${status === s ? `selected-${s}` : ''}`}
                      onClick={() => handleSetAttendance(student.id, s)}
                      aria-pressed={status === s}
                    >
                      {label}
                    </button>
                  );
                  return (
                    <tr key={student.id} className="border-t border-slate-200 hover:bg-slate-50 transition-colors">
                      <td className="p-4 min-w-[210px]">
                        <p className="font-semibold text-slate-900">{student.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{student.id}</p>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2 flex-wrap">
                          {atBtn('Present', 'present')}
                          {atBtn('Absent', 'absent')}
                          {atBtn('Late', 'late')}
                          {atBtn('Excused', 'excused')}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {course.students.length === 0 && (
                  <tr><td colSpan={2} className="p-8 text-center text-slate-400 text-sm">No students enrolled in this course.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Session Modal */}
      {sessionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-700" />
                {sessionModalMode === 'new' ? 'New Session' : 'Edit Session'}
              </h3>
              <button type="button" onClick={() => setSessionModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSessionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Session Title</label>
                <input type="text" required value={sessionForm.name} onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-teal-600 bg-slate-50 focus:bg-white" placeholder="e.g., Lecture 3: Sorting Review" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Date</label>
                  <input type="date" required value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-teal-600 bg-slate-50 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Time Range</label>
                  <input type="text" required value={sessionForm.time} onChange={(e) => setSessionForm({ ...sessionForm, time: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-teal-600 bg-slate-50 focus:bg-white" placeholder="10:00 - 12:00" />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setSessionModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-teal-700 text-white font-semibold text-sm hover:bg-teal-800 shadow-sm">Save Session</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Visualization Tab ────────────────────────────────────────────────────────

function VisualizationTab({ courseId }: { courseId: string }) {
  const { courseData, attendanceState } = useAcadence();
  const course = courseData[courseId];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeChartType, setActiveChartType] = useState<ChartType>('histogram');
  const [selectedRankingStudentId, setSelectedRankingStudentId] = useState<string | null>(null);
  const [rankingCriteria, setRankingCriteria] = useState<string>('overall');
  const [rankDropdownOpen, setRankDropdownOpen] = useState(false);
  const sessions = attendanceState[courseId]?.sessions || [];

  if (!course) return null;

  // Draw chart on changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawChart(ctx, canvas.width, canvas.height, activeChartType, course.students, course.assignments, selectedRankingStudentId);
  }, [course, activeChartType, selectedRankingStudentId]);

  const chartCaption: Record<ChartType, string> = {
    histogram: 'Distribution of calculated student performance scores (0% - 100%).',
    trend: 'Comparison of individual calculated student final grade trends.',
    difficulty: 'Comparing computed class average score percentage for each assignment.',
    radar: 'Skill distribution metrics across all assignments.',
    'student-detail': 'Individual assignment performance breakdown.',
  };

  // Build ranking data
  const getRankValue = (student: Student): number => {
    if (rankingCriteria === 'overall') return computeWeightedScore(student, course.assignments);
    if (rankingCriteria === 'attendance') return computeAttendanceRate(student.id, sessions);
    const assign = course.assignments.find((a) => a.id === rankingCriteria);
    const score = student.scores[rankingCriteria] ?? 0;
    return assign ? (score / (assign.maxPoints || 100)) * 100 : 0;
  };
  const getDisplayValue = (student: Student): string => {
    if (rankingCriteria === 'attendance') return `${computeAttendanceRate(student.id, sessions)}%`;
    if (rankingCriteria === 'overall') return `${computeWeightedScore(student, course.assignments).toFixed(1)}%`;
    const assign = course.assignments.find((a) => a.id === rankingCriteria);
    const score = student.scores[rankingCriteria] ?? 0;
    const maxPts = assign?.maxPoints || 100;
    return `${score}/${maxPts} (${Math.round((score / maxPts) * 100)}%)`;
  };

  const ranked = [...course.students].sort((a, b) => getRankValue(b) - getRankValue(a));
  const rankingOptions = [
    { value: 'overall', label: 'Final Grade' },
    { value: 'attendance', label: 'Attendance' },
    ...course.assignments.map((a) => ({ value: a.id, label: a.name })),
  ];
  const currentRankLabel = rankingOptions.find((o) => o.value === rankingCriteria)?.label || 'Final Grade';

  const chartBtn = (id: ChartType, icon: React.ReactNode, label: string, sub: string, iconBg: string) => (
    <button
      type="button" key={id}
      className={`chart-tab text-left p-4 rounded-xl transition-all flex items-center gap-3 ${activeChartType === id ? 'border-2 border-teal-600 bg-teal-50/50' : 'border border-slate-200 bg-white hover:bg-slate-50'}`}
      onClick={() => { setActiveChartType(id); setSelectedRankingStudentId(null); }}
      aria-pressed={activeChartType === id}
    >
      <span className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>{icon}</span>
      <div>
        <p className="font-bold text-sm text-slate-900">{label}</p>
        <p className="text-[11px] text-slate-500">{sub}</p>
      </div>
    </button>
  );

  return (
    <div className="space-y-4 view-in">
      <div>
        <h2 className="heading-font text-slate-900 font-bold" style={{ fontSize: 26 }}>Visualization Analytics</h2>
        <p className="text-slate-500 mt-1 text-sm">Review dynamic diagrams computed instantly from the student roster and current assignments.</p>
      </div>
      <div className="grid lg:grid-cols-4 gap-6 items-start">
        {/* Chart selectors */}
        <div className="lg:col-span-1 flex flex-col gap-2">
          {chartBtn('histogram', <BarChart2 className="w-4 h-4 text-teal-800" />, 'Grade Distribution', 'Histogram of scores', 'bg-teal-100')}
          {chartBtn('trend', <TrendingUp className="w-4 h-4 text-blue-800" />, 'GPA Trend', 'Student performance line', 'bg-blue-100')}
          {chartBtn('difficulty', <HelpCircle className="w-4 h-4 text-violet-800" />, 'Course Difficulty', 'Assignment averages comparison', 'bg-violet-100')}
          {chartBtn('radar', <Shield className="w-4 h-4 text-amber-800" />, 'Performance Radar', 'Skill distribution metrics', 'bg-amber-100')}
        </div>

        {/* Canvas */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[420px]">
          {course.students.length === 0 ? (
            <div className="flex flex-col items-center text-center p-6 space-y-3">
              <AlertTriangle className="w-12 h-12 text-amber-500" />
              <p className="font-bold text-slate-800">Insufficient Student Data</p>
              <p className="text-sm text-slate-500 max-w-sm">Add students, record grades, or set up assignments to render this chart.</p>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center">
              <canvas ref={canvasRef} width={600} height={350} className="max-w-full h-auto block" />
              <p className="text-xs text-slate-500 mt-4 text-center italic">{chartCaption[activeChartType]}</p>
            </div>
          )}
        </div>

        {/* Ranking Card */}
        <div className="lg:col-span-1">
          <div className="canva-card text-left p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><Trophy className="w-4 h-4" /></span>
                <h3 className="font-bold text-sm text-slate-900">Classroom Rankings</h3>
              </div>
              {/* Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-slate-50 border border-slate-200 hover:border-teal-500 rounded-lg py-1 px-2.5 text-slate-700 transition-colors"
                  onClick={() => setRankDropdownOpen((prev) => !prev)}
                >
                  {currentRankLabel} <ChevronDown className="w-3 h-3 text-slate-500" />
                </button>
                {rankDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-[95] text-[11px]">
                    {rankingOptions.map((opt) => (
                      <button
                        key={opt.value} type="button"
                        className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 transition-colors ${opt.value === rankingCriteria ? 'font-bold text-teal-700 bg-slate-50' : 'text-slate-700'}`}
                        onClick={() => { setRankingCriteria(opt.value); setRankDropdownOpen(false); }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {ranked.map((student, idx) => {
                const isSelected = selectedRankingStudentId === student.id;
                const badgeCls = idx === 0 ? 'bg-amber-100 text-amber-800' : idx === 1 ? 'bg-slate-200 text-slate-700' : idx === 2 ? 'bg-amber-500/10 text-amber-700' : 'bg-slate-100 text-slate-500';
                return (
                  <button
                    key={student.id} type="button"
                    className={`w-full text-left flex items-center justify-between p-3.5 rounded-2xl border transition-all text-xs focus:outline-none ${isSelected ? 'bg-teal-50/50 border-teal-400 ring-1 ring-teal-400 font-semibold' : 'bg-slate-50/50 border-slate-100 hover:bg-slate-100'}`}
                    onClick={() => { setSelectedRankingStudentId(student.id); setActiveChartType('student-detail'); }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 rounded-full ${badgeCls} flex items-center justify-center font-bold text-[10px] shrink-0`}>{idx + 1}</span>
                      <span className="font-medium text-slate-800 truncate">{student.name}</span>
                    </div>
                    <span className="font-bold text-teal-700 font-mono ml-2 shrink-0">{getDisplayValue(student)}</span>
                  </button>
                );
              })}
              {ranked.length === 0 && <p className="text-slate-400 text-xs text-center py-4">No students yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI Prediction Tab ─────────────────────────────────────────────────────────

function AiPredictionTab({ courseId }: { courseId: string }) {
  const { courseData, attendanceState } = useAcadence();
  const course = courseData[courseId];
  if (!course) return null;
  const sessions = attendanceState[courseId]?.sessions || [];

  return (
    <div className="space-y-4 view-in">
      <div>
        <h2 className="heading-font text-slate-900 font-bold" style={{ fontSize: 26 }}>AI Student Risk Prediction</h2>
        <p className="text-slate-500 mt-1 text-sm">Utilize course assignment scores and session attendance to predict final grades and detect early at-risk indicators.</p>
      </div>
      <div className="grid lg:grid-cols-4 gap-6 items-start">
        {/* Info card */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm" style={{ fontSize: 18 }}>Risk Intelligence</h3>
          <p className="text-xs text-slate-500">Calculations and triggers are processed locally based on standard educational cohort modeling averages.</p>
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-rose-800 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4" /> At-Risk Alert Rule
            </div>
            <p className="text-[11px] text-rose-700 leading-relaxed">
              A student is flagged at-risk if predicted final grade falls <span className="font-bold">under 60%</span> OR attendance rate is <span className="font-bold">80% or below</span>.
            </p>
          </div>
        </div>
        {/* Prediction table */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">Student Name</th>
                <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">Attendance Rate</th>
                <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">Predicted Final Grade</th>
                <th className="text-right p-4 font-semibold text-xs uppercase tracking-wider">Risk Assessment</th>
              </tr>
            </thead>
            <tbody>
              {course.students.map((student) => {
                const attendanceRate = computeAttendanceRate(student.id, sessions);
                const predictedGrade = computeWeightedScore(student, course.assignments);
                const isAtRisk = predictedGrade < 60 || attendanceRate <= 80;
                return (
                  <tr key={student.id} className="border-t border-slate-200 hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-semibold text-slate-900">{student.name}</td>
                    <td className={`p-4 font-semibold ${attendanceRate <= 80 ? 'text-rose-600' : 'text-slate-700'}`}>{attendanceRate}%</td>
                    <td className={`p-4 font-bold ${predictedGrade < 60 ? 'text-rose-600' : 'text-teal-700'}`}>
                      {predictedGrade.toFixed(1)}% ({gradeLetter(predictedGrade)})
                    </td>
                    <td className="p-4 text-right">
                      {isAtRisk ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-700" /> At Risk
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Good Standing
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {course.students.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-slate-400 text-sm">No students enrolled yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main CourseView ──────────────────────────────────────────────────────────

const TABS: { key: CourseTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'enrollment', label: 'Enrollment Management' },
  { key: 'grades', label: 'Grade Management' },
  { key: 'attendance', label: 'Attendance Report' },
  { key: 'visualizations', label: 'Visualization Reports' },
  { key: 'ai-prediction', label: 'AI Prediction' },
];

interface CourseViewProps {
  courseId: string;
  onBack: () => void;
}

export function CourseView({ courseId, onBack }: CourseViewProps) {
  const { courseData } = useAcadence();
  const [activeTab, setActiveTab] = useState<CourseTab>('overview');
  const course = courseData[courseId];

  useEffect(() => { setActiveTab('overview'); }, [courseId]);

  if (!course) return null;
  const badgeStyle = getCourseHeaderBadge(courseId);
  const totalStudents = course.students.length;
  const avgGpa = computeAverageGpa(course);

  return (
    <section aria-label="Course workspace" className="view-in">
      {/* Back button */}
      <button
        type="button" onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-700"
      >
        <ArrowLeft className="w-4 h-4" /> Back to all courses
      </button>

      {/* Course Header */}
      <header className="rounded-3xl bg-slate-900 text-white p-6 md:p-8 overflow-hidden relative mb-0">
        <div className="absolute right-0 top-0 w-64 h-64 rounded-full bg-teal-400/10 translate-x-1/3 -translate-y-1/3" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <span className="inline-block px-3 py-1 rounded-full font-bold text-xs" style={{ background: badgeStyle.bg, color: badgeStyle.color }}>
              {courseId.toUpperCase()}
            </span>
            <h1 className="heading-font text-white font-bold mt-3" style={{ fontSize: 32 }}>
              {course.name || courseId.toUpperCase()}
            </h1>
            <p className="text-slate-300 mt-2 text-sm">{course.instructor || 'Staff'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-2xl font-bold">{totalStudents}</p>
              <p className="text-xs text-slate-300">Students</p>
            </div>
            <div className="bg-white/10 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-2xl font-bold">{avgGpa}</p>
              <p className="text-xs text-slate-300">Average GPA</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <nav className="flex gap-2 overflow-x-auto py-5" aria-label="Course tools">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`workspace-tab shrink-0 border border-slate-200 bg-white px-4 py-2 rounded-xl text-sm font-semibold ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Active Tab Panel */}
      <div>
        {activeTab === 'overview' && <OverviewTab courseId={courseId} />}
        {activeTab === 'enrollment' && <EnrollmentTab courseId={courseId} />}
        {activeTab === 'grades' && <GradesTab courseId={courseId} />}
        {activeTab === 'attendance' && <AttendanceTab courseId={courseId} />}
        {activeTab === 'visualizations' && <VisualizationTab courseId={courseId} />}
        {activeTab === 'ai-prediction' && <AiPredictionTab courseId={courseId} />}
      </div>
    </section>
  );
}
