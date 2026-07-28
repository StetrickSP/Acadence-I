import { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, Redirect, useLocation } from 'wouter';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';

import { AcadenceProvider } from '@/context/AcadenceContext';
import { useStudentIdentity } from '@/hooks/useStudentIdentity';

import Dashboard from '@/pages/dashboard';
import Students from '@/pages/students';
import StudentDetail from '@/pages/student-detail';
import Courses from '@/pages/courses';
import CourseDetail from '@/pages/course-detail';
import Grades from '@/pages/grades';
import Assignments from '@/pages/assignments';
import Analytics from '@/pages/analytics';
import Predictions from '@/pages/predictions';
import ImportExport from '@/pages/import-export';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import StudentPortal from '@/pages/student-portal';
import ClaimPage from '@/pages/claim';

// ── Clerk setup ────────────────────────────────────────────────────────────────

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname so the
// same build serves multiple Clerk custom domains.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev (Clerk hits dev FAPI directly), auto-set
// in prod. Do NOT gate on import.meta.env.PROD / NODE_ENV.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

// Clerk passes full paths to routerPush/routerReplace, but wouter's
// setLocation prepends the base — strip it to avoid doubling.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#0f766e',
    colorForeground: '#0f172a',
    colorMutedForeground: '#64748b',
    colorDanger: '#dc2626',
    colorBackground: '#ffffff',
    colorInput: '#f8fafc',
    colorInputForeground: '#0f172a',
    colorNeutral: '#e2e8f0',
    fontFamily: '"DM Sans", sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white shadow-lg rounded-2xl w-[440px] max-w-full overflow-hidden border border-slate-100',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-slate-900 font-bold',
    headerSubtitle: 'text-slate-500',
    socialButtonsBlockButtonText: 'text-slate-700 font-medium',
    formFieldLabel: 'text-slate-700 font-semibold text-sm',
    footerActionLink: 'text-teal-700 hover:text-teal-800 font-semibold',
    footerActionText: 'text-slate-500',
    dividerText: 'text-slate-400',
    identityPreviewEditButton: 'text-teal-700',
    formFieldSuccessText: 'text-teal-700',
    alertText: 'text-slate-700',
    logoBox: 'mb-1',
    logoImage: 'w-10 h-10',
    socialButtonsBlockButton: 'border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50',
    formButtonPrimary: 'bg-teal-700 hover:bg-teal-800 text-white font-bold',
    formFieldInput: 'border border-slate-200 bg-slate-50 text-slate-800 rounded-xl',
    footerAction: 'bg-slate-50 border-t border-slate-100',
    dividerLine: 'bg-slate-200',
    alert: 'border border-rose-200 bg-rose-50 rounded-xl',
    otpCodeFieldInput: 'border border-slate-200 bg-slate-50',
    formFieldRow: 'gap-2',
    main: 'gap-5',
  },
};

// ── QueryClient ────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// ── Clerk cache invalidator ───────────────────────────────────────────────────

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

// ── Sign-in / Sign-up pages ───────────────────────────────────────────────────

function SignInPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'rgb(248,250,252)', fontFamily: '"DM Sans", sans-serif' }}
    >
      <div className="mb-6 text-center">
        <p className="text-sm text-slate-500 mt-1">Faculty &amp; Student Portal</p>
        <span
          className="text-xs px-3 py-1 rounded-full mt-2 inline-block font-medium"
          style={{ background: 'rgb(204,251,241)', color: 'rgb(15,118,110)' }}
        >
          Semester 2 · 2025–2026
        </span>
      </div>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        appearance={clerkAppearance}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'rgb(248,250,252)', fontFamily: '"DM Sans", sans-serif' }}
    >
      <div className="mb-6 text-center">
        <p className="text-sm text-slate-500 mt-1">Faculty &amp; Student Portal</p>
      </div>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        appearance={clerkAppearance}
      />
    </div>
  );
}

// ── Route guards ───────────────────────────────────────────────────────────────

/** Root landing: signed-in → /dashboard, signed-out → Home page */
function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

/** Loading spinner for identity resolution */
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500">Loading your profile…</p>
      </div>
    </div>
  );
}

/** Smart dashboard: admin → instructor Dashboard, student → StudentPortal */
function DashboardOrPortal() {
  const identity = useStudentIdentity();

  if (identity.status === 'loading') return <LoadingScreen />;
  if (identity.status === 'unauthenticated') return <Redirect to="/" />;
  if (identity.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-sm">
          <p className="text-slate-700 font-semibold mb-2">Could not verify your profile</p>
          <p className="text-sm text-slate-500 mb-4">Please refresh the page or sign out and sign back in.</p>
          <button
            className="text-sm text-teal-700 underline"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }
  if (identity.status === 'student') return <StudentPortal />;
  // admin
  return <Dashboard />;
}

/** Instructor-only guard (any signed-in non-student) */
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const identity = useStudentIdentity();
  if (identity.status === 'loading') return <LoadingScreen />;
  if (identity.status === 'unauthenticated') return <Redirect to="/" />;
  if (identity.status === 'student') return <Redirect to="/dashboard" />;
  if (identity.status === 'error') return <Redirect to="/dashboard" />;
  return <Component />;
}

// ── Router ─────────────────────────────────────────────────────────────────────

function Router() {
  return (
    <AcadenceProvider>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        {/* Legacy /login redirect */}
        <Route path="/login" component={() => <Redirect to="/sign-in" />} />
        <Route path="/dashboard" component={DashboardOrPortal} />
        <Route path="/claim" component={ClaimPage} />
        <Route path="/students/:id" component={() => <AdminRoute component={StudentDetail} />} />
        <Route path="/students" component={() => <AdminRoute component={Students} />} />
        <Route path="/courses/:id" component={() => <AdminRoute component={CourseDetail} />} />
        <Route path="/courses" component={() => <AdminRoute component={Courses} />} />
        <Route path="/grades" component={() => <AdminRoute component={Grades} />} />
        <Route path="/assignments" component={() => <AdminRoute component={Assignments} />} />
        <Route path="/analytics" component={() => <AdminRoute component={Analytics} />} />
        <Route path="/predictions" component={() => <AdminRoute component={Predictions} />} />
        <Route path="/import-export" component={() => <AdminRoute component={ImportExport} />} />
        <Route component={NotFound} />
      </Switch>
    </AcadenceProvider>
  );
}

// ── ClerkProvider with wouter integration ──────────────────────────────────────

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <Router />
      <Toaster />
    </ClerkProvider>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
