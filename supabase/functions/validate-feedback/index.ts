import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, origin, accept, x-requested-with, x-client-info",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };
}

const SYSTEM_PROMPT = `You are an AI feedback validator for an educational institution.

You will receive:
- Two ratings (1–5)
- A student's written feedback

Your tasks:
1. Reject vague or meaningless feedback (e.g. "good", "ok", "nice").
2. Reject unprofessional or abusive feedback.
3. Classify into ONE:
   - "appreciation" (positive feedback)
   - "improvement" (constructive criticism)
   - "reject"
4. Check rating vs text consistency.
5. Score feedback from 0–100 based on clarity, usefulness, and professionalism.
6. is_valid = true ONLY if score >= 60 AND category != "reject".

7. VERY IMPORTANT: REWRITE SUGGESTION
If the student's feedback is valid but poorly written, rewrite it into a clear, professional sentence.
If the student's feedback is vague/rejected, suggest what they SHOULD write about.

RULES FOR REWRITING:
- NEVER HALLUCINATE OR ADD NEW COMPLAINTS. If they say "pace needs to be faster", DO NOT add "needs more examples" or say "slower pace". Keep exactly their core meaning, just polish the grammar and tone.
- If they want it faster, write: "The session's pace could be increased to cover more material effectively."
- If they want it slower, write: "The session moved a bit too fast; a slightly slower pace would help me follow better."
- If the feedback is too short/vague (e.g. "NA", "Good"), suggest: "Please provide specific details about what you liked or what could be improved regarding the pace, clarity, or examples."

Return ONLY valid JSON:
{"score": number, "is_valid": boolean, "category": "appreciation"|"improvement"|"reject", "suggestion": string}
`;

function buildUserPrompt(
  understanding_rating: number,
  instructor_rating: number,
  description: string
) {
  const avg = (understanding_rating + instructor_rating) / 2;

  return `
Understanding Rating: ${understanding_rating}/5
Instructor Rating: ${instructor_rating}/5
Average Rating: ${avg}/5
Student Feedback: "${description}"
`;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: SYSTEM_PROMPT + "\n\n" + prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 500,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callLovableAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

function safeParseJSON(text: string) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function buildFallbackSuggestion(description: string) {
  const text = description.trim();

  if (!text) {
    return "I would benefit from clearer explanations and more structured guidance.";
  }

  const lower = text.toLowerCase();

  if (lower.includes("fast")) {
    return "The session felt a bit fast-paced, and slowing down the explanation would improve understanding.";
  }

  if (lower.includes("confusing") || lower.includes("difficult")) {
    return "The explanation was somewhat unclear, and more structured guidance would help improve comprehension.";
  }

  if (lower.includes("example")) {
    return "Including more practical examples would make the topic easier to understand.";
  }

  if (text.split(" ").length <= 3) {
    return "More detailed explanation and guidance would help in better understanding the topic.";
  }

  return `The student mentioned that ${text.toLowerCase()}, and improving clarity and structure would enhance learning.`;
}

function fallbackResult(
  understanding_rating: number,
  instructor_rating: number,
  description: string
) {
  const avg = (understanding_rating + instructor_rating) / 2;
  const words = description.trim().split(/\s+/).length;

  let score = 50 + words * 3;
  score = Math.min(score, 85);

  const category =
    avg >= 4 ? "appreciation" : avg <= 2.5 ? "improvement" : "improvement";

  return {
    score,
    is_valid: score >= 75,
    category,
    suggestion: buildFallbackSuggestion(description),
  };
}

function normalizeResult(parsed: any, description: string) {
  let suggestion = String(parsed?.suggestion || "").trim();

  // ONLY fallback if empty or too short
  if (!suggestion || suggestion.length < 10) {
    suggestion = buildFallbackSuggestion(description);
  }

  return {
    score: Math.max(0, Math.min(100, Number(parsed?.score) || 0)),
    is_valid: Boolean(parsed?.is_valid),
    category: ["appreciation", "improvement", "reject"].includes(
      parsed?.category
    )
      ? parsed.category
      : "reject",
    suggestion,
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin") || "*";

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    const { understanding_rating, instructor_rating, description } =
      await req.json();

    const prompt = buildUserPrompt(
      understanding_rating,
      instructor_rating,
      description
    );

    let raw = "";
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    // Try Gemini first
    if (geminiKey) {
      try {
        raw = await callGemini(prompt, geminiKey);
      } catch (e) {
        console.warn("Gemini failed:", e.message);
      }
    }

    // Fallback to Lovable
    if (!raw && lovableKey) {
      try {
        raw = await callLovableAI(prompt, lovableKey);
      } catch (e) {
        console.warn("Lovable failed:", e.message);
      }
    }

    // If both fail → fallback logic
    if (!raw) {
      const fallback = fallbackResult(
        understanding_rating,
        instructor_rating,
        description
      );
      return new Response(JSON.stringify(fallback), {
        headers: corsHeaders(origin),
      });
    }

    console.log("RAW AI:", raw);

    const parsed = safeParseJSON(raw);

    if (!parsed) {
      console.warn("JSON parse failed, using fallback");
      const fallback = fallbackResult(
        understanding_rating,
        instructor_rating,
        description
      );
      return new Response(JSON.stringify(fallback), {
        headers: corsHeaders(origin),
      });
    }

    const result = normalizeResult(parsed, description);

    return new Response(JSON.stringify(result), {
      headers: corsHeaders(origin),
    });
  } catch (err) {
    console.error("Error:", err);

  const message =
    err instanceof Error ? err.message : "Unknown error";

  return new Response(
    JSON.stringify({ error: message }),
    { status: 500, headers: corsHeaders("*") }
  );
  }
});