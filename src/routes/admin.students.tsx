import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, Github, Linkedin, ChevronDown, ChevronUp, X, Filter, Star } from "lucide-react";

export const Route = createFileRoute("/admin/students")({ component: ViewStudents });

function ViewStudents() {
  const [students, setStudents] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [cgpaMin, setCgpaMin] = useState("");
  const [cgpaMax, setCgpaMax] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [skillFilter, setSkillFilter] = useState("");
  const [placementFilter, setPlacementFilter] = useState("all");
  const [resumeFilter, setResumeFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [selectedApps, setSelectedApps] = useState<any[]>([]);
  const [selectedRecs, setSelectedRecs] = useState<any[]>([]);
  const [placedIds, setPlacedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "student");
      const ids = (roles || []).map((r) => r.user_id);
      if (ids.length === 0) { setStudents([]); return; }
      const [{ data: profs }, { data: sps }, { data: apps }] = await Promise.all([
        supabase.from("profiles").select("*").in("id", ids),
        supabase.from("student_profiles").select("*").in("user_id", ids),
        supabase.from("applications").select("student_id, status"),
      ]);
      const spMap = new Map((sps || []).map((s: any) => [s.user_id, s]));
      // Determine placement status per student
      const statusMap = new Map<string, string>();
      (apps || []).forEach((a: any) => {
        const cur = statusMap.get(a.student_id) || "applied";
        const rank: Record<string, number> = { applied: 0, shortlisted: 1, rejected: 0, selected: 2 };
        if ((rank[a.status] ?? 0) >= (rank[cur] ?? 0)) statusMap.set(a.student_id, a.status);
      });
      const placed = new Set((apps || []).filter((a: any) => a.status === "selected").map((a: any) => a.student_id));
      setPlacedIds(placed);
      setStudents((profs || []).map((p: any) => ({ ...p, profile: spMap.get(p.id), placementStatus: statusMap.get(p.id) || "none" })));
    })();
  }, []);

  // Derived filter options
  const branches = Array.from(new Set(students.map((s) => s.profile?.branch).filter(Boolean))).sort();
  const years = Array.from(new Set(students.map((s) => s.profile?.graduation_year).filter(Boolean))).sort();

  const activeFilterCount = [
    q, cgpaMin, cgpaMax, skillFilter,
    branchFilter !== "all" ? branchFilter : "",
    yearFilter !== "all" ? yearFilter : "",
    placementFilter !== "all" ? placementFilter : "",
    resumeFilter !== "all" ? resumeFilter : "",
  ].filter(Boolean).length;

  const filtered = students.filter((s) => {
    const cgpa = s.profile?.cgpa ?? null;
    if (cgpaMin && (cgpa === null || cgpa < parseFloat(cgpaMin))) return false;
    if (cgpaMax && (cgpa === null || cgpa > parseFloat(cgpaMax))) return false;
    if (branchFilter !== "all" && s.profile?.branch !== branchFilter) return false;
    if (yearFilter !== "all" && String(s.profile?.graduation_year) !== yearFilter) return false;
    if (resumeFilter === "yes" && !s.profile?.resume_url) return false;
    if (resumeFilter === "no" && s.profile?.resume_url) return false;
    if (placementFilter !== "all") {
      if (placementFilter === "placed" && !placedIds.has(s.id)) return false;
      if (placementFilter === "unplaced" && placedIds.has(s.id)) return false;
    }
    if (skillFilter) {
      const skills = (s.profile?.skills || []).map((sk: string) => sk.toLowerCase());
      if (!skills.some((sk: string) => sk.includes(skillFilter.toLowerCase()))) return false;
    }
    if (q) {
      const haystack = (s.full_name + " " + (s.email || "") + " " + (s.profile?.branch || "")).toLowerCase();
      if (!haystack.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const openStudent = async (s: any) => {
    setSelected(s);
    const [{ data: apps }, { data: recs }] = await Promise.all([
      supabase.from("applications").select("*, opportunities(role_title, company_name, type)").eq("student_id", s.id).order("applied_at", { ascending: false }),
      supabase.from("recommendations").select("*, opportunities(role_title, company_name)").eq("student_id", s.id).order("score", { ascending: false }).limit(5),
    ]);
    setSelectedApps(apps || []);
    setSelectedRecs(recs || []);
  };

  const clearFilters = () => {
    setQ(""); setCgpaMin(""); setCgpaMax(""); setBranchFilter("all");
    setYearFilter("all"); setSkillFilter(""); setPlacementFilter("all"); setResumeFilter("all");
  };

  const statusColor = (st: string) => {
    if (st === "selected") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    if (st === "shortlisted") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    if (st === "rejected") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl">Students</h1>
          <p className="text-muted-foreground">All registered students with profile and resume.</p>
        </div>
        <div className="text-sm text-muted-foreground mt-2">
          {filtered.length} of {students.length} students
        </div>
      </div>

      {/* Search + filter toggle */}
      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Search by name, email, branch…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-1.5 relative">
          <Filter className="h-4 w-4" />
          Filters
          {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center">{activeFilterCount}</span>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground gap-1">
            <X className="h-3.5 w-3.5" /> Clear all
          </Button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-xl border bg-card p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 shadow-[var(--shadow-card)]">
          <div className="space-y-1">
            <Label className="text-xs">CGPA Min</Label>
            <Input type="number" step="0.1" min="0" max="10" placeholder="0.0" value={cgpaMin} onChange={(e) => setCgpaMin(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CGPA Max</Label>
            <Input type="number" step="0.1" min="0" max="10" placeholder="10.0" value={cgpaMax} onChange={(e) => setCgpaMax(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Branch</Label>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Graduation Year</Label>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Skill keyword</Label>
            <Input placeholder="e.g. React, Python…" value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Placement status</Label>
            <Select value={placementFilter} onValueChange={setPlacementFilter}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="placed">Placed (selected)</SelectItem>
                <SelectItem value="unplaced">Not yet placed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Resume</Label>
            <Select value={resumeFilter} onValueChange={setResumeFilter}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Has resume</SelectItem>
                <SelectItem value="no">No resume</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Student cards */}
      <div className="grid gap-3">
        {filtered.length === 0 && <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">No students match your filters.</div>}
        {filtered.map((s) => (
          <div key={s.id} className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-soft)] transition-shadow cursor-pointer" onClick={() => openStudent(s)}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display text-lg">{s.full_name}</h3>
                  {placedIds.has(s.id) && (
                    <Badge className="text-[10px] bg-green-100 text-green-800 border-green-200 hover:bg-green-100">✓ Placed</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{s.email}</div>
                <div className="text-sm mt-2">
                  <span className="text-muted-foreground">Branch:</span> {s.profile?.branch || "—"} ·{" "}
                  <span className="text-muted-foreground">CGPA:</span>{" "}
                  <span className={s.profile?.cgpa >= 8 ? "text-green-600 font-medium" : s.profile?.cgpa >= 6.5 ? "text-amber-600" : "text-muted-foreground"}>
                    {s.profile?.cgpa ?? "—"}
                  </span> ·{" "}
                  <span className="text-muted-foreground">Year:</span> {s.profile?.graduation_year ?? "—"}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(s.profile?.skills || []).slice(0, 10).map((t: string) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                  {(s.profile?.skills || []).length > 10 && <span className="text-xs text-muted-foreground self-center">+{(s.profile.skills.length - 10)} more</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {s.profile?.resume_url && (
                  <a href={s.profile.resume_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-accent hover:underline inline-flex items-center gap-1">
                    Resume <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <span className="text-xs text-muted-foreground">Click to view profile →</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Deep-dive modal */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{selected?.full_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              {/* Profile info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Email:</span> {selected.email}</div>
                <div><span className="text-muted-foreground">Branch:</span> {selected.profile?.branch || "—"}</div>
                <div><span className="text-muted-foreground">CGPA:</span> <span className="font-medium">{selected.profile?.cgpa ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Grad Year:</span> {selected.profile?.graduation_year || "—"}</div>
              </div>
              <div className="flex gap-3 flex-wrap">
                {selected.profile?.resume_url && <a href={selected.profile.resume_url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3" />Resume</a>}
                {selected.profile?.github_url && <a href={selected.profile.github_url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1"><Github className="h-3 w-3" />GitHub</a>}
                {selected.profile?.linkedin_url && <a href={selected.profile.linkedin_url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1"><Linkedin className="h-3 w-3" />LinkedIn</a>}
              </div>
              {/* Skills */}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {(selected.profile?.skills || []).map((t: string) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                  {(selected.profile?.skills || []).length === 0 && <span className="text-xs text-muted-foreground">No skills listed.</span>}
                </div>
              </div>
              {/* Interests */}
              {(selected.profile?.interests || []).length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Interests</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.profile.interests.map((t: string) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                  </div>
                </div>
              )}
              {/* Applications */}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Applications ({selectedApps.length})</div>
                {selectedApps.length === 0
                  ? <div className="text-sm text-muted-foreground">No applications yet.</div>
                  : <div className="space-y-2">
                    {selectedApps.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg border p-3 gap-2 flex-wrap">
                        <div className="text-sm font-medium">{a.opportunities?.role_title} <span className="text-muted-foreground font-normal">@ {a.opportunities?.company_name}</span></div>
                        <Badge className={`text-[10px] ${statusColor(a.status)}`}>{a.status}</Badge>
                      </div>
                    ))}
                  </div>
                }
              </div>
              {/* AI Match Scores */}
              {selectedRecs.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><Star className="h-3 w-3" />Top AI Match Scores</div>
                  <div className="space-y-2">
                    {selectedRecs.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg border p-3 gap-2">
                        <div className="text-sm">{r.opportunities?.role_title} <span className="text-muted-foreground">@ {r.opportunities?.company_name}</span></div>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(r.score * 100)}%` }} />
                          </div>
                          <span className="text-xs font-medium tabular-nums">{Math.round(r.score * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
