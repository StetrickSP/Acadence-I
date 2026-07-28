import { useState } from 'react';
import { useClerk } from '@clerk/react';
import { useLocation } from 'wouter';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const apiBase = `${basePath}/api`;
export const ROLE_SESSION_KEY = 'acadence_role';

// ── Icons ────────────────────────────────────────────────────────────────────

function InstructorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
    </svg>
  );
}

function StudentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6 text-red-500">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  );
}

// ── RolePicker ───────────────────────────────────────────────────────────────

type PageState = 'pick' | 'checking' | 'not_registered' | 'clerk_down' | 'error';

export default function RolePickerPage() {
  const [state, setState] = useState<PageState>('pick');
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  function chooseInstructor() {
    sessionStorage.setItem(ROLE_SESSION_KEY, 'instructor');
    setLocation('/dashboard');
  }

  async function chooseStudent() {
    setState('checking');
    try {
      const res = await fetch(`${apiBase}/me/profile`, { credentials: 'include' });
      if (res.ok) {
        const body = await res.json();
        if (body?.role === 'student') {
          sessionStorage.setItem(ROLE_SESSION_KEY, 'student');
          setLocation('/dashboard');
          return;
        }
      }
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (body?.isAdmin === true) { setState('not_registered'); return; }
      }
      if (res.status === 503) {
        const body = await res.json().catch(() => ({}));
        if (body?.clerkLookupFailed === true) { setState('clerk_down'); return; }
      }
      setState('error');
    } catch {
      setState('error');
    }
  }

  function handleBack() {
    sessionStorage.removeItem(ROLE_SESSION_KEY);
    signOut(() => setLocation('/'));
  }

  // ── Not registered ──────────────────────────────────────────────────────────
  if (state === 'not_registered') {
    return (
      <Shell>
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg border border-slate-100 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertIcon />
          </div>
          <h2 className="text-slate-900 font-bold text-lg mb-2">Account not registered</h2>
          <p className="text-slate-500 text-sm mb-6">
            This account hasn't been registered as a student.
            Please contact your instructor to be added to a course.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setState('pick')}
              className="w-full py-2 px-4 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Choose a different role
            </button>
            <button
              onClick={handleBack}
              className="text-sm text-teal-700 hover:text-teal-800 font-medium underline underline-offset-2 mt-1"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Clerk API temporarily down ──────────────────────────────────────────────
  if (state === 'clerk_down') {
    return (
      <Shell>
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg border border-slate-100 p-8 text-center">
          <h2 className="text-slate-900 font-bold text-lg mb-2">Verification temporarily unavailable</h2>
          <p className="text-slate-500 text-sm mb-6">
            We couldn't verify your account right now. Please wait a moment and try again.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setState('pick')}
              className="w-full py-2 px-4 rounded-xl bg-teal-700 text-white text-sm font-bold hover:bg-teal-800 transition-colors"
            >
              Try again
            </button>
            <button
              onClick={handleBack}
              className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2 mt-1"
            >
              Sign out
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <Shell>
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg border border-slate-100 p-8 text-center">
          <h2 className="text-slate-900 font-bold text-lg mb-2">Something went wrong</h2>
          <p className="text-slate-500 text-sm mb-6">
            Could not verify your account. Please try again.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setState('pick')}
              className="w-full py-2 px-4 rounded-xl bg-teal-700 text-white text-sm font-bold hover:bg-teal-800 transition-colors"
            >
              Try again
            </button>
            <button
              onClick={handleBack}
              className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2 mt-1"
            >
              Sign out
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Role picker ─────────────────────────────────────────────────────────────
  const isChecking = state === 'checking';

  return (
    <Shell>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h1>
          <p className="text-slate-500 text-sm">How would you like to sign in today?</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Instructor card */}
          <button
            onClick={chooseInstructor}
            disabled={isChecking}
            className="group flex flex-col items-center gap-3 bg-white rounded-2xl border-2 border-slate-200 hover:border-teal-500 p-6 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-14 h-14 rounded-2xl bg-teal-50 group-hover:bg-teal-100 flex items-center justify-center text-teal-700 transition-colors">
              <InstructorIcon />
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-900 text-sm">Instructor</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">Manage courses &amp; grades</p>
            </div>
          </button>

          {/* Student card */}
          <button
            onClick={chooseStudent}
            disabled={isChecking}
            className="group flex flex-col items-center gap-3 bg-white rounded-2xl border-2 border-slate-200 hover:border-teal-500 p-6 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
          >
            {isChecking && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-2xl">
                <div className="w-5 h-5 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
              </div>
            )}
            <div className="w-14 h-14 rounded-2xl bg-teal-50 group-hover:bg-teal-100 flex items-center justify-center text-teal-700 transition-colors">
              <StudentIcon />
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-900 text-sm">Student</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">View your grades &amp; courses</p>
            </div>
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={handleBack}
            className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
          >
            Sign out and use a different account
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ── Layout shell ─────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'rgb(248,250,252)', fontFamily: '"DM Sans", sans-serif' }}
    >
      {/* Branding strip */}
      <div className="mb-8 text-center">
        <p className="text-sm text-slate-500">Faculty &amp; Student Portal</p>
        <span
          className="text-xs px-3 py-1 rounded-full mt-2 inline-block font-medium"
          style={{ background: 'rgb(204,251,241)', color: 'rgb(15,118,110)' }}
        >
          Semester 2 · 2025–2026
        </span>
      </div>
      {children}
    </div>
  );
}
