import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProviderConfig {
  provider: string;
  apiKey: string;
}

/** Call a single provider and return its content or null on failure */
async function callProvider(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number
): Promise<{ provider: string; content: string } | null> {
  try {
    const { provider, apiKey } = config;
    let url = "";
    let headers: Record<string, string> = { "Content-Type": "application/json" };
    let body: any = {};

    if (provider === "gemini") {
      url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      body = {
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      };
    } else if (provider === "orbit") {
      url = "https://api.orbit-provider.com/cliproxy-api/api/provider/agy/v1/chat/completions";
      headers["Authorization"] = `Bearer ${apiKey}`;
      body = {
        model: "gemini-claude-sonnet-4-6-thinking",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        max_tokens: maxTokens, temperature,
      };
    } else if (provider === "openrouter") {
      url = "https://openrouter.ai/api/v1/chat/completions";
      headers["Authorization"] = `Bearer ${apiKey}`;
      body = {
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        max_tokens: maxTokens, temperature,
      };
    } else if (provider === "siliconflow") {
      url = "https://api.siliconflow.cn/v1/chat/completions";
      headers["Authorization"] = `Bearer ${apiKey}`;
      body = {
        model: "Qwen/Qwen2.5-72B-Instruct",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        max_tokens: maxTokens, temperature,
      };
    } else if (provider === "mistral") {
      url = "https://api.mistral.ai/v1/chat/completions";
      headers["Authorization"] = `Bearer ${apiKey}`;
      body = {
        model: "mistral-large-latest",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        max_tokens: maxTokens, temperature,
      };
    } else if (provider === "groq") {
      url = "https://api.groq.com/openai/v1/chat/completions";
      headers["Authorization"] = `Bearer ${apiKey}`;
      body = {
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        max_tokens: maxTokens, temperature,
      };
    } else {
      // openai
      url = "https://api.openai.com/v1/chat/completions";
      headers["Authorization"] = `Bearer ${apiKey}`;
      body = {
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        max_tokens: maxTokens, temperature,
      };
    }

    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[merge] ${provider} failed:`, response.status, errText);
      return null;
    }

    const data = await response.json();
    let content = "";
    if (provider === "gemini") {
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      content = data.choices?.[0]?.message?.content || "";
    }

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

    // Call all providers in parallel
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

    // If only one succeeded, return it directly
    if (successfulResults.length === 1) {
      return new Response(JSON.stringify({ content: successfulResults[0].content, sources: [successfulResults[0].provider] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Merge using the Lovable AI Gateway (free, reliable)
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
      : `You are an expert at merging academic content. You will be given multiple versions of the same content written by different sources.
Your task: Merge the best parts from each version into one coherent, high-quality text.
Rules:
- Preserve the original HTML formatting (h1, h2, h3, p, ul, table, etc.).
- Choose the most accurate information and best phrasing from each version.
- If information conflicts between versions, choose the most scientifically accurate.
- Maintain the originally requested length - do not abbreviate.
- Output HTML only with no additional explanation.`;

    const mergeUserPrompt = successfulResults.map((r, i) =>
      `=== ${isAr ? 'النسخة' : 'Version'} ${i + 1} (${r.provider}) ===\n${r.content}`
    ).join('\n\n');

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fallback: return the longest result
      const longest = successfulResults.reduce((a, b) => a.content.length > b.content.length ? a : b);
      return new Response(JSON.stringify({ content: longest.content, sources: successfulResults.map(r => r.provider) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mergeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: mergeSystemPrompt },
          { role: "user", content: mergeUserPrompt },
        ],
        max_tokens: 8000,
        temperature: 0.3,
      }),
    });

    if (!mergeResponse.ok) {
      // Fallback to longest result
      const longest = successfulResults.reduce((a, b) => a.content.length > b.content.length ? a : b);
      return new Response(JSON.stringify({ content: longest.content, sources: successfulResults.map(r => r.provider) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mergeData = await mergeResponse.json();
    const mergedContent = mergeData.choices?.[0]?.message?.content || successfulResults[0].content;

    return new Response(JSON.stringify({
      content: mergedContent,
      sources: successfulResults.map(r => r.provider),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-merge-proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
