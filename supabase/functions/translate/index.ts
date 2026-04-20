import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { text, sourceLanguage, targetLanguage } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return new Response(JSON.stringify({ error: "Missing or invalid text" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceName = sourceLanguage === 'ar' ? 'Arabic' : 'English';
    const targetName = targetLanguage === 'ar' ? 'Arabic' : 'English';

    const systemPrompt = `You are an expert academic translator. Translate the following text from ${sourceName} to ${targetName} with high precision. Maintain academic tone, terminology accuracy, and proper formatting. Preserve paragraph structure. Output ONLY the translated text, nothing else (no preface, no explanation, no quotes).`;

    // Strategy 1: Lovable Gateway (primary - most reliable)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        console.log("[translate] Using Lovable gateway");
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: text },
            ],
            max_tokens: 8000,
            temperature: 0.2,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          if (content.trim()) {
            console.log(`[translate] Lovable success, length: ${content.length}`);
            return new Response(JSON.stringify({ translation: content.trim() }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          const errText = await response.text().catch(() => "");
          console.error(`[translate] Lovable failed ${response.status}:`, errText.substring(0, 200));
          if (response.status === 429) {
            return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again in a moment." }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (response.status === 402) {
            return new Response(JSON.stringify({ error: "AI quota exhausted. Please contact admin." }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch (e) {
        console.error("[translate] Lovable exception:", e);
      }
    }

    // Strategy 2: Gemini direct fallback
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (GEMINI_API_KEY) {
      console.log("[translate] Falling back to Gemini direct");
      const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${text}` }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 8000 },
            }),
          });
          if (response.ok) {
            const data = await response.json();
            const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (content.trim()) {
              console.log(`[translate] Success with Gemini ${model}`);
              return new Response(JSON.stringify({ translation: content.trim() }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        } catch (e) {
          console.error(`[translate] Gemini ${model} exception:`, e);
        }
      }
    }

    return new Response(JSON.stringify({ error: "No translation provider available. Please try again later." }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
