import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { provider, apiKey, systemPrompt, userPrompt, maxTokens, temperature } = await req.json();

    if (!provider || !apiKey) {
      return new Response(JSON.stringify({ error: "Missing provider or apiKey" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let content = "";

    if (provider === "orbit") {
      // Orbit Provider - Anthropic-compatible proxy
      // Orbit Provider - Anthropic-compatible proxy (CLIProxyAPI)
      const orbitModel = "gemini-claude-sonnet-4-6-thinking";
      // Try auth via query param as documented credential source
      const baseUrl = `https://api.orbit-provider.com/cliproxy-api/api/provider/agy/v1/messages?auth_token=${encodeURIComponent(apiKey)}`;
      
      console.log("Calling Orbit API, model:", orbitModel);
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: orbitModel,
          system: systemPrompt,
          messages: [
            { role: "user", content: userPrompt },
          ],
          max_tokens: maxTokens || 6000,
          temperature: temperature ?? 0.7,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error("Orbit API error:", response.status, errText);
        return new Response(JSON.stringify({ error: `Orbit API error: ${response.status} - ${errText.slice(0, 300)}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      // Anthropic format: data.content[0].text
      content = data.content?.[0]?.text || data.choices?.[0]?.message?.content || "";
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
