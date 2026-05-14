/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { description } = await req.json();
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    // Pro URL
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `You are an Academic Engineering Auditor. Analyze this student input: "${description}". 
        Create a professional 3-line feedback version. 
        If they mention specific topics like "loops" or "examples", include those.
        Return ONLY JSON: {"score": 85, "pass": true, "category": "appreciation", "suggested_feedback": "Topic: [Specific Topic]\\nLearned: [Detail]\\nImprovement: [Detail]", "suggestion": "hint"}` }] }]
      }),
    });

    const data = await res.json();
    const rawText = data.candidates[0].content.parts[0].text;
    
    // Find JSON within response
    const start = rawText.indexOf("{");
    const end = rawText.lastIndexOf("}") + 1;
    const result = JSON.parse(rawText.substring(start, end));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    // If you see THIS text in your app, the API call is still failing
    return new Response(JSON.stringify({ 
      score: 80, pass: true, category: "appreciation",
      suggested_feedback: "FALLBACK: Please ensure your API key is correct and the Generative Language API is enabled.",
      suggestion: "Error: " + error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});