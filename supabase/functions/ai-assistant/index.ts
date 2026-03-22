import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ChatMessage = { role: "user" | "assistant"; content: string };

function getSystemPrompt(language?: string) {
  return language === "ar"
    ? "أنت مساعد أكاديمي خبير متخصص في جميع المجالات الأكاديمية والبحثية. ساعد المستخدم بإجابات دقيقة وواضحة وعملية. عند الحاجة قدّم الخطوات بشكل منظم، وأجب باللغة العربية الفصحى."
    : "You are an expert academic assistant across academic and research fields. Give accurate, clear, practical answers. When useful, structure the answer into steps. Respond in English.";
}

async function callLovable(messages: ChatMessage[], language?: string) {
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

async function callGemini(messages: ChatMessage[], language?: string) {
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, language } = await req.json();
    const safeMessages = Array.isArray(messages) ? messages : [];

    let result = await callLovable(safeMessages, language);
    if (!result.reply) {
      result = await callGemini(safeMessages, language);
    }

    if (!result.reply) {
      return new Response(JSON.stringify({ error: result.error || "Assistant temporarily unavailable" }), {
        status: result.status >= 400 ? result.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
