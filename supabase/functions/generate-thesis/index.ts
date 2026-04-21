import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ThesisInput {
  title: string;
  thesisType: "master" | "phd";
  field: string;
  supervisor: string;
  university: string;
  abstract: string;
  language: "ar" | "en";
  chapterCount: number;
  referenceCount: number;
}

function chapterStructure(thesisType: string, isAr: boolean): string[] {
  if (thesisType === "phd") {
    return isAr
      ? [
        "الفصل الأول: المقدمة العامة وإطار البحث",
        "الفصل الثاني: المراجعة الأدبية والإطار النظري",
        "الفصل الثالث: الدراسات السابقة والفجوة البحثية",
        "الفصل الرابع: المنهجية البحثية وأدوات التحليل",
        "الفصل الخامس: تطبيق النموذج المقترح والمساهمة الأصلية",
        "الفصل السادس: النتائج والتحليل والمناقشة",
        "الفصل السابع: الخاتمة والتوصيات والأبحاث المستقبلية",
      ]
      : [
        "Chapter 1: General Introduction and Research Framework",
        "Chapter 2: Literature Review and Theoretical Framework",
        "Chapter 3: Previous Studies and Research Gap",
        "Chapter 4: Research Methodology and Analytical Tools",
        "Chapter 5: Proposed Model Implementation and Original Contribution",
        "Chapter 6: Results, Analysis and Discussion",
        "Chapter 7: Conclusion, Recommendations and Future Research",
      ];
  }
  return isAr
    ? [
      "الفصل الأول: المقدمة ومشكلة البحث",
      "الفصل الثاني: الإطار النظري والدراسات السابقة",
      "الفصل الثالث: المنهجية وإجراءات البحث",
      "الفصل الرابع: عرض النتائج وتحليلها ومناقشتها",
      "الفصل الخامس: الخاتمة والاستنتاجات والتوصيات",
    ]
    : [
      "Chapter 1: Introduction and Research Problem",
      "Chapter 2: Theoretical Framework and Previous Studies",
      "Chapter 3: Methodology and Research Procedures",
      "Chapter 4: Results, Analysis and Discussion",
      "Chapter 5: Conclusion, Findings and Recommendations",
    ];
}

function buildSystem(input: ThesisInput): string {
  const isAr = input.language === "ar";
  const typeLabel = input.thesisType === "phd"
    ? (isAr ? "رسالة دكتوراه (PhD)" : "PhD Dissertation")
    : (isAr ? "رسالة ماجستير" : "Master's Thesis");

  return isAr
    ? `أنت أستاذ جامعي خبير وموثوق في كتابة ${typeLabel} الأكاديمية وفق أعلى المعايير الدولية (APA 7).

قواعد صارمة لا يجوز تجاوزها:
1. اللغة: العربية الفصحى الأكاديمية، أسلوب موضوعي، ضمير الغائب، بدون عبارات إنشائية.
2. المنهجية الأكاديمية الكاملة: مقدمة، مشكلة البحث، أسئلة البحث (3-5)، أهداف البحث، فرضيات البحث، أهمية البحث، حدود البحث، مصطلحات البحث.
3. الدراسات السابقة: لا تقل عن ${Math.min(15, Math.floor(input.referenceCount / 2))} دراسة حقيقية معتمدة (2018-2025) مع لكل دراسة: المؤلف والسنة، الهدف، المنهجية، النتائج، الفجوة عن البحث الحالي.
4. المراجع: لا تقل عن ${input.referenceCount} مرجعاً حقيقياً موثقاً بصيغة APA 7. ممنوع منعاً باتاً اختراع مراجع وهمية. استخدم فقط مراجع منشورة فعلياً (مجلات محكمة، كتب أكاديمية، مؤتمرات دولية).
5. الاستشهاد المتسلسل داخل النص: [1], [2]... مرتبط بقائمة المراجع النهائية.
6. ${input.thesisType === "phd" ? "المساهمة الأصلية: يجب إبراز إسهامك العلمي الأصلي في الفصل الخامس بوضوح." : "أصالة البحث: قدم تحليلاً نقدياً للأدبيات."}
7. التنسيق: HTML نظيف فقط. استخدم <h1> للفصول، <h2> للأقسام الرئيسية، <h3> للفرعية، <p> للفقرات، <table> للجداول، <ol>/<ul> للقوائم.
8. الحجم: لكل فصل 1500-3000 كلمة على الأقل.
9. الترقيم: 1.1، 1.1.1 وهكذا.

أعد JSON فقط بهذا الشكل:
{ "html": "<محتوى HTML كامل بفصول مرقمة>", "chapters": ["اسم الفصل 1", ...] }`
    : `You are a senior university professor and an authoritative writer of academic ${typeLabel} following the highest international standards (APA 7).

Strict rules — NO exceptions:
1. Language: Formal academic English, third-person, objective tone, no fluff.
2. Full academic methodology: Introduction, Research Problem, Research Questions (3-5), Objectives, Hypotheses, Significance, Scope, Definitions.
3. Previous Studies: At least ${Math.min(15, Math.floor(input.referenceCount / 2))} REAL credible studies (2018-2025). For each: Author/Year, Objective, Methodology, Findings, Gap relative to current work.
4. References: At least ${input.referenceCount} REAL verifiable references in APA 7. ABSOLUTELY FORBIDDEN to invent fake references. Use only actually published works (peer-reviewed journals, academic books, international conferences).
5. Sequential in-text citations [1], [2]... linked to a final References list.
6. ${input.thesisType === "phd" ? "Original contribution: Clearly highlight your novel scientific contribution in Chapter 5." : "Originality: Provide critical analysis of the literature."}
7. Formatting: Clean HTML only. <h1> for chapters, <h2> for sections, <h3> for subsections, <p>, <table>, <ol>/<ul>.
8. Length: Each chapter 1500-3000+ words.
9. Numbering: 1.1, 1.1.1, etc.

Return JSON ONLY:
{ "html": "<full HTML with numbered chapters>", "chapters": ["Chapter 1 name", ...] }`;
}

function buildUser(input: ThesisInput): string {
  const isAr = input.language === "ar";
  const chapters = chapterStructure(input.thesisType, isAr);
  const list = chapters.map((c, i) => `${i + 1}. ${c}`).join("\n");

  return isAr
    ? `بيانات الرسالة:
- العنوان: ${input.title}
- التخصص: ${input.field}
- المشرف: ${input.supervisor || "غير محدد"}
- الجامعة: ${input.university || "غير محدد"}
- الفكرة/الملخص: ${input.abstract || "(غير مزود)"}

هيكل الرسالة المطلوب (${chapters.length} فصول):
${list}

قم بكتابة الرسالة كاملة الآن مع الالتزام بكل القواعد.`
    : `Thesis data:
- Title: ${input.title}
- Field: ${input.field}
- Supervisor: ${input.supervisor || "N/A"}
- University: ${input.university || "N/A"}
- Idea/Abstract: ${input.abstract || "(not provided)"}

Required structure (${chapters.length} chapters):
${list}

Write the full thesis now adhering to ALL rules.`;
}

async function callGeminiDirect(apiKey: string, system: string, user: string): Promise<any | null> {
  const models = ["gemini-2.5-pro", "gemini-2.5-flash"];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
          generationConfig: { maxOutputTokens: 32000, temperature: 0.7, responseMimeType: "application/json" },
        }),
      });
      if (!res.ok) { console.error("gemini", model, res.status); continue; }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return JSON.parse(text);
    } catch (e) { console.error("gemini exc:", e); }
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
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) { console.error("gateway:", res.status, await res.text()); return null; }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) return JSON.parse(content);
  } catch (e) { console.error("gateway exc:", e); }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const input: ThesisInput = await req.json();
    if (!input.title || !input.field) throw new Error("Missing title or field");

    const system = buildSystem(input);
    const user = buildUser(input);

    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    let result: any = null;
    if (GEMINI_KEY) result = await callGeminiDirect(GEMINI_KEY, system, user);
    if (!result) result = await callLovableGateway(system, user);
    if (!result) throw new Error("All AI providers failed");

    const html = result.html || "";
    const chapters = Array.isArray(result.chapters) ? result.chapters : [];

    return new Response(JSON.stringify({ content: { html }, chapters }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-thesis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
