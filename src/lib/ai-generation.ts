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

/* ───────────────────────────── QUALITY RULES (STRICT) ───────────────────────────── */

const QUALITY_RULES_AR = `قواعد الجودة الأكاديمية الصارمة:
- ممنوع تكرار أي جملة أو فكرة بصياغة مختلفة. كل فقرة يجب أن تضيف معلومة جديدة 100%.
- ممنوع منعاً باتاً استخدام عبارات الحشو مثل: "في هذا السياق"، "تجدر الإشارة"، "من المهم"، "يمكن القول"، "يعد X أداة قوية".
- كل فقرة يجب أن تحتوي على معلومات تقنية محددة: أرقام، نسب، مواصفات، مقاييس، أو أمثلة واقعية.
- اكتب بلغة أكاديمية رسمية موضوعية - بصيغة الباحث (نحن أو الباحث) وليس "أنا".
- الفقرة الواحدة 4-7 أسطر، متماسكة منطقياً، بفكرة محورية واحدة.
- ممنوع المقدمات الإنشائية الطويلة - ادخل في صلب الموضوع مباشرة.`;

const QUALITY_RULES_EN = `Strict academic quality rules:
- NEVER repeat any sentence or idea in different wording. Each paragraph MUST add 100% new information.
- ABSOLUTELY FORBIDDEN filler phrases: "In this context", "It is worth noting", "It is important", "It can be said", "X is a powerful tool".
- Each paragraph MUST contain specific information: numbers, percentages, specifications, measurements, or real examples.
- Write in formal, objective academic English - third-person ("the researcher", "this study"), never "I".
- Each paragraph 4-7 lines, logically coherent, with one central idea.
- NO long flowery introductions - get to the point immediately.`;

/* ───────────────────────────── HELPER ───────────────────────────── */

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function callAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number,
  retries = 3
): Promise<string> {
  // Merge mode first
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
        console.warn('[AI] Merge failed, fallback:', error?.message || data?.error);
      }
    } catch (e) {
      console.warn('[AI] Merge exception, fallback:', e);
    }
  }

  // Single user-selected provider (if configured)
  const userProvider = (localStorage.getItem('ai_provider') as AIProvider) || 'lovable' as any;
  const userKey = getProviderKey(userProvider);
  if (userKey && userProvider !== 'lovable' as any) {
    try {
      const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { provider: userProvider, apiKey: userKey, systemPrompt, userPrompt, maxTokens, temperature },
      });
      if (!error && data?.content) {
        console.log(`[AI] User provider (${userProvider}) success`);
        return data.content;
      }
      console.warn(`[AI] User provider (${userProvider}) failed, fallback to Lovable`);
    } catch (e) {
      console.warn(`[AI] User provider exception, fallback:`, e);
    }
  }

  // Fallback: Lovable AI
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { provider: 'lovable', apiKey: '', systemPrompt, userPrompt, maxTokens, temperature },
      });
      if (error) {
        if ((error.message || '').match(/429|rate/i) && attempt < retries) {
          await delay(attempt * 5000); continue;
        }
        throw new Error(error.message || 'AI proxy call failed');
      }
      if (data?.error) {
        if ((data.error || '').match(/429|rate/i) && attempt < retries) {
          await delay(attempt * 5000); continue;
        }
        throw new Error(data.error);
      }
      const content = data?.content || '';
      if (!content) {
        if (attempt < retries) { await delay(2000); continue; }
        throw new Error('AI returned empty content');
      }
      return content;
    } catch (e: any) {
      if (attempt === retries) throw e;
      await delay(attempt * 3000);
    }
  }
  throw new Error('All AI attempts failed');
}

/* ───────────────────────────── HTML CLEANUP ───────────────────────────── */

function cleanHtmlOutput(text: string): string {
  let cleaned = text
    .replace(/^```html\s*/gi, '')
    .replace(/^```\s*/gm, '')
    .replace(/```\s*$/g, '')
    .trim();
  cleaned = convertTextTablesToHtml(cleaned);
  return cleaned;
}

function convertTextTablesToHtml(html: string): string {
  const lines = html.split('\n');
  let result: string[] = [];
  let tableLines: string[] = [];
  let inTable = false;

  const isTableLine = (line: string): boolean => {
    const stripped = line.replace(/<[^>]+>/g, '').trim();
    if (!stripped) return false;
    const pipeCount = (stripped.match(/\|/g) || []).length;
    const tabCount = (stripped.match(/\t/g) || []).length;
    if (/^[\s|+\-:]+$/.test(stripped)) return inTable;
    return pipeCount >= 2 || tabCount >= 2;
  };

  const flushTable = () => {
    if (tableLines.length < 2) {
      result.push(...tableLines); tableLines = []; return;
    }
    const rows = tableLines
      .map(l => l.replace(/<[^>]+>/g, '').trim())
      .filter(l => !/^[\s|+\-:]+$/.test(l))
      .filter(l => l.length > 0);
    if (rows.length < 2) { result.push(...tableLines); tableLines = []; return; }
    const splitRow = (row: string): string[] => {
      if (row.includes('|')) return row.split('|').map(c => c.trim()).filter(c => c.length > 0);
      return row.split('\t').map(c => c.trim()).filter(c => c.length > 0);
    };
    let tableHtml = '<table border="1" style="border-collapse:collapse;width:100%;text-align:center;margin:10px auto;">';
    tableHtml += '<thead><tr>';
    for (const cell of splitRow(rows[0])) {
      tableHtml += `<th style="border:1px solid #000;padding:8px;background:#f0f0f0;">${cell}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';
    for (let r = 1; r < rows.length; r++) {
      tableHtml += '<tr>';
      for (const cell of splitRow(rows[r])) {
        tableHtml += `<td style="border:1px solid #000;padding:8px;">${cell}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table>';
    result.push(tableHtml);
    tableLines = [];
  };

  for (const line of lines) {
    if (isTableLine(line)) { inTable = true; tableLines.push(line); }
    else {
      if (inTable) { flushTable(); inTable = false; }
      result.push(line);
    }
  }
  if (inTable) flushTable();
  return result.join('\n');
}

/* ───────────────────────────── CHAPTER ROLE INFERENCE ───────────────────────────── */

/**
 * Identifies the academic role of each chapter based on its index/total count.
 * Returns one of: 'introduction' | 'literature' | 'methodology' | 'results' | 'conclusion' | 'recommendations'.
 * Used to inject the appropriate strict academic prompt for each chapter.
 */
function getChapterRole(index: number, total: number): string {
  if (index === 0) return 'introduction';
  if (total === 5) {
    return ['introduction', 'literature', 'methodology', 'results', 'conclusion'][index];
  }
  if (total === 4) {
    return ['introduction', 'literature', 'methodology', 'conclusion'][index];
  }
  // 6 chapters
  return ['introduction', 'literature', 'methodology', 'results', 'conclusion', 'recommendations'][index];
}

/* ───────────────────────────── CHAPTER-SPECIFIC PROMPTS (THE STRICT ACADEMIC METHODOLOGY) ───────────────────────────── */

function buildChapterPrompt(role: string, chapterNum: number, isAr: boolean, project: ProjectData): string {
  const isProject = project.project_type === 'project';

  if (role === 'introduction') {
    return isAr
      ? `الفصل الأول: المقدمة — يجب أن يحتوي إلزامياً على الأقسام التالية بترتيب دقيق:

<h2>${chapterNum}.1 تمهيد عام</h2>
فقرتان (4-7 أسطر لكل منهما) تقدمان للموضوع وأهميته العلمية والعملية في الواقع المعاصر.

<h2>${chapterNum}.2 مشكلة البحث</h2>
حدد بدقة المشكلة العلمية أو التطبيقية التي يعالجها البحث. صغها كأسئلة بحثية واضحة (3-5 أسئلة).

<h2>${chapterNum}.3 أهداف البحث</h2>
اذكر هدفاً رئيسياً واحداً + 4-6 أهداف فرعية مرقمة بقائمة <ol>.

<h2>${chapterNum}.4 أهمية البحث</h2>
اشرح الأهمية العلمية + الأهمية التطبيقية في فقرتين منفصلتين.

<h2>${chapterNum}.5 فرضيات البحث</h2>
اذكر 3-5 فرضيات قابلة للاختبار بقائمة <ol>.

<h2>${chapterNum}.6 حدود البحث</h2>
اذكر الحدود الموضوعية والزمانية والمكانية في 3 فقرات قصيرة.

<h2>${chapterNum}.7 مصطلحات البحث</h2>
عرّف 4-6 مصطلحات رئيسية تعريفاً إجرائياً.

<h2>${chapterNum}.8 ملخص الفصل</h2>
فقرة موجزة (4 أسطر) تختم الفصل الأول.

قاعدة إلزامية: استخدم استشهادات مرجعية مرقمة [1], [2], [3] داخل النص في الأماكن المناسبة (3-5 استشهادات على الأقل في هذا الفصل) بحيث ترتبط لاحقاً بقائمة المراجع النهائية.`
      : `Chapter 1: Introduction — MUST contain the following sections in this exact order:

<h2>${chapterNum}.1 General Background</h2>
Two paragraphs (4-7 lines each) introducing the topic and its scientific/practical importance.

<h2>${chapterNum}.2 Research Problem</h2>
Define the scientific/practical problem precisely. Phrase as 3-5 clear research questions.

<h2>${chapterNum}.3 Research Objectives</h2>
State one main objective + 4-6 sub-objectives in an <ol> numbered list.

<h2>${chapterNum}.4 Significance of the Study</h2>
Explain scientific significance + practical significance in two separate paragraphs.

<h2>${chapterNum}.5 Research Hypotheses</h2>
List 3-5 testable hypotheses in an <ol>.

<h2>${chapterNum}.6 Scope and Limitations</h2>
Subject, temporal, and spatial limits in 3 short paragraphs.

<h2>${chapterNum}.7 Operational Definitions of Terms</h2>
Define 4-6 key terms operationally.

<h2>${chapterNum}.8 Chapter Summary</h2>
A brief 4-line paragraph closing Chapter 1.

MANDATORY: Use numbered citations [1], [2], [3] in-text at appropriate positions (at least 3-5 citations in this chapter), to be linked to the final reference list.`;
  }

  if (role === 'literature') {
    return isAr
      ? `الفصل الثاني: الإطار النظري والدراسات السابقة — يجب أن يحتوي إلزامياً على:

<h2>${chapterNum}.1 الإطار النظري</h2>
3-5 أقسام فرعية <h3> تشرح المفاهيم النظرية الأساسية للموضوع، كل قسم 2-3 فقرات تفصيلية.

<h2>${chapterNum}.2 الدراسات السابقة</h2>
يجب إدراج 10 دراسات سابقة حقيقية وموثوقة بدقة (أبحاث منشورة في مجلات أكاديمية معترف بها بين 2018-2024). 
لكل دراسة استخدم هذا التنسيق بالضبط:

<h3>${chapterNum}.2.X اسم الباحث (السنة) - عنوان الدراسة</h3>
<p><strong>الهدف:</strong> [هدف الدراسة بدقة]</p>
<p><strong>المنهجية:</strong> [المنهجية المستخدمة - وصفية، تجريبية، إلخ]</p>
<p><strong>أبرز النتائج:</strong> [النتائج الرئيسية بأرقام إن أمكن]</p>
<p><strong>علاقتها بالبحث الحالي:</strong> [كيف تستفيد منها أو تختلف عنها]</p>

كرر الهيكل أعلاه 10 مرات بدراسات مختلفة. كل دراسة يجب أن تكون منشورة فعلياً (Springer, Elsevier, IEEE, MDPI, ACM, ScienceDirect) وتحمل DOI أو رقم مجلة.
استخدم استشهادات مرقمة [4], [5], ... [13] لكل دراسة بحيث تكون الأرقام متسلسلة بعد استشهادات الفصل الأول.

<h2>${chapterNum}.3 الفجوة البحثية</h2>
فقرتان توضحان كيف يسد البحث الحالي فجوة لم تعالجها الدراسات السابقة.

<h2>${chapterNum}.4 ملخص الفصل</h2>
فقرة ختامية (4 أسطر).

تحذير صارم: ممنوع اختلاق أسماء باحثين وهميين أو دراسات غير موجودة. استخدم فقط دراسات حقيقية يمكن التحقق منها (مثل دراسات Smith, Chen, Kumar, Al-Mahmoud, García في مجلات IEEE, Elsevier, Springer).`
      : `Chapter 2: Literature Review — MUST contain:

<h2>${chapterNum}.1 Theoretical Framework</h2>
3-5 <h3> subsections explaining core theoretical concepts; each with 2-3 detailed paragraphs.

<h2>${chapterNum}.2 Previous Studies</h2>
You MUST include exactly 10 real, verifiable previous studies (published in recognized academic journals between 2018-2024).
For EACH study use this exact format:

<h3>${chapterNum}.2.X Author(s) (Year) - Study Title</h3>
<p><strong>Objective:</strong> [precise objective]</p>
<p><strong>Methodology:</strong> [used methodology — descriptive, experimental, etc.]</p>
<p><strong>Key Findings:</strong> [main findings with numbers if possible]</p>
<p><strong>Relevance to current research:</strong> [how it relates or differs]</p>

Repeat the structure 10 times for 10 DIFFERENT studies. Each study MUST be actually published (Springer, Elsevier, IEEE, MDPI, ACM, ScienceDirect) and have a DOI/journal reference.
Use sequential numbered citations [4], [5], ... [13] for each, continuing from Chapter 1.

<h2>${chapterNum}.3 Research Gap</h2>
Two paragraphs explaining how the current research fills a gap unaddressed by previous studies.

<h2>${chapterNum}.4 Chapter Summary</h2>
A 4-line concluding paragraph.

STRICT WARNING: Do NOT invent fake author names or non-existent studies. Use only real, verifiable studies from established researchers (e.g., Smith, Chen, Kumar, Al-Mahmoud, García) in IEEE, Elsevier, Springer journals.`;
  }

  if (role === 'methodology') {
    if (isProject) {
      return isAr
        ? `الفصل الثالث: تصميم وتنفيذ المشروع — يجب أن يحتوي إلزامياً على:

<h2>${chapterNum}.1 مقدمة عن تأسيس المشروع</h2>
فقرتان توضحان فكرة المشروع، الدوافع وراءه، والحل الذي يقدمه.

<h2>${chapterNum}.2 مكونات المشروع</h2>
استخرج كل مكون مذكور في النبذة "${project.abstract || ''}" واشرحه بالتفصيل.
لكل مكون استخدم هذا التنسيق:
<h3>${chapterNum}.2.X اسم المكون</h3>
<p>وظيفته الأساسية</p>
<p>المواصفات التقنية بالأرقام (الفولتية، التيار، السرعة، الدقة...)</p>
<p>كيف يعمل المكون</p>
<p class="figure-caption" style="font-style:italic;text-align:center;">[Figure ${chapterNum}.X: A close-up realistic photo of the component, isolated on white background, showing its physical appearance clearly]</p>

<h2>${chapterNum}.3 خطوات تنفيذ المشروع</h2>
اذكر الخطوات بترتيب رقمي <ol> من 1-10 خطوة، كل خطوة مع شرح فقرة.

<h2>${chapterNum}.4 مخطط التركيب</h2>
صف مخطط التوصيل بين المكونات، ثم أضف:
<p class="figure-caption" style="font-style:italic;text-align:center;">[Figure ${chapterNum}.X: A clean technical wiring/block diagram showing how the project components connect together]</p>

<h2>${chapterNum}.5 برمجة المشروع</h2>
إذا كان المشروع يتضمن برمجة (Arduino, Python, etc.):
- اذكر اللغة والبيئة المستخدمة.
- أضف 2-3 مقاطع كود قصيرة داخل <pre><code> توضح المنطق الرئيسي.
- اشرح كل مقطع.

<h2>${chapterNum}.6 جداول المواصفات</h2>
أضف جدول HTML واحد على الأقل يلخص مواصفات جميع المكونات (اسم، نوع، فولتية، تيار، سعر تقريبي).

<h2>${chapterNum}.7 ملخص الفصل</h2>
فقرة ختامية.

استخدم استشهادات [14], [15] لمراجع تقنية حول المكونات.`
        : `Chapter 3: Project Design and Implementation — MUST contain:

<h2>${chapterNum}.1 Project Foundation Overview</h2>
Two paragraphs explaining the project idea, motivation, and the solution provided.

<h2>${chapterNum}.2 Project Components</h2>
Extract every component mentioned in the abstract "${project.abstract || ''}" and explain each.
For EACH component use this format:
<h3>${chapterNum}.2.X Component Name</h3>
<p>Primary function</p>
<p>Technical specifications with numbers (voltage, current, speed, accuracy...)</p>
<p>How the component works</p>
<p class="figure-caption" style="font-style:italic;text-align:center;">[Figure ${chapterNum}.X: A close-up realistic photo of the component, isolated on white background, showing its physical appearance clearly]</p>

<h2>${chapterNum}.3 Implementation Steps</h2>
Numbered steps in <ol> from 1-10, each with a paragraph explanation.

<h2>${chapterNum}.4 Wiring/Block Diagram</h2>
Describe the connections between components, then add:
<p class="figure-caption" style="font-style:italic;text-align:center;">[Figure ${chapterNum}.X: A clean technical wiring/block diagram showing how the project components connect together]</p>

<h2>${chapterNum}.5 Project Programming</h2>
If the project includes programming (Arduino, Python, etc.):
- State the language and environment.
- Add 2-3 short code snippets in <pre><code> showing main logic.
- Explain each snippet.

<h2>${chapterNum}.6 Specifications Table</h2>
Add at least one HTML table summarizing all component specs (name, type, voltage, current, approximate cost).

<h2>${chapterNum}.7 Chapter Summary</h2>
A concluding paragraph.

Use citations [14], [15] for technical references about components.`;
    }
    // Pure research methodology
    return isAr
      ? `الفصل الثالث: منهجية البحث — يجب أن يحتوي إلزامياً على:

<h2>${chapterNum}.1 منهج البحث</h2>
حدد المنهج (وصفي، تحليلي، تجريبي، مختلط) واذكر مبرر اختياره.

<h2>${chapterNum}.2 مجتمع وعينة البحث</h2>
صف مجتمع الدراسة + حجم العينة + طريقة الاختيار + التبرير الإحصائي.

<h2>${chapterNum}.3 أدوات جمع البيانات</h2>
اذكر الأدوات (استبانة، مقابلة، ملاحظة، تحليل وثائق) واشرح بناء كل أداة.

<h2>${chapterNum}.4 صدق وثبات الأدوات</h2>
اشرح كيف تم التحقق من الصدق والثبات (Cronbach's Alpha بأرقام تقديرية).

<h2>${chapterNum}.5 إجراءات التطبيق</h2>
اذكر خطوات التطبيق الزمنية بترتيب <ol>.

<h2>${chapterNum}.6 الأساليب الإحصائية</h2>
اذكر التحاليل المستخدمة (SPSS, R, ANOVA, t-test, Pearson correlation).

<h2>${chapterNum}.7 ملخص الفصل</h2>`
      : `Chapter 3: Research Methodology — MUST contain:

<h2>${chapterNum}.1 Research Approach</h2>
State the approach (descriptive, analytical, experimental, mixed) with justification.

<h2>${chapterNum}.2 Population and Sample</h2>
Describe target population + sample size + selection method + statistical justification.

<h2>${chapterNum}.3 Data Collection Instruments</h2>
List instruments (questionnaire, interview, observation) and explain construction of each.

<h2>${chapterNum}.4 Validity and Reliability</h2>
Explain validation procedures (Cronbach's Alpha with estimated numbers).

<h2>${chapterNum}.5 Implementation Procedures</h2>
List time-ordered steps in <ol>.

<h2>${chapterNum}.6 Statistical Methods</h2>
State analyses used (SPSS, R, ANOVA, t-test, Pearson correlation).

<h2>${chapterNum}.7 Chapter Summary</h2>`;
  }

  if (role === 'results') {
    return isAr
      ? `الفصل الرابع: النتائج والمناقشة — يجب أن يحتوي إلزامياً على:

<h2>${chapterNum}.1 مقدمة عن النتائج</h2>
فقرة تمهد لعرض النتائج وتذكر بأهداف البحث.

<h2>${chapterNum}.2 عرض النتائج</h2>
${isProject
  ? 'اعرض نتائج تشغيل المشروع: الأداء، القياسات، أوقات الاستجابة، نسب النجاح. أضف صور للنتائج الفعلية مع <p class="figure-caption">[Figure X.Y: Real test result showing measurement output]</p>.'
  : 'اعرض نتائج التحليل الإحصائي مع جداول HTML تحوي الأرقام الفعلية (المتوسطات، الانحراف المعياري، قيم p, t, F).'}
أضف 2-3 جداول HTML حقيقية بنتائج عددية محددة.
أضف 2-3 صور توضيحية بالتنسيق المطلوب (figure-caption).

<h2>${chapterNum}.3 مناقشة النتائج</h2>
لكل نتيجة رئيسية، اكتب فقرة تحليلية تربطها بالأدبيات السابقة باستخدام استشهادات مرقمة.

<h2>${chapterNum}.4 المقارنة مع الدراسات السابقة</h2>
أضف جدول HTML يقارن نتائج البحث بنتائج 3-5 من الدراسات السابقة المذكورة في الفصل الثاني.

<h2>${chapterNum}.5 ملخص الفصل</h2>
فقرة ختامية تلخص أهم النتائج.`
      : `Chapter 4: Results and Discussion — MUST contain:

<h2>${chapterNum}.1 Introduction to Results</h2>
A paragraph introducing the results and recalling the research objectives.

<h2>${chapterNum}.2 Presentation of Results</h2>
${isProject
  ? 'Present the project operation results: performance, measurements, response times, success rates. Add real test result figures with <p class="figure-caption">[Figure X.Y: Real test result showing measurement output]</p>.'
  : 'Present statistical analysis results with HTML tables containing actual numbers (means, std deviation, p-values, t-values, F-values).'}
Add 2-3 real HTML tables with specific numeric results.
Add 2-3 illustrative figures in the required figure-caption format.

<h2>${chapterNum}.3 Discussion of Results</h2>
For each main finding, write an analytical paragraph linking it to previous literature using numbered citations.

<h2>${chapterNum}.4 Comparison with Previous Studies</h2>
Add an HTML table comparing the research results with 3-5 previous studies from Chapter 2.

<h2>${chapterNum}.5 Chapter Summary</h2>
A concluding paragraph summarizing the main findings.`;
  }

  if (role === 'conclusion') {
    return isAr
      ? `الفصل الخامس: الخاتمة والأعمال المستقبلية — يجب أن يحتوي إلزامياً على:

<h2>${chapterNum}.1 ملخص البحث</h2>
3-4 فقرات تلخص: المشكلة، المنهجية، أهم النتائج، الإسهام العلمي.

<h2>${chapterNum}.2 الاستنتاجات</h2>
استنتاجات مرقمة <ol> من 5-8 نقاط مبنية على النتائج فعلياً.

<h2>${chapterNum}.3 التوصيات</h2>
4-6 توصيات عملية مرقمة <ol>.

<h2>${chapterNum}.4 الأعمال المستقبلية</h2>
5-7 أفكار مستقبلية مرقمة <ol> لتطوير المشروع/البحث (تقنيات جديدة، توسيع نطاق العينة، دمج تقنيات حديثة، تطبيق على مجالات أخرى).

<h2>${chapterNum}.5 خاتمة</h2>
فقرة ختامية بصياغة أكاديمية رفيعة.`
      : `Chapter 5: Conclusion and Future Work — MUST contain:

<h2>${chapterNum}.1 Research Summary</h2>
3-4 paragraphs summarizing: the problem, methodology, key findings, scientific contribution.

<h2>${chapterNum}.2 Conclusions</h2>
5-8 numbered conclusions in <ol> based directly on actual findings.

<h2>${chapterNum}.3 Recommendations</h2>
4-6 practical numbered recommendations in <ol>.

<h2>${chapterNum}.4 Future Work</h2>
5-7 numbered future ideas in <ol> to develop the project/research (new technologies, sample expansion, integration with modern techniques, application to other domains).

<h2>${chapterNum}.5 Closing Statement</h2>
A high academic-quality closing paragraph.`;
  }

  if (role === 'recommendations') {
    return isAr
      ? `الفصل السادس: التوصيات والآفاق المستقبلية — اشرح بالتفصيل: التوصيات للمؤسسات، التوصيات للباحثين، الأبعاد التطبيقية، التطوير المستقبلي.`
      : `Chapter 6: Recommendations and Future Perspectives — Detail: institutional recommendations, recommendations for researchers, practical dimensions, future development.`;
  }

  return '';
}

/* ───────────────────────────── MAIN GENERATOR ───────────────────────────── */

export async function generateResearch({ project, lang, onProgress, t }: GenerateParams): Promise<Record<string, string>> {
  const content: Record<string, string> = {};
  const totalChapters = project.chapters.length;
  const researchLang = project.research_language || lang;
  const includeImages = project.include_images;
  const isAr = researchLang === 'ar';

  /* ── ABSTRACT ── */
  onProgress(t('generatingAbstract'), 3);
  const abstractSystem = isAr
    ? `أنت خبير أكاديمي. اكتب ملخص بحث (Abstract) بتنسيق HTML. استخدم <h1>الملخص</h1> للعنوان، ثم <p> للمحتوى. ${QUALITY_RULES_AR}`
    : `You are an academic expert. Write a research Abstract in HTML. Use <h1>Abstract</h1>, then <p> for content. ${QUALITY_RULES_EN}`;
  const abstractUser = isAr
    ? `اكتب ملخصاً أكاديمياً (Abstract) لبحث بعنوان "${project.title}".
السياق: ${project.abstract || 'غير محدد'}.
يجب أن يكون 200-300 كلمة، فقرة واحدة متماسكة تغطي: (1) خلفية المشكلة، (2) هدف البحث، (3) المنهجية المستخدمة، (4) أهم النتائج، (5) الإسهام العلمي.
بعد الملخص، أضف: <p><strong>الكلمات المفتاحية:</strong> [5-7 كلمات مفصولة بفواصل]</p>`
    : `Write an academic Abstract for a paper titled "${project.title}".
Context: ${project.abstract || 'Not specified'}.
Must be 200-300 words, one cohesive paragraph covering: (1) problem background, (2) research objective, (3) methodology used, (4) main findings, (5) scientific contribution.
After the abstract add: <p><strong>Keywords:</strong> [5-7 comma-separated keywords]</p>`;

  try {
    const raw = await callAI(abstractSystem, abstractUser, 1500, 0.5);
    content['abstract'] = cleanHtmlOutput(raw);
  } catch (e: any) {
    throw new Error(`Abstract generation failed: ${e.message}`);
  }

  await delay(2000);

  /* ── EACH CHAPTER ── */
  for (let i = 0; i < totalChapters; i++) {
    const chapterName = isAr ? project.chapters[i].nameAr : project.chapters[i].name;
    const progressStep = `${t('draftingChapter')} ${i + 1}: ${chapterName}`;
    const baseProgress = 10 + (i / totalChapters) * 70;
    onProgress(progressStep, baseProgress);

    const chapterPages = project.chapter_pages?.[i];
    const wordTarget = chapterPages ? chapterPages * WORDS_PER_PAGE : 800;
    const chapterNum = i + 1;
    const role = getChapterRole(i, totalChapters);
    const dirInstruction = project.text_direction === 'ltr' ? 'Write in left-to-right.' : 'Write in right-to-left.';

    /* ── Chapter-specific strict structural prompt ── */
    const structuralPrompt = buildChapterPrompt(role, chapterNum, isAr, project);

    /* ── Image instructions ── */
    const figureInstruction = includeImages
      ? (isAr
        ? `الصور التوضيحية: أضف 3-5 عناوين صور موزعة بين الفقرات بهذا التنسيق:
<p class="figure-caption" style="font-style:italic;text-align:center;font-size:12pt;">[Figure ${chapterNum}.N: A precise English description of a CONCRETE physical/visual subject matching the paragraph context]</p>
- يجب أن تكون الصور قابلة للتوليد بدقة: مكون مادي، جهاز، لقطة قريبة، مخطط تقني نظيف.
- ممنوع طلب: خرائط، رسوم بيانية إحصائية، جداول، صور تحوي نصوصاً كثيرة.
- الوصف يجب أن يصف موضوعاً واحداً واضحاً.`
        : `Figures: Add 3-5 figure captions distributed between paragraphs:
<p class="figure-caption" style="font-style:italic;text-align:center;font-size:12pt;">[Figure ${chapterNum}.N: A precise English description of a CONCRETE physical/visual subject matching the paragraph context]</p>
- Only request generatable images: physical components, devices, close-ups, clean technical diagrams.
- Do NOT request: maps, statistical charts, tables, text-heavy images.
- Each description should depict ONE clear subject.`)
      : '';

    /* ── Table instructions ── */
    const tableInstruction = project.include_data_tables
      ? (isAr
        ? `الجداول: كل جدول يجب أن يكون عنصر <table> HTML حقيقي. ممنوع كتابة الجداول كنص.
<p style="text-align:center;"><strong>جدول ${chapterNum}.X: وصف الجدول</strong></p>
<table border="1" style="border-collapse:collapse;width:100%;text-align:center;margin:10px auto;">
<thead><tr><th style="border:1px solid #000;padding:8px;background:#f0f0f0;">عنوان</th></tr></thead>
<tbody><tr><td style="border:1px solid #000;padding:8px;">قيمة</td></tr></tbody>
</table>
أضف 1-3 جداول حسب نوع الفصل، كل جدول 3+ أعمدة و 4+ صفوف ببيانات حقيقية.`
        : `Tables: Each table MUST be a real HTML <table> element. Plain-text tables are FORBIDDEN.
<p style="text-align:center;"><strong>Table ${chapterNum}.X: Description</strong></p>
<table border="1" style="border-collapse:collapse;width:100%;text-align:center;margin:10px auto;">
<thead><tr><th style="border:1px solid #000;padding:8px;background:#f0f0f0;">Header</th></tr></thead>
<tbody><tr><td style="border:1px solid #000;padding:8px;">Value</td></tr></tbody>
</table>
Add 1-3 tables depending on chapter type; each with 3+ columns and 4+ rows of real data.`)
      : '';

    const numberingInstruction = isAr
      ? `ترقيم العناوين: عنوان الفصل بـ <h1>الفصل ${chapterNum}: ${chapterName}</h1>، الأقسام الرئيسية ${chapterNum}.1, ${chapterNum}.2 بـ <h2>، الفرعية ${chapterNum}.1.1 بـ <h3>.`
      : `Numbering: Chapter title <h1>Chapter ${chapterNum}: ${chapterName}</h1>, main sections ${chapterNum}.1, ${chapterNum}.2 in <h2>, subsections ${chapterNum}.1.1 in <h3>.`;

    const pageCountStrict = isAr
      ? `الطول المستهدف: حوالي ${wordTarget} كلمة (${chapterPages || Math.round(wordTarget / WORDS_PER_PAGE)} صفحات). اكتب بعمق دون تكرار.`
      : `Target length: approximately ${wordTarget} words (${chapterPages || Math.round(wordTarget / WORDS_PER_PAGE)} pages). Write in depth without repetition.`;

    const noRefsInChapter = isAr
      ? 'لا تكتب قائمة المراجع في نهاية الفصل (ستُوضع في قسم منفصل). لكن يجب استخدام استشهادات مرقمة [N] داخل النص.'
      : 'Do NOT write a references section at the end (it goes in a separate section). But you MUST use numbered in-text citations [N].';

    const systemPrompt = isAr
      ? `أنت خبير أكاديمي بمؤهل دكتوراه. اكتب بأسلوب أكاديمي رسمي محكم باللغة العربية. ${dirInstruction}
قواعد التنسيق:
- HTML فقط (لا Markdown).
- ${numberingInstruction}
- استخدم <p> للنص، <ol>/<ul> للقوائم.
${figureInstruction}
${tableInstruction}
- ${noRefsInChapter}
- ممنوع رموز Unicode غير عربية أو إيموجي.
${QUALITY_RULES_AR}`
      : `You are an academic expert with a PhD. Write in formal scholarly English. ${dirInstruction}
Formatting rules:
- HTML only (no Markdown).
- ${numberingInstruction}
- Use <p> for text, <ol>/<ul> for lists.
${figureInstruction}
${tableInstruction}
- ${noRefsInChapter}
- No emoji or unusual Unicode.
${QUALITY_RULES_EN}`;

    const userPrompt = isAr
      ? `اكتب الفصل "${chapterName}" لبحث بعنوان "${project.title}".
${project.abstract ? `النبذة: ${project.abstract}` : ''}
${pageCountStrict}

${structuralPrompt}

ابدأ بـ <h1>الفصل ${chapterNum}: ${chapterName}</h1>. التزم بالهيكل أعلاه بدقة 100%. لا تتخطى أي قسم مطلوب. اكتب محتوى عميقاً وحقيقياً وأكاديمياً.`
      : `Write chapter "${chapterName}" for a paper titled "${project.title}".
${project.abstract ? `Abstract: ${project.abstract}` : ''}
${pageCountStrict}

${structuralPrompt}

Start with <h1>Chapter ${chapterNum}: ${chapterName}</h1>. Follow the structure above with 100% precision. Do NOT skip any required section. Write deep, real, scholarly content.`;

    try {
      const raw = await callAI(systemPrompt, userPrompt, 8000, 0.75);
      content[`chapter_${i}`] = cleanHtmlOutput(raw);
      onProgress(progressStep, baseProgress + (70 / totalChapters) * 0.8);
    } catch (e: any) {
      throw new Error(`Chapter ${i + 1} failed: ${e.message}`);
    }

    if (i < totalChapters - 1) await delay(3000);
  }

  /* ── REFERENCES ── */
  onProgress(t('formattingCitations'), 85);
  await delay(2000);

  const refCount = Math.max(project.reference_count || 20, 15);
  const refsSystem = isAr
    ? `أنت خبير أكاديمي. اكتب قائمة المراجع بتنسيق HTML باستخدام نظام APA 7. كل مرجع يبدأ برقم [N] متسلسل ويتطابق مع الاستشهادات داخل النص.`
    : `You are an academic expert. Write a reference list in APA 7 HTML format. Each reference starts with a sequential [N] matching in-text citations.`;
  const refsPrompt = isAr
    ? `اكتب قائمة مراجع لبحث "${project.title}" حول "${project.abstract || ''}". 
يجب أن تحتوي بالضبط على ${refCount} مرجعاً حقيقياً وموثقاً، مرقمة من [1] إلى [${refCount}]، بترتيب ظهورها في النص.
استخدم تنسيق APA 7 مع: المؤلف، السنة، العنوان، المجلة/الناشر، DOI أو رابط.
أمثلة على نوع المراجع المطلوبة (احرص على الواقعية):
- مقالات IEEE Transactions, Elsevier, Springer (2019-2024)
- كتب جامعية مرجعية في المجال
- مواصفات تقنية رسمية إن كان المشروع تقني
استخدم: <h1>المراجع</h1>، ثم <ol> أو <p> لكل مرجع.
${project.custom_references ? `\nيجب تضمين هذه المراجع المخصصة من المستخدم: ${project.custom_references}` : ''}`
    : `Write a reference list for "${project.title}" about "${project.abstract || ''}".
Must contain EXACTLY ${refCount} real, verifiable references numbered [1] to [${refCount}] in order of appearance.
Use APA 7 format: Author, Year, Title, Journal/Publisher, DOI or URL.
Examples of required reference types (ensure realism):
- IEEE Transactions, Elsevier, Springer articles (2019-2024)
- University reference textbooks in the field
- Official technical specifications if the project is technical
Use: <h1>References</h1>, then <ol> or <p> per reference.
${project.custom_references ? `\nMust include user-provided custom references: ${project.custom_references}` : ''}`;

  try {
    const rawRefs = await callAI(refsSystem, refsPrompt, 4000, 0.4);
    content['references'] = cleanHtmlOutput(rawRefs);
  } catch (e: any) {
    content['references'] = isAr ? '<h1>المراجع</h1><p>لم يتم توليد المراجع.</p>' : '<h1>References</h1><p>References could not be generated.</p>';
  }

  onProgress(t('generatingToc'), 92);
  onProgress(t('finalizing'), 98);
  return content;
}

/* ───────────────────────────── REGENERATE SINGLE CHAPTER ───────────────────────────── */

export async function regenerateChapter({ project, lang, chapterIndex, onProgress, t }: GenerateParams & { chapterIndex: number; }): Promise<string> {
  const researchLang = project.research_language || lang;
  const isAr = researchLang === 'ar';
  const chapterName = isAr ? project.chapters[chapterIndex].nameAr : project.chapters[chapterIndex].name;
  onProgress(`${t('draftingChapter')} ${chapterIndex + 1}: ${chapterName}`, 20);

  const chapterPages = project.chapter_pages?.[chapterIndex];
  const wordTarget = chapterPages ? chapterPages * WORDS_PER_PAGE : 800;
  const chapterNum = chapterIndex + 1;
  const role = getChapterRole(chapterIndex, project.chapters.length);
  const dirInstruction = project.text_direction === 'ltr' ? 'Write in left-to-right.' : 'Write in right-to-left.';

  const structuralPrompt = buildChapterPrompt(role, chapterNum, isAr, project);

  const figureInstruction = project.include_images
    ? (isAr
      ? `أضف 3-5 عناوين صور بين الفقرات بالتنسيق:
<p class="figure-caption">[Figure ${chapterNum}.N: A precise concrete English description]</p>`
      : `Add 3-5 figure captions between paragraphs:
<p class="figure-caption">[Figure ${chapterNum}.N: A precise concrete English description]</p>`)
    : '';

  const tableInstruction = project.include_data_tables
    ? (isAr
      ? `الجداول: كل جدول <table> HTML مع <thead> و <tbody>. 1-3 جداول ببيانات حقيقية، 3+ أعمدة و 4+ صفوف.`
      : `Tables: each must be HTML <table> with <thead>/<tbody>. 1-3 tables with real data, 3+ cols, 4+ rows.`)
    : '';

  const numberingInstruction = isAr
    ? `<h1>الفصل ${chapterNum}: ${chapterName}</h1>, <h2>${chapterNum}.1</h2>, <h3>${chapterNum}.1.1</h3>.`
    : `<h1>Chapter ${chapterNum}: ${chapterName}</h1>, <h2>${chapterNum}.1</h2>, <h3>${chapterNum}.1.1</h3>.`;

  const pageCountStrict = isAr
    ? `الطول المستهدف: ~${wordTarget} كلمة (${chapterPages || Math.round(wordTarget / WORDS_PER_PAGE)} صفحات).`
    : `Target: ~${wordTarget} words (${chapterPages || Math.round(wordTarget / WORDS_PER_PAGE)} pages).`;

  const systemPrompt = isAr
    ? `أنت خبير أكاديمي. ${dirInstruction} HTML فقط. ${numberingInstruction}
${figureInstruction}
${tableInstruction}
لا تكتب قائمة مراجع نهائية. استخدم استشهادات [N] داخل النص.
${QUALITY_RULES_AR}`
    : `Academic expert. ${dirInstruction} HTML only. ${numberingInstruction}
${figureInstruction}
${tableInstruction}
Do NOT write a final references list. Use [N] in-text citations.
${QUALITY_RULES_EN}`;

  const userPrompt = isAr
    ? `اكتب الفصل "${chapterName}" لبحث "${project.title}".
${project.abstract ? `النبذة: ${project.abstract}` : ''}
${pageCountStrict}

${structuralPrompt}

التزم بالهيكل بدقة 100%.`
    : `Write chapter "${chapterName}" for "${project.title}".
${project.abstract ? `Abstract: ${project.abstract}` : ''}
${pageCountStrict}

${structuralPrompt}

Follow the structure 100%.`;

  onProgress(`${t('draftingChapter')} ${chapterIndex + 1}: ${chapterName}`, 50);
  const raw = await callAI(systemPrompt, userPrompt, 8000, 0.75);
  const chapterContent = cleanHtmlOutput(raw);

  onProgress(t('finalizing'), 90);
  return chapterContent;
}
