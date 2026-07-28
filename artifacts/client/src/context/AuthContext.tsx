import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAcadence } from './AcadenceContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuthUser =
  | { role: 'teacher'; name: string; email: string }
  | { role: 'student'; studentId: string; name: string; email: string };

interface AuthContextType {
  currentUser: AuthUser | null;
  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEY = 'acadence_auth_session';

function loadSession(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

// ── Provider (must be inside AcadenceProvider) ────────────────────────────────

export function CustomAuthProvider({ children }: { children: React.ReactNode }) {
  const { courseData } = useAcadence();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(loadSession);

  const login = useCallback(
    (email: string, password: string): { ok: boolean; error?: string } => {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();

      // ── Teacher ──────────────────────────────────────────────────────────────
      if (trimmedEmail === 'teacher@gmail.com') {
        if (trimmedPassword === '1111') {
          const user: AuthUser = {
            role: 'teacher',
            name: 'Dr. Nguyen Minh Tuan',
            email: 'teacher@gmail.com',
          };
          setCurrentUser(user);
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
          return { ok: true };
        }
        return { ok: false, error: 'Incorrect password.' };
      }

      // ── Student ───────────────────────────────────────────────────────────────
      // Search all courses for the email; password = student ID
      for (const courseId of Object.keys(courseData)) {
        const course = courseData[courseId];
        const student = course.students.find(
          (s) => s.email.toLowerCase() === trimmedEmail && s.status === 'Enrolled'
        );
        if (student) {
          if (trimmedPassword === student.id) {
            const user: AuthUser = {
              role: 'student',
              studentId: student.id,
              name: student.name,
              email: student.email,
            };
            setCurrentUser(user);
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
            return { ok: true };
          }
          return {
            ok: false,
            error: 'Incorrect password. Your password is your Student ID (e.g. STU001).',
          };
        }
      }

      return {
        ok: false,
        error: 'No account found with this email. Ask your instructor to enroll you.',
      };
    },
    [courseData]
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCustomAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useCustomAuth must be used inside CustomAuthProvider');
  return ctx;
}
