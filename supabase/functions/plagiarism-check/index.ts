import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isAr = language === 'ar';
    const systemPrompt = isAr
      ? `أنت خبير في كشف الانتحال الأكاديمي. قم بتحليل النص المقدم وأعطِ تقييماً شاملاً يتضمن:
1. نسبة الأصالة التقديرية (من 0% إلى 100%)
2. تحليل أسلوب الكتابة (هل يبدو أصلياً أم منسوخاً)
3. ملاحظات على عبارات قد تكون مأخوذة من مصادر أخرى
4. توصيات لتحسين الأصالة

أجب بتنسيق JSON:
{"originality_score": number, "analysis": "string", "suspicious_phrases": ["string"], "recommendations": ["string"]}`
      : `You are an academic plagiarism detection expert. Analyze the provided text and give a comprehensive assessment including:
1. Estimated originality score (0% to 100%)
2. Writing style analysis (does it appear original or copied)
3. Notes on phrases that may be taken from other sources
4. Recommendations for improving originality

Respond in JSON format:
{"originality_score": number, "analysis": "string", "suspicious_phrases": ["string"], "recommendations": ["string"]}`;

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
        max_tokens: 4000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ result: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("plagiarism-check error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
