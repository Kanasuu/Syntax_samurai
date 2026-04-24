const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

function getApiKey(): string {
  // Use import.meta.env for client-side (Vite build-time replacement)
  // Fall back to process.env for SSR (server-side rendering)
  const key =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_GROQ_API_KEY) ||
    (typeof process !== "undefined" && process.env?.VITE_GROQ_API_KEY) ||
    "";
  return key;
}

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatWithGroq(
  messages: GroqMessage[],
  options?: { temperature?: number; max_tokens?: number }
): Promise<string> {
  const key = getApiKey();
  if (!key || key === "your-groq-api-key-here") {
    throw new Error("GROQ API key not configured. Add VITE_GROQ_API_KEY to your .env file.");
  }

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// Helper: parse JSON from AI response (handles markdown code blocks)
export function parseJsonResponse<T>(text: string): T {
  // Strip markdown code blocks if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```$/, "");
  }
  return JSON.parse(cleaned);
}
