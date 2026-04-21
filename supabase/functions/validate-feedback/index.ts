import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an AI feedback validator for an educational institution.

You will receive a student's feedback for a teaching session, with two ratings (1-5) and a description.

Tasks:
1. REJECT vague or low-effort feedback (e.g. "good", "nice", "ok", single emoji, < ~6 meaningful words). category="reject", is_valid=false.
2. REJECT personal attacks, grudges, or unprofessional tone. category="reject", is_valid=false.
3. Otherwise, decide if the feedback is APPRECIATION (positive, thanks, what worked) or IMPROVEMENT (constructive criticism, what to change). Pick exactly one.
4. Check rating-text consistency. Low ratings + glowing text, or high ratings + harsh text → lower the score.
5. Score 0-100 based on genuineness, specificity, professionalism, constructiveness.
6. is_valid = true only if score >= 75 AND category != "reject".
7. If is_valid is false, write a professionally rewritten suggestion in "suggestion" that matches the ratings. Otherwise leave suggestion empty.

Respond ONLY with valid JSON (no markdown, no code blocks, no commentary):
{"score": <0-100>, "is_valid": <bool>, "category": "appreciation"|"improvement"|"reject", "suggestion": "<string>"}`;

function buildUserPrompt(understanding_rating: number, instructor_rating: number, description: string) {
  const avgRating = (understanding_rating + instructor_rating) / 2;
  return `Understanding Rating: ${understanding_rating}/5
Instructor Rating: ${instructor_rating}/5
Average Rating: ${avgRating}/5
Student's Description: "${description}"`;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: SYSTEM_PROMPT + "\n\n" + prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
      }),
    }
  );
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini ${response.status}: ${errText}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callLovableAI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Lovable AI ${response.status}: ${errText}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function normalizeResult(parsed: Record<string, unknown>) {
  const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
  const rawCat = String(parsed.category || "").toLowerCase();
  const category =
    rawCat === "appreciation" || rawCat === "improvement" || rawCat === "reject"
      ? rawCat
      : score >= 75
        ? "appreciation"
        : "reject";
  const is_valid = Boolean(parsed.is_valid) && category !== "reject" && score >= 75;
  const suggestion = String(parsed.suggestion || "");
  return { score, is_valid, category, suggestion };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { understanding_rating, instructor_rating, description } = await req.json();

    // Quick local reject for super-short text — saves an API call.
    const wordCount = String(description || "").trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 4) {
      return new Response(
        JSON.stringify({
          score: 30,
          is_valid: false,
          category: "reject",
          suggestion: "Please share a bit more — what specifically helped or could be improved? (~10+ words)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = buildUserPrompt(understanding_rating, instructor_rating, description);

    let rawText = "";
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (geminiKey) {
      try {
        rawText = await callGemini(userPrompt, geminiKey);
      } catch (e) {
        console.warn("Gemini failed, falling back:", (e as Error).message);
      }
    }
    if (!rawText && lovableKey) {
      try {
        rawText = await callLovableAI(userPrompt, lovableKey);
      } catch (e) {
        console.error("Lovable AI also failed:", (e as Error).message);
      }
    }

    if (!rawText) {
      return new Response(JSON.stringify({ error: "All AI providers failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse AI response:", rawText);
      return new Response(
        JSON.stringify({ score: 50, is_valid: false, category: "reject", suggestion: "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const result = normalizeResult(parsed);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validate-feedback error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
