// AI-powered resume <-> opportunity matching using Groq API
// Triggered when: a student updates profile/resume, OR when a new opportunity is posted (for all students)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Trigger = "profile_update" | "new_opportunity" | "manual";

interface Body {
  studentId?: string;        // run for one student
  opportunityId?: string;    // run for all students against one opp (admin posts new opp)
  trigger?: Trigger;
}

const SYSTEM_PROMPT = `You are an AI placement advisor for engineering students. You rank internship/job opportunities for a specific student.

Rules:
- Score 80-100 = excellent match (skills + domain align strongly)
- Score 60-79  = good match (partial overlap)
- Score 40-59  = fair match (some relevance)
- Below 40    = poor match
- The reason MUST reference at least one specific skill, interest, or attribute from the student's profile.
- If student CGPA < opportunity min_cgpa, score must be <= 30 and the reason must mention this.
- Order recommendations by score descending. Include ALL provided opportunities.`;

function buildUserPrompt(profile: any, opportunities: any[]) {
  return `STUDENT PROFILE:
${JSON.stringify({
  name: profile.full_name,
  branch: profile.branch,
  cgpa: profile.cgpa,
  skills: profile.skills,
  interests: profile.interests,
  graduation_year: profile.graduation_year,
  resume_summary: profile.resume_text ? String(profile.resume_text).slice(0, 1500) : "Not provided",
}, null, 2)}

AVAILABLE OPPORTUNITIES (${opportunities.length}):
${JSON.stringify(opportunities.map((o) => ({
  opportunity_id: o.id,
  company: o.company_name,
  role: o.role_title,
  type: o.type,
  description: String(o.description || "").slice(0, 400),
  required_skills: o.required_skills,
  domain_tags: o.domain_tags,
  min_cgpa: o.min_cgpa,
  eligible_branches: o.eligible_branches,
})), null, 2)}

Rank these opportunities for the student.`;
}

async function loadStudent(studentId: string) {
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", studentId)
    .single();
  const { data: sp } = await admin
    .from("student_profiles")
    .select("*")
    .eq("user_id", studentId)
    .single();
  if (!sp) return null;

  // If a resume exists, fetch a brief text summary using AI multimodal once and cache via resume_text? For simplicity, we treat any prior resume_text from upload step.
  return {
    full_name: profile?.full_name,
    branch: sp.branch,
    cgpa: sp.cgpa,
    skills: sp.skills || [],
    interests: sp.interests || [],
    graduation_year: sp.graduation_year,
    resume_text: (sp as any).resume_text || null,
  };
}

async function loadOpportunities(opportunityId?: string) {
  let q = admin
    .from("opportunities")
    .select("*")
    .eq("is_active", true);
  if (opportunityId) q = q.eq("id", opportunityId);
  const { data } = await q;
  return data || [];
}

async function callAI(messages: any[]) {
  const tool = {
    type: "function",
    function: {
      name: "rank_opportunities",
      description: "Return ranked recommendation list",
      parameters: {
        type: "object",
        properties: {
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                opportunity_id: { type: "string" },
                score: { type: "number" },
                reason: { type: "string" },
              },
              required: ["opportunity_id", "score", "reason"],
              additionalProperties: false,
            },
          },
        },
        required: ["recommendations"],
        additionalProperties: false,
      },
    },
  };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      tools: [tool],
      tool_choice: { type: "function", function: { name: "rank_opportunities" } },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway ${res.status}: ${text}`);
  }
  const data = await res.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("No tool call in AI response");
  const args = JSON.parse(call.function.arguments);
  return (args.recommendations || []) as Array<{ opportunity_id: string; score: number; reason: string }>;
}

async function generateForStudent(studentId: string, opps: any[], trigger: Trigger) {
  const profile = await loadStudent(studentId);
  if (!profile) return { skipped: true };
  if (opps.length === 0) return { count: 0 };

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(profile, opps) },
  ];
  const recs = await callAI(messages);
  const valid = recs.filter((r) => r.opportunity_id && typeof r.score === "number" && r.reason);

  if (valid.length > 0) {
    const rows = valid.map((r) => ({
      student_id: studentId,
      opportunity_id: r.opportunity_id,
      score: Math.max(0, Math.min(100, r.score)),
      reason: r.reason,
      generated_at: new Date().toISOString(),
    }));
    await admin.from("recommendations").upsert(rows, { onConflict: "student_id,opportunity_id" });

    // Notify top 3
    const top3 = [...valid].sort((a, b) => b.score - a.score).slice(0, 3);
    const oppMap = new Map(opps.map((o) => [o.id, o]));
    const notifs = top3.map((r) => {
      const o = oppMap.get(r.opportunity_id);
      return {
        user_id: studentId,
        type: trigger === "new_opportunity" ? "new_opportunity" : "recommendation",
        title: trigger === "new_opportunity"
          ? `New match: ${o?.role_title} at ${o?.company_name}`
          : `Strong match: ${o?.role_title} at ${o?.company_name}`,
        body: r.reason,
        opportunity_id: r.opportunity_id,
      };
    }).filter((n) => n.opportunity_id);
    if (notifs.length) await admin.from("notifications").insert(notifs);
  }
  return { count: valid.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: Body = await req.json().catch(() => ({}));
    const trigger: Trigger = body.trigger || "manual";

    // Case 1: a new opportunity was posted -> rank it for ALL students
    if (body.opportunityId && !body.studentId) {
      const opps = await loadOpportunities(body.opportunityId);
      if (opps.length === 0) return new Response(JSON.stringify({ message: "Opportunity inactive" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: students } = await admin.from("user_roles").select("user_id").eq("role", "student");
      let total = 0;
      for (const s of students || []) {
        try {
          // For per-opportunity ranking, also include the student's existing pool so AI can compare context.
          // Simpler: just rank this single opportunity in context of student profile.
          const res = await generateForStudent(s.user_id, opps, "new_opportunity");
          total += (res as any).count || 0;
        } catch (e) {
          console.error("student fail", s.user_id, e);
        }
      }
      return new Response(JSON.stringify({ ok: true, total }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Case 2: per-student rerank against ALL active opportunities
    if (body.studentId) {
      const opps = await loadOpportunities();
      const out = await generateForStudent(body.studentId, opps, trigger);
      return new Response(JSON.stringify({ ok: true, ...out }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Provide studentId or opportunityId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("match-recommendations error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("429") ? 429 : msg.includes("402") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
