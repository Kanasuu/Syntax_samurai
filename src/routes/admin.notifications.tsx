import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bell, Send, Users, Clock, Briefcase, CheckCircle2, ChevronRight, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/notifications")({ component: AdminNotifications });

interface Opportunity {
  id: string;
  role_title: string;
  company_name: string;
  type: string;
  ctc: string | null;
  location: string | null;
  min_cgpa: number;
  eligible_branches: string[];
  deadline: string | null;
}

interface HistoryItem {
  label: string;
  company: string;
  sentAt: string;
  count: number;
  isNew?: boolean;
}

const emptyForm = {
  company_name: "", role_title: "", description: "",
  type: "internship" as "job" | "internship",
  ctc: "", location: "", min_cgpa: "0",
  eligible_branches: "", required_skills: "", deadline: "", apply_link: "",
};

function AudienceFilters({
  branches, years, branchFilter, setBranchFilter,
  yearFilter, setYearFilter, cgpaMin, setCgpaMin, matchCount,
}: {
  branches: string[]; years: number[];
  branchFilter: string; setBranchFilter: (v: string) => void;
  yearFilter: string; setYearFilter: (v: string) => void;
  cgpaMin: string; setCgpaMin: (v: string) => void;
  matchCount: number;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Target audience</Label>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Branch</Label>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Grad Year</Label>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Min CGPA</Label>
          <Input type="number" step="0.1" min="0" max="10" placeholder="0.0"
            value={cgpaMin} onChange={(e) => setCgpaMin(e.target.value)} className="h-8 text-xs" />
        </div>
      </div>
      <div className={`rounded-lg px-4 py-2.5 text-sm flex items-center gap-2 ${matchCount > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
        <Users className="h-4 w-4 shrink-0" />
        <span>
          <strong>{matchCount}</strong> student{matchCount !== 1 ? "s" : ""} will receive this notification
          {branchFilter !== "all" && <Badge variant="outline" className="ml-2 text-[10px]">{branchFilter}</Badge>}
          {yearFilter !== "all" && <Badge variant="outline" className="ml-2 text-[10px]">{yearFilter}</Badge>}
          {cgpaMin && <Badge variant="outline" className="ml-2 text-[10px]">CGPA ≥ {cgpaMin}</Badge>}
        </span>
      </div>
    </div>
  );
}

function AdminNotifications() {
  const { user } = useAuth();

  // Shared student data
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // ── Section A: Post New Opportunity ──
  const [newForm, setNewForm] = useState(emptyForm);
  const [newBranch, setNewBranch] = useState("all");
  const [newYear, setNewYear] = useState("all");
  const [newCgpa, setNewCgpa] = useState("");
  const [posting, setPosting] = useState(false);

  // ── Section B: Alert Existing Opportunity ──
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOppId, setSelectedOppId] = useState("");
  const [exBranch, setExBranch] = useState("all");
  const [exYear, setExYear] = useState("all");
  const [exCgpa, setExCgpa] = useState("");
  const [sending, setSending] = useState(false);

  const selectedOpp = opportunities.find((o) => o.id === selectedOppId);

  useEffect(() => {
    (async () => {
      const [{ data: opps }, { data: roles }] = await Promise.all([
        supabase.from("opportunities")
          .select("id, role_title, company_name, type, ctc, location, min_cgpa, eligible_branches, deadline")
          .eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id").eq("role", "student"),
      ]);
      setOpportunities(opps || []);
      const ids = (roles || []).map((r) => r.user_id);
      if (ids.length === 0) return;
      const { data: sps } = await supabase
        .from("student_profiles").select("user_id, branch, cgpa, graduation_year").in("user_id", ids);
      setAllStudents(sps || []);
      setBranches(Array.from(new Set((sps || []).map((s: any) => s.branch).filter(Boolean))).sort() as string[]);
      setYears(Array.from(new Set((sps || []).map((s: any) => s.graduation_year).filter(Boolean))).sort() as number[]);
    })();
  }, []);

  // Auto-fill filters when existing opp is selected
  useEffect(() => {
    if (!selectedOpp) return;
    if (selectedOpp.min_cgpa > 0) setExCgpa(String(selectedOpp.min_cgpa));
    else setExCgpa("");
    setExBranch("all");
  }, [selectedOppId]);

  const filterStudents = (branch: string, year: string, cgpa: string) =>
    allStudents.filter((s) => {
      if (branch !== "all" && s.branch !== branch) return false;
      if (year !== "all" && String(s.graduation_year) !== year) return false;
      const min = cgpa ? parseFloat(cgpa) : 0;
      if (min > 0 && (s.cgpa == null || s.cgpa < min)) return false;
      return true;
    });

  const newMatching = filterStudents(newBranch, newYear, newCgpa);
  const exMatching  = filterStudents(exBranch, exYear, exCgpa);

  const sendNotifications = async (
    studentList: any[], oppId: string, title: string, body: string
  ) => {
    const rows = studentList.map((s) => ({
      user_id: s.user_id, type: "new_opportunity", title, body, opportunity_id: oppId,
    }));
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await supabase.from("notifications").insert(rows.slice(i, i + 50));
      if (error) throw error;
    }
  };

  // ── Post new opportunity + notify ──
  const postAndNotify = async () => {
    if (!user) return;
    if (!newForm.company_name || !newForm.role_title || !newForm.description) {
      toast.error("Company, role title and description are required.");
      return;
    }
    if (newMatching.length === 0) {
      toast.error("No students match your filters.");
      return;
    }
    if (!confirm(`Post "${newForm.role_title}" and notify ${newMatching.length} student(s)?`)) return;
    setPosting(true);
    try {
      const payload = {
        company_name: newForm.company_name.trim(),
        role_title: newForm.role_title.trim(),
        description: newForm.description.trim(),
        type: newForm.type,
        ctc: newForm.ctc.trim() || null,
        location: newForm.location.trim() || null,
        min_cgpa: parseFloat(newForm.min_cgpa) || 0,
        eligible_branches: newForm.eligible_branches.split(",").map((s) => s.trim()).filter(Boolean),
        required_skills: newForm.required_skills.split(",").map((s) => s.trim()).filter(Boolean),
        deadline: newForm.deadline || null,
        apply_link: newForm.apply_link.trim() || null,
        posted_by: user.id,
      };
      const { data: opp, error } = await supabase.from("opportunities").insert(payload).select().single();
      if (error) throw error;

      // Trigger AI recommendations
      supabase.functions.invoke("match-recommendations", { body: { opportunityId: opp.id, trigger: "new_opportunity" } }).catch(() => {});

      const ctcPart = newForm.ctc ? ` · CTC: ${newForm.ctc}` : "";
      const locPart = newForm.location ? ` · ${newForm.location}` : "";
      const deadlinePart = newForm.deadline
        ? ` · Deadline: ${new Date(newForm.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
        : "";
      const title = `New ${newForm.type === "internship" ? "Internship" : "Job"}: ${newForm.role_title} at ${newForm.company_name}`;
      const body = `${newForm.type === "internship" ? "Internship" : "Job"} opportunity${locPart}${ctcPart}${deadlinePart}. Tap to view details and apply.`;

      await sendNotifications(newMatching, opp.id, title, body);

      toast.success(`Posted & notified ${newMatching.length} student(s)!`);
      setHistory((h) => [{ label: newForm.role_title, company: newForm.company_name, sentAt: new Date().toISOString(), count: newMatching.length, isNew: true }, ...h]);
      setNewForm(emptyForm);
      setNewBranch("all"); setNewYear("all"); setNewCgpa("");

      // Refresh existing opportunities list
      const { data: refreshed } = await supabase.from("opportunities")
        .select("id, role_title, company_name, type, ctc, location, min_cgpa, eligible_branches, deadline")
        .eq("is_active", true).order("created_at", { ascending: false });
      setOpportunities(refreshed || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to post opportunity");
    } finally {
      setPosting(false);
    }
  };

  // ── Alert existing opportunity ──
  const alertExisting = async () => {
    if (!user || !selectedOppId) return;
    if (exMatching.length === 0) { toast.error("No students match your filters."); return; }
    if (!confirm(`Notify ${exMatching.length} student(s) about "${selectedOpp?.role_title}"?`)) return;
    setSending(true);
    try {
      const ctcPart = selectedOpp?.ctc ? ` · CTC: ${selectedOpp.ctc}` : "";
      const locPart = selectedOpp?.location ? ` · ${selectedOpp.location}` : "";
      const deadlinePart = selectedOpp?.deadline
        ? ` · Deadline: ${new Date(selectedOpp.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
        : "";
      const title = `Opportunity: ${selectedOpp?.role_title} at ${selectedOpp?.company_name}`;
      const body = `${selectedOpp?.type === "internship" ? "Internship" : "Job"} opportunity${locPart}${ctcPart}${deadlinePart}. Tap to view and apply.`;
      await sendNotifications(exMatching, selectedOppId, title, body);
      toast.success(`Notified ${exMatching.length} student(s)!`);
      setHistory((h) => [{ label: selectedOpp?.role_title || "", company: selectedOpp?.company_name || "", sentAt: new Date().toISOString(), count: exMatching.length }, ...h]);
      setSelectedOppId(""); setExBranch("all"); setExYear("all"); setExCgpa("");
    } catch (err: any) {
      toast.error(err.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl">Targeted Notifications</h1>
        <p className="text-muted-foreground">Post new opportunities or alert students about existing ones — with direct apply links in their notification bell.</p>
      </div>

      {/* ══════════════════════════════════════════
          SECTION A: POST NEW + NOTIFY
      ══════════════════════════════════════════ */}
      <div className="rounded-xl border-2 border-primary/20 bg-card p-6 shadow-[var(--shadow-card)] space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center">
            <Plus className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold">Post New Opportunity & Notify Students</div>
            <p className="text-xs text-muted-foreground">Creates the opportunity in the system and instantly pushes it to matched students.</p>
          </div>
        </div>

        <div className="grid gap-4">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Company name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Google" value={newForm.company_name} onChange={(e) => setNewForm({ ...newForm, company_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Role title <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Software Engineer" value={newForm.role_title} onChange={(e) => setNewForm({ ...newForm, role_title: e.target.value })} />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label>Description <span className="text-destructive">*</span></Label>
            <Textarea rows={3} placeholder="Job responsibilities, skills required, perks…" value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} />
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={newForm.type} onValueChange={(v) => setNewForm({ ...newForm, type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internship">Internship</SelectItem>
                  <SelectItem value="job">Full-time Job</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>CTC / Stipend</Label>
              <Input placeholder="12 LPA" value={newForm.ctc} onChange={(e) => setNewForm({ ...newForm, ctc: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Location</Label>
              <Input placeholder="Bangalore / Remote" value={newForm.location} onChange={(e) => setNewForm({ ...newForm, location: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Deadline</Label>
              <Input type="date" value={newForm.deadline} onChange={(e) => setNewForm({ ...newForm, deadline: e.target.value })} />
            </div>
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Min CGPA</Label>
              <Input type="number" step="0.1" min="0" max="10" placeholder="0" value={newForm.min_cgpa} onChange={(e) => setNewForm({ ...newForm, min_cgpa: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Eligible branches</Label>
              <Input placeholder="CSE, ECE (leave blank = all)" value={newForm.eligible_branches} onChange={(e) => setNewForm({ ...newForm, eligible_branches: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Required skills</Label>
              <Input placeholder="Python, React, SQL" value={newForm.required_skills} onChange={(e) => setNewForm({ ...newForm, required_skills: e.target.value })} />
            </div>
          </div>

          {newForm.type === "internship" && (
            <div className="space-y-1">
              <Label>Apply link (external URL)</Label>
              <Input placeholder="https://apply.company.com/..." value={newForm.apply_link} onChange={(e) => setNewForm({ ...newForm, apply_link: e.target.value })} />
            </div>
          )}

          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Posting will also trigger AI ranking for matched students.
          </div>

          {/* Audience filters */}
          <AudienceFilters
            branches={branches} years={years}
            branchFilter={newBranch} setBranchFilter={setNewBranch}
            yearFilter={newYear} setYearFilter={setNewYear}
            cgpaMin={newCgpa} setCgpaMin={setNewCgpa}
            matchCount={newMatching.length}
          />

          <Button
            onClick={postAndNotify}
            disabled={posting || !newForm.company_name || !newForm.role_title || !newForm.description || newMatching.length === 0}
            className="w-full gap-2"
          >
            <Send className="h-4 w-4" />
            {posting ? "Posting…" : `Post & notify ${newMatching.length} student${newMatching.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SECTION B: ALERT EXISTING OPPORTUNITY
      ══════════════════════════════════════════ */}
      <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-accent/10 grid place-items-center">
            <Bell className="h-4 w-4 text-accent" />
          </div>
          <div>
            <div className="font-semibold">Alert Students about an Existing Opportunity</div>
            <p className="text-xs text-muted-foreground">Pick from already-posted opportunities and push to targeted students.</p>
          </div>
        </div>

        {/* Opportunity picker */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Choose opportunity</Label>
          <Select value={selectedOppId} onValueChange={setSelectedOppId}>
            <SelectTrigger>
              <SelectValue placeholder="Select an active opportunity…" />
            </SelectTrigger>
            <SelectContent>
              {opportunities.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">No active opportunities.</div>
              )}
              {opportunities.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  <span className="font-medium">{o.role_title}</span>
                  <span className="text-muted-foreground ml-1">— {o.company_name}</span>
                  <Badge variant="outline" className="ml-2 text-[9px] uppercase">{o.type}</Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Opportunity preview */}
        {selectedOpp && (
          <div className="rounded-lg border bg-muted/40 p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-accent" />
              <span className="font-semibold text-sm">{selectedOpp.role_title}</span>
              <Badge variant="secondary" className="text-[10px] uppercase">{selectedOpp.type}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{selectedOpp.company_name}</p>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {selectedOpp.location && <span>📍 {selectedOpp.location}</span>}
              {selectedOpp.ctc && <span>💰 {selectedOpp.ctc}</span>}
              {selectedOpp.min_cgpa > 0 && <span>🎓 Min CGPA: {selectedOpp.min_cgpa}</span>}
              {selectedOpp.deadline && (
                <span>📅 {new Date(selectedOpp.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
              )}
            </div>
            {selectedOpp.eligible_branches.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedOpp.eligible_branches.map((b) => (
                  <Badge key={b} variant="outline" className="text-[10px]">{b}</Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <AudienceFilters
          branches={branches} years={years}
          branchFilter={exBranch} setBranchFilter={setExBranch}
          yearFilter={exYear} setYearFilter={setExYear}
          cgpaMin={exCgpa} setCgpaMin={setExCgpa}
          matchCount={exMatching.length}
        />

        <Button
          onClick={alertExisting}
          disabled={sending || !selectedOppId || exMatching.length === 0}
          className="w-full gap-2"
          variant="secondary"
        >
          <Send className="h-4 w-4" />
          {sending ? "Sending…" : `Notify ${exMatching.length} student${exMatching.length !== 1 ? "s" : ""} → Apply link included`}
        </Button>
      </div>

      {/* ══════════════════════════════════════════
          SESSION HISTORY
      ══════════════════════════════════════════ */}
      <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-accent" />
          Sent This Session
        </div>
        {history.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center rounded-lg border border-dashed space-y-2">
            <Bell className="h-8 w-8 mx-auto opacity-20" />
            <p>Nothing sent yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((h, i) => (
              <div key={i} className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{h.label}</span>
                    {h.isNew && <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">New post</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{h.company}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="secondary" className="text-[10px]">{h.count} recipients</Badge>
                    <span className="text-[10px] text-muted-foreground">{new Date(h.sentAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground space-y-1.5 border border-dashed">
          <p className="font-medium text-foreground text-sm mb-2">How it works</p>
          <div className="flex items-start gap-2"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" /><span>Students receive a real-time notification in their bell icon.</span></div>
          <div className="flex items-start gap-2"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" /><span>Each notification has a <strong>View & Apply</strong> button linking directly to the opportunity.</span></div>
          <div className="flex items-start gap-2"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" /><span>New posts also trigger AI-based match scoring for all matched students.</span></div>
        </div>
      </div>
    </div>
  );
}
