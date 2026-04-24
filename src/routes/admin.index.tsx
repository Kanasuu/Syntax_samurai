import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/shared/StatCard";
import {
  Briefcase, Users, ClipboardList, GraduationCap, TrendingUp,
  AlertCircle, CheckCircle2, Clock, XCircle, BookOpen, Zap
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid
} from "recharts";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

const STATUS_COLORS: Record<string, string> = {
  applied: "#2196F3",
  shortlisted: "#8b5cf6",
  selected: "#4CAF50",
  rejected: "#d94444",
};

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  applied: Clock,
  shortlisted: Zap,
  selected: CheckCircle2,
  rejected: XCircle,
};

const PIE_COLORS = ["#2196F3", "#8b5cf6", "#4CAF50", "#d94444", "#d4a017", "#1e3a6e"];

interface Stats {
  totalStudents: number;
  totalOpportunities: number;
  totalApplications: number;
  totalSelected: number;
  placementRate: number;
  byRole: { name: string; applications: number }[];
  statusBreakdown: { name: string; value: number }[];
  branchPlacement: { branch: string; placed: number; total: number }[];
  cgpaComparison: { group: string; avgCgpa: number }[];
  topSkills: { skill: string; count: number }[];
  expiringOpps: { id: string; role_title: string; company_name: string; deadline: string; daysLeft: number }[];
  recentApplications: { student: string; role: string; company: string; status: string; date: string }[];
  topCompanies: { company: string; count: number }[];
}

function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [
          { count: students },
          { count: opps },
          { count: apps },
          { count: selected },
          { data: appData },
          { data: oppData },
          { data: studentProfileData },
          { data: profilesData },
        ] = await Promise.all([
          supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "student"),
          supabase.from("opportunities").select("*", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("applications").select("*", { count: "exact", head: true }),
          supabase.from("applications").select("*", { count: "exact", head: true }).eq("status", "selected"),
          supabase.from("applications").select("opportunity_id, status, student_id, applied_at").order("applied_at", { ascending: false }),
          supabase.from("opportunities").select("id, role_title, company_name, required_skills, deadline, is_active"),
          supabase.from("student_profiles").select("user_id, branch, cgpa"),
          supabase.from("profiles").select("id, full_name"),
        ]);

        const oppMap = new Map((oppData || []).map((o: any) => [o.id, o]));
        const profMap = new Map((profilesData || []).map((p: any) => [p.id, p.full_name]));

        // Top opportunities by applications
        const byRoleMap = new Map<string, number>();
        (appData || []).forEach((a: any) => {
          const o = oppMap.get(a.opportunity_id);
          const name = (o?.role_title || "Unknown").slice(0, 22);
          byRoleMap.set(name, (byRoleMap.get(name) || 0) + 1);
        });
        const byRole = Array.from(byRoleMap.entries())
          .map(([name, applications]) => ({ name, applications }))
          .sort((a, b) => b.applications - a.applications)
          .slice(0, 6);

        // Application status breakdown
        const statusMap = new Map<string, number>();
        (appData || []).forEach((a: any) => statusMap.set(a.status, (statusMap.get(a.status) || 0) + 1));
        const statusBreakdown = Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }));

        // Branch-wise placement
        const branchMap = new Map<string, { total: number; placed: number }>();
        const placedIds = new Set((appData || []).filter((a: any) => a.status === "selected").map((a: any) => a.student_id));
        (studentProfileData || []).forEach((sp: any) => {
          if (!sp.branch) return;
          const entry = branchMap.get(sp.branch) || { total: 0, placed: 0 };
          entry.total += 1;
          if (placedIds.has(sp.user_id)) entry.placed += 1;
          branchMap.set(sp.branch, entry);
        });
        const branchPlacement = Array.from(branchMap.entries())
          .map(([branch, v]) => ({ branch, ...v }))
          .sort((a, b) => b.total - a.total);

        // Avg CGPA
        const placedCgpas: number[] = [];
        const unplacedCgpas: number[] = [];
        (studentProfileData || []).forEach((sp: any) => {
          if (sp.cgpa == null) return;
          (placedIds.has(sp.user_id) ? placedCgpas : unplacedCgpas).push(Number(sp.cgpa));
        });
        const avg = (arr: number[]) => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0;
        const cgpaComparison = [
          { group: "Placed", avgCgpa: avg(placedCgpas) },
          { group: "Not Placed", avgCgpa: avg(unplacedCgpas) },
        ];

        // Top skills
        const skillCount = new Map<string, number>();
        (oppData || []).forEach((o: any) =>
          (o.required_skills || []).forEach((s: string) => skillCount.set(s, (skillCount.get(s) || 0) + 1))
        );
        const topSkills = Array.from(skillCount.entries())
          .map(([skill, count]) => ({ skill, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);

        // Top companies
        const companyMap = new Map<string, number>();
        (appData || []).forEach((a: any) => {
          const o = oppMap.get(a.opportunity_id);
          if (!o?.company_name) return;
          companyMap.set(o.company_name, (companyMap.get(o.company_name) || 0) + 1);
        });
        const topCompanies = Array.from(companyMap.entries())
          .map(([company, count]) => ({ company, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Recent applications
        const recentApplications = (appData || []).slice(0, 8).map((a: any) => {
          const o = oppMap.get(a.opportunity_id);
          return {
            student: profMap.get(a.student_id) || "Student",
            role: o?.role_title || "Unknown Role",
            company: o?.company_name || "Unknown",
            status: a.status,
            date: new Date(a.applied_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          };
        });

        // Expiring opportunities
        const now = new Date();
        const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const expiringOpps = (oppData || [])
          .filter((o: any) => o.is_active && o.deadline && new Date(o.deadline) <= in30 && new Date(o.deadline) >= now)
          .map((o: any) => ({
            ...o,
            daysLeft: Math.ceil((new Date(o.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          }))
          .sort((a: any, b: any) => a.daysLeft - b.daysLeft)
          .slice(0, 5);

        const placementRate = students ? Math.round(((selected || 0) / students) * 100) : 0;

        setStats({
          totalStudents: students || 0,
          totalOpportunities: opps || 0,
          totalApplications: apps || 0,
          totalSelected: selected || 0,
          placementRate,
          byRole,
          statusBreakdown,
          branchPlacement,
          cgpaComparison,
          topSkills,
          expiringOpps,
          recentApplications,
          topCompanies,
        });
      } catch (err: any) {
        console.error("Dashboard error:", err);
        setError(err?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Placement dashboard</h1>
        <p className="text-muted-foreground">Loading…</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => <div key={i} className="rounded-xl border bg-card p-5 h-28 animate-pulse" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[...Array(4)].map((_, i) => <div key={i} className="rounded-xl border bg-card p-5 h-72 animate-pulse" />)}
      </div>
    </div>
  );

  if (error) return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Placement dashboard</h1>
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 text-sm">
        <strong>Error:</strong> {error}
      </div>
    </div>
  );

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Placement dashboard</h1>
        <p className="text-muted-foreground">Live data from your database.</p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Students" value={stats.totalStudents} icon={GraduationCap} accent />
        <StatCard label="Active Opportunities" value={stats.totalOpportunities} icon={Briefcase} />
        <StatCard label="Applications" value={stats.totalApplications} icon={ClipboardList} />
        <StatCard label="Placed" value={stats.totalSelected} icon={Users} hint="status = selected" />
        <StatCard label="Placement Rate" value={`${stats.placementRate}%`} icon={TrendingUp} hint={`${stats.totalSelected} of ${stats.totalStudents}`} />
      </div>

      {/* ── Deadline alert ── */}
      {stats.expiringOpps.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <h3 className="font-medium text-sm text-amber-800 dark:text-amber-300">Deadlines in next 30 days</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.expiringOpps.map((o) => (
              <div key={o.id} className="text-xs rounded-lg border border-amber-200 bg-white dark:bg-amber-900/20 px-3 py-2">
                <span className="font-medium">{o.role_title}</span>
                <span className="text-muted-foreground"> · {o.company_name}</span>
                <Badge className={`ml-2 text-[9px] ${o.daysLeft <= 7 ? "bg-red-100 text-red-700 border-red-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                  {o.daysLeft}d left
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 1: Application status + Recent activity ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Application status breakdown */}
        <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-lg mb-4">Application status breakdown</h3>
          {stats.statusBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No applications in the system yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.statusBreakdown.map((s) => {
                const Icon = STATUS_ICONS[s.name] || Clock;
                const color = STATUS_COLORS[s.name] || "#888";
                const pct = stats.totalApplications ? Math.round((s.value / stats.totalApplications) * 100) : 0;
                return (
                  <div key={s.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-sm capitalize">
                        <Icon className="h-3.5 w-3.5" style={{ color }} />
                        {s.name}
                      </div>
                      <span className="text-sm font-semibold">{s.value} <span className="text-muted-foreground font-normal text-xs">({pct}%)</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent applications */}
        <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-lg mb-4">Recent applications</h3>
          {stats.recentApplications.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No applications yet.</p>
          ) : (
            <div className="divide-y">
              {stats.recentApplications.map((a, i) => {
                const color = STATUS_COLORS[a.status] || "#888";
                return (
                  <div key={i} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.student}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.role} · {a.company}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{a.date}</span>
                      <span className="text-[10px] capitalize font-medium px-2 py-0.5 rounded-full" style={{ background: color + "22", color }}>
                        {a.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Top opportunities bar + Top companies ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Top opportunities by applications */}
        <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-lg mb-4">Top roles by applications</h3>
          {stats.byRole.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No applications yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.byRole} margin={{ top: 4, right: 4, left: -10, bottom: 40 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="applications" fill="#1e3a6e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top companies */}
        <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-lg mb-4">Most applied companies</h3>
          {stats.topCompanies.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No application data yet.</p>
          ) : (
            <div className="space-y-3 mt-2">
              {stats.topCompanies.map((c, i) => {
                const max = stats.topCompanies[0].count;
                const pct = Math.round((c.count / max) * 100);
                return (
                  <div key={c.company}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                        {c.company}
                      </span>
                      <span className="text-muted-foreground">{c.count} app{c.count !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Branch placement + Skills ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Branch-wise placement */}
        <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-lg mb-4">Branch-wise placement</h3>
          {stats.branchPlacement.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Students need to fill in their branch in profiles.</p>
          ) : (
            <div className="space-y-3">
              {stats.branchPlacement.map((b) => {
                const placedPct = b.total ? Math.round((b.placed / b.total) * 100) : 0;
                return (
                  <div key={b.branch}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{b.branch}</span>
                      <span className="text-muted-foreground">{b.placed}/{b.total} placed <span className="text-xs">({placedPct}%)</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${placedPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top skills in demand */}
        <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-lg mb-4">Top skills in demand</h3>
          {stats.topSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Add required skills to your opportunities.</p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-1">
              {stats.topSkills.map((s, i) => (
                <span
                  key={s.skill}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border"
                  style={{
                    fontSize: `${Math.max(11, 14 - i)}px`,
                    opacity: Math.max(0.5, 1 - i * 0.08),
                    background: "#1e3a6e11",
                    borderColor: "#1e3a6e33",
                    color: "#1e3a6e",
                  }}
                >
                  <BookOpen className="h-3 w-3" />
                  {s.skill}
                  <span className="text-[10px] opacity-60 ml-0.5">{s.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CGPA comparison ── */}
      {stats.cgpaComparison.some((c) => c.avgCgpa > 0) && (
        <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-lg mb-4">Avg CGPA: Placed vs Not Placed</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.cgpaComparison} margin={{ top: 16, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="group" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 10]} allowDecimals />
              <Tooltip formatter={(val) => [`${val}`, "Avg CGPA"]} />
              <Bar dataKey="avgCgpa" name="Avg CGPA" fill="#2196F3" radius={[6, 6, 0, 0]}
                label={{ position: "top", fontSize: 13, fontWeight: 700 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
