import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { OpportunityCard } from "@/components/shared/OpportunityCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/student/browse")({ 
  component: BrowseOpportunities,
  validateSearch: (s: Record<string, unknown>) => ({ highlight: s.highlight as string | undefined }),
});

type Opp = Tables<"opportunities">;

interface StudentProfile {
  cgpa: number | null;
  branch: string | null;
}

function checkEligibility(opp: Opp, profile: StudentProfile | null): { eligible: boolean; reason: string } {
  if (!profile) return { eligible: true, reason: "" };

  const reasons: string[] = [];

  // Check CGPA
  if (profile.cgpa != null && opp.min_cgpa != null && Number(opp.min_cgpa) > 0) {
    if (Number(profile.cgpa) < Number(opp.min_cgpa)) {
      reasons.push(`CGPA ${Number(profile.cgpa).toFixed(2)} < required ${Number(opp.min_cgpa).toFixed(2)}`);
    }
  }

  // Check branch
  const branches = opp.eligible_branches || [];
  if (branches.length > 0 && profile.branch) {
    const studentBranch = profile.branch.toLowerCase().trim();
    const allowed = branches.map((b) => b.toLowerCase().trim());
    if (!allowed.includes(studentBranch)) {
      reasons.push(`${profile.branch} not in eligible branches (${branches.join(", ")})`);
    }
  }

  return {
    eligible: reasons.length === 0,
    reason: reasons.join(" · "),
  };
}

function BrowseOpportunities() {
  const { user } = useAuth();
  const { highlight } = Route.useSearch();
  const [opps, setOpps] = useState<Opp[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [applying, setApplying] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("opportunities").select("*").eq("is_active", true).order("created_at", { ascending: false });
    setOpps((data || []) as Opp[]);
    if (user) {
      const [{ data: apps }, { data: sp }] = await Promise.all([
        supabase.from("applications").select("opportunity_id").eq("student_id", user.id),
        supabase.from("student_profiles").select("cgpa, branch").eq("user_id", user.id).maybeSingle(),
      ]);
      setAppliedIds(new Set((apps || []).map((a) => a.opportunity_id)));
      setStudentProfile(sp as StudentProfile | null);
    }
  };

  useEffect(() => { load(); }, [user]);

  // Scroll to highlighted card after load
  useEffect(() => {
    if (!highlight || opps.length === 0) return;
    const el = document.getElementById(`opp-${highlight}`);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    }
  }, [highlight, opps]);

  const apply = async (oppId: string) => {
    if (!user) return;
    setApplying(oppId);
    const { error } = await supabase.from("applications").insert({ student_id: user.id, opportunity_id: oppId });
    setApplying(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Application submitted!");
    setAppliedIds((p) => new Set([...p, oppId]));
  };

  // Text/type filtering
  const textFiltered = opps.filter((o) => {
    if (type !== "all" && o.type !== type) return false;
    if (q && !((o.role_title + " " + o.company_name + " " + (o.domain_tags || []).join(" ") + " " + (o.required_skills || []).join(" ")).toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  // Eligibility check for each opportunity
  const withEligibility = textFiltered.map((o) => {
    const { eligible, reason } = checkEligibility(o, studentProfile);
    return { ...o, eligible, reason };
  });

  const eligibleCount = withEligibility.filter((o) => o.eligible).length;
  const totalCount = withEligibility.length;

  // Final display: eligible first, then ineligible (if showAll)
  const eligibleOpps = withEligibility.filter((o) => o.eligible);
  const ineligibleOpps = withEligibility.filter((o) => !o.eligible);
  const displayOpps = showAll ? [...eligibleOpps, ...ineligibleOpps] : eligibleOpps;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Browse opportunities</h1>
        <p className="text-muted-foreground">All active jobs and internships.</p>
      </div>

      {/* Qualification Counter */}
      {studentProfile && (
        <div className="flex items-center justify-between flex-wrap gap-3 rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium">
              You qualify for <span className="text-accent font-display text-lg">{eligibleCount}</span> out of <span className="font-display text-lg">{totalCount}</span> {totalCount === 1 ? "company" : "companies"}
            </span>
            {studentProfile.cgpa != null && (
              <span className="text-xs text-muted-foreground ml-2">(CGPA: {Number(studentProfile.cgpa).toFixed(2)} · Branch: {studentProfile.branch || "Not set"})</span>
            )}
          </div>
          {ineligibleOpps.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)} className="gap-1.5">
              {showAll ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showAll ? "Hide ineligible" : `Show all (${ineligibleOpps.length} hidden)`}
            </Button>
          )}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search by company, role, skill…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="job">Jobs</SelectItem>
            <SelectItem value="internship">Internships</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Opportunity Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {displayOpps.length === 0 && <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground md:col-span-2 xl:col-span-3">No opportunities match.</div>}
        {displayOpps.map((o) => (
          <div
            key={o.id}
            id={`opp-${o.id}`}
            className={highlight === o.id ? "ring-2 ring-accent ring-offset-2 rounded-xl" : ""}
          >
            <OpportunityCard
              opp={o}
              onApply={() => apply(o.id)}
              applied={appliedIds.has(o.id)}
              applying={applying === o.id}
              eligible={o.eligible}
              ineligibleReason={o.reason}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
