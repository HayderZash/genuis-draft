import type { ProjectData } from '@/pages/ProjectEditor';
import type { TranslationKey } from '@/i18n/translations';

interface GenerateParams {
  apiKey: string;
  provider: 'openai' | 'gemini';
  project: ProjectData;
  lang: 'ar' | 'en';
  onProgress: (step: string, progress: number) => void;
  t: (key: TranslationKey) => string;
}

const DEFAULT_WORD_TARGETS = [1200, 1800, 1800, 1200, 900, 900];
const WORDS_PER_PAGE = 250;

async function callAI(
  provider: 'openai' | 'gemini',
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number
): Promise<string> {
  if (provider === 'gemini') {
    const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
    const maxRetries = 3;
    const initialDelay = 30000; // 30 seconds for free tier

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: combinedPrompt }] }],
              generationConfig: { maxOutputTokens: maxTokens, temperature },
            }),
          }
        );

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          let delay = initialDelay;
          if (retryAfter) {
            const parsed = parseInt(retryAfter, 10);
            if (!isNaN(parsed)) delay = parsed * 1000;
          }
          const jitter = Math.random() * 1000;
          const waitTime = delay + jitter;
          console.warn(`Rate limit hit. Retrying in ${(waitTime / 1000).toFixed(1)}s... (Attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (error: any) {
        if (attempt === maxRetries - 1) throw error;
        const waitTime = initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(`Error, retrying in ${(waitTime / 1000).toFixed(1)}s...`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }

    throw new Error('Gemini API failed after retries');
  }

  // OpenAI
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature,
    }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `API error: ${response.status}`);
  }
  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

export async function generateResearch({ apiKey, provider, project, lang, onProgress, t }: GenerateParams): Promise<Record<string, string>> {
  const content: Record<string, string> = {};
  const totalChapters = project.chapters.length;

  // Generate Abstract first
  onProgress(t('generatingAbstract'), 3);
  const abstractSystemPrompt = lang === 'ar'
    ? 'أنت خبير أكاديمي. اكتب ملخصاً أكاديمياً بتنسيق HTML. استخدم <h1> للعنوان و <p> للنص. حجم النص 14.'
    : 'You are an academic expert. Write an academic abstract in HTML. Use <h1> for title and <p> for text.';
  const abstractUserPrompt = lang === 'ar'
    ? `اكتب ملخصاً أكاديمياً (Abstract) لبحث بعنوان "${project.title}". التفاصيل: ${project.abstract || 'غير محدد'}. اكتب حوالي 200-300 كلمة.`
    : `Write an academic abstract for a research paper titled "${project.title}". Details: ${project.abstract || 'Not specified'}. Write approximately 200-300 words.`;
  const rawAbstract = await callAI(provider, apiKey, abstractSystemPrompt, abstractUserPrompt, 1500, 0.5);
  content['abstract'] = cleanHtmlOutput(rawAbstract);

  onProgress(t('analyzingTopic'), 5);

  for (let i = 0; i < totalChapters; i++) {
    const chapterName = lang === 'ar' ? project.chapters[i].nameAr : project.chapters[i].name;
    const progressStep = `${t('draftingChapter')} ${i + 1}: ${chapterName}`;
    const baseProgress = 10 + (i / totalChapters) * 70;
    onProgress(progressStep, baseProgress);

    const chapterPages = project.chapter_pages?.[i];
    const wordTarget = chapterPages ? chapterPages * WORDS_PER_PAGE : (DEFAULT_WORD_TARGETS[i] || 1200);
    const isLast = i === totalChapters - 1;
    const chapterNum = i + 1;
    const refsInstruction = project.custom_references
      ? `\nUse these references where relevant: ${project.custom_references}`
      : '';
    const dirInstruction = project.text_direction === 'ltr' ? 'Write in left-to-right direction.' : 'Write in right-to-left direction.';

    const figureInstruction = lang === 'ar'
      ? `أضف عناوين الأشكال بتنسيق <p class="figure-caption"><em>[الشكل ${chapterNum}.X: الوصف]</em></p> (حيث X رقم تسلسلي). عنوان الشكل يكون مائلاً وبحجم 12.`
      : `Insert figure captions as <p class="figure-caption"><em>[Figure ${chapterNum}.X: Description]</em></p> (X is sequential). Figure captions must be italic and 12px size.`;

    const refStyleInstruction = lang === 'ar'
      ? 'عند الإشارة إلى المصادر في النص، استخدم الترقيم بين أقواس مربعة مثل [1] و [2] وهكذا.'
      : 'When citing references in text, use numbered brackets like [1], [2], etc.';

    const systemPrompt = lang === 'ar'
      ? `أنت خبير أكاديمي متخصص. اكتب بأسلوب أكاديمي رسمي باللغة العربية. ${dirInstruction} استخدم تنسيق HTML مع العناوين. عنوان الفصل يكون <h1>، العناوين الرئيسية <h2>، العناوين الفرعية <h3>، والنص العادي <p>. ${figureInstruction} ${refStyleInstruction}`
      : `You are a strict academic expert. Write in formal academic style in English. ${dirInstruction} Use HTML formatting. Chapter title as <h1>, main headings as <h2>, subheadings as <h3>, body as <p>. ${figureInstruction} ${refStyleInstruction}`;

    const userPrompt = lang === 'ar'
      ? `اكتب الفصل "${chapterName}" لبحث بعنوان "${project.title}". الملخص: ${project.abstract || 'غير محدد'}. اكتب حوالي ${wordTarget} كلمة. ${isLast ? 'هذا هو الفصل الأخير.' : ''}${refsInstruction}`
      : `Write chapter "${chapterName}" for a research paper titled "${project.title}". Abstract: ${project.abstract || 'Not specified'}. Write approximately ${wordTarget} words. ${isLast ? 'This is the final chapter.' : ''}${refsInstruction}`;

    const raw = await callAI(provider, apiKey, systemPrompt, userPrompt, 4000, 0.7);
    content[`chapter_${i}`] = cleanHtmlOutput(raw);
    onProgress(progressStep, baseProgress + (70 / totalChapters) * 0.8);
  }

  // Generate references with numbered style [1], [2]
  onProgress(t('formattingCitations'), 85);
  const refCount = project.reference_count || 10;
  const refsSystemPrompt = lang === 'ar' ? 'أنت خبير أكاديمي. اكتب بتنسيق HTML.' : 'You are an academic expert. Write in HTML format.';
  const refsPrompt = lang === 'ar'
    ? `بناءً على بحث بعنوان "${project.title}" حول "${project.abstract}", اكتب قائمة مراجع مرقمة تحتوي على ${refCount} مصدر. رقم كل مصدر بين أقواس مربعة [1]، [2]، إلخ. استخدم تنسيق HTML مع <h1> للعنوان و <p> لكل مرجع. ${project.custom_references ? `تأكد من تضمين هذه المراجع: ${project.custom_references}` : ''}`
    : `Based on a research paper titled "${project.title}" about "${project.abstract}", write a numbered reference list with exactly ${refCount} references. Number each reference with square brackets [1], [2], etc. Use HTML with <h1> for the title and <p> for each reference. ${project.custom_references ? `Make sure to include: ${project.custom_references}` : ''}`;

  const rawRefs = await callAI(provider, apiKey, refsSystemPrompt, refsPrompt, 2000, 0.5);
  content['references'] = cleanHtmlOutput(rawRefs);

  // Generate TOC/Lists if requested
  if (project.include_toc || project.include_list_of_tables || project.include_list_of_figures) {
    onProgress(t('generatingToc'), 92);
    const tocParts: string[] = [];
    if (project.include_toc) {
      const tocTitle = lang === 'ar' ? 'جدول المحتويات' : 'Table of Contents';
      let tocHtml = `<h1>${tocTitle}</h1>`;
      project.chapters.forEach((ch, i) => {
        const name = lang === 'ar' ? ch.nameAr : ch.name;
        tocHtml += `<p style="font-size:14px;">${lang === 'ar' ? `الفصل ${i + 1}: ${name}` : `Chapter ${i + 1}: ${name}`}</p>`;
      });
      tocHtml += `<p style="font-size:14px;">${lang === 'ar' ? 'المراجع' : 'References'}</p>`;
      tocParts.push(tocHtml);
    }
    if (project.include_list_of_tables) {
      const title = lang === 'ar' ? 'قائمة الجداول' : 'List of Tables';
      tocParts.push(`<h1>${title}</h1><p style="font-size:14px;">${lang === 'ar' ? 'سيتم تحديثها بعد التوليد' : 'Will be updated after generation'}</p>`);
    }
    if (project.include_list_of_figures) {
      const title = lang === 'ar' ? 'قائمة الأشكال' : 'List of Figures';
      tocParts.push(`<h1>${title}</h1><p style="font-size:14px;">${lang === 'ar' ? 'سيتم تحديثها بعد التوليد' : 'Will be updated after generation'}</p>`);
    }
    content['toc'] = tocParts.join('');
  }

  onProgress(t('finalizing'), 98);
  return content;
}

/** Strip markdown code fences from AI output */
function cleanHtmlOutput(text: string): string {
  return text
    .replace(/^```html\s*/gi, '')
    .replace(/^```\s*/gm, '')
    .replace(/```\s*$/g, '')
    .trim();
}

/** Regenerate a single chapter */
export async function regenerateChapter({ apiKey, provider, project, lang, chapterIndex, onProgress, t }: GenerateParams & { chapterIndex: number }): Promise<string> {
  const chapterName = lang === 'ar' ? project.chapters[chapterIndex].nameAr : project.chapters[chapterIndex].name;
  onProgress(`${t('draftingChapter')} ${chapterIndex + 1}: ${chapterName}`, 20);

  const chapterPages = project.chapter_pages?.[chapterIndex];
  const wordTarget = chapterPages ? chapterPages * WORDS_PER_PAGE : (DEFAULT_WORD_TARGETS[chapterIndex] || 1200);
  const chapterNum = chapterIndex + 1;
  const isLast = chapterIndex === project.chapters.length - 1;
  const refsInstruction = project.custom_references ? `\nUse these references where relevant: ${project.custom_references}` : '';
  const dirInstruction = project.text_direction === 'ltr' ? 'Write in left-to-right direction.' : 'Write in right-to-left direction.';

  const figureInstruction = lang === 'ar'
    ? `أضف عناوين الأشكال بتنسيق <p class="figure-caption"><em>[الشكل ${chapterNum}.X: الوصف]</em></p> (حيث X رقم تسلسلي). عنوان الشكل يكون مائلاً وبحجم 12.`
    : `Insert figure captions as <p class="figure-caption"><em>[Figure ${chapterNum}.X: Description]</em></p> (X is sequential). Figure captions must be italic and 12px size.`;

  const refStyleInstruction = lang === 'ar'
    ? 'عند الإشارة إلى المصادر في النص، استخدم الترقيم بين أقواس مربعة مثل [1] و [2] وهكذا.'
    : 'When citing references in text, use numbered brackets like [1], [2], etc.';

  const systemPrompt = lang === 'ar'
    ? `أنت خبير أكاديمي متخصص. اكتب بأسلوب أكاديمي رسمي باللغة العربية. ${dirInstruction} استخدم تنسيق HTML مع العناوين. عنوان الفصل يكون <h1>، العناوين الرئيسية <h2>، العناوين الفرعية <h3>، والنص العادي <p>. ${figureInstruction} ${refStyleInstruction}`
    : `You are a strict academic expert. Write in formal academic style in English. ${dirInstruction} Use HTML formatting. Chapter title as <h1>, main headings as <h2>, subheadings as <h3>, body as <p>. ${figureInstruction} ${refStyleInstruction}`;

  const userPrompt = lang === 'ar'
    ? `اكتب الفصل "${chapterName}" لبحث بعنوان "${project.title}". الملخص: ${project.abstract || 'غير محدد'}. اكتب حوالي ${wordTarget} كلمة. ${isLast ? 'هذا هو الفصل الأخير.' : ''}${refsInstruction}`
    : `Write chapter "${chapterName}" for a research paper titled "${project.title}". Abstract: ${project.abstract || 'Not specified'}. Write approximately ${wordTarget} words. ${isLast ? 'This is the final chapter.' : ''}${refsInstruction}`;

  onProgress(`${t('draftingChapter')} ${chapterIndex + 1}: ${chapterName}`, 50);
  const raw = await callAI(provider, apiKey, systemPrompt, userPrompt, 4000, 0.7);
  onProgress(t('finalizing'), 90);
  return cleanHtmlOutput(raw);
}
