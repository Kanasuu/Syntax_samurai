export function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function statusColor(status: string) {
  switch (status) {
    case "applied": return "bg-secondary text-secondary-foreground";
    case "shortlisted": return "bg-accent/15 text-accent border border-accent/30";
    case "selected": return "bg-success/15 text-success border border-success/30";
    case "rejected": return "bg-destructive/10 text-destructive border border-destructive/30";
    default: return "bg-muted text-muted-foreground";
  }
}

export function scoreColor(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-accent";
  if (score >= 40) return "text-warning";
  return "text-muted-foreground";
}
