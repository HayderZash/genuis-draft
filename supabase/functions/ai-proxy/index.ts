import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProviderSpec {
  url: string;
  model: string;
  isGemini?: boolean;
  needsAuth?: boolean;
  authHeader?: string;
}

/**
 * Get provider specification (URL + model + auth) for a given provider key.
 * NOTE: All names are unique. Cohere v2 (chat) uses /v2/chat. DALL·E 3 uses /v1/images/generations.
 */
function getProviderSpec(provider: string): ProviderSpec | null {
  switch (provider) {
    case "gemini":
      return { url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", model: "gemini-2.5-flash", isGemini: true };
    case "gemini_pro":
      return { url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent", model: "gemini-2.5-pro", isGemini: true };
    case "openai":
      return { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini", needsAuth: true };
    case "groq":
      return { url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", needsAuth: true };
    case "orbit":
      return { url: "https://api.orbit-provider.com/cliproxy-api/api/provider/agy/v1/chat/completions", model: "gemini-claude-sonnet-4-6-thinking", needsAuth: true };
    case "openrouter":
      return { url: "https://openrouter.ai/api/v1/chat/completions", model: "google/gemini-2.5-flash", needsAuth: true };
    case "siliconflow":
      return { url: "https://api.siliconflow.cn/v1/chat/completions", model: "Qwen/Qwen2.5-72B-Instruct", needsAuth: true };
    case "mistral":
      return { url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-large-latest", needsAuth: true };
    case "mistral_medium":
      return { url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-medium-latest", needsAuth: true };
    case "codestral":
      return { url: "https://api.mistral.ai/v1/chat/completions", model: "codestral-latest", needsAuth: true };
    case "devstral":
      return { url: "https://api.mistral.ai/v1/chat/completions", model: "devstral-latest", needsAuth: true };
    case "deepseek_chat":
      return { url: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-chat", needsAuth: true };
    case "deepseek_reasoner":
      return { url: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-reasoner", needsAuth: true };
    case "cohere_command_vision":
      return { url: "https://api.cohere.com/v2/chat", model: "command-a-vision-07-2025", needsAuth: true };
    case "cohere_rerank":
      // Rerank is a separate endpoint; treat as a chat completion using internal embed/rerank result.
      // For text generation tasks we route to command-a-vision instead (rerank is not for generation).
      return { url: "https://api.cohere.com/v2/chat", model: "command-a-vision-07-2025", needsAuth: true };
    case "cohere_embed":
      return { url: "https://api.cohere.com/v2/chat", model: "command-a-vision-07-2025", needsAuth: true };
    default:
      return null;
  }
}

// Hard wall-clock timeout per provider call to prevent the UI from hanging for minutes
// when an upstream API stalls. 90s is generous for long generations but fast enough to fail.
const PROVIDER_TIMEOUT_MS = 90_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = PROVIDER_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAICompatible(spec: ProviderSpec, apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number, temperature: number): Promise<string> {
  const response = await fetchWithTimeout(spec.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: spec.model,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      max_tokens: maxTokens,
      temperature,
    }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${errText.substring(0, 200)}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callGemini(spec: ProviderSpec, apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number, temperature: number): Promise<string> {
  const url = `${spec.url}?key=${apiKey}`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${errText.substring(0, 200)}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callCohere(spec: ProviderSpec, apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number, temperature: number): Promise<string> {
  const response = await fetchWithTimeout(spec.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: spec.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature,
    }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${errText.substring(0, 200)}`);
  }
  const data = await response.json();
  // Cohere v2 chat returns { message: { content: [{ type: "text", text: "..." }] } }
  const content = data.message?.content?.[0]?.text || data.text || "";
  return content;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { provider, apiKey, systemPrompt, userPrompt, maxTokens, temperature } = await req.json();

    if (!provider || typeof provider !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid provider" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!systemPrompt || !userPrompt || typeof userPrompt !== "string") {
      return new Response(JSON.stringify({ error: "Missing systemPrompt or userPrompt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strict API-key validation for non-lovable providers
    const trimmedKey = typeof apiKey === "string" ? apiKey.trim() : "";
    if (provider !== "lovable") {
      if (!trimmedKey) {
        return new Response(JSON.stringify({
          error: `Missing API key for provider '${provider}'. Set it in Settings or switch to 'lovable'.`,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (trimmedKey.length < 16 || /\s/.test(trimmedKey)) {
        return new Response(JSON.stringify({
          error: `Invalid API key format for provider '${provider}'.`,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    let content = "";

    // Lovable AI gateway (no user key needed)
    if (provider === "lovable") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log("[ai-proxy] Using Lovable AI gateway");
      const response = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: maxTokens || 8000,
          temperature: temperature ?? 0.7,
        }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error("Lovable AI error:", response.status, errText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded (429)" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required (402)" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: `AI error: ${response.status} - ${errText.substring(0, 200)}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || "";
      console.log("[ai-proxy] Lovable AI success, content length:", content.length);
    } else {
      const spec = getProviderSpec(provider);
      if (!spec) {
        return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const max = maxTokens || 6000;
      const temp = temperature ?? 0.7;

      try {
        if (spec.isGemini) {
          content = await callGemini(spec, apiKey, systemPrompt, userPrompt, max, temp);
        } else if (provider.startsWith("cohere_")) {
          content = await callCohere(spec, apiKey, systemPrompt, userPrompt, max, temp);
        } else {
          content = await callOpenAICompatible(spec, apiKey, systemPrompt, userPrompt, max, temp);
        }
      } catch (e) {
        const isAbort = e instanceof Error && (e.name === "AbortError" || /aborted/i.test(e.message));
        const errMsg = isAbort
          ? `Provider timeout after ${PROVIDER_TIMEOUT_MS / 1000}s`
          : (e instanceof Error ? e.message : "Unknown error");
        console.error(`[ai-proxy] ${provider} error:`, errMsg);
        return new Response(JSON.stringify({ error: `${provider} error: ${errMsg}` }), {
          status: isAbort ? 504 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
