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
      ? `أنت خبير في كشف الاستلال الأكاديمي. قم بتحليل النص المقدم بدقة عالية جداً وأعطِ تقييماً شاملاً.

مهم جداً: يجب أن تعطي نسبة الاستلال (وليس نسبة الأصالة). نسبة الاستلال هي نسبة النص الذي يبدو منسوخاً أو مقتبساً من مصادر أخرى.

قم بتحليل:
1. نسبة الاستلال التقديرية (من 0% إلى 100%) - كلما كانت أعلى كان النص أكثر استلالاً
2. تحليل مفصل لأسلوب الكتابة
3. العبارات التي تبدو مستلة أو منسوخة بالتحديد
4. توصيات لتقليل نسبة الاستلال

أجب بتنسيق JSON فقط:
{"plagiarism_score": number, "analysis": "string", "suspicious_phrases": ["string"], "recommendations": ["string"]}`
      : `You are an expert in academic plagiarism detection. Analyze the provided text with very high accuracy.

IMPORTANT: You must provide the plagiarism percentage (NOT the originality percentage). The plagiarism score represents how much of the text appears to be copied or borrowed from other sources.

Analyze:
1. Estimated plagiarism score (0% to 100%) - higher means more plagiarism detected
2. Detailed writing style analysis
3. Specific phrases that appear to be plagiarized
4. Recommendations to reduce plagiarism

Respond in JSON format only:
{"plagiarism_score": number, "analysis": "string", "suspicious_phrases": ["string"], "recommendations": ["string"]}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
