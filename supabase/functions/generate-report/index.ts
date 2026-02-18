import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, report_type, abstract, research_language, page_count, custom_references, reference_count } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isAr = research_language === 'ar';
    const wordTarget = page_count * 250;
    const typeLabel = report_type === 'lab'
      ? (isAr ? 'تقرير مختبري' : 'laboratory report')
      : (isAr ? 'تقرير علمي' : 'scientific report');

    const refsNote = custom_references ? (isAr ? `استخدم هذه المراجع: ${custom_references}` : `Use these references: ${custom_references}`) : '';

    const systemPrompt = isAr
      ? `أنت خبير أكاديمي. اكتب ${typeLabel} بأسلوب أكاديمي رسمي باللغة العربية. استخدم تنسيق HTML مع <h1> للعنوان الرئيسي و <h2> للعناوين الفرعية و <p> للنصوص.`
      : `You are an academic expert. Write a ${typeLabel} in formal academic style in English. Use HTML with <h1> for main title, <h2> for section headings, <p> for body text.`;

    const userPrompt = isAr
      ? `اكتب ${typeLabel} بعنوان "${title}". الملخص: ${abstract || 'غير محدد'}. اكتب حوالي ${wordTarget} كلمة. يجب أن يتضمن التقرير: مقدمة، المنهجية، النتائج، المناقشة، والخاتمة. أضف قائمة مراجع تحتوي على ${reference_count} مصدر. ${refsNote}`
      : `Write a ${typeLabel} titled "${title}". Abstract: ${abstract || 'Not specified'}. Write approximately ${wordTarget} words. Include: Introduction, Methodology, Results, Discussion, and Conclusion. Add a reference list with ${reference_count} references. ${refsNote}`;

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
          { role: "user", content: userPrompt },
        ],
        max_tokens: 8000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    // Clean any markdown code blocks
    content = content.replace(/^```html?\s*/gi, '').replace(/```\s*$/g, '').trim();

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
