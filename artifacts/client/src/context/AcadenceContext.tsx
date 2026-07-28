import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  CourseData, AttendanceState, ProfileData, SettingsData,
  Course, Student, Assignment, Session, AttendanceStatus,
} from '@/lib/acadence-utils';
import { computeCoursePassRate, computeAverageGpa } from '@/lib/acadence-utils';

// ── Initial data (mirrors HTML prototype) ─────────────────────────────────────

const INITIAL_COURSE_DATA: CourseData = {
  cs301: {
    name: 'Algorithms',
    instructor: 'Dr. Nguyen · Monday & Wednesday · Room B-204',
    passRate: '87%',
    attendanceRate: '92%',
    nextItem: 'Final project',
    assignments: [
      { id: 'a1', name: 'Assignment', weight: 30, maxPoints: 100 },
      { id: 'a2', name: 'Midterm', weight: 30, maxPoints: 100 },
      { id: 'a3', name: 'Final', weight: 40, maxPoints: 100 },
    ],
    students: [
      { id: 'STU001', name: 'Nguyen Van A', email: 'nva@university.edu', status: 'Enrolled', scores: { a1: 92, a2: 88, a3: 85 } },
      { id: 'STU002', name: 'Tran Thi B', email: 'ttb@university.edu', status: 'Enrolled', scores: { a1: 70, a2: 62, a3: 68 } },
      { id: 'STU003', name: 'Le Hoang C', email: 'lhc@university.edu', status: 'Not Enrolled', scores: { a1: 52, a2: 45, a3: 40 } },
      { id: 'STU004', name: 'Pham Minh D', email: 'pmd@university.edu', status: 'Enrolled', scores: { a1: 85, a2: 78, a3: 82 } },
    ],
  },
  ds201: {
    name: 'Data Analysis',
    instructor: 'Prof. Tran · Tuesday & Thursday · Data Lab 3',
    passRate: '81%',
    attendanceRate: '86%',
    nextItem: 'Data lab review',
    assignments: [
      { id: 'a1', name: 'Assignment', weight: 30, maxPoints: 100 },
      { id: 'a2', name: 'Midterm', weight: 30, maxPoints: 100 },
      { id: 'a3', name: 'Final', weight: 40, maxPoints: 100 },
    ],
    students: [
      { id: 'STU002', name: 'Tran Thi B', email: 'ttb@university.edu', status: 'Enrolled', scores: { a1: 84, a2: 77, a3: 80 } },
      { id: 'STU005', name: 'Vo Thanh E', email: 'vte@university.edu', status: 'Enrolled', scores: { a1: 94, a2: 91, a3: 93 } },
      { id: 'STU006', name: 'Doan Kim F', email: 'dkf@university.edu', status: 'Enrolled', scores: { a1: 73, a2: 69, a3: 75 } },
      { id: 'STU007', name: 'Bui Anh G', email: 'bag@university.edu', status: 'Not Enrolled', scores: { a1: 65, a2: 72, a3: 68 } },
    ],
  },
  se401: {
    name: 'Software Engineering',
    instructor: 'Dr. Le · Tuesday & Friday · Innovation Studio',
    passRate: '91%',
    attendanceRate: '90%',
    nextItem: 'Sprint demonstration',
    assignments: [
      { id: 'a1', name: 'Assignment', weight: 30, maxPoints: 100 },
      { id: 'a2', name: 'Midterm', weight: 30, maxPoints: 100 },
      { id: 'a3', name: 'Final', weight: 40, maxPoints: 100 },
    ],
    students: [
      { id: 'STU001', name: 'Nguyen Van A', email: 'nva@university.edu', status: 'Enrolled', scores: { a1: 90, a2: 86, a3: 89 } },
      { id: 'STU004', name: 'Pham Minh D', email: 'pmd@university.edu', status: 'Enrolled', scores: { a1: 82, a2: 79, a3: 84 } },
      { id: 'STU008', name: 'Hoang Thu H', email: 'hth@university.edu', status: 'Enrolled', scores: { a1: 88, a2: 90, a3: 92 } },
      { id: 'STU009', name: 'Ngo Duc I', email: 'ndi@university.edu', status: 'Not Enrolled', scores: { a1: 76, a2: 81, a3: 78 } },
    ],
  },
  ai501: {
    name: 'Machine Learning',
    instructor: 'Dr. Pham · Wednesday & Friday · AI Research Lab',
    passRate: '93%',
    attendanceRate: '94%',
    nextItem: 'Model evaluation',
    assignments: [
      { id: 'a1', name: 'Assignment', weight: 30, maxPoints: 100 },
      { id: 'a2', name: 'Midterm', weight: 30, maxPoints: 100 },
      { id: 'a3', name: 'Final', weight: 40, maxPoints: 100 },
    ],
    students: [
      { id: 'STU005', name: 'Vo Thanh E', email: 'vte@university.edu', status: 'Enrolled', scores: { a1: 96, a2: 92, a3: 95 } },
      { id: 'STU010', name: 'Dang Lan K', email: 'dlk@university.edu', status: 'Enrolled', scores: { a1: 89, a2: 85, a3: 91 } },
      { id: 'STU011', name: 'Phan Quang L', email: 'pql@university.edu', status: 'Not Enrolled', scores: { a1: 78, a2: 82, a3: 80 } },
      { id: 'STU012', name: 'Mai Ngoc M', email: 'mnm@university.edu', status: 'Enrolled', scores: { a1: 87, a2: 90, a3: 88 } },
    ],
  },
};

const INITIAL_ATTENDANCE: AttendanceState = {
  cs301: {
    sessions: [
      {
        id: 's1', name: 'Lecture 1: Intro to Complexities', date: '2026-07-13', time: '09:00 - 11:00',
        records: { STU001: 'present', STU002: 'present', STU003: 'absent', STU004: 'present' },
      },
      {
        id: 's2', name: 'Lecture 2: Sorting and Searching', date: '2026-07-20', time: '09:00 - 11:00',
        records: { STU001: 'present', STU002: 'absent', STU003: 'absent', STU004: 'late' },
      },
    ],
  },
  ds201: {
    sessions: [
      {
        id: 's1', name: 'Lab 1: Python Review', date: '2026-07-14', time: '13:30 - 15:30',
        records: { STU002: 'present', STU005: 'present', STU006: 'present', STU007: 'absent' },
      },
    ],
  },
  se401: {
    sessions: [
      {
        id: 's1', name: 'Seminar 1: SDLC Methodologies', date: '2026-07-14', time: '10:00 - 12:00',
        records: { STU001: 'present', STU004: 'present', STU008: 'present', STU009: 'late' },
      },
    ],
  },
  ai501: {
    sessions: [
      {
        id: 's1', name: 'Introduction to Supervised Learning', date: '2026-07-15', time: '08:30 - 10:30',
        records: { STU005: 'present', STU010: 'present', STU011: 'absent', STU012: 'present' },
      },
    ],
  },
};

const INITIAL_PROFILE: ProfileData = {
  name: 'Dr. Nguyen Minh Tuan',
  avatarImg: null,
  avatarInitials: 'NT',
  office: 'B-204',
  subject: 'Computer Science',
};

const INITIAL_SETTINGS: SettingsData = {
  email: 'nguyen.tuan@university.edu',
  password: '••••••••',
};

// ── Context type ─────────────────────────────────────────────────────────────

export interface AcadenceContextType {
  courseData: CourseData;
  attendanceState: AttendanceState;
  profileData: ProfileData;
  settingsData: SettingsData;
  // Course mutations
  addCourse: (id: string, course: Omit<Course, 'assignments' | 'students'> & { assignments?: Assignment[]; students?: Student[] }) => void;
  deleteCourse: (id: string) => void;
  updateCourse: (id: string, field: 'name' | 'instructor', value: string) => void;
  // Student mutations
  addStudent: (courseId: string, student: Omit<Student, 'scores'>) => void;
  importStudents: (courseId: string, students: Omit<Student, 'scores'>[]) => { imported: number; skipped: number; logs: string[] };
  // Score mutations
  updateScore: (courseId: string, studentId: string, assignmentId: string, score: number) => void;
  importGrades: (courseId: string, grades: Array<{ studentName: string; assignmentName: string; score: number }>) => { imported: number; skipped: number; logs: string[] };
  // Assignment mutations
  addAssignment: (courseId: string, assignment: Omit<Assignment, 'id'>) => void;
  deleteAssignment: (courseId: string, assignmentId: string) => void;
  updateAssignment: (courseId: string, assignment: Assignment) => void;
  // Attendance mutations
  addSession: (courseId: string, session: Omit<Session, 'id' | 'records'>) => void;
  updateSession: (courseId: string, sessionId: string, updates: { name?: string; date?: string; time?: string }) => void;
  setAttendance: (courseId: string, sessionId: string, studentId: string, status: AttendanceStatus) => void;
  updateAttendanceRate: (courseId: string) => void;
  // Profile mutations
  updateProfile: (updates: Partial<ProfileData>) => void;
  updateSettings: (updates: Partial<SettingsData>) => void;
  // Student read helpers
  getStudentCourses: (studentId: string) => { courseId: string; course: Course }[];
  getStudentScores: (studentId: string, courseId: string) => { assignment: Assignment; score: number | undefined }[];
  getStudentAttendance: (studentId: string, courseId: string) => { session: Session; status: AttendanceStatus | undefined }[];
}

// ── Context ────────────────────────────────────────────────────────────────────

const AcadenceContext = createContext<AcadenceContextType | null>(null);

export function AcadenceProvider({
  children,
  initialProfileName,
  initialSettingsEmail,
}: {
  children: React.ReactNode;
  initialProfileName?: string;
  initialSettingsEmail?: string;
}) {
  const [courseData, setCourseData] = useState<CourseData>(INITIAL_COURSE_DATA);
  const [attendanceState, setAttendanceState] = useState<AttendanceState>(INITIAL_ATTENDANCE);
  const [profileData, setProfileData] = useState<ProfileData>({
    ...INITIAL_PROFILE,
    name: initialProfileName || INITIAL_PROFILE.name,
    avatarInitials: initialProfileName
      ? initialProfileName.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
      : INITIAL_PROFILE.avatarInitials,
  });
  const [settingsData, setSettingsData] = useState<SettingsData>({
    ...INITIAL_SETTINGS,
    email: initialSettingsEmail || INITIAL_SETTINGS.email,
  });

  // ── Course mutations ────────────────────────────────────────────────────────

  const addCourse = useCallback((id: string, courseInit: Partial<Course>) => {
    const normalizedId = id.toLowerCase().trim();
    setCourseData((prev) => {
      if (prev[normalizedId]) return prev;
      return {
        ...prev,
        [normalizedId]: {
          name: courseInit.name || '',
          instructor: courseInit.instructor || '',
          passRate: '100%',
          attendanceRate: '100%',
          nextItem: 'Initial Orientation',
          assignments: [
            { id: 'a1', name: 'Assignment', weight: 30, maxPoints: 100 },
            { id: 'a2', name: 'Midterm', weight: 30, maxPoints: 100 },
            { id: 'a3', name: 'Final', weight: 40, maxPoints: 100 },
          ],
          students: [
            { id: 'STU001', name: 'Nguyen Van A', email: 'nva@university.edu', status: 'Enrolled', scores: { a1: 100, a2: 100, a3: 100 } },
            { id: 'STU002', name: 'Tran Thi B', email: 'ttb@university.edu', status: 'Enrolled', scores: { a1: 100, a2: 100, a3: 100 } },
          ],
        },
      };
    });
    setAttendanceState((prev) => ({
      ...prev,
      [normalizedId]: { sessions: [] },
    }));
  }, []);

  const deleteCourse = useCallback((id: string) => {
    setCourseData((prev) => {
      if (Object.keys(prev).length <= 1) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setAttendanceState((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const updateCourse = useCallback((id: string, field: 'name' | 'instructor', value: string) => {
    setCourseData((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }, []);

  // ── Student mutations ───────────────────────────────────────────────────────

  const addStudent = useCallback((courseId: string, student: Omit<Student, 'scores'>) => {
    setCourseData((prev) => {
      const course = prev[courseId];
      if (!course) return prev;
      const scores: Record<string, number> = {};
      course.assignments.forEach((a) => { scores[a.id] = 0; });
      return {
        ...prev,
        [courseId]: {
          ...course,
          students: [...course.students, { ...student, scores }],
        },
      };
    });
  }, []);

  const importStudents = useCallback(
    (courseId: string, students: Omit<Student, 'scores'>[]) => {
      let imported = 0;
      let skipped = 0;
      const logs: string[] = [];
      setCourseData((prev) => {
        const course = prev[courseId];
        if (!course) return prev;
        const updatedStudents = [...course.students];
        students.forEach((s, rowIndex) => {
          const exists = updatedStudents.some((ex) => ex.id === s.id);
          if (exists) {
            skipped++;
            logs.push(`Row ${rowIndex + 2}: Student ID '${s.id}' already enrolled.`);
            return;
          }
          const scores: Record<string, number> = {};
          course.assignments.forEach((a) => { scores[a.id] = 100; });
          updatedStudents.push({ ...s, scores });
          imported++;
        });
        return { ...prev, [courseId]: { ...course, students: updatedStudents } };
      });
      return { imported, skipped, logs };
    },
    []
  );

  // ── Score mutations ─────────────────────────────────────────────────────────

  const updateScore = useCallback((courseId: string, studentId: string, assignmentId: string, score: number) => {
    setCourseData((prev) => {
      const course = prev[courseId];
      if (!course) return prev;
      const students = course.students.map((s) =>
        s.id === studentId ? { ...s, scores: { ...s.scores, [assignmentId]: score } } : s
      );
      const passRate = computeCoursePassRate({ ...course, students });
      return {
        ...prev,
        [courseId]: { ...course, students, passRate },
      };
    });
  }, []);

  const importGrades = useCallback(
    (courseId: string, grades: Array<{ studentName: string; assignmentName: string; score: number }>) => {
      let imported = 0;
      let skipped = 0;
      const logs: string[] = [];
      setCourseData((prev) => {
        const course = prev[courseId];
        if (!course) return prev;
        const students = course.students.map((s) => ({ ...s, scores: { ...s.scores } }));
        grades.forEach((g, i) => {
          const student = students.find(
            (s) => s.name.toLowerCase().trim() === g.studentName.toLowerCase().trim()
          );
          if (!student) {
            skipped++;
            logs.push(`Row ${i + 2}: Student '${g.studentName}' not found.`);
            return;
          }
          const assignment = course.assignments.find(
            (a) => a.name.toLowerCase().trim() === g.assignmentName.toLowerCase().trim()
          );
          if (!assignment) {
            skipped++;
            logs.push(`Row ${i + 2}: Assignment '${g.assignmentName}' not found.`);
            return;
          }
          const constrained = Math.max(0, Math.min(assignment.maxPoints || 100, g.score));
          student.scores[assignment.id] = constrained;
          imported++;
        });
        return { ...prev, [courseId]: { ...course, students } };
      });
      return { imported, skipped, logs };
    },
    []
  );

  // ── Assignment mutations ────────────────────────────────────────────────────

  const addAssignment = useCallback((courseId: string, assignment: Omit<Assignment, 'id'>) => {
    const newId = 'a' + Date.now();
    setCourseData((prev) => {
      const course = prev[courseId];
      if (!course) return prev;
      const students = course.students.map((s) => ({
        ...s,
        scores: { ...s.scores, [newId]: 0 },
      }));
      return {
        ...prev,
        [courseId]: {
          ...course,
          assignments: [...course.assignments, { ...assignment, id: newId }],
          students,
        },
      };
    });
  }, []);

  const deleteAssignment = useCallback((courseId: string, assignmentId: string) => {
    setCourseData((prev) => {
      const course = prev[courseId];
      if (!course) return prev;
      return {
        ...prev,
        [courseId]: {
          ...course,
          assignments: course.assignments.filter((a) => a.id !== assignmentId),
        },
      };
    });
  }, []);

  const updateAssignment = useCallback((courseId: string, assignment: Assignment) => {
    setCourseData((prev) => {
      const course = prev[courseId];
      if (!course) return prev;
      return {
        ...prev,
        [courseId]: {
          ...course,
          assignments: course.assignments.map((a) => (a.id === assignment.id ? assignment : a)),
        },
      };
    });
  }, []);

  // ── Attendance mutations ────────────────────────────────────────────────────

  const addSession = useCallback((courseId: string, session: Omit<Session, 'id' | 'records'>) => {
    const newId = 's' + Date.now();
    setAttendanceState((prev) => ({
      ...prev,
      [courseId]: {
        sessions: [...(prev[courseId]?.sessions || []), { ...session, id: newId, records: {} }],
      },
    }));
  }, []);

  const updateSession = useCallback(
    (courseId: string, sessionId: string, updates: { name?: string; date?: string; time?: string }) => {
      setAttendanceState((prev) => ({
        ...prev,
        [courseId]: {
          ...prev[courseId],
          sessions: (prev[courseId]?.sessions || []).map((s) =>
            s.id === sessionId ? { ...s, ...updates } : s
          ),
        },
      }));
    },
    []
  );

  const setAttendance = useCallback(
    (courseId: string, sessionId: string, studentId: string, status: AttendanceStatus) => {
      setAttendanceState((prev) => ({
        ...prev,
        [courseId]: {
          ...prev[courseId],
          sessions: (prev[courseId]?.sessions || []).map((s) =>
            s.id === sessionId
              ? { ...s, records: { ...s.records, [studentId]: status } }
              : s
          ),
        },
      }));
    },
    []
  );

  const updateAttendanceRate = useCallback(
    (courseId: string) => {
      setAttendanceState((prev) => {
        const sessions = prev[courseId]?.sessions || [];
        const students = courseData[courseId]?.students || [];
        if (!students.length || !sessions.length) return prev;
        let totalRateSum = 0;
        students.forEach((student) => {
          let presentCount = 0;
          let lateCount = 0;
          let totalSessions = 0;
          sessions.forEach((s) => {
            if (s.records && s.records[student.id]) {
              totalSessions++;
              if (s.records[student.id] === 'present') presentCount++;
              else if (s.records[student.id] === 'late') lateCount++;
            }
          });
          const equivalentAbsencesFromLates = Math.floor(lateCount / 2);
          const attended = presentCount + lateCount - equivalentAbsencesFromLates;
          totalRateSum += totalSessions > 0 ? Math.round((Math.max(0, attended) / totalSessions) * 100) : 100;
        });
        const newRate = Math.round(totalRateSum / students.length) + '%';
        setCourseData((prev2) => ({
          ...prev2,
          [courseId]: { ...prev2[courseId], attendanceRate: newRate },
        }));
        return prev;
      });
    },
    [courseData]
  );

  // ── Profile mutations ───────────────────────────────────────────────────────

  const updateProfile = useCallback((updates: Partial<ProfileData>) => {
    setProfileData((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateSettings = useCallback((updates: Partial<SettingsData>) => {
    setSettingsData((prev) => ({ ...prev, ...updates }));
  }, []);

  // ── Student read helpers ────────────────────────────────────────────────────

  const getStudentCourses = useCallback(
    (studentId: string) =>
      Object.entries(courseData)
        .filter(([, course]) =>
          course.students.some((s) => s.id === studentId && s.status === 'Enrolled')
        )
        .map(([courseId, course]) => ({ courseId, course })),
    [courseData]
  );

  const getStudentScores = useCallback(
    (studentId: string, courseId: string) => {
      const course = courseData[courseId];
      if (!course) return [];
      const student = course.students.find((s) => s.id === studentId);
      return course.assignments.map((a) => ({
        assignment: a,
        score: student?.scores[a.id],
      }));
    },
    [courseData]
  );

  const getStudentAttendance = useCallback(
    (studentId: string, courseId: string) => {
      const sessions = attendanceState[courseId]?.sessions ?? [];
      return sessions.map((session) => ({
        session,
        status: session.records[studentId] as AttendanceStatus | undefined,
      }));
    },
    [attendanceState]
  );

  return (
    <AcadenceContext.Provider
      value={{
        courseData,
        attendanceState,
        profileData,
        settingsData,
        addCourse,
        deleteCourse,
        updateCourse,
        addStudent,
        importStudents,
        updateScore,
        importGrades,
        addAssignment,
        deleteAssignment,
        updateAssignment,
        addSession,
        updateSession,
        setAttendance,
        updateAttendanceRate,
        updateProfile,
        updateSettings,
        getStudentCourses,
        getStudentScores,
        getStudentAttendance,
      }}
    >
      {children}
    </AcadenceContext.Provider>
  );
}

export function useAcadence(): AcadenceContextType {
  const ctx = useContext(AcadenceContext);
  if (!ctx) throw new Error('useAcadence must be used within AcadenceProvider');
  return ctx;
}
