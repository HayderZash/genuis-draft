import type { ProjectData } from '@/pages/ProjectEditor';
import type { TranslationKey } from '@/i18n/translations';
import { supabase } from '@/integrations/supabase/client';
import type { AIProvider } from '@/components/SettingsDialog';
import { getMergeConfig, getProviderKey } from '@/components/SettingsDialog';

interface GenerateParams {
  apiKey: string;
  provider: AIProvider;
  project: ProjectData;
  lang: 'ar' | 'en';
  onProgress: (step: string, progress: number) => void;
  t: (key: TranslationKey) => string;
}

const WORDS_PER_PAGE = 250;

/** Delay helper */
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Call AI with retry logic for rate limits */
async function callAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number,
  retries = 3
): Promise<string> {
  // Try merge mode first
  const mergeConfig = getMergeConfig();
  if (mergeConfig.enabled && mergeConfig.providers.length > 0) {
    try {
      const providers = mergeConfig.providers
        .map(p => ({ provider: p, apiKey: getProviderKey(p) }))
        .filter(p => p.apiKey);
      
      if (providers.length > 0) {
        const { data, error } = await supabase.functions.invoke('ai-merge-proxy', {
          body: { providers, systemPrompt, userPrompt, maxTokens, temperature, mergeLanguage: systemPrompt.includes('العربية') ? 'ar' : 'en' },
        });
        if (!error && data?.content) {
          console.log('[AI] Merge mode succeeded');
          return data.content;
        }
        console.warn('[AI] Merge mode failed, falling back to Lovable AI:', error?.message || data?.error);
      }
    } catch (e) {
      console.warn('[AI] Merge exception, falling back:', e);
    }
  }

  // Fallback: use Lovable AI directly (always available)
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[AI] Lovable AI attempt ${attempt}/${retries}`);
      
      const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { provider: 'lovable', apiKey: '', systemPrompt, userPrompt, maxTokens, temperature },
      });

      if (error) {
        const errMsg = error.message || 'AI proxy call failed';
        console.error(`[AI] Invoke error (attempt ${attempt}):`, errMsg);
        
        // Check for rate limit
        if (errMsg.includes('429') || errMsg.includes('rate') || errMsg.includes('Rate')) {
          if (attempt < retries) {
            const waitTime = attempt * 5000; // 5s, 10s, 15s
            console.log(`[AI] Rate limited, waiting ${waitTime}ms...`);
            await delay(waitTime);
            continue;
          }
        }
        throw new Error(errMsg);
      }

      if (data?.error) {
        console.error(`[AI] API error (attempt ${attempt}):`, data.error);
        
        if (data.error.includes('429') || data.error.includes('rate') || data.error.includes('Rate')) {
          if (attempt < retries) {
            const waitTime = attempt * 5000;
            console.log(`[AI] Rate limited, waiting ${waitTime}ms...`);
            await delay(waitTime);
            continue;
          }
        }
        throw new Error(data.error);
      }

      const content = data?.content || '';
      if (!content) {
        console.error(`[AI] Empty content (attempt ${attempt})`);
        if (attempt < retries) {
          await delay(2000);
          continue;
        }
        throw new Error('AI returned empty content');
      }

      console.log(`[AI] Success, content length: ${content.length}`);
      return content;
    } catch (e: any) {
      if (attempt === retries) throw e;
      console.warn(`[AI] Attempt ${attempt} failed:`, e.message);
      await delay(attempt * 3000);
    }
  }

  throw new Error('All AI attempts failed');
}

/** Strip markdown code fences from AI output */
function cleanHtmlOutput(text: string): string {
  return text
    .replace(/^```html\s*/gi, '')
    .replace(/^```\s*/gm, '')
    .replace(/```\s*$/g, '')
    .trim();
}

export async function generateResearch({ project, lang, onProgress, t }: GenerateParams): Promise<Record<string, string>> {
  const content: Record<string, string> = {};
  const totalChapters = project.chapters.length;
  const researchLang = project.research_language || lang;
  const includeImages = (project as any).include_images;

  // Generate Abstract
  onProgress(t('generatingAbstract'), 3);
  const abstractSystemPrompt = researchLang === 'ar'
    ? 'أنت خبير أكاديمي. اكتب ملخصاً أكاديمياً (Abstract) بتنسيق HTML. استخدم <h1> للعنوان و <p> للنص. اكتب باللغة العربية فقط.'
    : 'You are an academic expert. Write an academic abstract in HTML. Use <h1> for title and <p> for text. Write in English only.';
  const abstractUserPrompt = researchLang === 'ar'
    ? `اكتب ملخصاً أكاديمياً (Abstract) لبحث بعنوان "${project.title}". يجب أن يكون الملخص باللغة العربية ويلخص أهداف البحث ومنهجيته وأهم نتائجه في 200-300 كلمة.`
    : `Write an academic abstract for a research paper titled "${project.title}". Summarize objectives, methodology, and key findings in 200-300 words.`;
  
  try {
    const rawAbstract = await callAI(abstractSystemPrompt, abstractUserPrompt, 1500, 0.5);
    content['abstract'] = cleanHtmlOutput(rawAbstract);
    console.log('[Gen] Abstract done');
  } catch (e: any) {
    console.error('[Gen] Abstract failed:', e.message);
    throw new Error(`Abstract generation failed: ${e.message}`);
  }

  onProgress(t('analyzingTopic'), 5);

  // Add delay between API calls to avoid rate limits
  await delay(2000);

  // Generate each chapter
  for (let i = 0; i < totalChapters; i++) {
    const chapterName = researchLang === 'ar' ? project.chapters[i].nameAr : project.chapters[i].name;
    const progressStep = `${t('draftingChapter')} ${i + 1}: ${chapterName}`;
    const baseProgress = 10 + (i / totalChapters) * 70;
    onProgress(progressStep, baseProgress);

    const chapterPages = project.chapter_pages?.[i];
    const wordTarget = chapterPages ? chapterPages * WORDS_PER_PAGE : 1200;
    const chapterNum = i + 1;
    const isLast = i === totalChapters - 1;
    const refsInstruction = project.custom_references ? `\nUse these references where relevant: ${project.custom_references}` : '';
    const dirInstruction = project.text_direction === 'ltr' ? 'Write in left-to-right direction.' : 'Write in right-to-left direction.';

    const includeTables = (project as any).include_data_tables;

    const figureInstruction = includeImages
      ? (researchLang === 'ar'
        ? `أضف عناوين أشكال توضيحية بتنسيق <p class="figure-caption"><em>[الشكل ${chapterNum}.X: الوصف]</em></p>.`
        : `Insert figure captions as <p class="figure-caption"><em>[Figure ${chapterNum}.X: Description]</em></p>.`)
      : '';

    const tableInstruction = includeTables
      ? (researchLang === 'ar'
        ? `أضف جداول بيانات بتنسيق HTML مع عنوان <p><strong>جدول ${chapterNum}.X: الوصف</strong></p> متبوعاً بـ <table>.`
        : `Add data tables with <p><strong>Table ${chapterNum}.X: Description</strong></p> followed by <table>.`)
      : '';

    const noRefsInChapter = researchLang === 'ar'
      ? 'لا تكتب قائمة المصادر أو المراجع في نهاية الفصل. لا تستخدم أي إشارات مرجعية داخل النص.'
      : 'Do NOT include a references section at the end. Do NOT use in-text citations like [1] or [2].';

    const numberingInstruction = researchLang === 'ar'
      ? `رقّم العناوين: عنوان الفصل "الفصل ${chapterNum}: ${chapterName}" بـ <h1>، العناوين الرئيسية ${chapterNum}.1، ${chapterNum}.2 بـ <h2>، الفرعية ${chapterNum}.1.1 بـ <h3>.`
      : `Number headings: chapter title "Chapter ${chapterNum}: ${chapterName}" in <h1>, main headings ${chapterNum}.1, ${chapterNum}.2 in <h2>, subheadings ${chapterNum}.1.1 in <h3>.`;

    const pageCountStrict = researchLang === 'ar'
      ? `هام جداً: يجب أن يكون طول هذا الفصل ${wordTarget} كلمة بالضبط (${chapterPages || Math.round(wordTarget / WORDS_PER_PAGE)} صفحات). اكتب محتوى كافياً لملء هذا العدد. لا تكتب أقل.`
      : `CRITICAL: This chapter MUST be exactly ${wordTarget} words (${chapterPages || Math.round(wordTarget / WORDS_PER_PAGE)} pages). Write enough content to fill this count. Do NOT write less.`;

    const systemPrompt = researchLang === 'ar'
      ? `أنت خبير أكاديمي متخصص. اكتب بأسلوب أكاديمي رسمي باللغة العربية. ${dirInstruction}
قواعد التنسيق:
- استخدم HTML فقط (لا تستخدم Markdown).
- ${numberingInstruction}
- استخدم <p> للنص العادي.
${figureInstruction ? `- ${figureInstruction}` : ''}
${tableInstruction ? `- ${tableInstruction}` : ''}
- ${noRefsInChapter}
- لا تستخدم رموز خاصة أو أكواد Unicode غير عربية.`
      : `You are an academic expert. Write in formal academic English. ${dirInstruction}
Formatting rules:
- Use HTML only (no Markdown).
- ${numberingInstruction}
- Use <p> for body text.
${figureInstruction ? `- ${figureInstruction}` : ''}
${tableInstruction ? `- ${tableInstruction}` : ''}
- ${noRefsInChapter}
- Do not use special symbols or unusual Unicode characters.`;

    const userPrompt = researchLang === 'ar'
      ? `اكتب الفصل "${chapterName}" لبحث بعنوان "${project.title}".
الملخص: ${project.abstract || 'غير محدد'}.
${pageCountStrict}

التعليمات:
1. ابدأ بعنوان الفصل بتنسيق <h1>.
2. اكتب مقدمة الفصل في فقرتين على الأقل.
3. قسّم المحتوى إلى أقسام فرعية واضحة بعناوين <h2>.
4. لكل قسم فرعي، اكتب 3-5 فقرات مفصلة ومعمقة.
5. إذا احتاج القسم لتفصيل أكبر، أضف عناوين <h3>.
6. اختم الفصل بفقرة ملخصة.
${isLast ? 'هذا هو الفصل الأخير - اكتب خاتمة شاملة.' : ''}${refsInstruction}

مهم: اكتب كل فقرة بشكل كامل ومفصل. لا تختصر.`
      : `Write chapter "${chapterName}" for a research paper titled "${project.title}".
Abstract: ${project.abstract || 'Not specified'}.
${pageCountStrict}

Instructions:
1. Start with the chapter title in <h1>.
2. Write an introduction of at least 2 paragraphs.
3. Divide content into clear subsections with <h2> headings.
4. For each subsection, write 3-5 detailed, in-depth paragraphs.
5. Add <h3> subheadings where more detail is needed.
6. End the chapter with a summary paragraph.
${isLast ? 'This is the final chapter - write a comprehensive conclusion.' : ''}${refsInstruction}

Important: Write each paragraph fully and in detail. Do not abbreviate.`;

    try {
      const raw = await callAI(systemPrompt, userPrompt, 8000, 0.7);
      content[`chapter_${i}`] = cleanHtmlOutput(raw);
      onProgress(progressStep, baseProgress + (70 / totalChapters) * 0.8);
      console.log(`[Gen] Chapter ${i + 1} done, length: ${content[`chapter_${i}`].length}`);
    } catch (e: any) {
      console.error(`[Gen] Chapter ${i + 1} failed:`, e.message);
      throw new Error(`Chapter ${i + 1} failed: ${e.message}`);
    }

    // Delay between chapters to avoid rate limits
    if (i < totalChapters - 1) {
      await delay(3000);
    }
  }

  // Generate references
  onProgress(t('formattingCitations'), 85);
  await delay(2000);
  
  const refCount = project.reference_count || 10;
  const refsSystemPrompt = researchLang === 'ar' ? 'أنت خبير أكاديمي. اكتب بتنسيق HTML فقط.' : 'You are an academic expert. Write in HTML format only.';
  const refsPrompt = researchLang === 'ar'
    ? `بناءً على بحث بعنوان "${project.title}" حول "${project.abstract}", اكتب قائمة مراجع مرقمة تحتوي على ${refCount} مصدر بالضبط. رقم كل مصدر [1]، [2]، إلخ. استخدم <h1> للعنوان و <p> لكل مرجع. ${project.custom_references ? `تضمين: ${project.custom_references}` : ''}`
    : `Based on research titled "${project.title}" about "${project.abstract}", write a numbered reference list with EXACTLY ${refCount} references. Number [1], [2], etc. Use <h1> for title and <p> for each reference. ${project.custom_references ? `Include: ${project.custom_references}` : ''}`;

  try {
    const rawRefs = await callAI(refsSystemPrompt, refsPrompt, 2000, 0.5);
    content['references'] = cleanHtmlOutput(rawRefs);
    console.log('[Gen] References done');
  } catch (e: any) {
    console.error('[Gen] References failed:', e.message);
    // Don't fail the whole generation for references
    content['references'] = researchLang === 'ar' ? '<h1>المراجع</h1><p>لم يتم توليد المراجع.</p>' : '<h1>References</h1><p>References could not be generated.</p>';
  }

  onProgress(t('generatingToc'), 92);
  onProgress(t('finalizing'), 98);
  return content;
}

/** Regenerate a single chapter */
export async function regenerateChapter({ project, lang, chapterIndex, onProgress, t }: GenerateParams & { chapterIndex: number; }): Promise<string> {
  const researchLang = project.research_language || lang;
  const chapterName = researchLang === 'ar' ? project.chapters[chapterIndex].nameAr : project.chapters[chapterIndex].name;
  onProgress(`${t('draftingChapter')} ${chapterIndex + 1}: ${chapterName}`, 20);

  const chapterPages = project.chapter_pages?.[chapterIndex];
  const wordTarget = chapterPages ? chapterPages * WORDS_PER_PAGE : 1200;
  const chapterNum = chapterIndex + 1;
  const isLast = chapterIndex === project.chapters.length - 1;
  const refsInstruction = project.custom_references ? `\nUse these references where relevant: ${project.custom_references}` : '';
  const dirInstruction = project.text_direction === 'ltr' ? 'Write in left-to-right direction.' : 'Write in right-to-left direction.';

  const includeImages = (project as any).include_images;
  const includeTables = (project as any).include_data_tables;

  const figureInstruction = includeImages
    ? (researchLang === 'ar'
      ? `أضف عناوين أشكال توضيحية بتنسيق <p class="figure-caption"><em>[الشكل ${chapterNum}.X: الوصف]</em></p>.`
      : `Insert figure captions as <p class="figure-caption"><em>[Figure ${chapterNum}.X: Description]</em></p>.`)
    : '';

  const tableInstruction = includeTables
    ? (researchLang === 'ar'
      ? `أضف جداول بيانات بتنسيق HTML مع عنوان <p><strong>جدول ${chapterNum}.X: الوصف</strong></p> متبوعاً بـ <table>.`
      : `Add data tables with <p><strong>Table ${chapterNum}.X: Description</strong></p> followed by <table>.`)
    : '';

  const noRefsInChapter = researchLang === 'ar'
    ? 'لا تكتب قائمة المصادر في نهاية الفصل. لا تستخدم إشارات مرجعية داخل النص.'
    : 'Do NOT include references at the end. Do NOT use in-text citations.';

  const numberingInstruction = researchLang === 'ar'
    ? `رقّم العناوين: "الفصل ${chapterNum}: ${chapterName}" بـ <h1>، الرئيسية ${chapterNum}.1 بـ <h2>، الفرعية ${chapterNum}.1.1 بـ <h3>.`
    : `Number: "Chapter ${chapterNum}: ${chapterName}" in <h1>, main ${chapterNum}.1 in <h2>, sub ${chapterNum}.1.1 in <h3>.`;

  const pageCountStrict = researchLang === 'ar'
    ? `هام جداً: يجب أن يكون طول هذا الفصل ${wordTarget} كلمة بالضبط (${chapterPages || Math.round(wordTarget / WORDS_PER_PAGE)} صفحات). لا تكتب أقل.`
    : `CRITICAL: This chapter MUST be exactly ${wordTarget} words (${chapterPages || Math.round(wordTarget / WORDS_PER_PAGE)} pages). Do NOT write less.`;

  const systemPrompt = researchLang === 'ar'
    ? `أنت خبير أكاديمي. اكتب بأسلوب رسمي بالعربية. ${dirInstruction}
قواعد: HTML فقط. ${numberingInstruction} <p> للنص.
${figureInstruction ? figureInstruction : ''} ${tableInstruction ? tableInstruction : ''}
${noRefsInChapter}
لا تستخدم رموز خاصة أو أكواد Unicode غير عربية.`
    : `You are an academic expert. Formal English. ${dirInstruction}
Rules: HTML only. ${numberingInstruction} <p> for body.
${figureInstruction} ${tableInstruction}
${noRefsInChapter}
No special symbols or unusual Unicode.`;

  const userPrompt = researchLang === 'ar'
    ? `اكتب الفصل "${chapterName}" لبحث بعنوان "${project.title}".
الملخص: ${project.abstract || 'غير محدد'}. ${pageCountStrict}
اكتب فقرة فقرة بتفصيل كامل. قسّم لأقسام فرعية واضحة.
${isLast ? 'هذا الفصل الأخير.' : ''}${refsInstruction}`
    : `Write chapter "${chapterName}" for "${project.title}".
Abstract: ${project.abstract || 'Not specified'}. ${pageCountStrict}
Write paragraph by paragraph in full detail. Use clear subsections.
${isLast ? 'Final chapter.' : ''}${refsInstruction}`;

  onProgress(`${t('draftingChapter')} ${chapterIndex + 1}: ${chapterName}`, 50);
  const raw = await callAI(systemPrompt, userPrompt, 8000, 0.7);
  const chapterContent = cleanHtmlOutput(raw);

  onProgress(t('finalizing'), 90);
  return chapterContent;
}
