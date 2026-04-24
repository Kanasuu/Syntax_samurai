import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fmtDate, statusColor } from "@/lib/utils-format";

export const Route = createFileRoute("/student/applications")({ component: MyApplications });

function MyApplications() {
  const { user } = useAuth();
  const [apps, setApps] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("applications")
        .select("*, opportunities(*)")
        .eq("student_id", user.id)
        .order("applied_at", { ascending: false });
      setApps(data || []);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">My applications</h1>
        <p className="text-muted-foreground">Track the status of every role you've applied to.</p>
      </div>
      <div className="grid gap-3">
        {apps.length === 0 && <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">No applications yet — head to Browse and apply!</div>}
        {apps.map((a) => (
          <div key={a.id} className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h3 className="font-display text-lg">{a.opportunities?.role_title}</h3>
              <div className="text-sm text-muted-foreground">{a.opportunities?.company_name}</div>
              <div className="text-xs text-muted-foreground mt-2">Applied {fmtDate(a.applied_at)} · Updated {fmtDate(a.updated_at)}</div>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full capitalize ${statusColor(a.status)}`}>{a.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
