import type { LucideIcon } from "lucide-react";

export function StatCard({ label, value, icon: Icon, hint, accent }: { label: string; value: string | number; icon: LucideIcon; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-soft)] transition-shadow">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`h-8 w-8 rounded-md grid place-items-center ${accent ? "text-primary-foreground" : "bg-secondary text-primary"}`} style={accent ? { background: "var(--gradient-primary)" } : undefined}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-3xl font-display">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
