/// <reference lib="deno.ns" />
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

const WEAK_FEEDBACK_PATTERNS = [
  "na",
  "n/a",
  "nothing",
  "nil",
  "none",
  "ok",
  "okay",
  "good",
  "nice",
  ".",
  "-",
  "_",
  "no",
];

const GENERIC_SUGGESTIONS = [
  "More practical examples during the session would help improve understanding.",
  "A slightly slower explanation of difficult concepts would make learning easier.",
  "More hands-on exercises and real-world examples would improve clarity.",
  "Additional revision sessions for important topics would be helpful.",
  "More interactive discussions during class would improve engagement.",
];

const SYSTEM_PROMPT = `
You are an AI classroom feedback reviewer and writing assistant.

Your task:
1. Analyze student feedback quality
2. Correct grammar and spelling
3. Generate an improved feedback suggestion

IMPORTANT VALIDATION RULES:
- Feedback like "NA", "ok", "good", ".", "-", "nothing" must ALWAYS:
  - receive score below 40
  - category = "reject"
  - is_valid = false

SCORING RULES:
- 0-39 → meaningless/gibberish/placeholder
- 40-59 → weak but partially meaningful
- 60-79 → decent constructive feedback
- 80-100 → detailed and highly constructive feedback

OUTPUT RULES:
- suggestion must NEVER repeat meaningless feedback
- suggestion must always be meaningful and constructive
- output only valid JSON

Return ONLY this JSON:
{
  "score": number,
  "is_valid": boolean,
  "category": "appreciation" | "improvement" | "reject",
  "corrected_feedback": string,
  "suggestion": string
}
`;

function buildUserPrompt(
  understanding_rating: number,
  instructor_rating: number,
  description: string
) {
  return `
Understanding Rating: ${understanding_rating}/5
Instructor Rating: ${instructor_rating}/5
Student Feedback: "${description}"
`;
}

function cleanBasic(text: string): string {
  const t = text.trim();

  if (!t) return "";

  let result = t.replace(/\s+/g, " ");

  result =
    result.charAt(0).toUpperCase() + result.slice(1);

  if (!/[.!?]$/.test(result)) {
    result += ".";
  }

  return result;
}

function isWeakFeedback(text: string): boolean {
  const cleaned = text.trim().toLowerCase();

  if (!cleaned) return true;

  if (WEAK_FEEDBACK_PATTERNS.includes(cleaned)) {
    return true;
  }

  if (cleaned.length < 4) {
    return true;
  }

  const words = cleaned.split(/\s+/);

  if (words.length <= 2) {
    return true;
  }

  return false;
}

function getWeakFeedbackSuggestion(index: number): string {
  return GENERIC_SUGGESTIONS[
    index % GENERIC_SUGGESTIONS.length
  ];
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: SYSTEM_PROMPT + "\n\n" + prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 400,
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const data = await res.json();

  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
  );
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

function normalizeResult(parsed: any, description: string) {
  const cleanedInput = description.trim();

  let score = Number(parsed?.score || 0);

  score = Math.max(0, Math.min(100, score));

  let category = parsed?.category;

  if (
    !["appreciation", "improvement", "reject"].includes(
      category
    )
  ) {
    category = "reject";
  }

  let corrected_feedback = cleanBasic(
    parsed?.corrected_feedback || cleanedInput
  );

  let suggestion = String(
    parsed?.suggestion || ""
  ).trim();

  if (
    !suggestion ||
    suggestion.length < 10 ||
    WEAK_FEEDBACK_PATTERNS.includes(
      suggestion.toLowerCase()
    )
  ) {
    suggestion =
      "More practical examples and clearer explanations would improve understanding.";
  }

  const weak = isWeakFeedback(cleanedInput);

  if (weak) {
    return {
      score: 25,
      is_valid: false,
      category: "reject",
      corrected_feedback:
        corrected_feedback || cleanBasic(cleanedInput),
      suggestion: getWeakFeedbackSuggestion(
        cleanedInput.length
      ),
    };
  }

  return {
    score,
    is_valid: score >= 60,
    category,
    corrected_feedback,
    suggestion,
  };
}

function fallbackResult(description: string) {
  const weak = isWeakFeedback(description);

  if (weak) {
    return {
      score: 25,
      is_valid: false,
      category: "reject",
      corrected_feedback: cleanBasic(description),
      suggestion:
        "More practical examples and interactive discussions would improve understanding.",
    };
  }

  const words = description
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return {
    score: Math.min(85, 55 + words * 3),
    is_valid: true,
    category: "improvement",
    corrected_feedback: cleanBasic(description),
    suggestion: cleanBasic(description),
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin") || "*";

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  try {
    const {
      understanding_rating,
      instructor_rating,
      description,
    } = await req.json();

    if (isWeakFeedback(description)) {
      const result = fallbackResult(description);

      return new Response(JSON.stringify(result), {
        headers: corsHeaders(origin),
      });
    }

    const prompt = buildUserPrompt(
      understanding_rating,
      instructor_rating,
      description
    );

    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const raw = await callGemini(prompt, geminiKey);

    console.log("RAW AI RESPONSE:", raw);

    const parsed = safeParseJSON(raw);

    if (!parsed) {
      const fallback = fallbackResult(description);

      return new Response(JSON.stringify(fallback), {
        headers: corsHeaders(origin),
      });
    }

    const result = normalizeResult(
      parsed,
      description
    );

    return new Response(JSON.stringify(result), {
      headers: corsHeaders(origin),
    });
  } catch (err) {
    console.error(err);

    return new Response(
      JSON.stringify({
        error:
          err instanceof Error
            ? err.message
            : "Unknown error",
      }),
      {
        status: 500,
        headers: corsHeaders("*"),
      }
    );
  }
});