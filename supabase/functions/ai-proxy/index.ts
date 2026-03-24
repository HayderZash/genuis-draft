import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { provider, apiKey, systemPrompt, userPrompt, maxTokens, temperature } = await req.json();

    if (!provider) {
      return new Response(JSON.stringify({ error: "Missing provider" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let content = "";

    // Lovable AI provider (default fallback, no user API key needed)
    if (provider === "lovable" || !apiKey) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log("[ai-proxy] Using Lovable AI gateway");
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
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
        // Fallback to Gemini API on 402/429
        const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
        if (GEMINI_KEY && (response.status === 402 || response.status === 429)) {
          console.log("[ai-proxy] Lovable failed, falling back to Gemini API");
          const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
          const geminiResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: combinedPrompt }] }],
                generationConfig: { maxOutputTokens: maxTokens || 8000, temperature: temperature ?? 0.7 },
              }),
            }
          );
          if (geminiResp.ok) {
            const gData = await geminiResp.json();
            content = gData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            console.log("[ai-proxy] Gemini fallback success, length:", content.length);
          } else {
            console.error("[ai-proxy] Gemini fallback failed:", geminiResp.status, "trying OpenRouter free");
            // 3rd fallback: OpenRouter free models (no key needed for some)
            try {
              const orResp = await fetch("https://text.pollinations.ai/openai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "openai",
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                  ],
                  max_tokens: maxTokens || 4000,
                }),
              });
              if (orResp.ok) {
                const orData = await orResp.json();
                content = orData.choices?.[0]?.message?.content || "";
                console.log("[ai-proxy] Pollinations fallback success, length:", content.length);
              } else {
                console.error("[ai-proxy] All fallbacks failed");
                return new Response(JSON.stringify({ error: "All AI providers temporarily unavailable. Please try again in a few minutes." }), {
                  status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            } catch (e3) {
              console.error("[ai-proxy] Pollinations error:", e3);
              return new Response(JSON.stringify({ error: "All AI providers temporarily unavailable." }), {
                status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        } else {
          return new Response(JSON.stringify({ error: `AI error: ${response.status}` }), {
            status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        const data = await response.json();
        content = data.choices?.[0]?.message?.content || "";
        console.log("[ai-proxy] Lovable AI success, content length:", content.length);
      }

    } else if (provider === "gemini") {
      const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: combinedPrompt }] }],
            generationConfig: { maxOutputTokens: maxTokens || 6000, temperature: temperature ?? 0.7 },
          }),
        }
      );
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error("Gemini API error:", response.status, errText);
        return new Response(JSON.stringify({ error: `Gemini API error: ${response.status}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await response.json();
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    } else if (provider === "orbit") {
      // Orbit Provider - direct connection
      const response = await fetch("https://api.orbit-provider.com/cliproxy-api/api/provider/agy/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gemini-claude-sonnet-4-6-thinking",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: maxTokens || 6000,
          temperature: temperature ?? 0.7,
        }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error("Orbit API error:", response.status, errText);
        return new Response(JSON.stringify({ error: `Orbit API error: ${response.status} - ${errText}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || "";

    } else if (provider === "openrouter") {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: maxTokens || 6000,
          temperature: temperature ?? 0.7,
        }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error("OpenRouter API error:", response.status, errText);
        return new Response(JSON.stringify({ error: `OpenRouter API error: ${response.status}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || "";

    } else if (provider === "siliconflow") {
      const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "Qwen/Qwen2.5-72B-Instruct",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: maxTokens || 6000,
          temperature: temperature ?? 0.7,
        }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error("SiliconFlow API error:", response.status, errText);
        return new Response(JSON.stringify({ error: `SiliconFlow API error: ${response.status}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || "";

    } else if (provider === "mistral") {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: maxTokens || 6000,
          temperature: temperature ?? 0.7,
        }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error("Mistral API error:", response.status, errText);
        return new Response(JSON.stringify({ error: `Mistral API error: ${response.status}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || "";

    } else {
      // OpenAI / Groq
      const isGroq = provider === "groq";
      const baseUrl = isGroq ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1";
      const model = isGroq ? "llama-3.3-70b-versatile" : "gpt-4o-mini";

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: maxTokens || 6000,
          temperature: temperature ?? 0.7,
        }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error(`${provider} API error:`, response.status, errText);
        return new Response(JSON.stringify({ error: `${provider} API error: ${response.status}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || "";
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
