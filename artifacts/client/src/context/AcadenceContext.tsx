import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type {
  CourseData, AttendanceState, ProfileData, SettingsData,
  Course, Student, Assignment, Session, AttendanceStatus,
} from '@/lib/acadence-utils';
import { computeCoursePassRate } from '@/lib/acadence-utils';

// ── API helpers ───────────────────────────────────────────────────────────────

const BASE = (import.meta.env.BASE_URL || '').replace(/\/$/, '');
const API = `${BASE}/api`;

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

/** "CS-301" → "cs301", "MATH 201" → "math201" */
function codeToKey(code: string): string {
  return code.replace(/[-\s]/g, '').toLowerCase();
}

// ── Default profile/settings (overridden by Clerk data) ───────────────────────

const INITIAL_PROFILE: ProfileData = {
  name: 'Instructor',
  avatarImg: null,
  avatarInitials: 'IN',
  office: '',
  subject: '',
};

const INITIAL_SETTINGS: SettingsData = {
  email: '',
  password: '••••••••',
};

// ── Context type ─────────────────────────────────────────────────────────────

export interface AcadenceContextType {
  courseData: CourseData;
  attendanceState: AttendanceState;
  profileData: ProfileData;
  settingsData: SettingsData;
  loading: boolean;
  error: string | null;
  refreshData: () => void;
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
  const [courseData, setCourseData] = useState<CourseData>({});
  const [attendanceState, setAttendanceState] = useState<AttendanceState>({});
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── DB ID maps (string context IDs ↔ integer DB PKs) ──────────────────────
  // courseKey ("cs301") → DB course.id
  const courseDbIdMap = useRef<Record<string, number>>({});
  // student_id string ("S001") → DB students.id
  const studentDbIdMap = useRef<Record<string, number>>({});
  // `${dbStudentId}:${dbAssignmentId}` → DB grades.id
  const gradeIdMap = useRef<Record<string, number>>({});
  // `${dbSessionId}:${dbStudentId}` → DB attendance_records.id
  const attendRecordIdMap = useRef<Record<string, number>>({});

  // ── Data loader ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/courses/full');
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const snapshot: any[] = await res.json();

      const newCourseData: CourseData = {};
      const newAttendance: AttendanceState = {};
      const newCourseDbIdMap: Record<string, number> = {};
      const newStudentDbIdMap: Record<string, number> = {};
      const newGradeIdMap: Record<string, number> = {};
      const newAttendRecordIdMap: Record<string, number> = {};

      for (const c of snapshot) {
        const key = codeToKey(c.code);
        newCourseDbIdMap[key] = c.id;

        // Build a fast lookup: dbStudentId → student_id_str
        const dbIdToStrId: Record<number, string> = {};
        for (const s of c.students) {
          dbIdToStrId[s.id] = s.student_id;
          newStudentDbIdMap[s.student_id] = s.id;
        }

        // Map assignments (weight: decimal → percentage integer)
        const assignments: Assignment[] = (c.assignments || []).map((a: any) => ({
          id: String(a.id),
          name: a.name,
          weight: Math.round(parseFloat(a.weight) * 100),
          maxPoints: parseFloat(a.max_score),
        }));

        // Build grade lookup: dbStudentId → assignmentId → score
        const gradeByStudAsgn: Record<string, number> = {};
        for (const g of (c.grades || [])) {
          const k = `${g.student_db_id}:${g.assignment_id}`;
          gradeByStudAsgn[k] = g.score;
          newGradeIdMap[`${g.student_db_id}:${g.assignment_id}`] = g.id;
        }

        // Build students
        const students: Student[] = (c.students || []).map((s: any) => {
          const scores: Record<string, number> = {};
          for (const a of assignments) {
            const gradeKey = `${s.id}:${a.id}`;
            if (gradeByStudAsgn[gradeKey] !== undefined) {
              scores[a.id] = gradeByStudAsgn[gradeKey];
            }
          }
          return {
            id: s.student_id,
            name: s.name,
            email: s.email,
            status: 'Enrolled' as const,
            scores,
          };
        });

        const mockCourse: Course = { name: c.name, instructor: c.instructor, assignments, students };
        newCourseData[key] = {
          name: c.name,
          instructor: c.instructor,
          passRate: computeCoursePassRate(mockCourse),
          attendanceRate: '—',
          nextItem: '',
          assignments,
          students,
        };

        // Build sessions with attendance records
        const sessions: Session[] = (c.sessions || []).map((s: any) => {
          const records: Record<string, AttendanceStatus> = {};
          for (const r of (s.attendance || [])) {
            const sidStr = r.student_id_str ?? dbIdToStrId[r.student_db_id];
            if (sidStr) {
              records[sidStr] = r.status as AttendanceStatus;
              newAttendRecordIdMap[`${s.id}:${r.student_db_id}`] = r.id;
            }
          }
          return {
            id: String(s.id),
            name: s.name,
            date: s.date,
            time: s.time_slot || '',
            records,
          };
        });
        newAttendance[key] = { sessions };
      }

      courseDbIdMap.current = newCourseDbIdMap;
      studentDbIdMap.current = newStudentDbIdMap;
      gradeIdMap.current = newGradeIdMap;
      attendRecordIdMap.current = newAttendRecordIdMap;

      setCourseData(newCourseData);
      setAttendanceState(newAttendance);
      setLoading(false);
    } catch (err: any) {
      console.error('[AcadenceContext] loadData error:', err);
      setError(err?.message ?? 'Failed to load data');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshData = useCallback(() => {
    loadData();
  }, [loadData]);

  // ── Helpers ───────────────────────────────────────────────────────────────────

  /** Find or create a student in the DB, returns their DB id. */
  async function ensureStudentInDb(student: Omit<Student, 'scores'>): Promise<number | null> {
    // Check cache first
    const cached = studentDbIdMap.current[student.id];
    if (cached) return cached;

    // Try to look up by student_id string
    try {
      const searchRes = await apiFetch(`/students?student_id_str=${encodeURIComponent(student.id)}`);
      if (searchRes.ok) {
        const list: any[] = await searchRes.json();
        if (list.length > 0) {
          studentDbIdMap.current[student.id] = list[0].id;
          return list[0].id;
        }
      }
    } catch {}

    // Create new student
    try {
      const createRes = await apiFetch('/students', {
        method: 'POST',
        body: JSON.stringify({
          student_id: student.id,
          name: student.name,
          email: student.email,
          year: 1,
          major: 'Undeclared',
        }),
      });
      if (createRes.ok) {
        const s = await createRes.json();
        studentDbIdMap.current[student.id] = s.id;
        return s.id;
      }
      // Conflict — search again
      const searchRes2 = await apiFetch(`/students?student_id_str=${encodeURIComponent(student.id)}`);
      if (searchRes2.ok) {
        const list2: any[] = await searchRes2.json();
        if (list2.length > 0) {
          studentDbIdMap.current[student.id] = list2[0].id;
          return list2[0].id;
        }
      }
    } catch (e) {
      console.error('[AcadenceContext] ensureStudentInDb error:', e);
    }
    return null;
  }

  // ── Course mutations ──────────────────────────────────────────────────────────

  const addCourse = useCallback((id: string, courseInit: Partial<Course>) => {
    const key = codeToKey(id);
    const defaultAssignments: Assignment[] = [
      { id: 'tmp-a1', name: 'Assignment', weight: 30, maxPoints: 100 },
      { id: 'tmp-a2', name: 'Midterm', weight: 30, maxPoints: 100 },
      { id: 'tmp-a3', name: 'Final', weight: 40, maxPoints: 100 },
    ];

    // Optimistic update
    let prevCourseData: CourseData;
    let prevAttendance: AttendanceState;
    setCourseData((prev) => {
      prevCourseData = prev;
      if (prev[key]) return prev;
      return {
        ...prev,
        [key]: {
          name: courseInit.name || '',
          instructor: courseInit.instructor || '',
          passRate: '100%',
          attendanceRate: '100%',
          nextItem: '',
          assignments: defaultAssignments,
          students: [],
        },
      };
    });
    setAttendanceState((prev) => {
      prevAttendance = prev;
      return { ...prev, [key]: { sessions: [] } };
    });

    // API call
    (async () => {
      try {
        const res = await apiFetch('/courses', {
          method: 'POST',
          body: JSON.stringify({
            code: id.toUpperCase(),
            name: courseInit.name || '',
            instructor: courseInit.instructor || '',
            credits: 3,
            semester: '2025-2',
            grading_scheme: 'weighted',
          }),
        });
        if (!res.ok) throw new Error(`Failed to create course: ${res.status}`);
        const created = await res.json();
        courseDbIdMap.current[key] = created.id;

        // Create default assignments in DB
        const dbAssignments: Assignment[] = [];
        for (const a of defaultAssignments) {
          const aRes = await apiFetch('/assignments', {
            method: 'POST',
            body: JSON.stringify({
              course_id: created.id,
              name: a.name,
              type: 'homework',
              max_score: a.maxPoints,
              weight: a.weight / 100,
            }),
          });
          if (aRes.ok) {
            const dbA = await aRes.json();
            dbAssignments.push({ id: String(dbA.id), name: dbA.name, weight: Math.round(parseFloat(dbA.weight) * 100), maxPoints: parseFloat(dbA.max_score) });
          }
        }

        // Swap tmp assignment IDs for real DB IDs
        if (dbAssignments.length > 0) {
          setCourseData((prev) => ({
            ...prev,
            [key]: { ...prev[key], assignments: dbAssignments },
          }));
        }
      } catch (e) {
        console.error('[AcadenceContext] addCourse API error:', e);
        setCourseData(prevCourseData!);
        setAttendanceState(prevAttendance!);
      }
    })();
  }, []);

  const deleteCourse = useCallback((id: string) => {
    let prevCourseData: CourseData;
    let prevAttendance: AttendanceState;

    setCourseData((prev) => {
      prevCourseData = prev;
      if (Object.keys(prev).length <= 1) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setAttendanceState((prev) => {
      prevAttendance = prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });

    const dbId = courseDbIdMap.current[id];
    if (!dbId) return;
    (async () => {
      try {
        const res = await apiFetch(`/courses/${dbId}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 204) throw new Error(`Failed to delete course: ${res.status}`);
        delete courseDbIdMap.current[id];
      } catch (e) {
        console.error('[AcadenceContext] deleteCourse API error:', e);
        setCourseData(prevCourseData!);
        setAttendanceState(prevAttendance!);
      }
    })();
  }, []);

  const updateCourse = useCallback((id: string, field: 'name' | 'instructor', value: string) => {
    let prevCourseData: CourseData;
    setCourseData((prev) => {
      prevCourseData = prev;
      return { ...prev, [id]: { ...prev[id], [field]: value } };
    });

    const dbId = courseDbIdMap.current[id];
    if (!dbId) return;
    (async () => {
      try {
        const res = await apiFetch(`/courses/${dbId}`, {
          method: 'PUT',
          body: JSON.stringify({ [field]: value }),
        });
        if (!res.ok) throw new Error(`Failed to update course: ${res.status}`);
      } catch (e) {
        console.error('[AcadenceContext] updateCourse API error:', e);
        setCourseData(prevCourseData!);
      }
    })();
  }, []);

  // ── Student mutations ─────────────────────────────────────────────────────────

  const addStudent = useCallback((courseId: string, student: Omit<Student, 'scores'>) => {
    let prevCourseData: CourseData;
    setCourseData((prev) => {
      prevCourseData = prev;
      const course = prev[courseId];
      if (!course) return prev;
      if (course.students.some((s) => s.id === student.id)) return prev;
      const scores: Record<string, number> = {};
      course.assignments.forEach((a) => { scores[a.id] = 0; });
      return {
        ...prev,
        [courseId]: { ...course, students: [...course.students, { ...student, scores }] },
      };
    });

    const dbCourseId = courseDbIdMap.current[courseId];
    (async () => {
      try {
        const dbStudentId = await ensureStudentInDb(student);
        if (!dbStudentId || !dbCourseId) throw new Error('Missing DB IDs');
        const res = await apiFetch('/enrollments', {
          method: 'POST',
          body: JSON.stringify({ student_id: dbStudentId, course_id: dbCourseId, semester: '2025-2' }),
        });
        if (!res.ok && res.status !== 409) throw new Error(`Enrollment failed: ${res.status}`);
      } catch (e) {
        console.error('[AcadenceContext] addStudent API error:', e);
        setCourseData(prevCourseData!);
      }
    })();
  }, []);

  const importStudents = useCallback(
    (courseId: string, students: Omit<Student, 'scores'>[]) => {
      let imported = 0;
      let skipped = 0;
      const logs: string[] = [];
      const toAdd: Omit<Student, 'scores'>[] = [];

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
          course.assignments.forEach((a) => { scores[a.id] = 0; });
          updatedStudents.push({ ...s, scores });
          toAdd.push(s);
          imported++;
        });
        return { ...prev, [courseId]: { ...course, students: updatedStudents } };
      });

      // Background API calls
      const dbCourseId = courseDbIdMap.current[courseId];
      if (dbCourseId) {
        (async () => {
          for (const s of toAdd) {
            try {
              const dbStudentId = await ensureStudentInDb(s);
              if (!dbStudentId) continue;
              await apiFetch('/enrollments', {
                method: 'POST',
                body: JSON.stringify({ student_id: dbStudentId, course_id: dbCourseId, semester: '2025-2' }),
              });
            } catch (e) {
              console.error('[AcadenceContext] importStudents API error for', s.id, e);
            }
          }
        })();
      }

      return { imported, skipped, logs };
    },
    []
  );

  // ── Score mutations ───────────────────────────────────────────────────────────

  const updateScore = useCallback((courseId: string, studentId: string, assignmentId: string, score: number) => {
    let prevCourseData: CourseData;
    setCourseData((prev) => {
      prevCourseData = prev;
      const course = prev[courseId];
      if (!course) return prev;
      const students = course.students.map((s) =>
        s.id === studentId ? { ...s, scores: { ...s.scores, [assignmentId]: score } } : s
      );
      return { ...prev, [courseId]: { ...course, students, passRate: computeCoursePassRate({ ...course, students }) } };
    });

    const dbStudentId = studentDbIdMap.current[studentId];
    const dbAssignmentId = parseInt(assignmentId);
    if (!dbStudentId || isNaN(dbAssignmentId)) return;

    (async () => {
      try {
        const res = await apiFetch('/grades/upsert', {
          method: 'PUT',
          body: JSON.stringify({ student_id: dbStudentId, assignment_id: dbAssignmentId, score }),
        });
        if (!res.ok) throw new Error(`Grade upsert failed: ${res.status}`);
        const g = await res.json();
        gradeIdMap.current[`${dbStudentId}:${dbAssignmentId}`] = g.id;
      } catch (e) {
        console.error('[AcadenceContext] updateScore API error:', e);
        setCourseData(prevCourseData!);
      }
    })();
  }, []);

  const importGrades = useCallback(
    (courseId: string, grades: Array<{ studentName: string; assignmentName: string; score: number }>) => {
      let imported = 0;
      let skipped = 0;
      const logs: string[] = [];
      const toUpsert: Array<{ studentId: string; assignmentId: string; score: number }> = [];

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
          toUpsert.push({ studentId: student.id, assignmentId: assignment.id, score: constrained });
          imported++;
        });
        return { ...prev, [courseId]: { ...course, students } };
      });

      // Background API calls
      (async () => {
        for (const { studentId, assignmentId, score } of toUpsert) {
          const dbStudentId = studentDbIdMap.current[studentId];
          const dbAssignmentId = parseInt(assignmentId);
          if (!dbStudentId || isNaN(dbAssignmentId)) continue;
          try {
            const res = await apiFetch('/grades/upsert', {
              method: 'PUT',
              body: JSON.stringify({ student_id: dbStudentId, assignment_id: dbAssignmentId, score }),
            });
            if (res.ok) {
              const g = await res.json();
              gradeIdMap.current[`${dbStudentId}:${dbAssignmentId}`] = g.id;
            }
          } catch (e) {
            console.error('[AcadenceContext] importGrades API error:', e);
          }
        }
      })();

      return { imported, skipped, logs };
    },
    []
  );

  // ── Assignment mutations ──────────────────────────────────────────────────────

  const addAssignment = useCallback((courseId: string, assignment: Omit<Assignment, 'id'>) => {
    const tempId = 'tmp-' + Date.now();
    let prevCourseData: CourseData;

    setCourseData((prev) => {
      prevCourseData = prev;
      const course = prev[courseId];
      if (!course) return prev;
      const students = course.students.map((s) => ({
        ...s,
        scores: { ...s.scores, [tempId]: 0 },
      }));
      return {
        ...prev,
        [courseId]: {
          ...course,
          assignments: [...course.assignments, { ...assignment, id: tempId }],
          students,
        },
      };
    });

    const dbCourseId = courseDbIdMap.current[courseId];
    if (!dbCourseId) return;

    (async () => {
      try {
        const res = await apiFetch('/assignments', {
          method: 'POST',
          body: JSON.stringify({
            course_id: dbCourseId,
            name: assignment.name,
            type: 'homework',
            max_score: assignment.maxPoints,
            weight: assignment.weight / 100,
          }),
        });
        if (!res.ok) throw new Error(`Create assignment failed: ${res.status}`);
        const dbA = await res.json();
        const realId = String(dbA.id);

        // Replace temp ID with real DB ID
        setCourseData((prev) => {
          const course = prev[courseId];
          if (!course) return prev;
          const assignments = course.assignments.map((a) =>
            a.id === tempId
              ? { id: realId, name: dbA.name, weight: Math.round(parseFloat(dbA.weight) * 100), maxPoints: parseFloat(dbA.max_score) }
              : a
          );
          const students = course.students.map((s) => {
            const scores = { ...s.scores };
            if (scores[tempId] !== undefined) {
              scores[realId] = scores[tempId];
              delete scores[tempId];
            }
            return { ...s, scores };
          });
          return { ...prev, [courseId]: { ...course, assignments, students } };
        });
      } catch (e) {
        console.error('[AcadenceContext] addAssignment API error:', e);
        setCourseData(prevCourseData!);
      }
    })();
  }, []);

  const deleteAssignment = useCallback((courseId: string, assignmentId: string) => {
    let prevCourseData: CourseData;
    setCourseData((prev) => {
      prevCourseData = prev;
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

    const dbAssignmentId = parseInt(assignmentId);
    if (isNaN(dbAssignmentId)) return;

    (async () => {
      try {
        const res = await apiFetch(`/assignments/${dbAssignmentId}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 204) throw new Error(`Delete assignment failed: ${res.status}`);
      } catch (e) {
        console.error('[AcadenceContext] deleteAssignment API error:', e);
        setCourseData(prevCourseData!);
      }
    })();
  }, []);

  const updateAssignment = useCallback((courseId: string, assignment: Assignment) => {
    let prevCourseData: CourseData;
    setCourseData((prev) => {
      prevCourseData = prev;
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

    const dbAssignmentId = parseInt(assignment.id);
    if (isNaN(dbAssignmentId)) return;

    (async () => {
      try {
        const res = await apiFetch(`/assignments/${dbAssignmentId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: assignment.name,
            max_score: assignment.maxPoints,
            weight: assignment.weight / 100,
          }),
        });
        if (!res.ok) throw new Error(`Update assignment failed: ${res.status}`);
      } catch (e) {
        console.error('[AcadenceContext] updateAssignment API error:', e);
        setCourseData(prevCourseData!);
      }
    })();
  }, []);

  // ── Attendance mutations ──────────────────────────────────────────────────────

  const addSession = useCallback((courseId: string, session: Omit<Session, 'id' | 'records'>) => {
    const tempId = 'tmp-' + Date.now();
    let prevAttendance: AttendanceState;

    setAttendanceState((prev) => {
      prevAttendance = prev;
      return {
        ...prev,
        [courseId]: {
          sessions: [...(prev[courseId]?.sessions || []), { ...session, id: tempId, records: {} }],
        },
      };
    });

    const dbCourseId = courseDbIdMap.current[courseId];
    if (!dbCourseId) return;

    (async () => {
      try {
        const res = await apiFetch('/sessions', {
          method: 'POST',
          body: JSON.stringify({
            course_id: dbCourseId,
            name: session.name,
            date: session.date,
            time_slot: session.time || '',
          }),
        });
        if (!res.ok) throw new Error(`Create session failed: ${res.status}`);
        const dbS = await res.json();
        const realId = String(dbS.id);

        // Replace temp ID with real DB ID
        setAttendanceState((prev) => ({
          ...prev,
          [courseId]: {
            sessions: (prev[courseId]?.sessions || []).map((s) =>
              s.id === tempId ? { ...s, id: realId } : s
            ),
          },
        }));
      } catch (e) {
        console.error('[AcadenceContext] addSession API error:', e);
        setAttendanceState(prevAttendance!);
      }
    })();
  }, []);

  const updateSession = useCallback(
    (courseId: string, sessionId: string, updates: { name?: string; date?: string; time?: string }) => {
      let prevAttendance: AttendanceState;
      setAttendanceState((prev) => {
        prevAttendance = prev;
        return {
          ...prev,
          [courseId]: {
            ...prev[courseId],
            sessions: (prev[courseId]?.sessions || []).map((s) =>
              s.id === sessionId ? { ...s, ...updates } : s
            ),
          },
        };
      });

      const dbSessionId = parseInt(sessionId);
      if (isNaN(dbSessionId)) return;

      (async () => {
        try {
          const res = await apiFetch(`/sessions/${dbSessionId}`, {
            method: 'PUT',
            body: JSON.stringify({ name: updates.name, date: updates.date, time_slot: updates.time }),
          });
          if (!res.ok) throw new Error(`Update session failed: ${res.status}`);
        } catch (e) {
          console.error('[AcadenceContext] updateSession API error:', e);
          setAttendanceState(prevAttendance!);
        }
      })();
    },
    []
  );

  const setAttendance = useCallback(
    (courseId: string, sessionId: string, studentId: string, status: AttendanceStatus) => {
      let prevAttendance: AttendanceState;
      setAttendanceState((prev) => {
        prevAttendance = prev;
        return {
          ...prev,
          [courseId]: {
            ...prev[courseId],
            sessions: (prev[courseId]?.sessions || []).map((s) =>
              s.id === sessionId
                ? { ...s, records: { ...s.records, [studentId]: status } }
                : s
            ),
          },
        };
      });

      const dbSessionId = parseInt(sessionId);
      const dbStudentId = studentDbIdMap.current[studentId];
      if (isNaN(dbSessionId) || !dbStudentId) return;

      (async () => {
        try {
          const res = await apiFetch(`/sessions/${dbSessionId}/attendance`, {
            method: 'POST',
            body: JSON.stringify({ student_db_id: dbStudentId, status }),
          });
          if (!res.ok) throw new Error(`Set attendance failed: ${res.status}`);
          const r = await res.json();
          attendRecordIdMap.current[`${dbSessionId}:${dbStudentId}`] = r.id;
        } catch (e) {
          console.error('[AcadenceContext] setAttendance API error:', e);
          setAttendanceState(prevAttendance!);
        }
      })();
    },
    []
  );

  const updateAttendanceRate = useCallback(
    (courseId: string) => {
      setAttendanceState((prev) => {
        const sessions = prev[courseId]?.sessions || [];
        setCourseData((prev2) => {
          const students = prev2[courseId]?.students || [];
          if (!students.length || !sessions.length) return prev2;
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
          return { ...prev2, [courseId]: { ...prev2[courseId], attendanceRate: newRate } };
        });
        return prev;
      });
    },
    []
  );

  // ── Profile mutations ─────────────────────────────────────────────────────────

  const updateProfile = useCallback((updates: Partial<ProfileData>) => {
    setProfileData((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateSettings = useCallback((updates: Partial<SettingsData>) => {
    setSettingsData((prev) => ({ ...prev, ...updates }));
  }, []);

  // ── Student read helpers ──────────────────────────────────────────────────────

  const getStudentCourses = useCallback(
    (studentId: string) =>
      Object.entries(courseData)
        .filter(([, course]) =>
          course.students.some((s) => s.id === studentId && s.status === 'Enrolled')
        )
        .map(([cId, course]) => ({ courseId: cId, course })),
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
        loading,
        error,
        refreshData,
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
