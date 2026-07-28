import { Link, useLocation } from 'wouter';
import { LayoutDashboard, Users, BookOpen, ClipboardList, FileText, TrendingUp, AlertTriangle, Menu, X, GraduationCap } from 'lucide-react';
import { useCustomAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useState } from 'react';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Students', href: '/students', icon: Users },
  { name: 'Courses', href: '/courses', icon: BookOpen },
  { name: 'Grades', href: '/grades', icon: ClipboardList },
  { name: 'Assignments', href: '/assignments', icon: FileText },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'Predictions', href: '/predictions', icon: AlertTriangle },
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [location] = useLocation();
  const { currentUser, logout } = useCustomAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const displayName = currentUser?.name || currentUser?.email || 'User';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Sidebar - Desktop */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border hidden lg:block">
        <div className="flex flex-col h-full">
          <div className="px-6 py-5 border-b border-sidebar-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
                <GraduationCap className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-display font-bold text-sidebar-foreground tracking-tight leading-none">
                  Acadence
                </h1>
                <p className="text-xs text-sidebar-foreground/60 mt-0.5">Faculty workspace</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location === item.href || (item.href !== '/dashboard' && location.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  }`}
                  data-testid={`nav-${item.name.toLowerCase()}`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md hover:bg-sidebar-accent/50 transition-colors"
                  data-testid="button-user-menu"
                >
                  <Avatar className="w-8 h-8 bg-primary text-primary-foreground">
                    <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-sidebar-foreground/60 truncate">Instructor</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} data-testid="button-sign-out">
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-display font-bold text-foreground">Acadence</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {mobileMenuOpen && (
          <nav className="border-t border-border bg-card pb-4">
            <div className="px-2 py-3 space-y-1">
              {navigation.map((item) => {
                const isActive = location === item.href || (item.href !== '/dashboard' && location.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
            <div className="px-2 pt-3 border-t border-border">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                Sign out
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="lg:pl-64 pt-14 lg:pt-0">
        <div className="min-h-[100dvh]">
          {children}
        </div>
      </main>
    </div>
  );
}
