import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildPrompt(text: string, language: string, mode: string): string {
  const isAr = language === "ar";
  if (mode === "both") {
    return isAr
      ? `أنت مدقق لغوي وكاشف انتحال أكاديمي. حلل النص التالي وأعد JSON صالحاً فقط بهذا الشكل:
{
  "corrected": "النص المصحح بالكامل",
  "corrections": [{"original":"الخطأ","corrected":"التصحيح","type":"إملائي|نحوي|أسلوبي"}],
  "plagiarism": {
    "score": عدد بين 0 و 100 يمثل نسبة الاستلال التقديرية,
    "verdict": "أصلي|مشكوك فيه|مستل",
    "suspicious_phrases": ["جمل أو عبارات مشتبه بها"],
    "notes": "ملاحظات موجزة عن أسلوب الكتابة وتشابهه مع المصادر الشائعة"
  }
}

النص:
"""
${text}
"""

أعد JSON فقط بدون أي نص قبله أو بعده.`
      : `You are a proofreader and plagiarism detector. Analyze the text and return ONLY valid JSON in this shape:
{
  "corrected": "fully corrected text",
  "corrections": [{"original":"error","corrected":"fix","type":"spelling|grammar|style"}],
  "plagiarism": {
    "score": number 0-100 estimating plagiarism percentage,
    "verdict": "original|suspicious|plagiarized",
    "suspicious_phrases": ["phrases that look copied"],
    "notes": "brief notes on style similarity to common sources"
  }
}

Text:
"""
${text}
"""

Return JSON only — no preamble.`;
  }

  return isAr
    ? `أنت مدقق لغوي محترف. أعد JSON فقط:
{ "corrected": "النص المصحح", "corrections": [{"original":"خطأ","corrected":"تصحيح","type":"إملائي|نحوي|أسلوبي"}] }

النص:
${text}`
    : `You are a professional proofreader. Return JSON only:
{ "corrected": "corrected text", "corrections": [{"original":"err","corrected":"fix","type":"spelling|grammar|style"}] }

Text:
${text}`;
}

async function callGeminiDirect(apiKey: string, prompt: string): Promise<string | null> {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.3, responseMimeType: "application/json" },
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
    const { text, language, mode } = await req.json();
    if (!text) throw new Error("No text provided");
    const finalMode = mode || "both";
    const prompt = buildPrompt(text, language || "ar", finalMode);

    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    if (GEMINI_KEY) {
      const result = await callGeminiDirect(GEMINI_KEY, prompt);
      if (result) {
        return new Response(JSON.stringify({ result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("No API keys configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        response_format: { type: "json_object" },
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
