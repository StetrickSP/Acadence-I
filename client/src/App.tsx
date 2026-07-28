import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, Redirect, useLocation } from 'wouter';
import { ClerkProvider, SignIn, SignUp, Show } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';

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
import Home from '@/pages/home';
import NotFound from '@/pages/not-found';
import Portal from '@/pages/portal';
import Claim from '@/pages/claim';
import { useStudentIdentity } from '@/hooks/useStudentIdentity';

// REQUIRED — copy verbatim per Clerk skill
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — empty in dev, auto-set in prod
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

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
    colorPrimary: 'hsl(221 83% 53%)',
    colorForeground: 'hsl(222 47% 11%)',
    colorMutedForeground: 'hsl(215 16% 47%)',
    colorDanger: 'hsl(0 84% 60%)',
    colorBackground: 'hsl(0 0% 100%)',
    colorInput: 'hsl(210 40% 96%)',
    colorInputForeground: 'hsl(222 47% 11%)',
    colorNeutral: 'hsl(214 32% 91%)',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.5rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg',
    card: '!bg-transparent',
    footer: '!bg-transparent',
    headerTitle: 'text-gray-900 font-bold',
    headerSubtitle: 'text-gray-500',
    formFieldLabel: 'text-gray-700',
    formFieldInput: 'border-gray-200 bg-gray-50 text-gray-900',
    socialButtonsBlockButtonText: 'text-gray-700 font-medium',
    footerActionLink: 'text-blue-600 hover:text-blue-700',
    footerActionText: 'text-gray-500',
    dividerText: 'text-gray-400',
  },
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

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

/**
 * Smart dashboard entry point: students see the portal, admins see the full dashboard.
 * Fails closed — identity errors show a retry screen rather than granting admin access.
 */
function DashboardOrPortal() {
  const identity = useStudentIdentity();

  if (identity.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }
  if (identity.status === 'unauthenticated') {
    return <Redirect to="/" />;
  }
  if (identity.status === 'error') {
    // Fail closed: don't grant admin access on unknown errors — show a retry prompt
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6 text-center">
        <p className="text-muted-foreground text-sm">Unable to verify your account. Please refresh and try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm font-medium text-primary hover:underline"
        >
          Refresh
        </button>
      </div>
    );
  }
  if (identity.status === 'student') {
    return <Portal profile={identity.profile} />;
  }
  // explicit admin signal — show dashboard with a claim-account nudge
  return (
    <>
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2.5 flex items-center justify-between gap-4 text-sm">
        <span className="text-blue-700">
          Not seeing your student portal?
        </span>
        <a
          href={`${basePath}/claim`}
          className="font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-2 shrink-0"
        >
          Claim your student account →
        </a>
      </div>
      <Dashboard />
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Component />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

/**
 * Admin-only route: fail closed on any non-admin identity.
 * Students → /dashboard. Error/unknown → /dashboard (never grant admin by default).
 */
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const identity = useStudentIdentity();
  if (identity.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }
  // Fail closed: unauthenticated, student, and error all get redirected away
  if (identity.status === 'unauthenticated') return <Redirect to="/" />;
  if (identity.status === 'student') return <Redirect to="/dashboard" />;
  if (identity.status === 'error') return <Redirect to="/dashboard" />;
  // Only explicit admin signal passes through
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={() => (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} fallbackRedirectUrl={`${basePath}/dashboard`} />
        </div>
      )} />
      <Route path="/sign-up/*?" component={() => (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} fallbackRedirectUrl={`${basePath}/dashboard`} />
        </div>
      )} />
      <Route path="/dashboard" component={() => (
        <Show when="signed-in" fallback={<Redirect to="/" />}>
          <DashboardOrPortal />
        </Show>
      )} />
      <Route path="/students/:id" component={() => <AdminRoute component={StudentDetail} />} />
      <Route path="/students" component={() => <AdminRoute component={Students} />} />
      <Route path="/courses/:id" component={() => <AdminRoute component={CourseDetail} />} />
      <Route path="/courses" component={() => <AdminRoute component={Courses} />} />
      <Route path="/grades" component={() => <AdminRoute component={Grades} />} />
      <Route path="/assignments" component={() => <AdminRoute component={Assignments} />} />
      <Route path="/analytics" component={() => <AdminRoute component={Analytics} />} />
      <Route path="/predictions" component={() => <AdminRoute component={Predictions} />} />
      <Route path="/import-export" component={() => <AdminRoute component={ImportExport} />} />
      <Route path="/claim" component={() => (
        <Show when="signed-in" fallback={<Redirect to="/sign-in" />}>
          <Claim />
        </Show>
      )} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => { window.history.pushState(null, '', to); window.dispatchEvent(new PopStateEvent('popstate')); }}
      routerReplace={(to) => { window.history.replaceState(null, '', to); window.dispatchEvent(new PopStateEvent('popstate')); }}
      appearance={clerkAppearance}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
