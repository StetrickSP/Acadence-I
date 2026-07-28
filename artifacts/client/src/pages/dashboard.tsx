import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useUser, useClerk } from '@clerk/react';
import {
  Home, User, Menu, X, ChevronLeft, ChevronRight,
  LogOut, Sun, Moon, GraduationCap,
} from 'lucide-react';
import { HomeView } from '@/components/acadence/HomeView';
import { CourseView } from '@/components/acadence/CourseView';
import { ProfileView } from '@/components/acadence/ProfileView';
import { getInitials, type AppView } from '@/lib/acadence-utils';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  currentView: AppView;
  setCurrentView: (v: AppView) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  displayName: string;
  displayEmail: string;
  displayInitials: string;
  avatarImg: string | null;
  onSignOut: () => void;
}

function Sidebar({
  currentView, setCurrentView,
  collapsed, setCollapsed,
  mobileOpen, setMobileOpen,
  darkMode, setDarkMode,
  displayName, displayEmail, displayInitials, avatarImg,
  onSignOut,
}: SidebarProps) {
  const [profileDropOpen, setProfileDropOpen] = useState(false);

  const navItem = (view: AppView, Icon: React.ComponentType<{ className?: string }>, label: string) => (
    <button
      type="button"
      key={view}
      className={`nav-item ${currentView === view ? 'active' : ''}`}
      aria-current={currentView === view ? 'page' : undefined}
      onClick={() => { setCurrentView(view); setMobileOpen(false); }}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[59] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'open' : ''}`}
        aria-label="Primary navigation"
      >
        {/* Collapse button (desktop) */}
        <button
          type="button"
          className="hidden md:flex absolute -right-3 top-8 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm items-center justify-center text-slate-500 hover:text-teal-700 hover:border-teal-400 transition-colors z-20"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Mobile close */}
        <button
          type="button"
          className="md:hidden absolute top-4 right-4 text-slate-300 hover:text-white p-1"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo */}
        <div className={`px-3 pt-6 pb-5 border-b border-slate-700/50 ${collapsed ? 'flex justify-center' : ''}`}>
          <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-xl bg-teal-500 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="heading-font font-bold text-white text-base leading-none">Acadence</p>
                <p className="text-slate-400 text-[10px] mt-0.5 truncate">Faculty workspace</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <p className="mt-4 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Semester 2 · 2025–2026
            </p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Sidebar navigation">
          {!collapsed && (
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-2">Workspace</p>
          )}
          {navItem('home', Home, 'Home')}
          {navItem('profile', User, 'Profile')}
        </nav>

        {/* Hint card (only when expanded) */}
        {!collapsed && (
          <div className="mx-3 mb-4 p-3 bg-teal-900/40 border border-teal-700/30 rounded-xl text-xs text-teal-200">
            <p className="font-semibold text-teal-100 mb-0.5">Tips for grades</p>
            <p className="text-teal-300 leading-relaxed text-[10px]">Click any course card on the Home page to open its gradebook and attendance tracker.</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-3 pb-5 border-t border-slate-700/50 pt-4 space-y-2">
          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className={`nav-item w-full ${collapsed ? 'justify-center' : ''}`}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {!collapsed && <span className="truncate">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          {/* User profile */}
          <div className="relative">
            <button
              type="button"
              className={`nav-item w-full ${collapsed ? 'justify-center' : ''}`}
              onClick={() => setProfileDropOpen((prev) => !prev)}
              aria-expanded={profileDropOpen}
              aria-haspopup="menu"
            >
              <div className="w-5 h-5 rounded-full bg-teal-400 text-slate-900 flex items-center justify-center font-bold text-[9px] shrink-0 overflow-hidden">
                {avatarImg ? (
                  <img src={avatarImg} alt="" className="w-full h-full object-cover" />
                ) : (
                  displayInitials
                )}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-white text-xs font-semibold truncate">{displayName}</p>
                  <p className="text-slate-400 text-[10px] truncate">{displayEmail}</p>
                </div>
              )}
            </button>
            {profileDropOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-[95]">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-300 hover:bg-slate-700 hover:text-white text-xs transition-colors"
                  onClick={() => { onSignOut(); setProfileDropOpen(false); }}
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, navigate] = useLocation();

  const [currentView, setCurrentView] = useState<AppView>('home');
  const [selectedCourse, setSelectedCourse] = useState<string>('cs301');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Clerk user info
  const displayName =
    user?.fullName ||
    user?.firstName ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'Faculty User';
  const displayEmail = user?.primaryEmailAddress?.emailAddress || 'faculty@university.edu';
  const displayInitials = getInitials(displayName);
  const avatarImg = user?.imageUrl || null;

  // Sync dark mode to body class (as the Canva HTML prototype does)
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    return () => document.body.classList.remove('dark-mode');
  }, [darkMode]);

  const openCourse = (courseId: string) => {
    setSelectedCourse(courseId);
    setCurrentView('course');
    setMobileOpen(false);
  };

  const handleSignOut = () => {
    signOut({ redirectUrl: basePath || '/' });
  };

  return (
    <div className={`w-full min-h-screen flex relative bg-slate-50 ${darkMode ? 'dark-mode' : ''}`}>
      {/* Mobile hamburger — shown only on small screens */}
      <button
        type="button"
        className="md:hidden fixed top-4 left-4 z-[70] p-2 rounded-xl bg-slate-900 text-white shadow-lg"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={(v) => { setCurrentView(v); }}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        displayName={displayName}
        displayEmail={displayEmail}
        displayInitials={displayInitials}
        avatarImg={avatarImg}
        onSignOut={handleSignOut}
      />

      {/* Main content */}
      <main
        className={`flex-1 min-w-0 transition-all duration-300 ease-in-out`}
        style={{ paddingLeft: 0 }}
      >
        <div className="w-full max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8 pt-16 md:pt-8">
          {currentView === 'home' && (
            <HomeView
              onOpenCourse={openCourse}
              profileName={displayName}
            />
          )}
          {currentView === 'course' && (
            <CourseView
              courseId={selectedCourse}
              onBack={() => setCurrentView('home')}
            />
          )}
          {currentView === 'profile' && (
            <ProfileView />
          )}
        </div>
      </main>
    </div>
  );
}
