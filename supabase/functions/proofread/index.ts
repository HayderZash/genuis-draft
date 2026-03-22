import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callGeminiDirect(apiKey: string, systemPrompt: string, text: string): Promise<string | null> {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${text}` }] }],
          generationConfig: { maxOutputTokens: 8000, temperature: 0.3 },
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) return content;
    } catch { /* try next */ }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, language } = await req.json();
    if (!text) throw new Error("No text provided");

    const systemPrompt = language === 'ar'
      ? `أنت مدقق لغوي محترف. قم بتدقيق النص التالي وأعد النص المصحح مع تمييز التغييرات. أعد الإجابة بتنسيق JSON يحتوي على:
- "corrected": النص المصحح بالكامل
- "corrections": مصفوفة من التصحيحات، كل عنصر يحتوي على "original" (الخطأ) و"corrected" (التصحيح) و"type" (نوع الخطأ: إملائي/نحوي/صرفي/أسلوبي)`
      : `You are a professional proofreader. Proofread the following text and return the corrected version with highlighted changes. Return as JSON with:
- "corrected": the fully corrected text
- "corrections": array of corrections, each with "original" (error), "corrected" (fix), and "type" (error type: spelling/grammar/style)`;

    // Strategy 1: Gemini API key
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    if (GEMINI_KEY) {
      const result = await callGeminiDirect(GEMINI_KEY, systemPrompt, text);
      if (result) {
        return new Response(JSON.stringify({ result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Strategy 2: Lovable Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("No API keys configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ result: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("proofread error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
