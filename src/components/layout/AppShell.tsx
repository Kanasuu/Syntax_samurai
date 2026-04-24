import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, LayoutDashboard, Briefcase, BookOpen, Users, Sparkles, FileText, User as UserIcon, ClipboardList, Bell, Target, Brain, Mic } from "lucide-react";
import { NotificationBell } from "@/components/shared/NotificationBell";

export function AppShell() {
  const { role, fullName, signOut, user } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const adminLinks = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/opportunities", label: "Opportunities", icon: Briefcase },
    { to: "/admin/courses", label: "Courses", icon: BookOpen },
    { to: "/admin/students", label: "Students", icon: Users },
    { to: "/admin/notifications", label: "Notify", icon: Bell },
    { to: "/admin/reports", label: "Reports", icon: FileText },
  ];
  const studentLinks = [
    { to: "/student", label: "Dashboard", icon: LayoutDashboard },
    { to: "/student/browse", label: "Browse", icon: Briefcase },
    { to: "/student/recommendations", label: "AI Matches", icon: Sparkles },
    { to: "/student/applications", label: "Applications", icon: ClipboardList },
    { to: "/student/interview-prep", label: "Prep", icon: Target },
    { to: "/student/quizzes", label: "Quiz", icon: Brain },
    { to: "/student/mock-interview", label: "Mock", icon: Mic },
    { to: "/student/profile", label: "Profile", icon: UserIcon },
  ];
  const links = role === "admin" ? adminLinks : studentLinks;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-card/90">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg">Placement Cell</div>
              <div className="text-[11px] text-muted-foreground -mt-0.5">{role === "admin" ? "Officer Console" : "Student Portal"}</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => {
              const active = path === l.to || (l.to !== "/admin" && l.to !== "/student" && path.startsWith(l.to));
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-colors ${active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
                >
                  <l.icon className="h-4 w-4" />
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <NotificationBell userId={user?.id} />
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-sm font-medium">{fullName || "User"}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{role}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={async () => { await signOut(); nav({ to: "/login" }); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="md:hidden border-t">
          <div className="container mx-auto px-2 flex gap-1 overflow-x-auto py-1.5">
            {links.map((l) => {
              const active = path === l.to;
              return (
                <Link key={l.to} to={l.to} className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap flex items-center gap-1 ${active ? "bg-secondary" : "text-muted-foreground"}`}>
                  <l.icon className="h-3.5 w-3.5" />
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Placement Cell Management System · AI-powered matching
      </footer>
    </div>
  );
}
