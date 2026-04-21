import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TYPE_LABEL_AR: Record<string, string> = {
  mcq: "اختيار من متعدد (4 خيارات)",
  tf: "صح أو خطأ",
  essay: "مقالي",
  fill: "إكمال الفراغ",
};
const TYPE_LABEL_EN: Record<string, string> = {
  mcq: "Multiple Choice (4 options)",
  tf: "True/False",
  essay: "Essay",
  fill: "Fill in the Blank",
};

function buildPrompt(sourceText: string, count: number, types: string[], difficulty: string, language: string): { system: string; user: string } {
  const isAr = language === "ar";
  const typeList = types.map(t => isAr ? TYPE_LABEL_AR[t] : TYPE_LABEL_EN[t]).filter(Boolean).join(" / ");
  const system = isAr
    ? `أنت خبير امتحانات أكاديمي صارم. تنشئ أسئلة دقيقة من المحتوى المُعطى فقط دون اختراع معلومات. التزم بمستوى الصعوبة المطلوب وتنوّع الأسئلة. أعد إجابة JSON صالحة 100% فقط (بدون أي نص قبلها أو بعدها).`
    : `You are a rigorous academic exam expert. Generate accurate questions strictly from the provided content without fabrication. Match the requested difficulty and variety. Return ONLY a valid JSON object — nothing before/after.`;

  const schema = `{
  "questions": [
    { "type": "mcq" | "tf" | "essay" | "fill", "question": "...", "options"?: ["A","B","C","D"], "answer": "...", "explanation": "..." }
  ]
}`;

  const user = isAr
    ? `أنشئ ${count} سؤالاً متنوعاً من الأنواع التالية: ${typeList}.
مستوى الصعوبة: ${difficulty}.
لكل سؤال: نص واضح + إجابة صحيحة + شرح موجز. للاختيار من متعدد: 4 خيارات.
للأسئلة المقالية: قدّم نموذج إجابة وافٍ.
وزّع الأسئلة بالتساوي على الأنواع المطلوبة قدر الإمكان.

المحتوى المصدر:
"""
${sourceText}
"""

أعد JSON فقط بهذا الشكل:
${schema}`
    : `Generate ${count} diverse questions of these types: ${typeList}.
Difficulty: ${difficulty}.
Each question must include: clear text + correct answer + brief explanation. MCQ: 4 options.
Essay: provide a model answer.
Distribute counts evenly across requested types.

Source content:
"""
${sourceText}
"""

Return JSON ONLY in this shape:
${schema}`;

  return { system, user };
}

async function callGeminiDirect(apiKey: string, system: string, user: string): Promise<any | null> {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.6, responseMimeType: "application/json" },
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return JSON.parse(text);
    } catch (e) { console.error("gemini direct error:", e); }
  }
  return null;
}

async function callLovableGateway(system: string, user: string): Promise<any | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.6,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) { console.error("gateway:", res.status, await res.text()); return null; }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) return JSON.parse(content);
  } catch (e) { console.error("gateway exception:", e); }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { sourceText, count, types, difficulty, language } = await req.json();
    if (!sourceText) throw new Error("Missing sourceText");

    const { system, user } = buildPrompt(sourceText, count || 10, types?.length ? types : ["mcq"], difficulty || "medium", language || "ar");

    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    let result: any = null;
    if (GEMINI_KEY) result = await callGeminiDirect(GEMINI_KEY, system, user);
    if (!result) result = await callLovableGateway(system, user);
    if (!result) throw new Error("All AI providers failed");

    const questions = Array.isArray(result.questions) ? result.questions : [];

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-exam error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
