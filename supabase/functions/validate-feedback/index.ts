import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an AI feedback validator for an educational institution. You will receive student feedback for a teaching session including ratings and a description.

Instructions:
1. Check if the feedback is genuine, professional, and focused on the subject/session delivery (not personal attacks or grudges).
2. Check consistency: If ratings are low (1-2) but text is positive, or ratings are high (4-5) but text is negative, it's inconsistent.
3. Check if the description is constructive and provides actionable insight.
4. Assign a score from 0 to 100 based on genuineness, consistency, professionalism, and constructiveness.
5. If the feedback has issues, provide a professionally rewritten suggestion that matches the given ratings.

Respond ONLY with valid JSON (no markdown, no code blocks):
{"score": <number 0-100>, "is_valid": <true if score >= 75>, "suggestion": "<rewritten professional feedback or empty string if original is good>"}`;

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
        generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { understanding_rating, instructor_rating, description } = await req.json();
    const userPrompt = buildUserPrompt(understanding_rating, instructor_rating, description);

    let rawText = "";

    // Try Gemini first, fallback to Lovable AI
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (geminiKey) {
      try {
        rawText = await callGemini(userPrompt, geminiKey);
      } catch (e) {
        console.warn("Gemini failed, falling back to Lovable AI:", (e as Error).message);
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
      return new Response(JSON.stringify({ score: 50, is_valid: false, suggestion: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validate-feedback error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
