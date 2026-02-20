/** Report generation using the same AI providers as research */

interface ReportGenParams {
  title: string;
  report_type: string;
  abstract: string;
  research_language: string;
  page_count: number;
  custom_references: string;
  reference_count: number;
  provider: 'openai' | 'gemini' | 'groq' | 'orbit';
  apiKey: string;
}

async function callAI(
  provider: 'openai' | 'gemini' | 'groq' | 'orbit',
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  if (provider === 'gemini') {
    const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: combinedPrompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
        }),
      }
    );
    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  if (provider === 'orbit') {
    const response = await fetch('https://api.orbit-provider.com/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        model: 'claude-opus-4-6-thinking',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        max_tokens: maxTokens, temperature: 0.7,
      }),
    });
    if (!response.ok) throw new Error(`Orbit API error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  const isGroq = provider === 'groq';
  const baseUrl = isGroq ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1';
  const model = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `API error: ${response.status}`);
  }
  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

function cleanHtml(text: string): string {
  return text.replace(/^```html\s*/gi, '').replace(/^```\s*/gm, '').replace(/```\s*$/g, '').trim();
}

export async function callAIForReport(params: ReportGenParams): Promise<Record<string, string>> {
  const { title, report_type, abstract, research_language, page_count, custom_references, reference_count, provider, apiKey } = params;
  const isAr = research_language === 'ar';
  const wordTarget = page_count * 250;

  const typeLabel = report_type === 'lab'
    ? (isAr ? 'تقرير مختبري' : 'laboratory report')
    : (isAr ? 'تقرير علمي' : 'scientific report');

  const systemPrompt = isAr
    ? `أنت خبير أكاديمي. اكتب ${typeLabel} بأسلوب أكاديمي رسمي باللغة العربية. استخدم تنسيق HTML مع <h1> للعنوان الرئيسي و <h2> للعناوين الفرعية و <p> للنصوص.`
    : `You are an academic expert. Write a ${typeLabel} in formal academic style in English. Use HTML with <h1> for main title, <h2> for section headings, <p> for body text.`;

  const refsNote = custom_references ? (isAr ? `استخدم هذه المراجع: ${custom_references}` : `Use these references: ${custom_references}`) : '';

  const userPrompt = isAr
    ? `اكتب ${typeLabel} بعنوان "${title}". الملخص: ${abstract || 'غير محدد'}. اكتب حوالي ${wordTarget} كلمة. يجب أن يتضمن التقرير: مقدمة، المنهجية، النتائج، المناقشة، والخاتمة. أضف قائمة مراجع تحتوي على ${reference_count} مصدر. ${refsNote}`
    : `Write a ${typeLabel} titled "${title}". Abstract: ${abstract || 'Not specified'}. Write approximately ${wordTarget} words. Include: Introduction, Methodology, Results, Discussion, and Conclusion. Add a reference list with ${reference_count} references. ${refsNote}`;

  const raw = await callAI(provider, apiKey, systemPrompt, userPrompt, 6000);
  return { _full: cleanHtml(raw) };
}
