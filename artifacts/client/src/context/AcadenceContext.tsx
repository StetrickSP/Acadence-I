import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type {
  CourseData, AttendanceState, ProfileData, SettingsData,
  Course, Student, Assignment, Session, AttendanceStatus,
} from '@/lib/acadence-utils';
import { computeCoursePassRate } from '@/lib/acadence-utils';

// ── API helpers ────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, '');
const API = `${BASE_URL}/api`;

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  // Dashboard routes (/courses, /grades, /assignments, /sessions, /enrollments, /students)
  // are public — no auth header required.  The X-Demo-Auth bypass in require_auth is a
  // server-side-only mechanism for future protected routes; the key must never be embedded
  // in the client bundle.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  return fetch(`${API}${path}`, { ...options, headers });
}

// ── DB ID tracking (mutable ref — not state, to avoid extra renders) ───────────

interface DbIds {
  /** courseKey (e.g. "cs301") → numeric course DB id */
  courses: Record<string, number>;
  /** student_id_str (e.g. "STU001") → numeric student DB id */
  students: Record<string, number>;
  /** courseKey → { frontendAssignmentId → numeric assignment DB id } */
  assignments: Record<string, Record<string, number>>;
  /** courseKey → { frontendSessionId → numeric session DB id } */
  sessions: Record<string, Record<string, number>>;
  /** courseKey → semester string (needed for enrollment) */
  semester: Record<string, string>;
}

// ── Initial / empty state ─────────────────────────────────────────────────────

const EMPTY_COURSE_DATA: CourseData = {};
const EMPTY_ATTENDANCE: AttendanceState = {};

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

const PROFILE_STORAGE_KEY = 'acadence_profile';

// ── Context type ──────────────────────────────────────────────────────────────

export interface AcadenceContextType {
  courseData: CourseData;
  attendanceState: AttendanceState;
  profileData: ProfileData;
  settingsData: SettingsData;
  // Loading state (true while initial fetch is in progress)
  isLoading: boolean;
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

// ── Context ───────────────────────────────────────────────────────────────────

const AcadenceContext = createContext<AcadenceContextType | null>(null);

// ── Helpers to parse /courses/full response ────────────────────────────────────

function parseFullResponse(data: { courses: any[] }): {
  courseData: CourseData;
  attendanceState: AttendanceState;
  dbIds: DbIds;
} {
  const courseData: CourseData = {};
  const attendanceState: AttendanceState = {};
  const dbIds: DbIds = {
    courses: {},
    students: {},
    assignments: {},
    sessions: {},
    semester: {},
  };

  for (const c of data.courses) {
    const key: string = c.code.toLowerCase();
    dbIds.courses[key] = c.db_id;
    dbIds.semester[key] = c.semester || '2026-Fall';
    dbIds.assignments[key] = {};
    dbIds.sessions[key] = {};

    const assignments: Assignment[] = c.assignments.map((a: any) => {
      const frontendId = `a${a.id}`;
      dbIds.assignments[key][frontendId] = a.id;
      return {
        id: frontendId,
        name: a.name,
        weight: a.weight,
        maxPoints: a.maxPoints,
      };
    });

    const students: Student[] = c.students.map((s: any) => {
      dbIds.students[s.id] = s.db_id;
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        status: (s.status || 'Enrolled') as Student['status'],
        scores: s.scores || {},
      };
    });

    const sessions: Session[] = c.sessions.map((sess: any) => {
      dbIds.sessions[key][sess.id] = sess.db_id;
      return {
        id: sess.id,
        name: sess.name,
        date: sess.date,
        time: sess.time,
        records: sess.records || {},
      };
    });

    courseData[key] = {
      name: c.name,
      instructor: c.instructor,
      passRate: computeCoursePassRate({ assignments, students }),
      attendanceRate: '100%',
      nextItem: '',
      assignments,
      students,
    };

    attendanceState[key] = { sessions };
  }

  return { courseData, attendanceState, dbIds };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AcadenceProvider({
  children,
  initialProfileName,
  initialSettingsEmail,
}: {
  children: React.ReactNode;
  initialProfileName?: string;
  initialSettingsEmail?: string;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [courseData, setCourseData] = useState<CourseData>(EMPTY_COURSE_DATA);
  const [attendanceState, setAttendanceState] = useState<AttendanceState>(EMPTY_ATTENDANCE);

  // Profile: persist in localStorage since there is no backend profile endpoint yet.
  const [profileData, setProfileData] = useState<ProfileData>(() => {
    try {
      const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (stored) return JSON.parse(stored) as ProfileData;
    } catch { /* ignore */ }
    const base = INITIAL_PROFILE;
    if (initialProfileName) {
      return {
        ...base,
        name: initialProfileName,
        avatarInitials: initialProfileName.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase(),
      };
    }
    return base;
  });

  const [settingsData, setSettingsData] = useState<SettingsData>({
    ...INITIAL_SETTINGS,
    email: initialSettingsEmail || INITIAL_SETTINGS.email,
  });

  // Mutable ref for DB ID mappings — updated on load and on every mutation
  const dbIdsRef = useRef<DbIds>({
    courses: {},
    students: {},
    assignments: {},
    sessions: {},
    semester: {},
  });

  // ── Initial data load ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiFetch('/courses/full')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const { courseData: cd, attendanceState: at, dbIds } = parseFullResponse(data);
        setCourseData(cd);
        setAttendanceState(at);
        dbIdsRef.current = dbIds;
      })
      .catch((err) => {
        console.error('[AcadenceContext] Failed to load courses/full:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Course mutations ────────────────────────────────────────────────────────

  const addCourse = useCallback((id: string, courseInit: Partial<Course>) => {
    const key = id.toLowerCase().trim();
    const body = {
      code: key,
      name: courseInit.name || '',
      credits: 3,
      semester: '2026-Fall',
      instructor: courseInit.instructor || '',
      description: '',
      grading_scheme: 'weighted',
    };
    apiFetch('/courses', { method: 'POST', body: JSON.stringify(body) })
      .then((r) => r.json())
      .then((newCourse) => {
        dbIdsRef.current.courses[key] = newCourse.id;
        dbIdsRef.current.semester[key] = newCourse.semester;
        dbIdsRef.current.assignments[key] = {};
        dbIdsRef.current.sessions[key] = {};
        setCourseData((prev) => {
          if (prev[key]) return prev;
          return {
            ...prev,
            [key]: {
              name: newCourse.name,
              instructor: newCourse.instructor || '',
              passRate: '100%',
              attendanceRate: '100%',
              nextItem: '',
              assignments: [],
              students: [],
            },
          };
        });
        setAttendanceState((prev) => ({ ...prev, [key]: { sessions: [] } }));
      })
      .catch((err) => console.error('[addCourse] API error:', err));
  }, []);

  const deleteCourse = useCallback((id: string) => {
    // Guard: never delete the last course — check before touching state or the DB.
    const currentKeys = Object.keys(courseData);
    if (currentKeys.length <= 1) return;

    const dbId = dbIdsRef.current.courses[id];
    if (dbId) {
      apiFetch(`/courses/${dbId}`, { method: 'DELETE' })
        .catch((err) => console.error('[deleteCourse] API error:', err));
    }
    setCourseData((prev) => {
      if (Object.keys(prev).length <= 1) return prev; // double-check inside setter
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setAttendanceState((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    // Clean up dbIds
    delete dbIdsRef.current.courses[id];
    delete dbIdsRef.current.assignments[id];
    delete dbIdsRef.current.sessions[id];
    delete dbIdsRef.current.semester[id];
  }, [courseData]);

  const updateCourse = useCallback((id: string, field: 'name' | 'instructor', value: string) => {
    const dbId = dbIdsRef.current.courses[id];
    if (dbId) {
      apiFetch(`/courses/${dbId}`, {
        method: 'PUT',
        body: JSON.stringify({ [field]: value }),
      }).catch((err) => console.error('[updateCourse] API error:', err));
    }
    setCourseData((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }, []);

  // ── Student mutations ───────────────────────────────────────────────────────

  const addStudent = useCallback((courseId: string, student: Omit<Student, 'scores'>) => {
    const courseDbId = dbIdsRef.current.courses[courseId];
    const semester = dbIdsRef.current.semester[courseId] || '2026-Fall';

    // Step 1: find existing student or create a new one (idempotent)
    const studentBody = {
      name: student.name,
      email: student.email,
      student_id: student.id,
      year: 1,
      major: 'Undeclared',
    };
    apiFetch('/students/find-or-create', { method: 'POST', body: JSON.stringify(studentBody) })
      .then((r) => r.json())
      .then((s: any) => {
        const studentDbId: number = s.id;
        if (!studentDbId || !courseDbId) return;
        dbIdsRef.current.students[student.id] = studentDbId;
        // Step 2: enroll (idempotent — safe if already enrolled)
        return apiFetch('/enrollments', {
          method: 'POST',
          body: JSON.stringify({ student_id: studentDbId, course_id: courseDbId, semester }),
        });
      })
      .catch((err) => console.error('[addStudent] API error:', err));

    // Optimistic local state update
    setCourseData((prev) => {
      const course = prev[courseId];
      if (!course) return prev;
      if (course.students.some((s) => s.id === student.id)) return prev;
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

      // Compute result synchronously from current state, fire API in background
      setCourseData((prev) => {
        const course = prev[courseId];
        if (!course) return prev;
        const updatedStudents = [...course.students];
        const toAdd: Omit<Student, 'scores'>[] = [];
        students.forEach((s, rowIndex) => {
          const exists = updatedStudents.some((ex) => ex.id === s.id);
          if (exists) {
            skipped++;
            logs.push(`Row ${rowIndex + 2}: Student ID '${s.id}' already enrolled.`);
            return;
          }
          const scores: Record<string, number> = {};
          course.assignments.forEach((a) => { scores[a.id] = 0; });
          updatedStudents.push({ ...s, scores });
          toAdd.push(s);
          imported++;
        });

        // Fire API calls for each new student in the background
        const courseDbId = dbIdsRef.current.courses[courseId];
        const semester = dbIdsRef.current.semester[courseId] || '2026-Fall';
        toAdd.forEach((s) => {
          // Use find-or-create so re-importing the same student_id is safe
          apiFetch('/students/find-or-create', {
            method: 'POST',
            body: JSON.stringify({ name: s.name, email: s.email, student_id: s.id, year: 1, major: 'Undeclared' }),
          })
            .then((r) => r.json())
            .then((found: any) => {
              const studentDbId: number = found.id;
              if (!studentDbId || !courseDbId) return;
              dbIdsRef.current.students[s.id] = studentDbId;
              // Enrollment is idempotent — safe even if already enrolled
              return apiFetch('/enrollments', {
                method: 'POST',
                body: JSON.stringify({ student_id: studentDbId, course_id: courseDbId, semester }),
              });
            })
            .catch((err) => console.error('[importStudents] API error:', err));
        });

        return { ...prev, [courseId]: { ...course, students: updatedStudents } };
      });

      return { imported, skipped, logs };
    },
    []
  );

  // ── Score mutations ─────────────────────────────────────────────────────────

  const updateScore = useCallback(
    (courseId: string, studentId: string, assignmentId: string, score: number) => {
      const studentDbId = dbIdsRef.current.students[studentId];
      const assignmentDbId = dbIdsRef.current.assignments[courseId]?.[assignmentId];
      if (studentDbId && assignmentDbId) {
        apiFetch('/grades/upsert', {
          method: 'POST',
          body: JSON.stringify({ student_id: studentDbId, assignment_id: assignmentDbId, score }),
        }).catch((err) => console.error('[updateScore] API error:', err));
      }
      setCourseData((prev) => {
        const course = prev[courseId];
        if (!course) return prev;
        const students = course.students.map((s) =>
          s.id === studentId ? { ...s, scores: { ...s.scores, [assignmentId]: score } } : s
        );
        const passRate = computeCoursePassRate({ ...course, students });
        return { ...prev, [courseId]: { ...course, students, passRate } };
      });
    },
    []
  );

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

          // Fire API in background
          const studentDbId = dbIdsRef.current.students[student.id];
          const assignmentDbId = dbIdsRef.current.assignments[courseId]?.[assignment.id];
          if (studentDbId && assignmentDbId) {
            apiFetch('/grades/upsert', {
              method: 'POST',
              body: JSON.stringify({ student_id: studentDbId, assignment_id: assignmentDbId, score: constrained }),
            }).catch((err) => console.error('[importGrades] API error:', err));
          }
        });
        return { ...prev, [courseId]: { ...course, students } };
      });

      return { imported, skipped, logs };
    },
    []
  );

  // ── Assignment mutations ────────────────────────────────────────────────────

  const addAssignment = useCallback((courseId: string, assignment: Omit<Assignment, 'id'>) => {
    const courseDbId = dbIdsRef.current.courses[courseId];
    if (!courseDbId) {
      // Optimistic only (no DB id yet — shouldn't happen after load)
      const newId = 'a' + Date.now();
      setCourseData((prev) => {
        const course = prev[courseId];
        if (!course) return prev;
        const students = course.students.map((s) => ({ ...s, scores: { ...s.scores, [newId]: 0 } }));
        return { ...prev, [courseId]: { ...course, assignments: [...course.assignments, { ...assignment, id: newId }], students } };
      });
      return;
    }
    const body = {
      course_id: courseDbId,
      name: assignment.name,
      type: 'assignment',
      max_score: assignment.maxPoints,
      // DB stores weight as a 0–1 fraction; dashboard uses whole percentages → divide by 100.
      weight: assignment.weight / 100,
    };
    apiFetch('/assignments', { method: 'POST', body: JSON.stringify(body) })
      .then((r) => r.json())
      .then((newA: any) => {
        const frontendId = `a${newA.id}`;
        if (!dbIdsRef.current.assignments[courseId]) dbIdsRef.current.assignments[courseId] = {};
        dbIdsRef.current.assignments[courseId][frontendId] = newA.id;
        setCourseData((prev) => {
          const course = prev[courseId];
          if (!course) return prev;
          const students = course.students.map((s) => ({ ...s, scores: { ...s.scores, [frontendId]: 0 } }));
          return {
            ...prev,
            [courseId]: {
              ...course,
              // API returns weight as fraction → convert back to percentage for the frontend.
              assignments: [...course.assignments, { id: frontendId, name: newA.name, weight: Math.round(newA.weight * 100), maxPoints: newA.max_score }],
              students,
            },
          };
        });
      })
      .catch((err) => console.error('[addAssignment] API error:', err));
  }, []);

  const deleteAssignment = useCallback((courseId: string, assignmentId: string) => {
    const dbId = dbIdsRef.current.assignments[courseId]?.[assignmentId];
    if (dbId) {
      apiFetch(`/assignments/${dbId}`, { method: 'DELETE' })
        .catch((err) => console.error('[deleteAssignment] API error:', err));
      delete dbIdsRef.current.assignments[courseId][assignmentId];
    }
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
    const dbId = dbIdsRef.current.assignments[courseId]?.[assignment.id];
    if (dbId) {
      apiFetch(`/assignments/${dbId}`, {
        method: 'PUT',
        // DB stores weight as 0–1 fraction; dashboard value is a whole percentage → divide.
        body: JSON.stringify({ name: assignment.name, weight: assignment.weight / 100, max_score: assignment.maxPoints }),
      }).catch((err) => console.error('[updateAssignment] API error:', err));
    }
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
    const courseDbId = dbIdsRef.current.courses[courseId];
    if (!courseDbId) return;
    apiFetch('/sessions', {
      method: 'POST',
      body: JSON.stringify({ course_id: courseDbId, name: session.name, date: session.date, time: session.time }),
    })
      .then((r) => r.json())
      .then((newS: any) => {
        const frontendId = `s${newS.id}`;
        if (!dbIdsRef.current.sessions[courseId]) dbIdsRef.current.sessions[courseId] = {};
        dbIdsRef.current.sessions[courseId][frontendId] = newS.id;
        setAttendanceState((prev) => ({
          ...prev,
          [courseId]: {
            sessions: [
              ...(prev[courseId]?.sessions || []),
              { id: frontendId, name: newS.name, date: newS.date, time: newS.time, records: {} },
            ],
          },
        }));
      })
      .catch((err) => console.error('[addSession] API error:', err));
  }, []);

  const updateSession = useCallback(
    (courseId: string, sessionId: string, updates: { name?: string; date?: string; time?: string }) => {
      const dbId = dbIdsRef.current.sessions[courseId]?.[sessionId];
      if (dbId) {
        apiFetch(`/sessions/${dbId}`, { method: 'PUT', body: JSON.stringify(updates) })
          .catch((err) => console.error('[updateSession] API error:', err));
      }
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
      const sessionDbId = dbIdsRef.current.sessions[courseId]?.[sessionId];
      const studentDbId = dbIdsRef.current.students[studentId];
      if (sessionDbId && studentDbId) {
        apiFetch('/attendance', {
          method: 'POST',
          body: JSON.stringify({ session_id: sessionDbId, student_db_id: studentDbId, status }),
        }).catch((err) => console.error('[setAttendance] API error:', err));
      }
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
    setProfileData((prev) => {
      const next = { ...prev, ...updates };
      try { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
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
        isLoading,
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
