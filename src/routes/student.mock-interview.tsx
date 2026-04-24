import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { chatWithGroq, parseJsonResponse } from "@/lib/groq";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Mic, Loader2, ChevronDown, ChevronUp, Bookmark, BookmarkCheck,
  Sparkles, RefreshCw, MessageCircle
} from "lucide-react";

export const Route = createFileRoute("/student/mock-interview")({ component: MockInterview });

interface MockQuestion {
  category: string;
  question: string;
  expectedAnswer: string;
  followUp: string;
  difficulty: string;
}

function MockInterview() {
  const { user } = useAuth();
  const [mode, setMode] = useState<"role" | "custom">("role");
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [customCompany, setCustomCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("applications")
        .select("id, opportunity_id, opportunities(role_title, company_name, type, required_skills, domain_tags, description)")
        .eq("student_id", user.id)
        .order("applied_at", { ascending: false });
      setApplications(data || []);
    })();
  }, [user]);

  const generate = async () => {
    let role = "", company = "", skills = "", desc = "";
    if (mode === "role") {
      const app = applications.find((a) => a.id === selectedApp);
      if (!app?.opportunities) return;
      role = app.opportunities.role_title;
      company = app.opportunities.company_name;
      skills = (app.opportunities.required_skills || []).join(", ");
      desc = app.opportunities.description || "";
    } else {
      role = customRole;
      company = customCompany || "a top tech company";
    }

    setLoading(true);
    setError("");
    setQuestions([]);
    setExpanded(new Set());
    setBookmarked(new Set());

    try {
      const response = await chatWithGroq([
        {
          role: "system",
          content: `You are a mock interview coach. Generate realistic interview questions. Return ONLY a valid JSON array, no other text. Each item:
{"category": "Technical|HR|Behavioral|Situational|Problem Solving", "question": "...", "expectedAnswer": "detailed model answer (3-5 sentences)", "followUp": "a follow-up question the interviewer might ask", "difficulty": "Easy|Medium|Hard"}
Generate exactly 12 diverse questions across all categories. Make them realistic and role-specific.`
        },
        {
          role: "user",
          content: `Generate mock interview questions for:
Role: ${role}
Company: ${company}
Required Skills: ${skills || "general"}
Description: ${desc || "N/A"}`
        }
      ], { temperature: 0.8, max_tokens: 3500 });

      const parsed = parseJsonResponse<MockQuestion[]>(response);
      setQuestions(parsed);
    } catch (e: any) {
      setError(e.message || "Failed to generate questions");
    }
    setLoading(false);
  };

  const toggleExpand = (i: number) => {
    const next = new Set(expanded);
    next.has(i) ? next.delete(i) : next.add(i);
    setExpanded(next);
  };

  const toggleBookmark = (i: number) => {
    const next = new Set(bookmarked);
    next.has(i) ? next.delete(i) : next.add(i);
    setBookmarked(next);
  };

  const revealAll = () => setExpanded(new Set(questions.map((_, i) => i)));
  const collapseAll = () => setExpanded(new Set());

  const categories = ["all", ...new Set(questions.map((q) => q.category))];
  const filtered = questions.filter((q) => filter === "all" || q.category === filter);

  const diffColor = (d: string) => {
    if (d === "Easy") return "bg-green-100 text-green-800";
    if (d === "Medium") return "bg-amber-100 text-amber-800";
    if (d === "Hard") return "bg-red-100 text-red-800";
    return "";
  };

  const catEmoji = (c: string) => {
    if (c === "Technical") return "💻";
    if (c === "HR") return "🤝";
    if (c === "Behavioral") return "🧠";
    if (c === "Situational") return "🎯";
    if (c === "Problem Solving") return "🧩";
    return "❓";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl flex items-center gap-2">
          <Mic className="h-8 w-8 text-accent" /> Mock Interview
        </h1>
        <p className="text-muted-foreground">AI-generated interview questions with model answers.</p>
      </div>

      {/* Setup */}
      {questions.length === 0 && !loading && (
        <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] space-y-4">
          <div className="flex gap-2">
            <Button variant={mode === "role" ? "default" : "outline"} size="sm" onClick={() => setMode("role")}>From my applications</Button>
            <Button variant={mode === "custom" ? "default" : "outline"} size="sm" onClick={() => setMode("custom")}>Custom role</Button>
          </div>

          {mode === "role" ? (
            <div className="space-y-2">
              <Select value={selectedApp} onValueChange={setSelectedApp}>
                <SelectTrigger><SelectValue placeholder="Select an application…" /></SelectTrigger>
                <SelectContent>
                  {applications.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.opportunities?.role_title} @ {a.opportunities?.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Role (e.g., Frontend Developer)" value={customRole} onChange={(e) => setCustomRole(e.target.value)} />
              <Input placeholder="Company (optional)" value={customCompany} onChange={(e) => setCustomCompany(e.target.value)} />
            </div>
          )}

          <Button
            onClick={generate}
            disabled={loading || (mode === "role" ? !selectedApp : !customRole)}
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate Questions
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading && (
        <div className="rounded-xl border bg-card p-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent" />
          <p className="text-sm text-muted-foreground mt-3">AI is preparing your mock interview…</p>
        </div>
      )}

      {/* Questions display */}
      {questions.length > 0 && !loading && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-9 w-44 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c === "all" ? "All categories" : `${catEmoji(c)} ${c}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={revealAll}>Show all answers</Button>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={collapseAll}>Hide all</Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs ml-auto" onClick={() => { setQuestions([]); setError(""); }}>
              <RefreshCw className="h-3 w-3" /> New Questions
            </Button>
            {bookmarked.size > 0 && (
              <Badge variant="secondary" className="text-xs">{bookmarked.size} bookmarked</Badge>
            )}
          </div>

          {/* Question cards */}
          {filtered.map((q, qi) => {
            const originalIdx = questions.indexOf(q);
            const isExpanded = expanded.has(originalIdx);
            const isBookmarked = bookmarked.has(originalIdx);
            return (
              <div key={originalIdx} className={`rounded-xl border bg-card shadow-[var(--shadow-card)] overflow-hidden ${isBookmarked ? "ring-2 ring-amber-300" : ""}`}>
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-full bg-secondary text-xs grid place-items-center shrink-0 font-medium mt-0.5">{qi + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge className={`text-[10px] ${diffColor(q.difficulty)}`}>{q.difficulty}</Badge>
                        <Badge variant="outline" className="text-[10px]">{catEmoji(q.category)} {q.category}</Badge>
                      </div>
                      <p className="text-sm font-medium">{q.question}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleBookmark(originalIdx)} className="p-1 rounded hover:bg-muted transition-colors">
                        {isBookmarked
                          ? <BookmarkCheck className="h-4 w-4 text-amber-500" />
                          : <Bookmark className="h-4 w-4 text-muted-foreground" />
                        }
                      </button>
                      <button onClick={() => toggleExpand(originalIdx)} className="p-1 rounded hover:bg-muted transition-colors">
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        }
                      </button>
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t bg-accent/5 px-5 py-4 space-y-3">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-accent mb-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Model Answer
                      </div>
                      <p className="text-sm leading-relaxed">{q.expectedAnswer}</p>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" /> Possible Follow-Up
                      </div>
                      <p className="text-sm text-muted-foreground italic">"{q.followUp}"</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
