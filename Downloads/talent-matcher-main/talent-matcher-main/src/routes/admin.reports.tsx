import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Users, TrendingUp, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/reports")({ component: PlacementReports });

const COLORS = ["#1e3a6e", "#2196F3", "#4CAF50", "#d94444", "#8b5cf6", "#d4a017", "#c2185b", "#00897b"];

interface PlacedStudent {
  name: string;
  email: string;
  branch: string;
  cgpa: number | null;
  graduation_year: number | null;
  company: string;
  role: string;
  type: string;
  ctc: string;
}

function PlacementReports() {
  const [placed, setPlaced] = useState<PlacedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState("all");

  useEffect(() => {
    (async () => {
      // Get all "selected" applications
      const { data: apps } = await supabase
        .from("applications")
        .select("student_id, opportunity_id")
        .eq("status", "selected");

      if (!apps || apps.length === 0) { setPlaced([]); setLoading(false); return; }

      const studentIds = [...new Set(apps.map((a) => a.student_id))];
      const oppIds = [...new Set(apps.map((a) => a.opportunity_id))];

      const [{ data: profiles }, { data: studentProfiles }, { data: opportunities }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").in("id", studentIds),
        supabase.from("student_profiles").select("user_id, branch, cgpa, graduation_year").in("user_id", studentIds),
        supabase.from("opportunities").select("id, role_title, company_name, type, ctc").in("id", oppIds),
      ]);

      const profMap = new Map((profiles || []).map((p) => [p.id, p]));
      const spMap = new Map((studentProfiles || []).map((s: any) => [s.user_id, s]));
      const oppMap = new Map((opportunities || []).map((o: any) => [o.id, o]));

      const placedList: PlacedStudent[] = apps.map((a) => {
        const prof = profMap.get(a.student_id);
        const sp = spMap.get(a.student_id);
        const opp = oppMap.get(a.opportunity_id);
        return {
          name: prof?.full_name || "Unknown",
          email: prof?.email || "",
          branch: sp?.branch || "—",
          cgpa: sp?.cgpa ?? null,
          graduation_year: sp?.graduation_year ?? null,
          company: opp?.company_name || "—",
          role: opp?.role_title || "—",
          type: opp?.type || "—",
          ctc: opp?.ctc || "—",
        };
      });

      setPlaced(placedList);
      setLoading(false);
    })();
  }, []);

  const years = Array.from(new Set(placed.map((p) => p.graduation_year).filter(Boolean))).sort() as number[];

  const filtered = placed.filter((p) => {
    if (yearFilter !== "all" && String(p.graduation_year) !== yearFilter) return false;
    return true;
  });

  // Branch breakdown
  const branchCount = new Map<string, number>();
  filtered.forEach((p) => branchCount.set(p.branch, (branchCount.get(p.branch) || 0) + 1));
  const branchData = Array.from(branchCount.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Company breakdown
  const companyCount = new Map<string, number>();
  filtered.forEach((p) => companyCount.set(p.company, (companyCount.get(p.company) || 0) + 1));
  const companyData = Array.from(companyCount.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  const exportCSV = () => {
    const rows = [
      ["Name", "Email", "Branch", "CGPA", "Graduation Year", "Company", "Role", "Type", "CTC/Stipend"],
      ...filtered.map((p) => [
        p.name, p.email, p.branch, p.cgpa ?? "", p.graduation_year ?? "",
        p.company, p.role, p.type, p.ctc,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `placement-report${yearFilter !== "all" ? `-${yearFilter}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Placement report CSV downloaded");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-4xl">Placement Reports</h1>
          <p className="text-muted-foreground">Loading report data…</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="rounded-xl border bg-card p-5 h-24 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl">Placement Reports</h1>
          <p className="text-muted-foreground">Placement summary and exportable reports.</p>
        </div>
        <div className="flex gap-2">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={exportCSV} disabled={filtered.length === 0} className="gap-1.5">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total Placed</div>
            <div className="h-8 w-8 rounded-md bg-secondary grid place-items-center"><Users className="h-4 w-4 text-primary" /></div>
          </div>
          <div className="mt-3 text-3xl font-display">{filtered.length}</div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Companies</div>
            <div className="h-8 w-8 rounded-md bg-secondary grid place-items-center"><Building2 className="h-4 w-4 text-primary" /></div>
          </div>
          <div className="mt-3 text-3xl font-display">{companyData.length}</div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Avg CGPA</div>
            <div className="h-8 w-8 rounded-md bg-secondary grid place-items-center"><TrendingUp className="h-4 w-4 text-primary" /></div>
          </div>
          <div className="mt-3 text-3xl font-display">
            {filtered.filter((p) => p.cgpa != null).length > 0
              ? (filtered.filter((p) => p.cgpa != null).reduce((sum, p) => sum + (p.cgpa || 0), 0) / filtered.filter((p) => p.cgpa != null).length).toFixed(2)
              : "—"}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Branch-wise placements — progress bars */}
        <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-lg mb-4">Placement per branch</h3>
          {branchData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No placement data yet.</p>
          ) : (
            <div className="space-y-4">
              {branchData.map((b, i) => {
                const max = branchData[0].value;
                const pct = Math.round((b.value / max) * 100);
                return (
                  <div key={b.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 rounded-full items-center justify-center text-[10px] font-bold text-white" style={{ background: COLORS[i % COLORS.length] }}>{i + 1}</span>
                        {b.name}
                      </span>
                      <span className="text-muted-foreground">{b.value} placed</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top recruiters — leaderboard */}
        <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-lg mb-4">Top recruiting companies</h3>
          {companyData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No placement data yet.</p>
          ) : (
            <div className="space-y-4">
              {companyData.map((c, i) => {
                const max = companyData[0].count;
                const pct = Math.round((c.count / max) * 100);
                return (
                  <div key={c.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {c.name}
                      </span>
                      <span className="text-muted-foreground">{c.count} hire{c.count !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Full table */}
      <div className="rounded-xl border bg-card shadow-[var(--shadow-card)] overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" />
          <h3 className="font-display text-lg">Placed Students</h3>
          <Badge variant="secondary" className="ml-auto text-xs">{filtered.length} records</Badge>
        </div>
        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">No placed students found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2 font-medium text-xs">#</th>
                  <th className="text-left px-4 py-2 font-medium text-xs">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-xs">Branch</th>
                  <th className="text-left px-4 py-2 font-medium text-xs">CGPA</th>
                  <th className="text-left px-4 py-2 font-medium text-xs">Company</th>
                  <th className="text-left px-4 py-2 font-medium text-xs">Role</th>
                  <th className="text-left px-4 py-2 font-medium text-xs">Type</th>
                  <th className="text-left px-4 py-2 font-medium text-xs">CTC</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground">{p.email}</div>
                    </td>
                    <td className="px-4 py-2.5">{p.branch}</td>
                    <td className="px-4 py-2.5">
                      <span className={p.cgpa && p.cgpa >= 8 ? "text-green-600 font-medium" : ""}>
                        {p.cgpa ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium">{p.company}</td>
                    <td className="px-4 py-2.5">{p.role}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="text-[10px] uppercase">{p.type}</Badge>
                    </td>
                    <td className="px-4 py-2.5">{p.ctc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
