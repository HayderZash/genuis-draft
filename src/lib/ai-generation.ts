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

const WORDS_PER_PAGE = 200;

/** Strong anti-repetition and quality rules */
const QUALITY_RULES_AR = `قواعد الجودة الصارمة:
- ممنوع تكرار أي جملة أو فكرة بصياغة مختلفة. كل فقرة يجب أن تضيف معلومة جديدة 100%.
- لا تستخدم عبارات عامة فارغة مثل "يعد X أداة قوية" أو "يمكن أن يعد X". اكتب معلومات تقنية محددة بأرقام وتفاصيل.
- كل فقرة يجب أن تحتوي على حقائق محددة: أرقام، مواصفات تقنية، مقارنات، أمثلة واقعية.
- لا تكتب مقدمات طويلة. ادخل في صلب الموضوع مباشرة.
- لا تكتب "في هذا السياق" أو "يمكن أن يعد" أو "من المهم الإشارة إلى" - هذه حشو.
- اكتب كأنك خبير يشرح لطالب دراسات عليا، وليس كمقالة عامة.`;

const QUALITY_RULES_EN = `Strict quality rules:
- NEVER repeat any sentence or idea in different wording. Each paragraph MUST add 100% new information.
- Do NOT use vague phrases like "X is a powerful tool" or "X can be considered". Write specific technical information with numbers and details.
- Each paragraph MUST contain specific facts: numbers, technical specifications, comparisons, real-world examples.
- Do NOT write lengthy introductions. Get to the point immediately.
- Do NOT use filler phrases like "In this context", "It can be considered", "It is important to note" - these are padding.
- Write as an expert explaining to a graduate student, NOT as a generic article.`;

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
  const includeImages = project.include_images;

  // Generate Abstract
  onProgress(t('generatingAbstract'), 3);
  const abstractSystemPrompt = researchLang === 'ar'
    ? `أنت خبير أكاديمي متخصص. اكتب ملخصاً أكاديمياً (Abstract) بتنسيق HTML. استخدم <h1> للعنوان و <p> للنص. اكتب باللغة العربية فقط. ${QUALITY_RULES_AR}`
    : `You are a specialized academic expert. Write an academic abstract in HTML. Use <h1> for title and <p> for text. Write in English only. ${QUALITY_RULES_EN}`;
  const abstractUserPrompt = researchLang === 'ar'
    ? `اكتب ملخصاً أكاديمياً (Abstract) لبحث بعنوان "${project.title}".
النبذة: ${project.abstract || 'غير محدد'}.
يجب أن يكون الملخص 200-300 كلمة يلخص: الهدف، المنهجية، النتائج الرئيسية، والخلاصة.
اكتب بدقة وتحديد. لا تكرر أي جملة.`
    : `Write an academic abstract for a research paper titled "${project.title}".
Abstract context: ${project.abstract || 'Not specified'}.
Must be 200-300 words covering: objective, methodology, key results, and conclusion.
Be precise and specific. Do NOT repeat any sentence.`;
  
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
    const wordTarget = chapterPages ? chapterPages * WORDS_PER_PAGE : 800;
    const chapterNum = i + 1;
    const isLast = i === totalChapters - 1;
    const refsInstruction = project.custom_references ? `\nUse these references where relevant: ${project.custom_references}` : '';
    const dirInstruction = project.text_direction === 'ltr' ? 'Write in left-to-right direction.' : 'Write in right-to-left direction.';

    const includeTables = project.include_data_tables;
    const isProjectType = project.project_type === 'project';

    // Special instruction for Chapter 3 in project mode: describe components from abstract
    const projectComponentsInstruction = (isProjectType && chapterNum === 3)
      ? (researchLang === 'ar'
        ? `مهم جداً: هذا فصل "المنهجية" في مشروع تخرج. يجب أن تتضمن فقرة خاصة بعنوان "مكونات المشروع" تشرح فيها كل مكون من المكونات المذكورة في النبذة/الملخص التالي:
"${project.abstract}"
لكل مكون:
1. اكتب عنوان فرعي <h3> باسم المكون.
2. اشرح المكون بالتفصيل في 2-3 فقرات (وظيفته، أهميته، كيف يعمل).
3. أضف عنوان صورة توضيحية أسفل الشرح بالتنسيق:
<p class="figure-caption" style="font-style:italic;text-align:center;font-size:12pt;">[Figure ${chapterNum}.X: وصف دقيق بالإنجليزية للمكون يوضح شكله أو واجهته أو مخطط عمله]</p>
4. اجعل نوع الصورة من الأنواع القابلة للتوليد بدقة: لقطة واقعية للمكون، عرض منتج نظيف، أو مخطط تقني بسيط وواضح.
5. تجنب تماماً طلب خرائط، رسوم بيانية إحصائية، جداول، أو صور تحتاج نصوصاً كثيرة داخلها.
تأكد أن الوصف دقيق ومرتبط بالمكون المشروح، وأن الصورة تعرض موضوعاً واحداً واضحاً فقط.`
        : `CRITICAL: This is the "Methodology" chapter of a graduation project. You MUST include a section titled "Project Components" that explains each component mentioned in the abstract:
"${project.abstract}"
For each component:
1. Write a <h3> subheading with the component name.
2. Explain the component in detail in 2-3 paragraphs (function, importance, how it works).
3. Add a figure caption below the explanation in this format:
<p class="figure-caption" style="font-style:italic;text-align:center;font-size:12pt;">[Figure ${chapterNum}.X: A precise English description of the component showing its interface, diagram, or architecture]</p>
4. Use only image types that can be generated accurately: a realistic component/product view, a clean product render, or a simple technical diagram.
5. Do NOT request maps, statistical charts, tables, or visuals that depend on heavy text inside the image.
Ensure descriptions are specific, visually concrete, and related to the explained component, with one clear subject per image.`)
      : '';

    const figureInstruction = includeImages
      ? (researchLang === 'ar'
        ? `مهم جداً: يجب أن تضيف ما لا يقل عن 3 إلى 5 عناوين صور توضيحية في هذا الفصل، موزعة بين الفقرات (ليس في النهاية فقط). كل عنوان صورة يجب أن يكون بالتنسيق التالي بالضبط:
<p class="figure-caption" style="font-style:italic;text-align:center;font-size:12pt;">[Figure ${chapterNum}.1: وصف دقيق ومفصل بالإنجليزية لما يجب أن تُظهره الصورة]</p>
يجب أن يكون الوصف دقيقاً وواقعياً ومرتبطاً مباشرة بالمحتوى المكتوب في الفقرة السابقة.
اختر فقط صوراً قابلة للتوليد بدقة مثل: جهاز، مكوّن، مشهد تطبيقي، لقطة قريبة لقطعة مهمة، أو مخطط تقني/تشغيلي بسيط ونظيف.
تجنب تماماً طلب خرائط، bar charts، line charts، الجداول، والرسوم التي تحتاج نصوصاً داخلية كثيرة.
كل صورة يجب أن تعرض موضوعاً رئيسياً واحداً واضحاً وبتركيب مرتب وحديث.`
        : `CRITICAL: You MUST include at least 3 to 5 figure captions in this chapter, distributed between paragraphs (NOT only at the end). Each figure caption MUST follow this exact format:
<p class="figure-caption" style="font-style:italic;text-align:center;font-size:12pt;">[Figure ${chapterNum}.1: A specific, detailed description of exactly what the image should show]</p>
Each description MUST be specific, realistic, and directly related to the preceding paragraph content.
Only request image types that can be generated accurately, such as a device, component, practical scene, close-up of an important part, or a simple clean technical/workflow diagram.
Do NOT request maps, bar charts, line charts, tables, or visuals that depend on heavy readable text inside the image.
Each image should have one clear main subject and a clean modern composition.`)
      : '';

    const tableInstruction = includeTables
      ? (researchLang === 'ar'
        ? `مهم جداً: يجب أن تضيف جداول بيانات حقيقية بتنسيق HTML كامل. كل جدول يجب أن يكون بالتنسيق التالي بالضبط:
<p><strong>جدول ${chapterNum}.X: وصف الجدول</strong></p>
<table border="1" style="border-collapse:collapse;width:100%;text-align:center;">
<thead><tr><th style="border:1px solid #000;padding:8px;background:#f0f0f0;">العمود 1</th><th style="border:1px solid #000;padding:8px;background:#f0f0f0;">العمود 2</th></tr></thead>
<tbody><tr><td style="border:1px solid #000;padding:8px;">القيمة</td><td style="border:1px solid #000;padding:8px;">القيمة</td></tr></tbody>
</table>
لا تكتب الجداول كنصوص عادية أبداً. يجب أن تكون عناصر <table> حقيقية مع <thead> و <tbody> و <tr> و <th> و <td>.
أضف 2-3 جداول بيانات في هذا الفصل موزعة بين الفقرات.`
        : `CRITICAL: You MUST add real HTML data tables. Each table MUST follow this exact format:
<p><strong>Table ${chapterNum}.X: Table Description</strong></p>
<table border="1" style="border-collapse:collapse;width:100%;text-align:center;">
<thead><tr><th style="border:1px solid #000;padding:8px;background:#f0f0f0;">Column 1</th><th style="border:1px solid #000;padding:8px;background:#f0f0f0;">Column 2</th></tr></thead>
<tbody><tr><td style="border:1px solid #000;padding:8px;">Value</td><td style="border:1px solid #000;padding:8px;">Value</td></tr></tbody>
</table>
NEVER write tables as plain text. They MUST be actual <table> elements with <thead>, <tbody>, <tr>, <th>, <td>.
Add 2-3 data tables distributed between paragraphs in this chapter.`)
      : '';

    const noRefsInChapter = researchLang === 'ar'
      ? 'لا تكتب قائمة المصادر أو المراجع في نهاية الفصل. لا تستخدم أي إشارات مرجعية داخل النص.'
      : 'Do NOT include a references section at the end. Do NOT use in-text citations like [1] or [2].';

    const numberingInstruction = researchLang === 'ar'
      ? `رقّم العناوين: عنوان الفصل "الفصل ${chapterNum}: ${chapterName}" بـ <h1>، العناوين الرئيسية ${chapterNum}.1، ${chapterNum}.2 بـ <h2>، الفرعية ${chapterNum}.1.1 بـ <h3>.`
      : `Number headings: chapter title "Chapter ${chapterNum}: ${chapterName}" in <h1>, main headings ${chapterNum}.1, ${chapterNum}.2 in <h2>, subheadings ${chapterNum}.1.1 in <h3>.`;

    const pageCountStrict = researchLang === 'ar'
      ? `هام: يجب أن يكون طول هذا الفصل حوالي ${wordTarget} كلمة (${chapterPages || Math.round(wordTarget / WORDS_PER_PAGE)} صفحات). اكتب بإيجاز وعمق دون تكرار. لا تعد صياغة نفس الأفكار.`
      : `This chapter should be approximately ${wordTarget} words (${chapterPages || Math.round(wordTarget / WORDS_PER_PAGE)} pages). Write concisely and in-depth without repetition. Do NOT rephrase the same ideas.`;

    const systemPrompt = researchLang === 'ar'
      ? `أنت خبير أكاديمي متخصص. اكتب بأسلوب أكاديمي رسمي باللغة العربية. ${dirInstruction}
قواعد التنسيق:
- استخدم HTML فقط (لا تستخدم Markdown).
- ${numberingInstruction}
- استخدم <p> للنص العادي.
${figureInstruction ? `- ${figureInstruction}` : ''}
${tableInstruction ? `- ${tableInstruction}` : ''}
${projectComponentsInstruction ? `- ${projectComponentsInstruction}` : ''}
- ${noRefsInChapter}
- لا تستخدم رموز خاصة أو أكواد Unicode غير عربية.
${QUALITY_RULES_AR}`
      : `You are an academic expert. Write in formal academic English. ${dirInstruction}
Formatting rules:
- Use HTML only (no Markdown).
- ${numberingInstruction}
- Use <p> for body text.
${figureInstruction ? `- ${figureInstruction}` : ''}
${tableInstruction ? `- ${tableInstruction}` : ''}
${projectComponentsInstruction ? `- ${projectComponentsInstruction}` : ''}
- ${noRefsInChapter}
- Do not use special symbols or unusual Unicode characters.
${QUALITY_RULES_EN}`;

    const userPrompt = researchLang === 'ar'
      ? `اكتب الفصل "${chapterName}" لبحث بعنوان "${project.title}".
الملخص: ${project.abstract || 'غير محدد'}.
${pageCountStrict}

التعليمات:
1. ابدأ بعنوان الفصل بتنسيق <h1>.
2. اكتب مقدمة الفصل في فقرتين على الأقل.
3. قسّم المحتوى إلى أقسام فرعية واضحة بعناوين <h2>.
4. لكل قسم فرعي، اكتب 2-4 فقرات مفصلة بمعلومات تقنية محددة.
5. إذا احتاج القسم لتفصيل أكبر، أضف عناوين <h3>.
6. اختم الفصل بفقرة ملخصة.
${isLast ? 'هذا هو الفصل الأخير - اكتب خاتمة شاملة.' : ''}${refsInstruction}

تحذير صارم: لا تكرر أي فكرة أو جملة بصياغة مختلفة. كل فقرة يجب أن تقدم معلومة جديدة تماماً. إذا وجدت نفسك تكرر، انتقل للنقطة التالية فوراً.`
      : `Write chapter "${chapterName}" for a research paper titled "${project.title}".
Abstract: ${project.abstract || 'Not specified'}.
${pageCountStrict}

Instructions:
1. Start with the chapter title in <h1>.
2. Write an introduction of at least 2 paragraphs.
3. Divide content into clear subsections with <h2> headings.
4. For each subsection, write 2-4 detailed paragraphs with specific technical information.
5. Add <h3> subheadings where more detail is needed.
6. End the chapter with a summary paragraph.
${isLast ? 'This is the final chapter - write a comprehensive conclusion.' : ''}${refsInstruction}

STRICT WARNING: Do NOT repeat any idea or sentence in different wording. Each paragraph MUST present entirely new information. If you find yourself repeating, move to the next point immediately.`;

    try {
      const raw = await callAI(systemPrompt, userPrompt, 8000, 0.8);
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
  const wordTarget = chapterPages ? chapterPages * WORDS_PER_PAGE : 800;
  const chapterNum = chapterIndex + 1;
  const isLast = chapterIndex === project.chapters.length - 1;
  const refsInstruction = project.custom_references ? `\nUse these references where relevant: ${project.custom_references}` : '';
  const dirInstruction = project.text_direction === 'ltr' ? 'Write in left-to-right direction.' : 'Write in right-to-left direction.';

  const includeImages = project.include_images;
  const includeTables = project.include_data_tables;

  const figureInstruction = includeImages
    ? (researchLang === 'ar'
      ? `مهم جداً: أضف 3-5 عناوين صور توضيحية موزعة بين الفقرات بالتنسيق:
<p class="figure-caption">[Figure ${chapterNum}.1: وصف تفصيلي بالإنجليزية]</p>
ضع عناوين الصور بين الفقرات وليس في نهاية الفصل.`
      : `CRITICAL: Include 3-5 figure captions distributed between paragraphs:
<p class="figure-caption">[Figure ${chapterNum}.1: Detailed description]</p>
Place them BETWEEN paragraphs, not at the end.`)
    : '';

    const tableInstruction = includeTables
    ? (researchLang === 'ar'
      ? `أضف جداول بيانات حقيقية بتنسيق HTML كامل مع <table border="1"><thead><tr><th>...</th></tr></thead><tbody><tr><td>...</td></tr></tbody></table>. لا تكتب الجداول كنص عادي.`
      : `Add real HTML tables with <table border="1"><thead><tr><th>...</th></tr></thead><tbody><tr><td>...</td></tr></tbody></table>. NEVER write tables as plain text.`)
    : '';

  const noRefsInChapter = researchLang === 'ar'
    ? 'لا تكتب قائمة المصادر في نهاية الفصل. لا تستخدم إشارات مرجعية داخل النص.'
    : 'Do NOT include references at the end. Do NOT use in-text citations.';

  const numberingInstruction = researchLang === 'ar'
    ? `رقّم العناوين: "الفصل ${chapterNum}: ${chapterName}" بـ <h1>، الرئيسية ${chapterNum}.1 بـ <h2>، الفرعية ${chapterNum}.1.1 بـ <h3>.`
    : `Number: "Chapter ${chapterNum}: ${chapterName}" in <h1>, main ${chapterNum}.1 in <h2>, sub ${chapterNum}.1.1 in <h3>.`;

  const pageCountStrict = researchLang === 'ar'
    ? `هام: يجب أن يكون طول هذا الفصل حوالي ${wordTarget} كلمة (${chapterPages || Math.round(wordTarget / WORDS_PER_PAGE)} صفحات). اكتب بإيجاز وعمق دون تكرار.`
    : `This chapter should be approximately ${wordTarget} words (${chapterPages || Math.round(wordTarget / WORDS_PER_PAGE)} pages). Write concisely without repetition.`;

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
  const raw = await callAI(systemPrompt, userPrompt, 8000, 0.8);
  const chapterContent = cleanHtmlOutput(raw);

  onProgress(t('finalizing'), 90);
  return chapterContent;
}
