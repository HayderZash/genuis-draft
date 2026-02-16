import type { ProjectData } from '@/pages/ProjectEditor';
import type { TranslationKey } from '@/i18n/translations';

interface GenerateParams {
  apiKey: string;
  project: ProjectData;
  lang: 'ar' | 'en';
  onProgress: (step: string, progress: number) => void;
  t: (key: TranslationKey) => string;
}

const WORD_TARGETS = [1200, 1800, 1800, 1200, 900, 900];

export async function generateResearch({ apiKey, project, lang, onProgress, t }: GenerateParams): Promise<Record<string, string>> {
  const content: Record<string, string> = {};
  const totalChapters = project.chapters.length;

  onProgress(t('analyzingTopic'), 5);

  for (let i = 0; i < totalChapters; i++) {
    const chapterName = lang === 'ar' ? project.chapters[i].nameAr : project.chapters[i].name;
    const progressStep = `${t('draftingChapter')} ${i + 1}: ${chapterName}`;
    const baseProgress = 10 + (i / totalChapters) * 75;
    onProgress(progressStep, baseProgress);

    const wordTarget = WORD_TARGETS[i] || 1200;
    const isLast = i === totalChapters - 1;
    const refsInstruction = project.custom_references
      ? `\nUse these references where relevant: ${project.custom_references}`
      : '';

    const systemPrompt = lang === 'ar'
      ? `أنت خبير أكاديمي متخصص. اكتب بأسلوب أكاديمي رسمي باللغة العربية. استخدم تنسيق HTML مع العناوين. عنوان الفصل يكون <h1>، العناوين الرئيسية <h2>، العناوين الفرعية <h3>، والنص العادي <p>. أضف [الشكل X: الوصف] بين الفقرات حيث يناسب.`
      : `You are a strict academic expert. Write in formal academic style in English. Use HTML formatting. Chapter title as <h1>, main headings as <h2>, subheadings as <h3>, body as <p>. Insert [Figure X: Description] between paragraphs where appropriate.`;

    const userPrompt = lang === 'ar'
      ? `اكتب الفصل "${chapterName}" لبحث بعنوان "${project.title}". الملخص: ${project.abstract || 'غير محدد'}. اكتب حوالي ${wordTarget} كلمة. ${isLast ? 'هذا هو الفصل الأخير.' : ''}${refsInstruction}`
      : `Write chapter "${chapterName}" for a research paper titled "${project.title}". Abstract: ${project.abstract || 'Not specified'}. Write approximately ${wordTarget} words. ${isLast ? 'This is the final chapter.' : ''}${refsInstruction}`;

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
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    content[`chapter_${i}`] = data.choices[0]?.message?.content || '';
    onProgress(progressStep, baseProgress + (75 / totalChapters) * 0.8);
  }

  // Generate references
  onProgress(t('formattingCitations'), 90);
  const refsPrompt = lang === 'ar'
    ? `بناءً على بحث بعنوان "${project.title}" حول "${project.abstract}", اكتب قائمة مراجع بتنسيق APA. استخدم تنسيق HTML مع <h1> للعنوان و <p> لكل مرجع. ${project.custom_references ? `تأكد من تضمين هذه المراجع: ${project.custom_references}` : ''}`
    : `Based on a research paper titled "${project.title}" about "${project.abstract}", write an APA-style reference list. Use HTML with <h1> for the title and <p> for each reference. ${project.custom_references ? `Make sure to include: ${project.custom_references}` : ''}`;

  const refsResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: lang === 'ar' ? 'أنت خبير أكاديمي. اكتب بتنسيق HTML.' : 'You are an academic expert. Write in HTML format.' },
        { role: 'user', content: refsPrompt },
      ],
      max_tokens: 2000,
      temperature: 0.5,
    }),
  });

  if (refsResponse.ok) {
    const refsData = await refsResponse.json();
    content['references'] = refsData.choices[0]?.message?.content || '';
  }

  onProgress(t('finalizing'), 98);
  return content;
}
