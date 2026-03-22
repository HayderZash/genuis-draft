import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callGeminiDirect(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string | null> {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
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
    const { cvData, language } = await req.json();
    const isAr = language === 'ar';

    const systemPrompt = isAr
      ? `أنت خبير في كتابة السير الذاتية بنظام ATS. قم بتوليد سيرة ذاتية احترافية بتنسيق HTML نظيف. استخدم تنسيق بسيط وواضح يتوافق مع أنظمة ATS. اكتب ملخصاً مهنياً قوياً بناءً على البيانات المقدمة. لا تستخدم جداول أو أعمدة. استخدم <h1> للاسم، <h2> للأقسام، <p> للنصوص، <ul> و <li> للقوائم.`
      : `You are an expert ATS CV writer. Generate a professional CV in clean HTML format. Use simple, ATS-compatible formatting. Write a strong professional summary based on the provided data. No tables or columns. Use <h1> for name, <h2> for sections, <p> for text, <ul> and <li> for lists.`;

    const userPrompt = isAr
      ? `أنشئ سيرة ذاتية احترافية بنظام ATS للشخص التالي:
الاسم: ${cvData.full_name}
الهاتف: ${cvData.phone || 'غير محدد'}
البريد: ${cvData.email || 'غير محدد'}
${cvData.linkedin_url ? `LinkedIn: ${cvData.linkedin_url}` : ''}
${cvData.facebook_url ? `Facebook: ${cvData.facebook_url}` : ''}
${cvData.portfolio_url ? `الموقع: ${cvData.portfolio_url}` : ''}
الملخص: ${cvData.summary || 'غير محدد'}
الخبرات: ${JSON.stringify(cvData.experiences || [])}
التعليم: ${JSON.stringify(cvData.education || [])}
المهارات التقنية: ${(cvData.technical_skills || []).join(', ')}
المهارات الناعمة: ${(cvData.soft_skills || []).join(', ')}
اللغات: ${JSON.stringify(cvData.languages || [])}
اكتب السيرة الذاتية باللغة العربية.`
      : `Create a professional ATS CV for:
Name: ${cvData.full_name}
Phone: ${cvData.phone || 'N/A'}
Email: ${cvData.email || 'N/A'}
${cvData.linkedin_url ? `LinkedIn: ${cvData.linkedin_url}` : ''}
${cvData.facebook_url ? `Facebook: ${cvData.facebook_url}` : ''}
${cvData.portfolio_url ? `Portfolio: ${cvData.portfolio_url}` : ''}
Summary: ${cvData.summary || 'N/A'}
Experiences: ${JSON.stringify(cvData.experiences || [])}
Education: ${JSON.stringify(cvData.education || [])}
Technical Skills: ${(cvData.technical_skills || []).join(', ')}
Soft Skills: ${(cvData.soft_skills || []).join(', ')}
Languages: ${JSON.stringify(cvData.languages || [])}
Write the CV in English.`;

    // Strategy 1: Gemini API
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    if (GEMINI_KEY) {
      const result = await callGeminiDirect(GEMINI_KEY, systemPrompt, userPrompt);
      if (result) {
        return new Response(JSON.stringify({ content: result }), {
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
          { role: "user", content: userPrompt },
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-cv error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
