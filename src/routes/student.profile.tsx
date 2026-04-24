import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, FileText, Sparkles, X } from "lucide-react";

export const Route = createFileRoute("/student/profile")({ component: EditProfile });

function EditProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    cgpa: "", branch: "", graduation_year: "", linkedin_url: "", github_url: "",
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("student_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setProfile({
          cgpa: data.cgpa?.toString() || "",
          branch: data.branch || "",
          graduation_year: data.graduation_year?.toString() || "",
          linkedin_url: data.linkedin_url || "",
          github_url: data.github_url || "",
        });
        setSkills(data.skills || []);
        setInterests(data.interests || []);
        setResumeUrl(data.resume_url);
        setResumeText((data as any).resume_text || null);
      }
    })();
  }, [user]);

  const addTag = (val: string, list: string[], setter: (v: string[]) => void, clear: () => void) => {
    const v = val.trim();
    if (!v || list.includes(v)) return;
    setter([...list, v]);
    clear();
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    
    // Auto-add pending inputs if user forgot to click "Add"
    let finalSkills = [...skills];
    if (skillInput.trim() && !finalSkills.includes(skillInput.trim())) {
      finalSkills.push(skillInput.trim());
      setSkillInput("");
      setSkills(finalSkills);
    }
    
    let finalInterests = [...interests];
    if (interestInput.trim() && !finalInterests.includes(interestInput.trim())) {
      finalInterests.push(interestInput.trim());
      setInterestInput("");
      setInterests(finalInterests);
    }

    const payload = {
      user_id: user.id,
      cgpa: profile.cgpa ? parseFloat(profile.cgpa) : null,
      branch: profile.branch.trim() || null,
      graduation_year: profile.graduation_year ? parseInt(profile.graduation_year) : null,
      linkedin_url: profile.linkedin_url.trim() || null,
      github_url: profile.github_url.trim() || null,
      skills: finalSkills,
      interests: finalInterests,
    };
    console.log("Saving profile payload:", JSON.stringify(payload));
    const { error, data } = await supabase.from("student_profiles").upsert(payload as any, { onConflict: "user_id" }).select();
    console.log("Save result:", { data, error });
    setSaving(false);
    if (error) { toast.error("Save failed: " + error.message); console.error("Supabase save error:", error); return; }
    toast.success("Profile saved — AI is re-ranking matches…");
    supabase.functions.invoke("match-recommendations", { body: { studentId: user.id, trigger: "profile_update" } }).catch(() => {});
  };

  const onFile = async (file: File) => {
    if (!user) return;
    if (file.type !== "application/pdf") { toast.error("Please upload a PDF resume"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    setUploading(true);
    const path = `${user.id}/resume.pdf`;
    const { error: upErr } = await supabase.storage.from("resumes").upload(path, file, { upsert: true, contentType: "application/pdf" });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }

    // Get a signed URL for storage and persist on profile
    const { data: signed } = await supabase.storage.from("resumes").createSignedUrl(path, 60 * 60 * 24 * 30);
    const url = signed?.signedUrl || null;
    await supabase.from("student_profiles").update({ resume_url: url, resume_path: path } as any).eq("user_id", user.id);
    setResumeUrl(url);
    toast.success("Resume uploaded — AI is reading it…");

    const { data: parseData, error: parseErr } = await supabase.functions.invoke("parse-resume", { body: { resumePath: path } });
    setUploading(false);
    if (parseErr) { toast.error("Resume parsing failed: " + parseErr.message); return; }
    const summary = (parseData as any)?.summary;
    if (summary) {
      setResumeText(summary);
      toast.success("Resume analysed and AI matches are updating!");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Your profile</h1>
        <p className="text-muted-foreground">Keep this fresh — every change re-trains your AI recommendations.</p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl mb-4">Resume</h2>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
          className="border-2 border-dashed border-input rounded-lg p-6 text-center hover:bg-secondary/30 cursor-pointer transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <input type="file" accept="application/pdf" ref={fileRef} className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
          <div className="mt-2 text-sm">{uploading ? "Uploading and analysing…" : "Drop a PDF or click to upload"}</div>
          <div className="text-xs text-muted-foreground">Max 5MB · PDF only</div>
        </div>
        {resumeUrl && (
          <div className="mt-4 flex items-center justify-between rounded-md border bg-secondary/30 px-3 py-2">
            <div className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-accent" /> Current resume</div>
            <a href={resumeUrl} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline">View</a>
          </div>
        )}
        {resumeText && (
          <div className="mt-3 rounded-md bg-accent/5 border-l-2 border-accent px-3 py-2 text-xs">
            <div className="flex items-center gap-1 text-accent uppercase tracking-wider"><Sparkles className="h-3 w-3" /> AI summary</div>
            <p className="mt-1 text-muted-foreground line-clamp-4">{resumeText}</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] space-y-4">
        <h2 className="font-display text-xl">Academic & links</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><Label>CGPA</Label><Input type="number" step="0.01" max="10" value={profile.cgpa} onChange={(e) => setProfile({ ...profile, cgpa: e.target.value })} /></div>
          <div><Label>Branch</Label><Input placeholder="CSE / ECE / ME…" value={profile.branch} onChange={(e) => setProfile({ ...profile, branch: e.target.value })} /></div>
          <div><Label>Graduation year</Label><Input type="number" min="2000" max="2100" value={profile.graduation_year} onChange={(e) => setProfile({ ...profile, graduation_year: e.target.value })} /></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>LinkedIn</Label><Input value={profile.linkedin_url} onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })} /></div>
          <div><Label>GitHub</Label><Input value={profile.github_url} onChange={(e) => setProfile({ ...profile, github_url: e.target.value })} /></div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] space-y-3">
        <h2 className="font-display text-xl">Skills & interests</h2>
        <div>
          <Label>Skills</Label>
          <div className="flex gap-2">
            <Input placeholder="Add a skill and press Enter" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(skillInput, skills, setSkills, () => setSkillInput("")); } }} />
            <Button type="button" onClick={() => addTag(skillInput, skills, setSkills, () => setSkillInput(""))}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {skills.map((s) => <Badge key={s} variant="secondary" className="cursor-pointer" onClick={() => setSkills(skills.filter((x) => x !== s))}>{s} <X className="h-3 w-3 ml-1" /></Badge>)}
          </div>
        </div>
        <div>
          <Label>Interests / domains</Label>
          <div className="flex gap-2">
            <Input placeholder="fintech, ML, web3…" value={interestInput} onChange={(e) => setInterestInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(interestInput, interests, setInterests, () => setInterestInput("")); } }} />
            <Button type="button" onClick={() => addTag(interestInput, interests, setInterests, () => setInterestInput(""))}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {interests.map((s) => <Badge key={s} variant="secondary" className="cursor-pointer" onClick={() => setInterests(interests.filter((x) => x !== s))}>{s} <X className="h-3 w-3 ml-1" /></Badge>)}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">{saving ? "Saving…" : "Save profile"}</Button>
      </div>
    </div>
  );
}
