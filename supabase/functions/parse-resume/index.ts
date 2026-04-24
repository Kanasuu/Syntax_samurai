// Parses an uploaded resume PDF into a plain-text summary using Groq AI.
// Stores resume_text on student_profiles. Then triggers match-recommendations.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

// Extract readable text from a PDF buffer (basic extraction for text-based PDFs)
function extractTextFromPDF(buf: Uint8Array): string {
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(buf);

  const textChunks: string[] = [];

  // Extract text between BT...ET blocks (PDF text objects)
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(raw)) !== null) {
    const block = match[1];
    // Extract text from Tj and TJ operators
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      textChunks.push(tjMatch[1]);
    }
    // TJ arrays
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
    let arrMatch;
    while ((arrMatch = tjArrayRegex.exec(block)) !== null) {
      const items = arrMatch[1];
      const strRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = strRegex.exec(items)) !== null) {
        textChunks.push(strMatch[1]);
      }
    }
  }

  // Also try to extract any stream text that looks readable
  if (textChunks.length === 0) {
    // Fallback: grab any readable ASCII sequences
    const readable = raw.match(/[\x20-\x7E]{10,}/g) || [];
    return readable.join(" ").slice(0, 5000);
  }

  return textChunks.join(" ").replace(/\s+/g, " ").trim().slice(0, 5000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const { resumePath } = await req.json();
    if (!resumePath) {
      return new Response(JSON.stringify({ error: "resumePath required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Make sure the path is owned by this user
    if (!resumePath.startsWith(`${userId}/`)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Download from storage
    const { data: fileBlob, error: dlErr } = await admin.storage.from("resumes").download(resumePath);
    if (dlErr || !fileBlob) {
      return new Response(JSON.stringify({ error: "Download failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const buf = new Uint8Array(await fileBlob.arrayBuffer());

    // Extract text from the PDF
    const rawText = extractTextFromPDF(buf);

    // Use Groq to create a structured summary from the extracted text
    const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You extract a concise structured summary from resume text. Return plain text only (no markdown). Include: candidate name, education, key skills, technologies, projects (1-line each), internships, achievements. Limit to ~1500 chars. If the input text is garbled or unreadable, extract whatever useful information you can find.",
          },
          {
            role: "user",
            content: `Summarize this resume text:\n\n${rawText || "No text could be extracted from the resume."}`,
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI parse error", aiRes.status, t);
      const status = aiRes.status === 429 ? 429 : aiRes.status === 402 ? 402 : 500;
      return new Response(JSON.stringify({ error: `AI parsing failed: ${t}` }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    const summary = aiJson.choices?.[0]?.message?.content?.toString().slice(0, 5000) || "";

    // Store the summary in student_profiles
    await admin.from("student_profiles").update({
      resume_text: summary,
      updated_at: new Date().toISOString(),
    } as any).eq("user_id", userId);

    // Fire-and-forget: trigger recommendations
    fetch(`${SUPABASE_URL}/functions/v1/match-recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
      body: JSON.stringify({ studentId: userId, trigger: "profile_update" }),
    }).catch((e) => console.error("trigger match failed", e));

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("parse-resume error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
