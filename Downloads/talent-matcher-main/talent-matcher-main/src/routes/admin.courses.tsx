import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/courses")({ component: ManageCourses });

function ManageCourses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [opps, setOpps] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", provider: "", url: "", description: "", tags: "", opportunity_id: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: c }, { data: o }] = await Promise.all([
      supabase.from("courses").select("*, opportunities(role_title, company_name)").order("created_at", { ascending: false }),
      supabase.from("opportunities").select("id, role_title, company_name").eq("is_active", true),
    ]);
    setCourses(c || []);
    setOpps(o || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("courses").insert({
      title: form.title.trim(),
      provider: form.provider.trim() || null,
      url: form.url.trim(),
      description: form.description.trim() || null,
      tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
      opportunity_id: form.opportunity_id || null,
      added_by: user.id,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Course added"); setOpen(false); setForm({ title: "", provider: "", url: "", description: "", tags: "", opportunity_id: "" }); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this course?")) return;
    await supabase.from("courses").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl">Learning resources</h1>
          <p className="text-muted-foreground">Curate courses students should explore.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Add resource</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {courses.length === 0 && <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground md:col-span-2">No resources yet.</div>}
        {courses.map((c) => (
          <div key={c.id} className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs uppercase text-accent"><BookOpen className="h-3 w-3" />{c.provider || "Course"}</div>
                <h3 className="font-display text-lg mt-1">{c.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(c.tags || []).map((t: string) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                </div>
                {c.opportunities && <div className="text-xs text-muted-foreground mt-2">For: {c.opportunities.role_title} @ {c.opportunities.company_name}</div>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
            <a href={c.url} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline inline-flex items-center gap-1 mt-3">Open <ExternalLink className="h-3 w-3" /></a>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add resource</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Provider</Label><Input placeholder="Coursera" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></div>
              <div>
                <Label>Linked opportunity (optional)</Label>
                <Select value={form.opportunity_id} onValueChange={(v) => setForm({ ...form, opportunity_id: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>{opps.map((o) => <SelectItem key={o.id} value={o.id}>{o.role_title} — {o.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.title || !form.url}>{saving ? "Saving…" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
