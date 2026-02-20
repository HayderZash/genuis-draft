import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, report_type, abstract, research_language, page_count, custom_references, reference_count, include_images, include_tables } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isAr = research_language === 'ar';
    const wordTarget = page_count * 250;
    const isLab = report_type === 'lab';
    const typeLabel = isLab
      ? (isAr ? 'تقرير مختبري' : 'laboratory report')
      : (isAr ? 'تقرير علمي' : 'scientific report');

    const refsNote = custom_references ? (isAr ? `استخدم هذه المراجع: ${custom_references}` : `Use these references: ${custom_references}`) : '';

    // Report structure - no research methodology
    const sections = isLab
      ? (isAr
          ? 'المقدمة، الأدوات والمواد، خطوات العمل، النتائج، التحليل والمناقشة، الاستنتاجات'
          : 'Introduction, Materials and Equipment, Procedure, Results, Analysis and Discussion, Conclusions')
      : (isAr
          ? 'المقدمة والخلفية، الموضوع الرئيسي، العرض والتحليل، النتائج، التوصيات، الخاتمة'
          : 'Introduction and Background, Main Topic, Presentation and Analysis, Findings, Recommendations, Conclusion');

    const imagesInstruction = include_images
      ? (isAr ? 'أضف صوراً توضيحية مع عناوين لكل صورة بتنسيق <p class="figure-caption"><em>[الشكل X: الوصف]</em></p>.' : 'Add illustrative images with captions formatted as <p class="figure-caption"><em>[Figure X: Description]</em></p>.')
      : '';
    const tablesInstruction = include_tables
      ? (isAr ? 'أضف جداول بيانات مع عناوين لكل جدول بتنسيق <p><strong>جدول X: الوصف</strong></p> متبوعاً بـ <table>.' : 'Add data tables with captions formatted as <p><strong>Table X: Description</strong></p> followed by <table>.')
      : '';

    const pageCountStrict = isAr
      ? `هام جداً: يجب أن يكون التقرير بطول ${wordTarget} كلمة بالضبط (${page_count} صفحات). التزم بعدد الكلمات بدقة تامة. لا تكتب أقل من ذلك مطلقاً.`
      : `CRITICAL: The report MUST be exactly ${wordTarget} words (${page_count} pages). Strictly adhere to this word count. Do NOT write less.`;

    const systemPrompt = isAr
      ? `أنت خبير في كتابة التقارير. اكتب ${typeLabel} بأسلوب رسمي واضح باللغة العربية. 
هذا تقرير وليس بحث أكاديمي - لا تضف منهجية البحث أو إطار نظري أو دراسات سابقة.
اكتب بأسلوب تقريري مباشر وعملي.
استخدم تنسيق HTML مع <h1> للعنوان الرئيسي و <h2> للعناوين الفرعية و <p> للنصوص و <ul>/<li> للقوائم.
${imagesInstruction} ${tablesInstruction}`
      : `You are an expert report writer. Write a ${typeLabel} in formal, clear style in English.
This is a REPORT not a research paper - do NOT include research methodology, theoretical framework, or literature review.
Write in a direct, practical, report-style format.
Use HTML with <h1> for main title, <h2> for section headings, <p> for body text, <ul>/<li> for lists.
${imagesInstruction} ${tablesInstruction}`;

    const userPrompt = isAr
      ? `اكتب ${typeLabel} بعنوان "${title}". التفاصيل: ${abstract || 'غير محدد'}. ${pageCountStrict}
يجب أن يتضمن التقرير الأقسام التالية: ${sections}.
أضف قائمة مراجع تحتوي على ${reference_count} مصدر في النهاية. ${refsNote}
لا تضف منهجية بحث أو إطار نظري.`
      : `Write a ${typeLabel} titled "${title}". Details: ${abstract || 'Not specified'}. ${pageCountStrict}
Include these sections: ${sections}.
Add a reference list with ${reference_count} references at the end. ${refsNote}
Do NOT include research methodology or theoretical framework.`;

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
