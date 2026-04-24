import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { chatWithGroq, parseJsonResponse } from "@/lib/groq";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BookOpen, Lightbulb, MessageSquare, ChevronDown, ChevronUp,
  Loader2, Sparkles, Building2, BriefcaseBusiness, Target, Users
} from "lucide-react";

export const Route = createFileRoute("/student/interview-prep")({ component: InterviewPrep });

interface PrepData {
  companyOverview: string;
  interviewProcess: string[];
  tips: string[];
  commonQuestions: { category: string; question: string; hint: string }[];
  resources: string[];
}

function InterviewPrep() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [prep, setPrep] = useState<PrepData | null>(null);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("applications")
        .select("id, opportunity_id, status, opportunities(role_title, company_name, type, description, required_skills, domain_tags)")
        .eq("student_id", user.id)
        .order("applied_at", { ascending: false });
      setApplications(data || []);
    })();
  }, [user]);

  const generatePrep = async () => {
    const app = applications.find((a) => a.id === selectedApp);
    if (!app?.opportunities) return;
    setLoading(true);
    setError("");
    setPrep(null);

    const opp = app.opportunities;
    try {
      const response = await chatWithGroq([
        {
          role: "system",
          content: `You are an expert placement/interview coach. Return ONLY valid JSON, no other text. The JSON must match this schema:
{
  "companyOverview": "2-3 sentence overview of the company and what they look for",
  "interviewProcess": ["Step 1: ...", "Step 2: ..."],
  "tips": ["tip1", "tip2", ...],
  "commonQuestions": [{"category": "Technical|HR|Behavioral|Situational", "question": "...", "hint": "brief answer hint"}],
  "resources": ["resource description 1", "resource description 2"]
}
Generate 8-10 common questions across categories. Make tips specific to this company/role.`
        },
        {
          role: "user",
          content: `Prepare interview prep material for:
Company: ${opp.company_name}
Role: ${opp.role_title} (${opp.type})
Description: ${opp.description || "N/A"}
Required Skills: ${(opp.required_skills || []).join(", ") || "N/A"}
Domain: ${(opp.domain_tags || []).join(", ") || "N/A"}`
        }
      ], { temperature: 0.7, max_tokens: 2048 });

      const data = parseJsonResponse<PrepData>(response);
      setPrep(data);
    } catch (e: any) {
      setError(e.message || "Failed to generate prep material");
    }
    setLoading(false);
  };

  const categoryIcon = (cat: string) => {
    if (cat === "Technical") return "💻";
    if (cat === "HR") return "🤝";
    if (cat === "Behavioral") return "🧠";
    if (cat === "Situational") return "🎯";
    return "❓";
  };

  const categoryColor = (cat: string) => {
    if (cat === "Technical") return "bg-blue-100 text-blue-800";
    if (cat === "HR") return "bg-green-100 text-green-800";
    if (cat === "Behavioral") return "bg-purple-100 text-purple-800";
    if (cat === "Situational") return "bg-amber-100 text-amber-800";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl flex items-center gap-2">
          <Target className="h-8 w-8 text-accent" /> Interview Prep
        </h1>
        <p className="text-muted-foreground">AI-powered interview preparation tailored to your applications.</p>
      </div>

      {/* Selector */}
      <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Building2 className="h-4 w-4 text-accent" /> Select an application to prepare for
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[250px]">
            <Select value={selectedApp} onValueChange={setSelectedApp}>
              <SelectTrigger><SelectValue placeholder="Choose a role you've applied to…" /></SelectTrigger>
              <SelectContent>
                {applications.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.opportunities?.role_title} @ {a.opportunities?.company_name}
                    {a.status === "shortlisted" && " ⭐"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generatePrep} disabled={!selectedApp || loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Generating…" : "Generate Prep Material"}
          </Button>
        </div>
        {applications.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No applications yet. <Link to="/student/browse" className="text-accent hover:underline">Browse opportunities</Link> and apply first!
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="rounded-xl border bg-card p-6 h-32 animate-pulse" />)}
        </div>
      )}

      {/* Results */}
      {prep && !loading && (
        <div className="space-y-5">
          {/* Company Overview */}
          <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
            <h3 className="font-display text-lg flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-accent" /> Company Overview
            </h3>
            <p className="text-sm leading-relaxed">{prep.companyOverview}</p>
          </div>

          {/* Interview Process */}
          <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
            <h3 className="font-display text-lg flex items-center gap-2 mb-3">
              <BriefcaseBusiness className="h-4 w-4 text-accent" /> Interview Process
            </h3>
            <div className="space-y-2">
              {prep.interviewProcess.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs grid place-items-center shrink-0 mt-0.5 font-medium">{i + 1}</div>
                  <div className="text-sm">{step}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
            <h3 className="font-display text-lg flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-amber-500" /> Interview Tips
            </h3>
            <div className="grid gap-2 md:grid-cols-2">
              {prep.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 px-3 py-2.5">
                  <span className="text-amber-500 shrink-0 mt-0.5">💡</span>
                  <span className="text-sm">{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Common Questions */}
          <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
            <h3 className="font-display text-lg flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-accent" /> Common Interview Questions
            </h3>
            <div className="space-y-2">
              {prep.commonQuestions.map((q, i) => (
                <div key={i} className="rounded-lg border overflow-hidden">
                  <button
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors"
                    onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                  >
                    <span>{categoryIcon(q.category)}</span>
                    <Badge className={`text-[10px] shrink-0 ${categoryColor(q.category)}`}>{q.category}</Badge>
                    <span className="text-sm flex-1">{q.question}</span>
                    {expandedQ === i ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </button>
                  {expandedQ === i && (
                    <div className="px-4 pb-3 border-t bg-accent/5">
                      <div className="text-xs uppercase tracking-wider text-accent mt-2 mb-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Answer Hint
                      </div>
                      <p className="text-sm text-muted-foreground">{q.hint}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
            <h3 className="font-display text-lg flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-accent" /> Recommended Resources
            </h3>
            <div className="space-y-2">
              {prep.resources.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-accent shrink-0 mt-0.5">📚</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
