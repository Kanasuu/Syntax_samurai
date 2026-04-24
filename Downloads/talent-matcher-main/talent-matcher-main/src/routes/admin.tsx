import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" />;
  if (role !== "admin") return <Navigate to="/student" />;
  return <AppShell />;
}
