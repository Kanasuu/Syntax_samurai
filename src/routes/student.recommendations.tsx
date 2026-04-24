import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Calendar, MapPin, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { fmtDate, scoreColor } from "@/lib/utils-format";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/student/recommendations")({ component: AIRecommendations });

function AIRecommendations() {
  const { user } = useAuth();
  const [studentProfile, setStudentProfile] = useState<{ cgpa: number | null; branch: string | null } | null>(null);
  const [recs, setRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data }, { data: apps }, { data: sp }] = await Promise.all([
      supabase.from("recommendations").select("*, opportunities(*)").eq("student_id", user.id).order("score", { ascending: false }),
      supabase.from("applications").select("opportunity_id").eq("student_id", user.id),
      supabase.from("student_profiles").select("cgpa, branch").eq("user_id", user.id).maybeSingle(),
    ]);
    setRecs((data || []).filter((r: any) => r.opportunities));
    setAppliedIds(new Set((apps || []).map((a) => a.opportunity_id)));
    setStudentProfile(sp);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const refresh = async () => {
    if (!user) return;
    setRefreshing(true);
    const { error } = await supabase.functions.invoke("match-recommendations", { body: { studentId: user.id, trigger: "manual" } });
    setRefreshing(false);
    if (error) { toast.error(error.message); return; }
    toast.success("AI re-ranked your matches");
    load();
  };

  const apply = async (oppId: string) => {
    if (!user) return;
    const { error } = await supabase.from("applications").insert({ student_id: user.id, opportunity_id: oppId });
    if (error) { toast.error(error.message); return; }
    setAppliedIds((p) => new Set([...p, oppId]));
    toast.success("Applied!");
  };

  if (loading) return <div className="text-muted-foreground">Loading recommendations…</div>;

  const checkEligibility = (opp: any) => {
    if (!studentProfile) return { eligible: true, reason: "" };
    const reasons: string[] = [];
    if (studentProfile.cgpa != null && opp.min_cgpa != null && Number(opp.min_cgpa) > 0) {
      if (Number(studentProfile.cgpa) < Number(opp.min_cgpa)) {
        reasons.push(`CGPA ${Number(studentProfile.cgpa).toFixed(2)} < required ${Number(opp.min_cgpa).toFixed(2)}`);
      }
    }
    const branches = opp.eligible_branches || [];
    if (branches.length > 0 && studentProfile.branch) {
      const studentBranch = studentProfile.branch.toLowerCase().trim();
      const allowed = branches.map((b: string) => b.toLowerCase().trim());
      if (!allowed.includes(studentBranch)) {
        reasons.push(`${studentProfile.branch} not in eligible branches (${branches.join(", ")})`);
      }
    }
    return { eligible: reasons.length === 0, reason: reasons.join(" · ") };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-4xl flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-accent" /> AI recommendations
          </h1>
          <p className="text-muted-foreground">Personalized matches ranked by an AI advisor.</p>
        </div>
        <Button onClick={refresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Analysing…" : "Refresh with AI"}
        </Button>
      </div>

      {recs.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground" />
          <h3 className="font-display text-xl mt-3">No recommendations yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">Complete your profile and upload a resume — the AI will rank every opportunity for you in seconds.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {recs.map((r) => {
            const o = r.opportunities;
            const applied = appliedIds.has(o.id);
            return (
              <div key={r.id} className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-soft)] transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wider text-accent flex items-center gap-1.5"><Briefcase className="h-3 w-3" />{o.type}</div>
                    <h3 className="font-display text-xl mt-1 leading-tight">{o.role_title}</h3>
                    <div className="text-sm text-muted-foreground">{o.company_name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-display text-3xl ${scoreColor(r.score)}`}>{Math.round(r.score)}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">/ 100 match</div>
                  </div>
                </div>
                <div className="mt-3 rounded-md border-l-2 border-accent bg-accent/5 px-3 py-2 text-sm">
                  <span className="text-[10px] uppercase tracking-wider text-accent flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI analysis</span>
                  <p className="mt-0.5">{r.reason}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(o.domain_tags || []).slice(0, 4).map((t: string) => <Badge key={t} variant="secondary" className="text-[10px] uppercase">{t}</Badge>)}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-muted-foreground">
                  {o.location && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{o.location}</div>}
                  {o.deadline && <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />Apply by {fmtDate(o.deadline)}</div>}
                </div>
                
                {(() => {
                  const { eligible, reason } = checkEligibility(o);
                  return (
                    <div className="mt-4 flex flex-col items-end gap-2">
                      {!eligible && (
                        <div className="text-[11px] text-destructive font-medium bg-destructive/10 px-2 py-1 rounded">
                          Not Eligible: {reason}
                        </div>
                      )}
                      <Button 
                        size="sm" 
                        disabled={applied || !eligible} 
                        onClick={() => apply(o.id)} 
                        variant={applied ? "secondary" : (eligible ? "default" : "outline")}
                      >
                        {applied ? "Applied ✓" : (!eligible ? "Not Eligible" : "Apply Now")}
                      </Button>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
