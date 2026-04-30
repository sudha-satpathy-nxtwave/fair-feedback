import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, origin, accept, x-requested-with, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-supabase-auth-token",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Expose-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

const SYSTEM_PROMPT = `You are an AI feedback validator for an educational institution.

You will receive a student's feedback for a teaching session, with two ratings (1-5) and a description.

Tasks:
1. REJECT vague or low-effort feedback (e.g. "good", "nice", "ok", "something could be better", "needs improvement", "not bad", single emoji, < ~6 meaningful words). category="reject", is_valid=false.
2. REJECT personal attacks, grudges, or unprofessional tone. category="reject", is_valid=false.
3. REJECT generic improvement statements that mention only a desire for something better without a concrete example.
4. Otherwise, decide if the feedback is APPRECIATION (positive, thanks, what worked) or IMPROVEMENT (constructive criticism, what to change). Pick exactly one.
5. Check rating-text consistency. Low ratings + glowing text, or high ratings + harsh text → lower the score.
6. Score 0-100 based on genuineness, specificity, professionalism, constructiveness.
7. is_valid = true only if score >= 75 AND category != "reject".
8. Always provide a polished rewrite of the student's description in the "suggestion" field. The suggestion must be a clean, student-facing feedback sentence or short paragraph that preserves the student's meaning. Do not provide guidance text like "Try being more specific..." or any commentary.

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

function fallbackResult(understanding_rating: number, instructor_rating: number, description: string) {
  const trimmed = String(description || "").trim();
  const lower = trimmed.toLowerCase();
  const avgRating = (understanding_rating + instructor_rating) / 2;
  const weakPhrases = [
    "could be better",
    "something could be better",
    "needs improvement",
    "need improvement",
    "can improve",
    "could improve",
    "not bad",
    "okay",
    "fine",
  ];
  const genericReject = ["good", "nice", "ok", "great", "fine", "awesome", "perfect", "no", "nothing"].some((phrase) => lower === phrase || lower.includes(phrase));
  const weakImprovement = weakPhrases.some((phrase) => lower.includes(phrase));
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  const sentimentScore = lower.includes("not") || lower.includes("poor") || lower.includes("bad") || lower.includes("confusing") || lower.includes("difficult") ? -1 : 1;
  let score = 50 + Math.min(30, words * 3);
  if (sentimentScore > 0) score += 10;
  if (sentimentScore < 0) score -= 10;
  if (avgRating <= 3 && sentimentScore > 0) score -= 20;
  if (avgRating >= 4 && sentimentScore < 0) score -= 20;
  if (genericReject || weakImprovement || words < 3) score = Math.min(score, 45);
  score = Math.max(0, Math.min(100, score));

  const category = genericReject || weakImprovement || score < 50
    ? "reject"
    : avgRating >= 4 && sentimentScore >= 0
      ? "appreciation"
      : "improvement";
  const is_valid = category !== "reject" && score >= 75;
  const suggestion = trimmed
    ? "The lesson could be clearer with more examples and a slightly slower pace so I can follow better."
    : "I would appreciate clearer explanations and more practical examples to help me learn better.";

  return { score, is_valid, category, suggestion };
}

serve(async (req) => {
  const origin = req.headers.get("origin") || "*";
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    const { understanding_rating, instructor_rating, description } = await req.json();

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
      const fallback = fallbackResult(understanding_rating, instructor_rating, description);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse AI response:", rawText);
      const fallback = fallbackResult(understanding_rating, instructor_rating, description);
      return new Response(
        JSON.stringify(fallback),
        { headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const result = normalizeResult(parsed);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validate-feedback error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  }
});
