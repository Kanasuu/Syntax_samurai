import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Calendar, MapPin, IndianRupee, ShieldX } from "lucide-react";
import { fmtDate } from "@/lib/utils-format";

type Opportunity = Tables<"opportunities">;

interface OpportunityCardProps {
  opp: Opportunity & { apply_link?: string | null };
  onApply?: () => void;
  applied?: boolean;
  applying?: boolean;
  eligible?: boolean;
  ineligibleReason?: string;
}

export function OpportunityCard({ opp, onApply, applied, applying, eligible = true, ineligibleReason }: OpportunityCardProps) {
  return (
    <div className={`rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] transition-all ${eligible ? "hover:shadow-[var(--shadow-soft)]" : "opacity-50 grayscale"}`}>
      {!eligible && ineligibleReason && (
        <div className="flex items-center gap-1.5 text-xs text-destructive mb-3 bg-destructive/10 rounded-md px-2.5 py-1.5">
          <ShieldX className="h-3.5 w-3.5 shrink-0" />
          {ineligibleReason}
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-accent flex items-center gap-1.5">
            <Briefcase className="h-3 w-3" />
            {opp.type}
          </div>
          <h3 className="font-display text-xl mt-1 leading-tight">{opp.role_title}</h3>
          <div className="text-sm text-muted-foreground mt-0.5">{opp.company_name}</div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{opp.description}</p>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {(opp.domain_tags || []).slice(0, 4).map((t) => (
          <Badge key={t} variant="secondary" className="text-[10px] uppercase tracking-wider">{t}</Badge>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-muted-foreground">
        {opp.location && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{opp.location}</div>}
        {opp.ctc && <div className="flex items-center gap-1.5"><IndianRupee className="h-3 w-3" />{opp.ctc}</div>}
        {opp.deadline && <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />Apply by {fmtDate(opp.deadline)}</div>}
        {opp.min_cgpa != null && <div>Min CGPA: <span className="text-foreground font-medium">{Number(opp.min_cgpa).toFixed(2)}</span></div>}
      </div>

      {onApply && (
        <div className="mt-4 flex justify-end">
          <Button onClick={() => {
            if ((opp as any).apply_link) window.open((opp as any).apply_link, "_blank");
            onApply();
          }} disabled={!eligible || applied || applying} variant={applied ? "secondary" : "default"} size="sm">
            {!eligible ? "Not Eligible" : applied ? "Applied ✓" : applying ? "Applying..." : (opp as any).apply_link ? "Apply Externally" : "Apply Now"}
          </Button>
        </div>
      )}
    </div>
  );
}
