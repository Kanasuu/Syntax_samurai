import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, Users, Sparkles, ArrowUpDown, Download, Star, Filter, Search } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/utils-format";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/opportunities")({ component: ManageOpportunities });

type Opp = Tables<"opportunities">;

interface FormState {
  company_name: string;
  role_title: string;
  description: string;
  type: "job" | "internship";
  ctc: string;
  location: string;
  min_cgpa: string;
  eligible_branches: string;
  required_skills: string;
  domain_tags: string;
  deadline: string;
  apply_link: string;
}

const empty: FormState = {
  company_name: "", role_title: "", description: "", type: "internship",
  ctc: "", location: "", min_cgpa: "0",
  eligible_branches: "", required_skills: "", domain_tags: "", deadline: "", apply_link: "",
};

function ManageOpportunities() {
  const { user } = useAuth();
  const [opps, setOpps] = useState<Opp[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Opp | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [applicantsFor, setApplicantsFor] = useState<Opp | null>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  // Opportunity list filters
  const [searchQ, setSearchQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sortBy, setSortBy] = useState<"created_at" | "deadline">("created_at");
  // Applicant panel filters & bulk actions
  const [appSortBy, setAppSortBy] = useState<"cgpa" | "applied_at">("applied_at");
  const [appStatusFilter, setAppStatusFilter] = useState("all");
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("shortlisted");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  // AI match scores
  const [matchScores, setMatchScores] = useState<Map<string, number>>(new Map());

  const load = async () => {
    const { data } = await supabase.from("opportunities").select("*").order(sortBy, { ascending: sortBy === "deadline" });
    setOpps((data || []) as Opp[]);
  };

  useEffect(() => { load(); }, [sortBy]);

  const startCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (o: Opp & { apply_link?: string }) => {
    setEditing(o);
    setForm({
      company_name: o.company_name, role_title: o.role_title, description: o.description, type: o.type as any,
      ctc: o.ctc || "", location: o.location || "", min_cgpa: String(o.min_cgpa ?? 0),
      eligible_branches: (o.eligible_branches || []).join(", "),
      required_skills: (o.required_skills || []).join(", "),
      domain_tags: (o.domain_tags || []).join(", "),
      deadline: o.deadline || "",
      apply_link: (o as any).apply_link || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      company_name: form.company_name.trim(),
      role_title: form.role_title.trim(),
      description: form.description.trim(),
      type: form.type,
      ctc: form.ctc.trim() || null,
      location: form.location.trim() || null,
      min_cgpa: parseFloat(form.min_cgpa) || 0,
      eligible_branches: form.eligible_branches.split(",").map((s) => s.trim()).filter(Boolean),
      required_skills: form.required_skills.split(",").map((s) => s.trim()).filter(Boolean),
      domain_tags: form.domain_tags.split(",").map((s) => s.trim()).filter(Boolean),
      deadline: form.deadline || null,
      apply_link: form.apply_link.trim() || null,
      posted_by: user.id,
    };

    let opportunityId: string | null = null;
    if (editing) {
      const { error } = await supabase.from("opportunities").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      opportunityId = editing.id;
      toast.success("Opportunity updated");
    } else {
      const { data, error } = await supabase.from("opportunities").insert(payload).select().single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      opportunityId = data.id;
      toast.success("Opportunity posted — AI is ranking matches…");
      supabase.functions.invoke("match-recommendations", { body: { opportunityId, trigger: "new_opportunity" } }).catch(() => {});
    }
    setSaving(false);
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Deactivate this opportunity? Students will no longer see it.")) return;
    const { error } = await supabase.from("opportunities").update({ is_active: false }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deactivated"); load(); }
  };

  const reactivate = async (id: string) => {
    await supabase.from("opportunities").update({ is_active: true }).eq("id", id);
    load();
  };

  const viewApplicants = async (o: Opp) => {
    setApplicantsFor(o);
    setSelectedAppIds(new Set());
    setAppStatusFilter("all");
    setAppSortBy("applied_at");
    const { data: apps } = await supabase
      .from("applications")
      .select("*")
      .eq("opportunity_id", o.id)
      .order("applied_at", { ascending: false });

    if (!apps || apps.length === 0) { setApplicants([]); setMatchScores(new Map()); return; }

    const studentIds = apps.map((a) => a.student_id);
    const [{ data: profs }, { data: sprofs }, { data: recs }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").in("id", studentIds),
      supabase.from("student_profiles").select("user_id, cgpa, branch, resume_url").in("user_id", studentIds),
      supabase.from("recommendations").select("student_id, score").eq("opportunity_id", o.id).in("student_id", studentIds),
    ]);

    const pMap = new Map((profs || []).map((p) => [p.id, p]));
    const spMap = new Map((sprofs || []).map((p) => [p.user_id, p]));
    const scores = new Map((recs || []).map((r: any) => [r.student_id, r.score]));
    setMatchScores(scores);

    setApplicants(apps.map((a) => ({
      ...a,
      profiles: pMap.get(a.student_id),
      student_profiles: spMap.get(a.student_id),
    })));
  };

  const updateStatus = async (appId: string, status: string) => {
    const { error } = await supabase.from("applications").update({ status }).eq("id", appId);
    if (error) { toast.error(error.message); return; }
    const app = applicants.find((a) => a.id === appId);
    if (app) {
      await supabase.from("notifications").insert({
        user_id: app.student_id,
        type: "status_update",
        title: `Application ${status}`,
        body: `Your application for ${applicantsFor?.role_title} at ${applicantsFor?.company_name} is now ${status}.`,
        opportunity_id: applicantsFor?.id,
      });
    }
    toast.success("Status updated");
    if (applicantsFor) viewApplicants(applicantsFor);
  };

  const bulkUpdateStatus = async () => {
    if (selectedAppIds.size === 0) return;
    setBulkUpdating(true);
    const ids = Array.from(selectedAppIds);
    const { error } = await supabase.from("applications").update({ status: bulkStatus }).in("id", ids);
    if (error) { toast.error(error.message); setBulkUpdating(false); return; }
    // Send notifications
    const affected = applicants.filter((a) => selectedAppIds.has(a.id));
    await Promise.all(affected.map((app) =>
      supabase.from("notifications").insert({
        user_id: app.student_id,
        type: "status_update",
        title: `Application ${bulkStatus}`,
        body: `Your application for ${applicantsFor?.role_title} at ${applicantsFor?.company_name} is now ${bulkStatus}.`,
        opportunity_id: applicantsFor?.id,
      })
    ));
    toast.success(`Updated ${ids.length} applicant(s) to "${bulkStatus}"`);
    setSelectedAppIds(new Set());
    setBulkUpdating(false);
    if (applicantsFor) viewApplicants(applicantsFor);
  };

  const exportCSV = () => {
    if (!applicants.length || !applicantsFor) return;
    const rows = [
      ["Name", "Email", "Branch", "CGPA", "Status", "AI Match %", "Resume URL"],
      ...filteredApplicants.map((a) => [
        a.profiles?.full_name || "",
        a.profiles?.email || "",
        a.student_profiles?.branch || "",
        a.student_profiles?.cgpa ?? "",
        a.status,
        matchScores.has(a.student_id) ? `${Math.round(matchScores.get(a.student_id)! * 100)}%` : "",
        a.student_profiles?.resume_url || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `applicants-${applicantsFor.role_title.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  // Filtered & sorted applicants
  const filteredApplicants = applicants
    .filter((a) => appStatusFilter === "all" || a.status === appStatusFilter)
    .sort((a, b) => {
      if (appSortBy === "cgpa") return (b.student_profiles?.cgpa ?? 0) - (a.student_profiles?.cgpa ?? 0);
      return new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime();
    });

  // Filtered opportunities
  const filteredOpps = opps.filter((o) => {
    if (typeFilter !== "all" && o.type !== typeFilter) return false;
    if (statusFilter === "active" && !o.is_active) return false;
    if (statusFilter === "inactive" && o.is_active) return false;
    if (searchQ) {
      const hay = `${o.role_title} ${o.company_name} ${(o.domain_tags || []).join(" ")}`.toLowerCase();
      if (!hay.includes(searchQ.toLowerCase())) return false;
    }
    return true;
  });

  const statusBadgeColor = (st: string) => {
    if (st === "selected") return "bg-green-100 text-green-800";
    if (st === "shortlisted") return "bg-blue-100 text-blue-800";
    if (st === "rejected") return "bg-red-100 text-red-800";
    return "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl">Opportunities</h1>
          <p className="text-muted-foreground">Post and manage placement opportunities.</p>
        </div>
        <Button onClick={startCreate}><Plus className="h-4 w-4 mr-1" /> New opportunity</Button>
      </div>

      {/* Opportunity list filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search opportunities…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="pl-8 h-9 max-w-xs text-sm" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="job">Job</SelectItem>
            <SelectItem value="internship">Internship</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="h-9 w-40 text-sm"><ArrowUpDown className="h-3.5 w-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Newest first</SelectItem>
            <SelectItem value="deadline">Deadline soonest</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filteredOpps.length} of {opps.length}</span>
      </div>

      <div className="grid gap-3">
        {filteredOpps.length === 0 && <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">No opportunities match. Create your first.</div>}
        {filteredOpps.map((o) => (
          <div key={o.id} className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-xl">{o.role_title}</h3>
                  <Badge variant="secondary" className="text-[10px] uppercase">{o.type}</Badge>
                  {!o.is_active && <Badge variant="outline" className="text-[10px]">inactive</Badge>}
                  {o.deadline && new Date(o.deadline) <= new Date(Date.now() + 7 * 86400000) && new Date(o.deadline) >= new Date() && (
                    <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">Deadline soon</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">{o.company_name} · {o.location || "Remote"}</div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(o.domain_tags || []).map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Min CGPA {Number(o.min_cgpa).toFixed(2)} · Deadline {fmtDate(o.deadline)}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => viewApplicants(o)}><Users className="h-3.5 w-3.5 mr-1" /> Applicants</Button>
                <Button size="sm" variant="outline" onClick={() => startEdit(o)}><Edit className="h-3.5 w-3.5" /></Button>
                {o.is_active
                  ? <Button size="sm" variant="ghost" onClick={() => remove(o.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  : <Button size="sm" variant="ghost" onClick={() => reactivate(o.id)}>Reactivate</Button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} opportunity</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Company</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
              <div><Label>Role title</Label><Input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} /></div>
            </div>
            <div><Label>Description</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="internship">Internship</SelectItem><SelectItem value="job">Job</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>CTC / Stipend</Label><Input placeholder="12 LPA" value={form.ctc} onChange={(e) => setForm({ ...form, ctc: e.target.value })} /></div>
              <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Min CGPA</Label><Input type="number" step="0.01" max="10" min="0" value={form.min_cgpa} onChange={(e) => setForm({ ...form, min_cgpa: e.target.value })} /></div>
              <div><Label>Deadline</Label><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
            </div>
            {form.type === "internship" && (
              <div><Label>Apply URL / Link</Label><Input placeholder="https://docs.google.com/..." value={form.apply_link} onChange={(e) => setForm({ ...form, apply_link: e.target.value })} /></div>
            )}
            <div><Label>Eligible branches (comma-separated, leave empty for all)</Label><Input placeholder="CSE, ECE, ME" value={form.eligible_branches} onChange={(e) => setForm({ ...form, eligible_branches: e.target.value })} /></div>
            <div><Label>Required skills (comma-separated)</Label><Input placeholder="Python, React, SQL" value={form.required_skills} onChange={(e) => setForm({ ...form, required_skills: e.target.value })} /></div>
            <div><Label>Domain tags</Label><Input placeholder="fintech, ML, backend" value={form.domain_tags} onChange={(e) => setForm({ ...form, domain_tags: e.target.value })} /></div>
            <div className="text-xs text-muted-foreground flex items-start gap-1.5"><Sparkles className="h-3.5 w-3.5 text-accent mt-0.5" /> Posting will trigger AI ranking for all students automatically.</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.company_name || !form.role_title || !form.description}>{saving ? "Saving…" : (editing ? "Save changes" : "Post opportunity")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Applicants dialog */}
      <Dialog open={!!applicantsFor} onOpenChange={(v) => !v && setApplicantsFor(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Applicants — {applicantsFor?.role_title} @ {applicantsFor?.company_name}</DialogTitle>
          </DialogHeader>

          {/* Controls */}
          <div className="flex flex-wrap gap-2 items-center border-b pb-3 mb-1">
            <Select value={appStatusFilter} onValueChange={setAppStatusFilter}>
              <SelectTrigger className="h-8 w-36 text-xs"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="applied">Applied</SelectItem>
                <SelectItem value="shortlisted">Shortlisted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="selected">Selected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={appSortBy} onValueChange={(v) => setAppSortBy(v as any)}>
              <SelectTrigger className="h-8 w-40 text-xs"><ArrowUpDown className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="applied_at">Latest applied</SelectItem>
                <SelectItem value="cgpa">Highest CGPA</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={exportCSV}>
              <Download className="h-3 w-3" /> Export CSV
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">{filteredApplicants.length} applicant(s)</span>
          </div>

          {/* Bulk action bar */}
          {selectedAppIds.size > 0 && (
            <div className="flex items-center gap-2 bg-secondary/60 rounded-lg px-3 py-2 mb-2">
              <span className="text-xs font-medium">{selectedAppIds.size} selected</span>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="shortlisted">Shortlisted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="selected">Selected</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="h-7 text-xs" onClick={bulkUpdateStatus} disabled={bulkUpdating}>
                {bulkUpdating ? "Updating…" : "Apply to all"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedAppIds(new Set())}>Clear</Button>
            </div>
          )}

          {/* Select all */}
          {filteredApplicants.length > 0 && (
            <div className="flex items-center gap-2 mb-1 px-1">
              <Checkbox
                id="select-all"
                checked={selectedAppIds.size === filteredApplicants.length}
                onCheckedChange={(v) => setSelectedAppIds(v ? new Set(filteredApplicants.map((a) => a.id)) : new Set())}
              />
              <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer">Select all</label>
            </div>
          )}

          <div className="space-y-2">
            {filteredApplicants.length === 0 && <div className="text-center text-muted-foreground py-6">No applicants match.</div>}
            {filteredApplicants.map((a: any) => {
              const score = matchScores.get(a.student_id);
              return (
                <div key={a.id} className="rounded-lg border p-3 flex items-center gap-3 flex-wrap">
                  <Checkbox
                    checked={selectedAppIds.has(a.id)}
                    onCheckedChange={(v) => {
                      const next = new Set(selectedAppIds);
                      v ? next.add(a.id) : next.delete(a.id);
                      setSelectedAppIds(next);
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{a.profiles?.full_name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.profiles?.email} · {a.student_profiles?.branch || "—"} · CGPA{" "}
                      <span className={a.student_profiles?.cgpa >= 8 ? "text-green-600 font-medium" : ""}>{a.student_profiles?.cgpa ?? "—"}</span>
                    </div>
                  </div>
                  {/* AI match score */}
                  {score != null && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Star className="h-3 w-3 text-amber-500" />
                      <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round(score * 100)}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">{Math.round(score * 100)}%</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 shrink-0">
                    {a.student_profiles?.resume_url && <a className="text-xs text-accent hover:underline" href={a.student_profiles.resume_url} target="_blank" rel="noreferrer">Resume</a>}
                    <Select value={a.status} onValueChange={(v) => updateStatus(a.id, v)}>
                      <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="applied">Applied</SelectItem>
                        <SelectItem value="shortlisted">Shortlisted</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="selected">Selected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
