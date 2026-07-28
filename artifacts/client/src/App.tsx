import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, Redirect, useLocation } from 'wouter';

import { AcadenceProvider } from '@/context/AcadenceContext';
import { CustomAuthProvider, useCustomAuth } from '@/context/AuthContext';

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
import LoginPage from '@/pages/login';
import StudentPortal from '@/pages/student-portal';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// ── Route guards ───────────────────────────────────────────────────────────────

/** The root landing: if logged in → /dashboard, else → /login */
function RootRedirect() {
  const { currentUser } = useCustomAuth();
  return <Redirect to={currentUser ? '/dashboard' : '/login'} />;
}

/** Smart dashboard: teacher → Dashboard, student → StudentPortal, guest → /login */
function DashboardOrPortal() {
  const { currentUser } = useCustomAuth();
  if (!currentUser) return <Redirect to="/login" />;
  if (currentUser.role === 'student') return <StudentPortal />;
  return <Dashboard />;
}

/** Teacher-only guard */
function TeacherRoute({ component: Component }: { component: React.ComponentType }) {
  const { currentUser } = useCustomAuth();
  if (!currentUser) return <Redirect to="/login" />;
  if (currentUser.role !== 'teacher') return <Redirect to="/dashboard" />;
  return <Component />;
}

// ── Router ─────────────────────────────────────────────────────────────────────

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/login" component={LoginPage} />
      <Route path="/dashboard" component={DashboardOrPortal} />
      <Route path="/students/:id" component={() => <TeacherRoute component={StudentDetail} />} />
      <Route path="/students" component={() => <TeacherRoute component={Students} />} />
      <Route path="/courses/:id" component={() => <TeacherRoute component={CourseDetail} />} />
      <Route path="/courses" component={() => <TeacherRoute component={Courses} />} />
      <Route path="/grades" component={() => <TeacherRoute component={Grades} />} />
      <Route path="/assignments" component={() => <TeacherRoute component={Assignments} />} />
      <Route path="/analytics" component={() => <TeacherRoute component={Analytics} />} />
      <Route path="/predictions" component={() => <TeacherRoute component={Predictions} />} />
      <Route path="/import-export" component={() => <TeacherRoute component={ImportExport} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AcadenceProvider>
          <CustomAuthProvider>
            <WouterRouter base={basePath}>
              <Router />
            </WouterRouter>
            <Toaster />
          </CustomAuthProvider>
        </AcadenceProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
