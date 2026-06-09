/** Report generation using the AI proxy edge function */
import { supabase } from '@/integrations/supabase/client';
import type { AIProvider } from '@/components/SettingsDialog';
import { getMergeConfig, getProviderKey } from '@/components/SettingsDialog';
import { getAssistantProviderPayload } from '@/lib/assistant-provider';

interface ReportGenParams {
  title: string;
  report_type: string;
  abstract: string;
  research_language: string;
  page_count: number;
  custom_references: string;
  reference_count: number;
  include_images?: boolean;
  include_tables?: boolean;
  provider: AIProvider;
  apiKey: string;
}

async function callAI(
  provider: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  // Try user's merge mode
  const mergeConfig = getMergeConfig();
  if (mergeConfig.enabled && mergeConfig.providers.length > 0) {
    const providers = mergeConfig.providers
      .map(p => ({ provider: p, apiKey: getProviderKey(p) }))
      .filter(p => p.apiKey);

    if (providers.length > 0) {
      const isAr = systemPrompt.includes('العربية') || systemPrompt.includes('عربي');
      const { data, error } = await supabase.functions.invoke('ai-merge-proxy', {
        body: { providers, systemPrompt, userPrompt, maxTokens, temperature: 0.7, mergeLanguage: isAr ? 'ar' : 'en' },
      });
      if (!error && data?.content) return data.content;
    }
  }

  // Try the provided provider/key
  if (provider && apiKey) {
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
      body: { provider, apiKey, systemPrompt, userPrompt, maxTokens, temperature: 0.7 },
    });
    if (!error && data?.content) return data.content;
  }

  // Fallback: try admin default keys
  const defaults = getAssistantProviderPayload();
  if (defaults.provider && defaults.apiKey) {
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
      body: { provider: defaults.provider, apiKey: defaults.apiKey, systemPrompt, userPrompt, maxTokens, temperature: 0.7 },
    });
    if (!error && data?.content) return data.content;
  }

  // Final fallback: Lovable
  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: { provider: 'lovable', apiKey: '', systemPrompt, userPrompt, maxTokens, temperature: 0.7 },
  });
  if (error) throw new Error(error.message || 'AI proxy call failed');
  if (data?.error) throw new Error(data.error);
  return data?.content || '';
}

function cleanHtml(text: string): string {
  return text.replace(/^```html\s*/gi, '').replace(/^```\s*/gm, '').replace(/```\s*$/g, '').trim();
}

/** Generate images for figure captions */
async function processImagesInContent(html: string): Promise<string> {
  const captionRegex = /\[(?:Figure|الشكل)\s+[\d.]+:\s*([^\]]+)\]/gi;
  const matches = [...html.matchAll(captionRegex)];
  if (matches.length === 0) return html;

  let result = html;
  for (const match of matches) {
    const description = match[1].trim();
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt: description },
      });
      if (error || !data?.imageUrl) continue;
      const imgHtml = `<div class="generated-figure" style="text-align:center;margin:16px 0;"><img src="${data.imageUrl}" alt="${description}" style="max-width:100%;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" /></div>`;
      result = result.replace(match[0], imgHtml + match[0]);
    } catch (e) {
      console.error('Image generation failed for:', description, e);
    }
  }
  return result;
}

export async function callAIForReport(params: ReportGenParams): Promise<Record<string, string>> {
  const { title, report_type, abstract, research_language, page_count, custom_references, reference_count, include_images, include_tables, provider, apiKey } = params;
  const isAr = research_language === 'ar';
  const wordTarget = page_count * 250;
  const isLab = report_type === 'lab';

  const typeLabel = isLab
    ? (isAr ? 'تقرير مختبري' : 'laboratory report')
    : (isAr ? 'تقرير علمي' : 'scientific report');

  const sections = isLab
    ? (isAr
      ? 'المقدمة، الأدوات والمواد، خطوات العمل، النتائج، التحليل والمناقشة، الاستنتاجات'
      : 'Introduction, Materials and Equipment, Procedure, Results, Analysis and Discussion, Conclusions')
    : (isAr
      ? 'المقدمة والخلفية، الموضوع الرئيسي، العرض والتحليل، النتائج، التوصيات، الخاتمة'
      : 'Introduction and Background, Main Topic, Presentation and Analysis, Findings, Recommendations, Conclusion');

  const imagesInstruction = include_images
    ? (isAr ? 'أضف صوراً توضيحية مع عناوين بتنسيق <p class="figure-caption"><em>[الشكل X: الوصف]</em></p>.' : 'Add illustrative images with captions as <p class="figure-caption"><em>[Figure X: Description]</em></p>.')
    : '';
  const tablesInstruction = include_tables
    ? (isAr ? 'أضف جداول بيانات مع عنوان <p><strong>جدول X: الوصف</strong></p> متبوعاً بـ <table>.' : 'Add data tables with <p><strong>Table X: Description</strong></p> followed by <table>.')
    : '';

  const pageCountStrict = isAr
    ? `هام جداً: يجب أن يكون التقرير بطول ${wordTarget} كلمة بالضبط (${page_count} صفحات). التزم بعدد الكلمات بدقة.`
    : `CRITICAL: The report MUST be exactly ${wordTarget} words (${page_count} pages). Strictly adhere to this word count.`;

  const systemPrompt = isAr
    ? `أنت خبير في كتابة التقارير. اكتب ${typeLabel} بأسلوب رسمي واضح باللغة العربية.
هذا تقرير وليس بحث أكاديمي - لا تضف منهجية البحث أو إطار نظري أو دراسات سابقة.
اكتب بأسلوب تقريري مباشر وعملي.
استخدم HTML فقط: <h1> للعنوان، <h2> للعناوين الفرعية، <p> للنصوص، <ul>/<li> للقوائم.
لا تستخدم رموز خاصة أو Markdown.
${imagesInstruction} ${tablesInstruction}`
    : `You are an expert report writer. Write a ${typeLabel} in formal, clear English.
This is a REPORT not a research paper - do NOT include research methodology, theoretical framework, or literature review.
Write in a direct, practical, report-style format.
Use HTML only: <h1> for main title, <h2> for sections, <p> for body, <ul>/<li> for lists.
No Markdown, no special symbols.
${imagesInstruction} ${tablesInstruction}`;

  const refsNote = custom_references ? (isAr ? `استخدم هذه المراجع: ${custom_references}` : `Use these references: ${custom_references}`) : '';

  const userPrompt = isAr
    ? `اكتب ${typeLabel} بعنوان "${title}". التفاصيل: ${abstract || 'غير محدد'}. ${pageCountStrict}
يجب أن يتضمن التقرير الأقسام التالية: ${sections}.
أضف قائمة مراجع تحتوي على ${reference_count} مصدر في النهاية. ${refsNote}
لا تضف منهجية بحث أو إطار نظري.
اكتب كل قسم بفقرات مفصلة وكاملة.`
    : `Write a ${typeLabel} titled "${title}". Details: ${abstract || 'Not specified'}. ${pageCountStrict}
Include these sections: ${sections}.
Add a reference list with ${reference_count} references at the end. ${refsNote}
Do NOT include research methodology or theoretical framework.
Write each section with full, detailed paragraphs.`;

  const raw = await callAI(provider, apiKey, systemPrompt, userPrompt, 8000);
  let content = cleanHtml(raw);

  // Generate images if enabled
  if (include_images) {
    content = await processImagesInContent(content);
  }

  return { _full: content };
}
