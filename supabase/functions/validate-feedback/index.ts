import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { understanding_rating, instructor_rating, description } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const avgRating = (understanding_rating + instructor_rating) / 2;

    const prompt = `You are an AI feedback validator for an educational institution. Analyze the following student feedback for a teaching session.

Understanding Rating: ${understanding_rating}/5
Instructor Rating: ${instructor_rating}/5
Average Rating: ${avgRating}/5
Student's Description: "${description}"

Instructions:
1. Check if the feedback is genuine, professional, and focused on the subject/session delivery (not personal attacks or grudges).
2. Check consistency: If ratings are low (1-2) but text is positive, or ratings are high (4-5) but text is negative, it's inconsistent.
3. Check if the description is constructive and provides actionable insight.
4. Assign a score from 0 to 100 based on genuineness, consistency, professionalism, and constructiveness.
5. If the feedback has issues, provide a professionally rewritten suggestion that matches the given ratings.

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "score": <number 0-100>,
  "is_valid": <true if score >= 75>,
  "suggestion": "<rewritten professional feedback that matches the ratings, or empty string if original is good>"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI validation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse Gemini response:", rawText);
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
