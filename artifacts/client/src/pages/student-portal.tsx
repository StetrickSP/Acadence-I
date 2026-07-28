import { useState } from 'react';
import {
  GraduationCap, Home, BookOpen, BarChart2, TrendingUp, Download,
  User, LogOut, Menu, X, ChevronLeft, AlertCircle, CheckCircle,
  Clock, XCircle, Star,
} from 'lucide-react';
import { useClerk } from '@clerk/react';
import { useStudentIdentity } from '@/hooks/useStudentIdentity';
import { useAcadence } from '@/context/AcadenceContext';
import { gradeLetter } from '@/lib/acadence-utils';
import { useLocation } from 'wouter';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

// ── Local score helper (avoids needing full Student shape) ─────────────────────

function calcPct(
  scores: { assignment: { weight: number; maxPoints: number }; score: number | undefined }[]
): number {
  let ws = 0;
  let tw = 0;
  for (const { assignment, score } of scores) {
    ws += ((score ?? 0) / (assignment.maxPoints || 100)) * assignment.weight;
    tw += assignment.weight;
  }
  return tw > 0 ? (ws / tw) * 100 : 0;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type SpPage =
  | 'dashboard'
  | 'courses'
  | { type: 'course-detail'; courseId: string; tab: 'attendance' | 'grades' | 'prediction' }
  | 'grades'
  | 'visualizations'
  | 'predictions'
  | 'export'
  | 'profile';

type VizType = 'distribution' | 'gpa-trend' | 'difficulty' | 'radar';

// ── Helpers ────────────────────────────────────────────────────────────────────

const COURSE_IMAGES: Record<string, string> = {
  cs: 'https://images.pexels.com/photos/27427258/pexels-photo-27427258.jpeg?w=600&auto=compress',
  ds: 'https://images.pexels.com/photos/7947999/pexels-photo-7947999.jpeg?w=600&auto=compress',
  se: 'https://images.pexels.com/photos/3912478/pexels-photo-3912478.jpeg?w=600&auto=compress',
  ai: 'https://images.pexels.com/photos/8386434/pexels-photo-8386434.jpeg?w=600&auto=compress',
};

const COURSE_COLORS: Record<string, { bg: string; badge: string; badgeBg: string }> = {
  cs301: { bg: 'linear-gradient(135deg,#1e40af,#3b82f6)', badge: '#1e40af', badgeBg: '#dbeafe' },
  ds201: { bg: 'linear-gradient(135deg,#6d28d9,#8b5cf6)', badge: '#6d28d9', badgeBg: '#ede9fe' },
  se401: { bg: 'linear-gradient(135deg,#0f766e,#14b8a6)', badge: '#0f766e', badgeBg: '#ccfbf1' },
  ai501: { bg: 'linear-gradient(135deg,#b45309,#f59e0b)', badge: '#b45309', badgeBg: '#fef3c7' },
};

function getImageKey(courseId: string): string {
  if (courseId.startsWith('cs')) return 'cs';
  if (courseId.startsWith('ds')) return 'ds';
  if (courseId.startsWith('se')) return 'se';
  if (courseId.startsWith('ai')) return 'ai';
  return 'cs';
}

function getCourseColor(courseId: string) {
  return (
    COURSE_COLORS[courseId] || {
      bg: 'linear-gradient(135deg,#334155,#64748b)',
      badge: '#334155',
      badgeBg: '#f1f5f9',
    }
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function gradeColor(letter: string) {
  if (letter === 'A' || letter === 'A+') return '#0f766e';
  if (letter === 'B' || letter === 'B+') return '#1d4ed8';
  if (letter === 'C' || letter === 'C+') return '#b45309';
  return '#dc2626';
}

function attIcon(status: string | undefined) {
  if (status === 'present') return <CheckCircle className="w-4 h-4" style={{ color: '#16a34a' }} />;
  if (status === 'late') return <Clock className="w-4 h-4" style={{ color: '#d97706' }} />;
  if (status === 'excused') return <Star className="w-4 h-4" style={{ color: '#2563eb' }} />;
  return <XCircle className="w-4 h-4" style={{ color: '#dc2626' }} />;
}

function attLabel(status: string | undefined) {
  if (!status) return 'Absent';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function attBadgeClass(status: string | undefined) {
  if (status === 'present') return 'sp-badge sp-badge-green';
  if (status === 'late') return 'sp-badge sp-badge-yellow';
  if (status === 'excused') return 'sp-badge sp-badge-blue';
  return 'sp-badge sp-badge-red';
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  page: SpPage;
  mobileOpen: boolean;
  onNavigate: (p: SpPage) => void;
  onClose: () => void;
  studentName: string;
  studentId: string;
  onSignOut: () => void;
}

function Sidebar({ page, mobileOpen, onNavigate, onClose, studentName, studentId, onSignOut }: SidebarProps) {
  const currentTop =
    typeof page === 'string'
      ? page
      : page.type === 'course-detail'
        ? 'courses'
        : page;

  const navItem = (id: SpPage, Icon: React.ComponentType<{ className?: string }>, label: string) => (
    <button
      key={String(id)}
      className={`sp-nav-item ${currentTop === id ? 'active' : ''}`}
      onClick={() => { onNavigate(id); onClose(); }}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </button>
  );

  return (
    <>
      <div className={`sp-mobile-overlay ${mobileOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sp-sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sp-sidebar-logo">
          <div className="sp-logo-icon">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="sp-logo-text">Acadence</span>
        </div>

        {/* Nav */}
        <nav className="sp-nav">
          <div className="sp-nav-section">
            <div className="sp-nav-label">Main</div>
            {navItem('dashboard', Home, 'Dashboard')}
            {navItem('courses', BookOpen, 'My Courses')}
            {navItem('grades', BarChart2, 'Grades')}
          </div>
          <div className="sp-nav-section" style={{ marginTop: 8 }}>
            <div className="sp-nav-label">Insights</div>
            {navItem('visualizations', TrendingUp, 'Visualizations')}
            {navItem('predictions', Star, 'Predictions')}
          </div>
          <div className="sp-nav-section" style={{ marginTop: 8 }}>
            <div className="sp-nav-label">Account</div>
            {navItem('export', Download, 'Export Report')}
            {navItem('profile', User, 'Profile')}
          </div>
        </nav>

        {/* User footer */}
        <div className="sp-sidebar-user">
          <div className="sp-user-card">
            <div className="sp-avatar">{getInitials(studentName)}</div>
            <div className="sp-user-info">
              <div className="sp-user-name">{studentName}</div>
              <div className="sp-user-id">{studentId}</div>
            </div>
            <button className="sp-signout-btn" onClick={onSignOut} title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Dashboard page ─────────────────────────────────────────────────────────────

function DashboardPage({
  studentName,
  studentId,
  myCourses,
  onViewCourse,
}: {
  studentName: string;
  studentId: string;
  myCourses: { courseId: string; course: ReturnType<ReturnType<typeof useAcadence>['getStudentCourses']>[0]['course'] }[];
  onViewCourse: (id: string) => void;
}) {
  const { getStudentScores } = useAcadence();

  const grades = myCourses.map(({ courseId, course }) => {
    const scores = getStudentScores(studentId, courseId);
    const scoreMap: Record<string, number> = {};
    scores.forEach(({ assignment, score }) => {
      if (score !== undefined) scoreMap[assignment.id] = score;
    });
    const pct = calcPct(scores);
    return { courseId, pct };
  });

  const avgGpa = grades.length
    ? (grades.reduce((s, g) => s + g.pct, 0) / grades.length / 25).toFixed(2)
    : '—';

  const atRisk = grades.filter((g) => g.pct < 60).length;

  return (
    <div className="sp-page-in">
      {/* Hero */}
      <div className="sp-hero">
        <div className="sp-hero-greeting">Welcome back 👋</div>
        <div className="sp-hero-name">{studentName}</div>
        <div className="sp-hero-sub">
          Student ID: {studentId} · Semester 2 · 2025–2026
        </div>
      </div>

      {/* Stats */}
      <div className="sp-stats">
        <div className="sp-stat-card">
          <div className="sp-stat-icon" style={{ background: '#dbeafe' }}>
            <BookOpen className="w-5 h-5" style={{ color: '#1d4ed8' }} />
          </div>
          <div>
            <div className="sp-stat-value">{myCourses.length}</div>
            <div className="sp-stat-label">Enrolled Courses</div>
          </div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-icon" style={{ background: '#ccfbf1' }}>
            <TrendingUp className="w-5 h-5" style={{ color: '#0f766e' }} />
          </div>
          <div>
            <div className="sp-stat-value" style={{ color: '#0f766e' }}>{avgGpa}</div>
            <div className="sp-stat-label">Average GPA (est.)</div>
          </div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-icon" style={{ background: atRisk > 0 ? '#fee2e2' : '#dcfce7' }}>
            <AlertCircle className="w-5 h-5" style={{ color: atRisk > 0 ? '#dc2626' : '#16a34a' }} />
          </div>
          <div>
            <div className="sp-stat-value" style={{ color: atRisk > 0 ? '#dc2626' : '#16a34a' }}>{atRisk}</div>
            <div className="sp-stat-label">At-Risk Courses</div>
          </div>
        </div>
      </div>

      {/* Courses */}
      <div className="sp-section-heading">My Courses</div>
      <div className="sp-course-grid">
        {myCourses.map(({ courseId, course }) => {
          const { pct } = grades.find((g) => g.courseId === courseId) || { pct: 0 };
          const letter = gradeLetter(pct);
          const color = getCourseColor(courseId);
          const imgKey = getImageKey(courseId);
          return (
            <div key={courseId} className="sp-course-card" onClick={() => onViewCourse(courseId)}>
              <img
                src={COURSE_IMAGES[imgKey]}
                alt={course.name}
                className="sp-course-img"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="sp-course-body">
                <span
                  className="sp-course-badge"
                  style={{ background: color.badgeBg, color: color.badge }}
                >
                  {courseId.toUpperCase()}
                </span>
                <div className="sp-course-name">{course.name}</div>
                <div className="sp-course-instructor">
                  {course.instructor?.split('·')[0]?.trim() ?? ''}
                </div>
                <div className="sp-course-grade" style={{ color: gradeColor(letter) }}>
                  {letter}
                  <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 6, fontWeight: 500 }}>
                    ({pct.toFixed(0)}%)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Courses page ───────────────────────────────────────────────────────────────

function CoursesPage({
  studentId,
  myCourses,
  onViewCourse,
}: {
  studentId: string;
  myCourses: { courseId: string; course: any }[];
  onViewCourse: (id: string) => void;
}) {
  const { getStudentScores } = useAcadence();

  return (
    <div className="sp-page-in">
      <div className="sp-section-heading" style={{ marginBottom: 20 }}>My Courses</div>
      <div className="sp-course-grid">
        {myCourses.map(({ courseId, course }) => {
          const scores = getStudentScores(studentId, courseId);
          const scoreMap: Record<string, number> = {};
          scores.forEach(({ assignment, score }) => {
            if (score !== undefined) scoreMap[assignment.id] = score;
          });
          const pct = calcPct(scores);
          const letter = gradeLetter(pct);
          const color = getCourseColor(courseId);
          const imgKey = getImageKey(courseId);
          return (
            <div key={courseId} className="sp-course-card" onClick={() => onViewCourse(courseId)}>
              <img
                src={COURSE_IMAGES[imgKey]}
                alt={course.name}
                className="sp-course-img"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="sp-course-body">
                <span
                  className="sp-course-badge"
                  style={{ background: color.badgeBg, color: color.badge }}
                >
                  {courseId.toUpperCase()}
                </span>
                <div className="sp-course-name">{course.name}</div>
                <div className="sp-course-instructor">{course.instructor?.split('·')[0]?.trim() ?? ''}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span className="sp-course-grade" style={{ color: gradeColor(letter) }}>{letter}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{pct.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Course Detail page ─────────────────────────────────────────────────────────

function CourseDetailPage({
  courseId,
  studentId,
  initialTab,
  onBack,
}: {
  courseId: string;
  studentId: string;
  initialTab: 'attendance' | 'grades' | 'prediction';
  onBack: () => void;
}) {
  const { courseData, getStudentScores, getStudentAttendance } = useAcadence();
  const [tab, setTab] = useState<'attendance' | 'grades' | 'prediction'>(initialTab);
  const course = courseData[courseId];
  if (!course) return <div className="sp-page-in">Course not found.</div>;

  const scores = getStudentScores(studentId, courseId);
  const scoreMap: Record<string, number> = {};
  scores.forEach(({ assignment, score }) => {
    if (score !== undefined) scoreMap[assignment.id] = score;
  });
  const pct = calcPct(scores);
  const letter = gradeLetter(pct);
  const color = getCourseColor(courseId);

  const attendance = getStudentAttendance(studentId, courseId);
  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const lateCount = attendance.filter((a) => a.status === 'late').length;
  const absentCount = attendance.filter((a) => !a.status || a.status === 'absent').length;
  const attPct =
    attendance.length > 0
      ? Math.round(((presentCount + lateCount * 0.5) / attendance.length) * 100)
      : 100;

  // Prediction (simple model)
  const predictedLetter = letter;
  const risk = pct < 60 ? 'High' : pct < 70 ? 'Medium' : 'Low';
  const riskClass = risk === 'High' ? 'sp-badge-red' : risk === 'Medium' ? 'sp-badge-yellow' : 'sp-badge-green';
  const confidence = Math.min(95, 60 + Math.round(scores.filter(s => s.score !== undefined).length * 8));

  return (
    <div className="sp-page-in">
      <button className="sp-back-btn" onClick={onBack}>
        <ChevronLeft className="w-4 h-4" /> Back to Courses
      </button>

      {/* Course header */}
      <div className="sp-course-header" style={{ background: color.bg }}>
        <span
          style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 20,
            padding: '3px 12px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.5px',
            marginBottom: 8,
          }}
        >
          {courseId.toUpperCase()}
        </span>
        <div
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 22,
            fontWeight: 700,
            color: 'white',
            marginBottom: 4,
          }}
        >
          {course.name}
        </div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)' }}>
          {course.instructor}
        </div>
      </div>

      {/* Tabs */}
      <div className="sp-tab-bar">
        {(['attendance', 'grades', 'prediction'] as const).map((t) => (
          <button
            key={t}
            className={`sp-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'attendance' ? 'Attendance' : t === 'grades' ? 'Grades' : 'AI Prediction'}
          </button>
        ))}
      </div>

      {/* Attendance tab */}
      {tab === 'attendance' && (
        <div>
          {/* Stats row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
            {[
              { label: 'Attendance Rate', value: `${attPct}%`, color: '#0f766e', bg: '#ccfbf1' },
              { label: 'Present', value: presentCount, color: '#16a34a', bg: '#dcfce7' },
              { label: 'Late', value: lateCount, color: '#d97706', bg: '#fef3c7' },
              { label: 'Absent', value: absentCount, color: '#dc2626', bg: '#fee2e2' },
            ].map(({ label, value, color: c, bg }) => (
              <div
                key={label}
                style={{
                  background: bg,
                  borderRadius: 12,
                  padding: '12px 18px',
                  minWidth: 90,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{value}</div>
                <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Sessions table */}
          {attendance.length === 0 ? (
            <div className="sp-card" style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>
              No sessions recorded yet.
            </div>
          ) : (
            <div className="sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map(({ session, status }) => (
                    <tr key={session.id}>
                      <td style={{ fontWeight: 500 }}>{session.name}</td>
                      <td>{session.date}</td>
                      <td style={{ color: '#64748b' }}>{session.time}</td>
                      <td>
                        <span className={attBadgeClass(status)}>
                          {attLabel(status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Grades tab */}
      {tab === 'grades' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                color: gradeColor(letter),
                fontFamily: "'Fraunces', serif",
                lineHeight: 1,
              }}
            >
              {letter}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
                {pct.toFixed(1)}%
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b' }}>Current grade</div>
            </div>
          </div>
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Assignment</th>
                  <th>Weight</th>
                  <th>Score</th>
                  <th>Out of</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {scores.map(({ assignment, score }) => (
                  <tr key={assignment.id}>
                    <td style={{ fontWeight: 500 }}>{assignment.name}</td>
                    <td style={{ color: '#64748b' }}>{assignment.weight}%</td>
                    <td style={{ fontWeight: 600, color: '#0f766e' }}>
                      {score !== undefined ? score : '—'}
                    </td>
                    <td style={{ color: '#64748b' }}>{assignment.maxPoints}</td>
                    <td>
                      {score !== undefined
                        ? <span className={`sp-badge ${score >= 80 ? 'sp-badge-green' : score >= 60 ? 'sp-badge-yellow' : 'sp-badge-red'}`}>
                            {((score / assignment.maxPoints) * 100).toFixed(0)}%
                          </span>
                        : <span className="sp-badge sp-badge-gray">N/A</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Prediction tab */}
      {tab === 'prediction' && (
        <div>
          <div className="sp-card" style={{ textAlign: 'center', padding: '32px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Predicted Final Grade</div>
            <div
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 64,
                fontWeight: 800,
                color: gradeColor(predictedLetter),
                lineHeight: 1,
                marginBottom: 8,
              }}
            >
              {predictedLetter}
            </div>
            <div style={{ fontSize: 13.5, color: '#64748b', marginBottom: 16 }}>
              Based on current scores and attendance
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className={`sp-badge ${riskClass}`}>
                {risk} Risk
              </span>
              <span className="sp-badge sp-badge-teal">
                {confidence}% Confidence
              </span>
            </div>
          </div>
          <div className="sp-card">
            <div className="sp-card-title">What this means</div>
            {risk === 'Low' && (
              <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
                You're on track for an excellent grade in this course. Keep up your consistent performance and attendance.
              </p>
            )}
            {risk === 'Medium' && (
              <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
                Your current performance suggests a passing grade, but there's room for improvement. Focus on the upcoming assignments to strengthen your grade.
              </p>
            )}
            {risk === 'High' && (
              <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
                You may be at risk of not passing this course. Consider speaking with your instructor and prioritizing upcoming work.
              </p>
            )}
          </div>
          <div className="sp-card">
            <div className="sp-card-title">Score Breakdown</div>
            {scores.map(({ assignment, score }) => {
              const pctVal = score !== undefined ? (score / assignment.maxPoints) * 100 : 0;
              const barColor = pctVal >= 80 ? '#16a34a' : pctVal >= 60 ? '#d97706' : '#dc2626';
              return (
                <div key={assignment.id} className="sp-bar-row">
                  <span className="sp-bar-label">{assignment.name}</span>
                  <div className="sp-bar-track">
                    <div
                      className="sp-bar-fill"
                      style={{ width: `${pctVal}%`, background: barColor }}
                    >
                      {score !== undefined ? `${pctVal.toFixed(0)}%` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Grades page ────────────────────────────────────────────────────────────────

function GradesPage({
  studentId,
  myCourses,
  onViewCourse,
}: {
  studentId: string;
  myCourses: { courseId: string; course: any }[];
  onViewCourse: (id: string) => void;
}) {
  const { getStudentScores } = useAcadence();
  const [filter, setFilter] = useState('all');

  const rows = myCourses.map(({ courseId, course }) => {
    const scores = getStudentScores(studentId, courseId);
    const scoreMap: Record<string, number> = {};
    scores.forEach(({ assignment, score }) => {
      if (score !== undefined) scoreMap[assignment.id] = score;
    });
    const pct = calcPct(scores);
    const letter = gradeLetter(pct);
    return { courseId, course, pct, letter };
  });

  const filtered = filter === 'all' ? rows : rows.filter((r) => {
    if (filter === 'passing') return r.pct >= 60;
    if (filter === 'at-risk') return r.pct < 60;
    return true;
  });

  return (
    <div className="sp-page-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div className="sp-section-heading" style={{ margin: 0 }}>Grade Overview</div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            background: '#1e293b',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            padding: '8px 14px',
            fontSize: 13,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          <option value="all">All Courses</option>
          <option value="passing">Passing</option>
          <option value="at-risk">At Risk</option>
        </select>
      </div>

      <div className="sp-table-wrap">
        <table className="sp-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Score</th>
              <th>Grade</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ courseId, course, pct, letter }) => (
              <tr key={courseId}>
                <td>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{course.name}</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{courseId.toUpperCase()}</div>
                </td>
                <td style={{ fontWeight: 600 }}>{pct.toFixed(1)}%</td>
                <td>
                  <span style={{ fontSize: 18, fontWeight: 800, color: gradeColor(letter) }}>{letter}</span>
                </td>
                <td>
                  <span className={`sp-badge ${pct >= 80 ? 'sp-badge-green' : pct >= 60 ? 'sp-badge-yellow' : 'sp-badge-red'}`}>
                    {pct >= 80 ? 'Excellent' : pct >= 60 ? 'Passing' : 'At Risk'}
                  </span>
                </td>
                <td>
                  <button
                    style={{ background: 'none', border: 'none', color: '#0f766e', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit' }}
                    onClick={() => onViewCourse(courseId)}
                  >
                    Details →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Visualizations page ────────────────────────────────────────────────────────

function VisualizationsPage({
  studentId,
  myCourses,
}: {
  studentId: string;
  myCourses: { courseId: string; course: any }[];
}) {
  const { getStudentScores } = useAcadence();
  const [viz, setViz] = useState<VizType>('distribution');

  const courseGrades = myCourses.map(({ courseId, course }) => {
    const scores = getStudentScores(studentId, courseId);
    const scoreMap: Record<string, number> = {};
    scores.forEach(({ assignment, score }) => {
      if (score !== undefined) scoreMap[assignment.id] = score;
    });
    const pct = calcPct(scores);
    return { courseId, name: course.name, pct, letter: gradeLetter(pct) };
  });

  const VIZ_NAV: { id: VizType; label: string; icon: React.ReactNode }[] = [
    { id: 'distribution', label: 'Grade Distribution', icon: <BarChart2 className="w-4 h-4" style={{ color: '#1d4ed8' }} /> },
    { id: 'gpa-trend', label: 'GPA Trend', icon: <TrendingUp className="w-4 h-4" style={{ color: '#0f766e' }} /> },
    { id: 'difficulty', label: 'Course Difficulty', icon: <AlertCircle className="w-4 h-4" style={{ color: '#d97706' }} /> },
    { id: 'radar', label: 'Performance Radar', icon: <Star className="w-4 h-4" style={{ color: '#7c3aed' }} /> },
  ];

  return (
    <div className="sp-page-in">
      <div className="sp-section-heading" style={{ marginBottom: 20 }}>Visualizations</div>
      <div className="sp-viz-layout">
        {/* Nav cards */}
        <div className="sp-viz-nav">
          {VIZ_NAV.map(({ id, label, icon }) => (
            <div
              key={id}
              className={`sp-viz-nav-card ${viz === id ? 'active' : ''}`}
              onClick={() => setViz(id)}
            >
              <div className="sp-viz-nav-icon">{icon}</div>
              <span className="sp-viz-nav-label">{label}</span>
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div className="sp-viz-chart">
          {viz === 'distribution' && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 20 }}>
                Grade Distribution
              </div>
              {courseGrades.map(({ courseId, name, pct }) => (
                <div key={courseId} className="sp-bar-row">
                  <span className="sp-bar-label" style={{ textAlign: 'right', fontSize: 12 }}>{name}</span>
                  <div className="sp-bar-track">
                    <div
                      className="sp-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 80 ? '#0f766e' : pct >= 60 ? '#d97706' : '#dc2626',
                      }}
                    >
                      {pct.toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {viz === 'gpa-trend' && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 20 }}>
                GPA Trend (by Course)
              </div>
              {(() => {
                const w = 520;
                const h = 200;
                const pad = { top: 20, right: 20, bottom: 30, left: 40 };
                const innerW = w - pad.left - pad.right;
                const innerH = h - pad.top - pad.bottom;
                const data = courseGrades.map((g, i) => ({
                  x: pad.left + (i / Math.max(courseGrades.length - 1, 1)) * innerW,
                  y: pad.top + innerH - (g.pct / 100) * innerH,
                  name: g.name,
                  pct: g.pct,
                }));
                const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x},${d.y}`).join(' ');
                return (
                  <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200 }}>
                    {/* Grid lines */}
                    {[0, 25, 50, 75, 100].map((v) => {
                      const y = pad.top + innerH - (v / 100) * innerH;
                      return (
                        <g key={v}>
                          <line x1={pad.left} x2={pad.left + innerW} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                          <text x={pad.left - 6} y={y + 4} fontSize={9} fill="#94a3b8" textAnchor="end">{v}</text>
                        </g>
                      );
                    })}
                    {/* Area */}
                    {data.length > 1 && (
                      <path
                        d={`${path} L${data[data.length - 1].x},${pad.top + innerH} L${data[0].x},${pad.top + innerH} Z`}
                        fill="#ccfbf1"
                        opacity={0.4}
                      />
                    )}
                    {/* Line */}
                    {data.length > 1 && <path d={path} fill="none" stroke="#0f766e" strokeWidth={2.5} strokeLinejoin="round" />}
                    {/* Dots + labels */}
                    {data.map((d, i) => (
                      <g key={i}>
                        <circle cx={d.x} cy={d.y} r={5} fill="#0f766e" stroke="white" strokeWidth={2} />
                        <text x={d.x} y={d.y - 10} fontSize={10} fill="#0f766e" textAnchor="middle" fontWeight={700}>
                          {d.pct.toFixed(0)}%
                        </text>
                      </g>
                    ))}
                    {/* X labels */}
                    {data.map((d, i) => (
                      <text key={i} x={d.x} y={h - 5} fontSize={8.5} fill="#64748b" textAnchor="middle">
                        {courseGrades[i].courseId.toUpperCase()}
                      </text>
                    ))}
                  </svg>
                );
              })()}
            </div>
          )}

          {viz === 'difficulty' && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 20 }}>
                Course Difficulty (inverted score)
              </div>
              {courseGrades.map(({ courseId, name, pct }) => {
                const difficulty = 100 - pct;
                return (
                  <div key={courseId} className="sp-bar-row">
                    <span className="sp-bar-label" style={{ textAlign: 'right', fontSize: 12 }}>{name}</span>
                    <div className="sp-bar-track">
                      <div
                        className="sp-bar-fill"
                        style={{
                          width: `${difficulty}%`,
                          background: difficulty > 40 ? '#dc2626' : difficulty > 20 ? '#d97706' : '#16a34a',
                        }}
                      >
                        {difficulty.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viz === 'radar' && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 20 }}>
                Performance Radar
              </div>
              {(() => {
                const n = courseGrades.length;
                if (n === 0) return <div style={{ color: '#94a3b8' }}>No data</div>;
                const cx = 160;
                const cy = 160;
                const r = 110;
                const points = courseGrades.map((g, i) => {
                  const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
                  const mag = (g.pct / 100) * r;
                  return {
                    x: cx + mag * Math.cos(angle),
                    y: cy + mag * Math.sin(angle),
                    lx: cx + (r + 20) * Math.cos(angle),
                    ly: cy + (r + 20) * Math.sin(angle),
                    name: g.courseId.toUpperCase(),
                  };
                });
                const polygon = points.map((p) => `${p.x},${p.y}`).join(' ');
                // Grid circles
                return (
                  <svg viewBox="0 0 320 320" style={{ width: '100%', maxWidth: 320 }}>
                    {[0.25, 0.5, 0.75, 1].map((f) => (
                      <circle key={f} cx={cx} cy={cy} r={r * f} fill="none" stroke="#e2e8f0" strokeWidth={1} />
                    ))}
                    {courseGrades.map((_, i) => {
                      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
                      return (
                        <line
                          key={i}
                          x1={cx}
                          y1={cy}
                          x2={cx + r * Math.cos(angle)}
                          y2={cy + r * Math.sin(angle)}
                          stroke="#e2e8f0"
                          strokeWidth={1}
                        />
                      );
                    })}
                    <polygon points={polygon} fill="#ccfbf1" stroke="#0f766e" strokeWidth={2} opacity={0.8} />
                    {points.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r={4} fill="#0f766e" />
                        <text x={p.lx} y={p.ly + 4} fontSize={10} fill="#475569" textAnchor="middle" fontWeight={600}>
                          {p.name}
                        </text>
                      </g>
                    ))}
                  </svg>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Predictions page ───────────────────────────────────────────────────────────

function PredictionsPage({
  studentId,
  myCourses,
  onViewCourse,
}: {
  studentId: string;
  myCourses: { courseId: string; course: any }[];
  onViewCourse: (id: string) => void;
}) {
  const { getStudentScores } = useAcadence();

  const predictions = myCourses.map(({ courseId, course }) => {
    const scores = getStudentScores(studentId, courseId);
    const scoreMap: Record<string, number> = {};
    scores.forEach(({ assignment, score }) => {
      if (score !== undefined) scoreMap[assignment.id] = score;
    });
    const pct = calcPct(scores);
    const letter = gradeLetter(pct);
    const risk = pct < 60 ? 'High' : pct < 70 ? 'Medium' : 'Low';
    const confidence = Math.min(95, 60 + scores.filter((s) => s.score !== undefined).length * 8);
    return { courseId, course, pct, letter, risk, confidence };
  });

  return (
    <div className="sp-page-in">
      <div className="sp-section-heading" style={{ marginBottom: 20 }}>Grade Predictions</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {predictions.map(({ courseId, course, pct, letter, risk, confidence }) => {
          const color = getCourseColor(courseId);
          const riskClass = risk === 'High' ? 'sp-badge-red' : risk === 'Medium' ? 'sp-badge-yellow' : 'sp-badge-green';
          return (
            <div key={courseId} className="sp-card" style={{ cursor: 'pointer' }} onClick={() => onViewCourse(courseId)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      background: color.badgeBg,
                      color: color.badge,
                      borderRadius: 20,
                      padding: '2px 10px',
                      fontSize: 10,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    {courseId.toUpperCase()}
                  </span>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{course.name}</div>
                </div>
                <div
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 40,
                    fontWeight: 800,
                    color: gradeColor(letter),
                    lineHeight: 1,
                  }}
                >
                  {letter}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <span className={`sp-badge ${riskClass}`}>{risk} Risk</span>
                <span className="sp-badge sp-badge-teal">{confidence}% Confidence</span>
              </div>
              {/* Mini bar */}
              <div style={{ background: '#f1f5f9', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: pct >= 80 ? '#0f766e' : pct >= 60 ? '#d97706' : '#dc2626',
                    borderRadius: 6,
                  }}
                />
              </div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 5 }}>
                Current average: {pct.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Export page ────────────────────────────────────────────────────────────────

function ExportPage({
  studentId,
  studentName,
  studentEmail,
  myCourses,
}: {
  studentId: string;
  studentName: string;
  studentEmail: string;
  myCourses: { courseId: string; course: any }[];
}) {
  const { getStudentScores, getStudentAttendance } = useAcadence();
  const [selected, setSelected] = useState<string>('all');
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = () => {
    const coursesToExport =
      selected === 'all' ? myCourses : myCourses.filter((c) => c.courseId === selected);

    const report = {
      generated: new Date().toISOString(),
      student: { id: studentId, name: studentName, email: studentEmail },
      courses: coursesToExport.map(({ courseId, course }) => {
        const scores = getStudentScores(studentId, courseId);
        const scoreMap: Record<string, number> = {};
        scores.forEach(({ assignment, score }) => {
          if (score !== undefined) scoreMap[assignment.id] = score;
        });
        const pct = calcPct(scores);
        const attendance = getStudentAttendance(studentId, courseId);
        return {
          id: courseId,
          name: course.name,
          instructor: course.instructor,
          scores: scores.map(({ assignment, score }) => ({
            assignment: assignment.name,
            weight: assignment.weight,
            score: score ?? null,
            maxPoints: assignment.maxPoints,
          })),
          currentGrade: {
            percentage: pct.toFixed(1),
            letter: gradeLetter(pct),
          },
          attendance: attendance.map(({ session, status }) => ({
            session: session.name,
            date: session.date,
            status: status ?? 'absent',
          })),
        };
      }),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `acadence-report-${studentId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div className="sp-page-in">
      <div className="sp-section-heading" style={{ marginBottom: 20 }}>Export Report</div>

      <div className="sp-card" style={{ maxWidth: 520 }}>
        <div style={{ marginBottom: 18 }}>
          <label className="sp-label">Select Course</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="sp-input"
          >
            <option value="all">All Courses</option>
            {myCourses.map(({ courseId, course }) => (
              <option key={courseId} value={courseId}>{course.name}</option>
            ))}
          </select>
        </div>

        <div
          style={{
            background: '#f0fdfa',
            border: '1px solid #99f6e4',
            borderRadius: 10,
            padding: '14px 16px',
            marginBottom: 20,
            fontSize: 13,
            color: '#0f766e',
          }}
        >
          <strong>What's included:</strong> assignment scores, current grade, attendance history, and AI prediction for{' '}
          {selected === 'all' ? 'all your enrolled courses' : myCourses.find((c) => c.courseId === selected)?.course.name ?? 'the selected course'}.
        </div>

        <button
          className="sp-btn-primary"
          onClick={handleDownload}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Download className="w-4 h-4" />
          {downloaded ? 'Downloaded!' : 'Download Report (JSON)'}
        </button>
      </div>
    </div>
  );
}

// ── Profile page ───────────────────────────────────────────────────────────────

function ProfilePage({
  studentId,
  studentName,
  studentEmail,
  myCourses,
}: {
  studentId: string;
  studentName: string;
  studentEmail: string;
  myCourses: { courseId: string; course: any }[];
}) {
  const { getStudentScores } = useAcadence();
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displayName, setDisplayName] = useState(studentName);
  const [editName, setEditName] = useState(studentName);

  const grades = myCourses.map(({ courseId, course }) => {
    const scores = getStudentScores(studentId, courseId);
    const scoreMap: Record<string, number> = {};
    scores.forEach(({ assignment, score }) => {
      if (score !== undefined) scoreMap[assignment.id] = score;
    });
    return calcPct(scores);
  });

  const avgGpa = grades.length
    ? (grades.reduce((s, g) => s + g, 0) / grades.length / 25).toFixed(2)
    : '—';

  return (
    <div className="sp-page-in">
      <div className="sp-section-heading" style={{ marginBottom: 20 }}>My Profile</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Profile card */}
        <div className="sp-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: '#0f766e',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              fontWeight: 700,
              margin: '0 auto 14px',
            }}
          >
            {getInitials(displayName)}
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
            {displayName}
          </div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 6 }}>{studentEmail}</div>
          <span className="sp-badge sp-badge-teal">Student</span>
          <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="sp-btn-primary" style={{ fontSize: 12.5, padding: '8px 16px' }} onClick={() => { setEditName(displayName); setEditOpen(true); }}>
              Edit Profile
            </button>
            <button className="sp-btn-ghost" style={{ fontSize: 12.5, padding: '8px 16px' }} onClick={() => setSettingsOpen(true)}>
              Settings
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="sp-card">
          <div className="sp-card-title">Academic Summary</div>
          {[
            { label: 'Student ID', value: studentId },
            { label: 'Enrolled Courses', value: myCourses.length },
            { label: 'Estimated GPA', value: avgGpa },
            { label: 'Academic Year', value: '2025–2026' },
            { label: 'Semester', value: 'Semester 2' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13.5 }}>
              <span style={{ color: '#64748b' }}>{label}</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editOpen && (
        <div className="sp-modal-overlay" onClick={() => setEditOpen(false)}>
          <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-title">Edit Profile</div>
            <div style={{ marginBottom: 16 }}>
              <label className="sp-label">Display Name</label>
              <input
                className="sp-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className="sp-label">Email</label>
              <input className="sp-input" value={studentEmail} disabled style={{ opacity: 0.6 }} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="sp-btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
              <button className="sp-btn-primary" onClick={() => { setDisplayName(editName.trim() || displayName); setEditOpen(false); }}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Settings Modal */}
      {settingsOpen && (
        <div className="sp-modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-title">Account Settings</div>
            <div style={{ marginBottom: 16 }}>
              <label className="sp-label">Student ID</label>
              <input className="sp-input" value={studentId} disabled style={{ opacity: 0.6 }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="sp-label">Email Address</label>
              <input className="sp-input" value={studentEmail} disabled style={{ opacity: 0.6 }} />
            </div>
            <p style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 20 }}>
              To change your email or ID, contact your instructor.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="sp-btn-primary" onClick={() => setSettingsOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── StudentPortal (root) ───────────────────────────────────────────────────────

export default function StudentPortal() {
  const { signOut } = useClerk();
  const identity = useStudentIdentity();
  const { getStudentCourses } = useAcadence();
  const [, navigate] = useLocation();
  const [page, setPage] = useState<SpPage>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  if (identity.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500">Loading your profile…</p>
        </div>
      </div>
    );
  }

  if (identity.status !== 'student') {
    navigate('/');
    return null;
  }

  const { studentId, name: studentName, email: studentEmail } = identity.profile;
  const myCourses = getStudentCourses(studentId);

  const handleSignOut = () => {
    signOut({ redirectUrl: basePath || '/' });
  };

  const openCourse = (courseId: string) =>
    setPage({ type: 'course-detail', courseId, tab: 'grades' });

  const pageTitle =
    typeof page === 'string'
      ? {
          dashboard: 'Dashboard',
          courses: 'My Courses',
          grades: 'Grades',
          visualizations: 'Visualizations',
          predictions: 'Predictions',
          export: 'Export Report',
          profile: 'Profile',
        }[page] ?? 'Acadence'
      : page.type === 'course-detail'
        ? myCourses.find((c) => c.courseId === page.courseId)?.course.name ?? 'Course'
        : 'Acadence';

  return (
    <div className="sp-layout">
      <Sidebar
        page={page}
        mobileOpen={mobileOpen}
        onNavigate={setPage}
        onClose={() => setMobileOpen(false)}
        studentName={studentName}
        studentId={studentId}
        onSignOut={handleSignOut}
      />

      <div className="sp-main">
        {/* Top bar */}
        <div className="sp-topbar">
          <button className="sp-hamburger" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <span className="sp-topbar-title">{pageTitle}</span>
          <span className="sp-topbar-subtitle">Semester 2 · 2025–2026</span>
        </div>

        {/* Content */}
        <div className="sp-content">
          {page === 'dashboard' && (
            <DashboardPage
              studentName={studentName}
              studentId={studentId}
              myCourses={myCourses}
              onViewCourse={openCourse}
            />
          )}

          {page === 'courses' && (
            <CoursesPage
              studentId={studentId}
              myCourses={myCourses}
              onViewCourse={openCourse}
            />
          )}

          {typeof page === 'object' && page.type === 'course-detail' && (
            <CourseDetailPage
              courseId={page.courseId}
              studentId={studentId}
              initialTab={page.tab}
              onBack={() => setPage('courses')}
            />
          )}

          {page === 'grades' && (
            <GradesPage
              studentId={studentId}
              myCourses={myCourses}
              onViewCourse={openCourse}
            />
          )}

          {page === 'visualizations' && (
            <VisualizationsPage studentId={studentId} myCourses={myCourses} />
          )}

          {page === 'predictions' && (
            <PredictionsPage
              studentId={studentId}
              myCourses={myCourses}
              onViewCourse={openCourse}
            />
          )}

          {page === 'export' && (
            <ExportPage
              studentId={studentId}
              studentName={studentName}
              studentEmail={studentEmail}
              myCourses={myCourses}
            />
          )}

          {page === 'profile' && (
            <ProfilePage
              studentId={studentId}
              studentName={studentName}
              studentEmail={studentEmail}
              myCourses={myCourses}
            />
          )}
        </div>
      </div>
    </div>
  );
}
