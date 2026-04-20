import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProviderConfig {
  provider: string;
  apiKey: string;
}

function getModelFor(provider: string): { url: string; model: string; type: 'openai' | 'gemini' | 'cohere' } {
  switch (provider) {
    case "gemini": return { url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", model: "gemini-2.5-flash", type: 'gemini' };
    case "gemini_pro": return { url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent", model: "gemini-2.5-pro", type: 'gemini' };
    case "openai": return { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini", type: 'openai' };
    case "groq": return { url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", type: 'openai' };
    case "orbit": return { url: "https://api.orbit-provider.com/cliproxy-api/api/provider/agy/v1/chat/completions", model: "gemini-claude-sonnet-4-6-thinking", type: 'openai' };
    case "openrouter": return { url: "https://openrouter.ai/api/v1/chat/completions", model: "google/gemini-2.5-flash", type: 'openai' };
    case "siliconflow": return { url: "https://api.siliconflow.cn/v1/chat/completions", model: "Qwen/Qwen2.5-72B-Instruct", type: 'openai' };
    case "mistral": return { url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-large-latest", type: 'openai' };
    case "mistral_medium": return { url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-medium-latest", type: 'openai' };
    case "codestral": return { url: "https://api.mistral.ai/v1/chat/completions", model: "codestral-latest", type: 'openai' };
    case "devstral": return { url: "https://api.mistral.ai/v1/chat/completions", model: "devstral-latest", type: 'openai' };
    case "deepseek_chat": return { url: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-chat", type: 'openai' };
    case "deepseek_reasoner": return { url: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-reasoner", type: 'openai' };
    case "cohere_command_vision":
    case "cohere_rerank":
    case "cohere_embed":
      return { url: "https://api.cohere.com/v2/chat", model: "command-a-vision-07-2025", type: 'cohere' };
    default:
      return { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini", type: 'openai' };
  }
}

async function callProvider(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number
): Promise<{ provider: string; content: string } | null> {
  try {
    const { provider, apiKey } = config;
    const spec = getModelFor(provider);

    let response: Response;
    if (spec.type === 'gemini') {
      response = await fetch(`${spec.url}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature },
        }),
      });
    } else {
      response = await fetch(spec.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: spec.model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          max_tokens: maxTokens,
          temperature,
        }),
      });
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[merge] ${provider} failed:`, response.status, errText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    let content = "";
    if (spec.type === 'gemini') content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    else if (spec.type === 'cohere') content = data.message?.content?.[0]?.text || "";
    else content = data.choices?.[0]?.message?.content || "";

    if (!content) return null;
    return { provider, content };
  } catch (e) {
    console.error(`[merge] ${config.provider} exception:`, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { providers, systemPrompt, userPrompt, maxTokens, temperature, mergeLanguage } = await req.json();

    if (!providers || !Array.isArray(providers) || providers.length === 0) {
      return new Response(JSON.stringify({ error: "No providers configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.allSettled(
      providers.map((p: ProviderConfig) => callProvider(p, systemPrompt, userPrompt, maxTokens || 6000, temperature ?? 0.7))
    );

    const successfulResults = results
      .filter((r): r is PromiseFulfilledResult<{ provider: string; content: string } | null> => r.status === "fulfilled")
      .map(r => r.value)
      .filter((r): r is { provider: string; content: string } => r !== null);

    if (successfulResults.length === 0) {
      return new Response(JSON.stringify({ error: "All providers failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (successfulResults.length === 1) {
      return new Response(JSON.stringify({ content: successfulResults[0].content, sources: [successfulResults[0].provider] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAr = mergeLanguage === 'ar';
    const mergeSystemPrompt = isAr
      ? `أنت خبير في دمج المحتوى الأكاديمي. سيتم إعطاؤك عدة نسخ من نفس المحتوى مكتوبة بواسطة مصادر مختلفة.
مهمتك: ادمج أفضل الأجزاء من كل نسخة في نص واحد متكامل وعالي الجودة.
القواعد:
- حافظ على تنسيق HTML الأصلي (h1, h2, h3, p, ul, table, إلخ).
- اختر أدق المعلومات وأفضل الصياغات من كل نسخة.
- إذا تعارضت المعلومات بين النسخ، اختر الأكثر دقة علمياً.
- حافظ على الطول الأصلي المطلوب - لا تختصر.
- أخرج HTML فقط بدون أي شرح إضافي.`
      : `You are an expert at merging academic content. Merge the best parts from each version into one coherent, high-quality text.
Rules:
- Preserve the original HTML formatting.
- Choose the most accurate information and best phrasing from each version.
- Output HTML only with no additional explanation.`;

    const mergeUserPrompt = successfulResults.map((r, i) =>
      `=== ${isAr ? 'النسخة' : 'Version'} ${i + 1} (${r.provider}) ===\n${r.content}`
    ).join('\n\n');

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      const longest = successfulResults.reduce((a, b) => a.content.length > b.content.length ? a : b);
      return new Response(JSON.stringify({ content: longest.content, sources: successfulResults.map(r => r.provider) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mergeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: mergeSystemPrompt }, { role: "user", content: mergeUserPrompt }],
        max_tokens: 8000,
        temperature: 0.3,
      }),
    });

    if (!mergeResponse.ok) {
      const longest = successfulResults.reduce((a, b) => a.content.length > b.content.length ? a : b);
      return new Response(JSON.stringify({ content: longest.content, sources: successfulResults.map(r => r.provider) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mergeData = await mergeResponse.json();
    const mergedContent = mergeData.choices?.[0]?.message?.content || successfulResults[0].content;

    return new Response(JSON.stringify({ content: mergedContent, sources: successfulResults.map(r => r.provider) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-merge-proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
