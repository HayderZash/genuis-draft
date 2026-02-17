import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, content, slideCount, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isAr = language === 'ar';
    const systemPrompt = isAr
      ? `أنت خبير في إنشاء العروض التقديمية الأكاديمية. قم بإنشاء عرض تقديمي من ${slideCount || 10} شرائح بناءً على المحتوى المقدم.

لكل شريحة قم بتقديم:
- عنوان الشريحة
- النقاط الرئيسية (3-5 نقاط)
- ملاحظات المتحدث

أجب بتنسيق JSON:
{"slides": [{"title": "string", "points": ["string"], "notes": "string"}]}`
      : `You are an expert in creating academic presentations. Create a presentation of ${slideCount || 10} slides based on the provided content.

For each slide provide:
- Slide title
- Key points (3-5 bullet points)
- Speaker notes

Respond in JSON format:
{"slides": [{"title": "string", "points": ["string"], "notes": "string"}]}`;

    const userPrompt = isAr
      ? `عنوان العرض: ${title}\n\nالمحتوى:\n${content}`
      : `Presentation title: ${title}\n\nContent:\n${content}`;

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
        max_tokens: 8000,
        temperature: 0.5,
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
    const resultContent = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ result: resultContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-presentation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
