import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatCard } from "@/components/shared/StatCard";
import { Sparkles, Briefcase, ClipboardList, Trophy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/student/")({ component: StudentDashboard });

function StudentDashboard() {
  const { user, fullName } = useAuth();
  const [stats, setStats] = useState({ apps: 0, recs: 0, opportunities: 0, selected: 0 });
  const [topRecs, setTopRecs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ count: apps }, { count: recs }, { count: opps }, { count: selected }, { data: top }] = await Promise.all([
        supabase.from("applications").select("*", { count: "exact", head: true }).eq("student_id", user.id),
        supabase.from("recommendations").select("*", { count: "exact", head: true }).eq("student_id", user.id),
        supabase.from("opportunities").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("applications").select("*", { count: "exact", head: true }).eq("student_id", user.id).eq("status", "selected"),
        supabase.from("recommendations")
          .select("score, reason, opportunities(id, role_title, company_name, type)")
          .eq("student_id", user.id)
          .order("score", { ascending: false })
          .limit(3),
      ]);
      setStats({ apps: apps || 0, recs: recs || 0, opportunities: opps || 0, selected: selected || 0 });
      setTopRecs(top || []);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Welcome, {fullName?.split(" ")[0] || "there"}.</h1>
        <p className="text-muted-foreground">Here's a snapshot of your placement journey.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active opportunities" value={stats.opportunities} icon={Briefcase} accent />
        <StatCard label="AI recommendations" value={stats.recs} icon={Sparkles} />
        <StatCard label="Your applications" value={stats.apps} icon={ClipboardList} />
        <StatCard label="Offers received" value={stats.selected} icon={Trophy} />
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-xl flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> Top AI matches</h2>
            <p className="text-xs text-muted-foreground">Based on your profile and resume.</p>
          </div>
          <Link to="/student/recommendations"><Button variant="ghost" size="sm">See all <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>
        </div>
        {topRecs.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No matches yet — <Link to="/student/profile" className="text-accent hover:underline">complete your profile</Link> to unlock AI recommendations.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {topRecs.map((r: any) => (
              <div key={r.opportunities.id} className="rounded-lg border p-4 bg-secondary/30">
                <div className="flex items-baseline justify-between">
                  <div className="text-xs uppercase tracking-wider text-accent">{r.opportunities.type}</div>
                  <div className="font-display text-2xl">{Math.round(r.score)}<span className="text-xs text-muted-foreground">/100</span></div>
                </div>
                <h4 className="font-medium mt-1">{r.opportunities.role_title}</h4>
                <div className="text-xs text-muted-foreground">{r.opportunities.company_name}</div>
                <p className="text-xs mt-2 line-clamp-3 text-muted-foreground">{r.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
