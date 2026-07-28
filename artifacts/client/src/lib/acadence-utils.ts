// ── Types ─────────────────────────────────────────────────────────────────────

export interface Assignment {
  id: string;
  name: string;
  weight: number;
  maxPoints: number;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  status: 'Enrolled' | 'Not Enrolled';
  scores: Record<string, number>;
}

export interface Session {
  id: string;
  name: string;
  date: string;
  time: string;
  records: Record<string, 'present' | 'absent' | 'late' | 'excused'>;
}

export interface Course {
  name?: string;
  instructor?: string;
  passRate?: string;
  attendanceRate?: string;
  nextItem?: string;
  assignments: Assignment[];
  students: Student[];
}

export interface CourseData {
  [courseId: string]: Course;
}

export interface AttendanceCourse {
  sessions: Session[];
}

export interface AttendanceState {
  [courseId: string]: AttendanceCourse;
}

export interface ProfileData {
  name: string;
  avatarImg: string | null;
  avatarInitials: string;
  office: string;
  subject: string;
}

export interface SettingsData {
  email: string;
  password: string;
}

export type GradeMode = 'weighted' | 'curved' | 'passfail';
export type ChartType = 'histogram' | 'trend' | 'difficulty' | 'radar' | 'student-detail';
export type CourseTab = 'overview' | 'enrollment' | 'grades' | 'attendance' | 'visualizations' | 'ai-prediction';
export type AppView = 'home' | 'course' | 'profile';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

// ── Pure utility functions ───────────────────────────────────────────────────

export function gradeLetter(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function getEnrolledCount(course: Course): number {
  if (!course?.students) return 0;
  return course.students.filter((s) => s.status === 'Enrolled').length;
}

export function computeWeightedScore(student: Student, assignments: Assignment[]): number {
  let weightedScore = 0;
  let totalWeight = 0;
  assignments.forEach((assign) => {
    const scoreVal = student.scores[assign.id] !== undefined ? student.scores[assign.id] : 0;
    const maxPts = assign.maxPoints || 100;
    weightedScore += (scoreVal / maxPts) * assign.weight;
    totalWeight += assign.weight;
  });
  return totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;
}

export function computeAttendanceRate(studentId: string, sessions: Session[]): number {
  let presentCount = 0;
  let lateCount = 0;
  let totalSessions = 0;
  sessions.forEach((s) => {
    if (s.records && s.records[studentId]) {
      totalSessions++;
      const status = s.records[studentId];
      if (status === 'present') presentCount++;
      else if (status === 'late') lateCount++;
    }
  });
  const equivalentAbsencesFromLates = Math.floor(lateCount / 2);
  const attendedSessions = presentCount + lateCount - equivalentAbsencesFromLates;
  return totalSessions > 0 ? Math.round((Math.max(0, attendedSessions) / totalSessions) * 100) : 100;
}

export function computeGpa(score: number): number {
  if (score >= 90) return 4.0;
  if (score >= 85) return 3.7;
  if (score >= 80) return 3.3;
  if (score >= 75) return 3.0;
  if (score >= 70) return 2.7;
  if (score >= 65) return 2.3;
  if (score >= 60) return 2.0;
  if (score >= 50) return 1.0;
  return 0.0;
}

export function computeCoursePassRate(course: Course): string {
  if (!course.students.length) return '100%';
  const passing = course.students.filter((s) => computeWeightedScore(s, course.assignments) >= 60).length;
  return Math.round((passing / course.students.length) * 100) + '%';
}

export function computeAverageGpa(course: Course): string {
  if (!course.students.length) return '4.00';
  const total = course.students.reduce(
    (sum, s) => sum + computeGpa(computeWeightedScore(s, course.assignments)),
    0
  );
  return (total / course.students.length).toFixed(2);
}

export interface GlobalStats {
  totalCourses: number;
  totalStudents: number;
  avgAttendance: string;
  pendingGrades: number;
}

export function getGlobalStats(courseData: CourseData, attendanceState: AttendanceState): GlobalStats {
  const courseIds = Object.keys(courseData);
  const totalCourses = courseIds.length;

  const allStudentIds = new Set<string>();
  courseIds.forEach((cId) => {
    courseData[cId].students.forEach((s) => allStudentIds.add(s.id));
  });
  const totalStudents = allStudentIds.size;

  let totalCourseRateSum = 0;
  courseIds.forEach((cId) => {
    const rateStr = courseData[cId].attendanceRate || '100%';
    totalCourseRateSum += parseInt(rateStr) || 100;
  });
  const avgAttendance =
    totalCourses > 0 ? Math.round(totalCourseRateSum / totalCourses) + '%' : '—';

  let pendingGrades = 0;
  courseIds.forEach((cId) => {
    courseData[cId].students.forEach((student) => {
      courseData[cId].assignments.forEach((assign) => {
        if (student.scores[assign.id] === undefined || student.scores[assign.id] === 0) {
          pendingGrades++;
        }
      });
    });
  });

  return { totalCourses, totalStudents, avgAttendance, pendingGrades };
}

export function parseSimpleCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values: string[] = [];
    let insideQuote = false;
    let currentVal = '';
    for (let ci = 0; ci < line.length; ci++) {
      const char = line[ci];
      if (char === '"' || char === "'") {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
    if (values.length >= headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? '';
      });
      rows.push(row);
    }
  }
  return { headers, rows };
}

// ── Course style helpers ──────────────────────────────────────────────────────

interface CourseStyle {
  badgeBg: string;
  badgeText: string;
  iconName: string;
  iconBg: string;
  iconText: string;
  headerBadgeBg: string;
  headerBadgeText: string;
}

const COURSE_STYLES: Record<string, CourseStyle> = {
  cs: {
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-700',
    iconName: 'Binary',
    iconBg: 'bg-teal-50',
    iconText: 'text-teal-700',
    headerBadgeBg: 'bg-teal-100/80',
    headerBadgeText: 'text-teal-300',
  },
  ds: {
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    iconName: 'BarChart3',
    iconBg: 'bg-blue-50',
    iconText: 'text-blue-700',
    headerBadgeBg: 'bg-blue-100/80',
    headerBadgeText: 'text-blue-300',
  },
  se: {
    badgeBg: 'bg-violet-50',
    badgeText: 'text-violet-700',
    iconName: 'Blocks',
    iconBg: 'bg-violet-50',
    iconText: 'text-violet-700',
    headerBadgeBg: 'bg-violet-100/80',
    headerBadgeText: 'text-violet-300',
  },
  ai: {
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    iconName: 'BrainCircuit',
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-700',
    headerBadgeBg: 'bg-amber-100/80',
    headerBadgeText: 'text-amber-300',
  },
};

const DEFAULT_STYLE: CourseStyle = COURSE_STYLES.cs;

export function getCourseStyle(courseId: string): CourseStyle {
  const prefix = courseId.substring(0, 2).toLowerCase();
  return COURSE_STYLES[prefix] || DEFAULT_STYLE;
}

export function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
