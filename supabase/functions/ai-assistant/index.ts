import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ChatMessage = { role: "user" | "assistant"; content: string };

type AssistantResult = { reply: string | null; error: string | null; status: number };

function getSystemPrompt(language?: string) {
  return language === "ar"
    ? "أنت مساعد أكاديمي خبير متخصص في جميع المجالات الأكاديمية والبحثية. ساعد المستخدم بإجابات دقيقة وواضحة وعملية. عند الحاجة قدّم الخطوات بشكل منظم، وأجب باللغة العربية الفصحى."
    : "You are an expert academic assistant across academic and research fields. Give accurate, clear, practical answers. When useful, structure the answer into steps. Respond in English.";
}

async function callLovable(messages: ChatMessage[], language?: string): Promise<AssistantResult> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return { reply: null, error: "LOVABLE_API_KEY is not configured", status: 500 };

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: getSystemPrompt(language) },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: 4000,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[ai-assistant] Lovable gateway error:", response.status, text);
    return {
      reply: null,
      error: response.status === 402
        ? "نفد رصيد مزود الدردشة الحالي. يتم التحويل إلى مزود بديل..."
        : response.status === 429
          ? "تم الوصول لحد الطلبات الحالي. يتم التحويل إلى مزود بديل..."
          : "AI gateway error",
      status: response.status,
    };
  }

  const data = await response.json();
  return { reply: data.choices?.[0]?.message?.content || "", error: null, status: 200 };
}

function extractGeminiText(data: any): string {
  return (data?.candidates?.[0]?.content?.parts || [])
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join(" ")
    .trim();
}

async function callGemini(messages: ChatMessage[], language?: string): Promise<AssistantResult> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return { reply: null, error: "GEMINI_API_KEY is not configured", status: 500 };

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: getSystemPrompt(language) }] },
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 4000,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[ai-assistant] Gemini direct error:", response.status, text);
    return {
      reply: null,
      error: response.status === 429
        ? "تم تجاوز حصة Gemini الحالية."
        : response.status === 403 || response.status === 401
          ? "Gemini API key is not valid for this request."
          : "Gemini direct error",
      status: response.status,
    };
  }

  const data = await response.json();
  const reply = extractGeminiText(data);
  return { reply, error: reply ? null : "Empty Gemini response", status: reply ? 200 : 502 };
}

function buildConversationPrompt(messages: ChatMessage[], language?: string) {
  const intro = language === "ar"
    ? "اعتمد على كامل المحادثة التالية، ثم أجب على آخر رسالة للمستخدم فقط مع مراعاة السياق السابق:\n\n"
    : "Use the full conversation below, then answer the user's last message only while considering the previous context:\n\n";

  const transcript = messages
    .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`)
    .join("\n\n");

  return `${intro}${transcript}`;
}

async function callConfiguredProvider(messages: ChatMessage[], language?: string, provider?: string, apiKey?: string): Promise<AssistantResult> {
  if (!provider || !apiKey) {
    return { reply: null, error: "No configured provider", status: 400 };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !anonKey) {
    return { reply: null, error: "Proxy environment is not configured", status: 500 };
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      provider,
      apiKey,
      systemPrompt: getSystemPrompt(language),
      userPrompt: buildConversationPrompt(messages, language),
      maxTokens: 4000,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[ai-assistant] Configured provider error:", response.status, text);
    return { reply: null, error: "Configured provider failed", status: response.status };
  }

  const data = await response.json();
  return { reply: data?.content || null, error: data?.content ? null : "Empty configured provider response", status: data?.content ? 200 : 502 };
}

async function fetchWikipediaSummary(query: string, language?: string): Promise<string | null> {
  const wikiLang = language === "ar" ? "ar" : "en";
  const searchUrl = new URL(`https://${wikiLang}.wikipedia.org/w/api.php`);
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("list", "search");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("utf8", "1");
  searchUrl.searchParams.set("srlimit", "1");
  searchUrl.searchParams.set("srsearch", query);

  const searchResponse = await fetch(searchUrl.toString(), {
    headers: { "User-Agent": "LovableAcademicAssistant/1.0 (https://lovable.dev)" },
  });

  if (!searchResponse.ok) return null;
  const searchData = await searchResponse.json();
  const title = searchData?.query?.search?.[0]?.title;
  if (!title) return null;

  const summaryResponse = await fetch(`https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
    headers: { "User-Agent": "LovableAcademicAssistant/1.0 (https://lovable.dev)" },
  });

  if (!summaryResponse.ok) return null;
  const summaryData = await summaryResponse.json();
  const extract = summaryData?.extract?.trim();
  if (!extract) return null;

  return language === "ar"
    ? `تعذر الوصول مؤقتاً إلى مزودات الذكاء الاصطناعي، لكن هذه خلاصة مرجعية أولية حول الموضوع:\n\n${extract}`
    : `AI providers are temporarily unavailable, but here is a quick reference summary on the topic:\n\n${extract}`;
}

async function callPollinations(messages: ChatMessage[], language?: string): Promise<AssistantResult> {
  try {
    const response = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages: [
          { role: "system", content: getSystemPrompt(language) },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 4000,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[ai-assistant] Pollinations error:", response.status, text);
      return { reply: null, error: "Pollinations error", status: response.status };
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "";
    return { reply: reply || null, error: reply ? null : "Empty Pollinations response", status: reply ? 200 : 502 };
  } catch (e) {
    console.error("[ai-assistant] Pollinations exception:", e);
    return { reply: null, error: "Pollinations exception", status: 500 };
  }
}

async function callReferenceFallback(messages: ChatMessage[], language?: string): Promise<AssistantResult> {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content?.trim();
  if (!latestUserMessage) {
    return {
      reply: language === "ar" ? "تعذر تنفيذ الطلب حالياً. حاول مرة أخرى بعد قليل." : "The request could not be completed right now. Please try again shortly.",
      error: null,
      status: 200,
    };
  }

  const summary = await fetchWikipediaSummary(latestUserMessage, language);
  if (summary) return { reply: summary, error: null, status: 200 };

  return {
    reply: language === "ar"
      ? "تعذر الوصول حالياً إلى مزودات الذكاء الاصطناعي، ولم أتمكن أيضاً من جلب مرجع مناسب لسؤالك. حاول لاحقاً أو أضف مزود AI من الإعدادات."
      : "AI providers are currently unavailable, and I could not fetch a suitable reference for your question. Please try again later or add an AI provider in settings.",
    error: null,
    status: 200,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, language, provider, apiKey } = await req.json();
    const safeMessages = Array.isArray(messages) ? messages : [];

    let result = await callLovable(safeMessages, language);
    if (!result.reply) {
      result = await callGemini(safeMessages, language);
    }

    if (!result.reply) {
      result = await callConfiguredProvider(safeMessages, language, provider, apiKey);
    }

    if (!result.reply) {
      result = await callPollinations(safeMessages, language);
    }

    if (!result.reply) {
      result = await callReferenceFallback(safeMessages, language);
    }

    return new Response(JSON.stringify({ reply: result.reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
