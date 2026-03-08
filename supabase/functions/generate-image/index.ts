import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function generateWithGeminiDirect(apiKey: string, prompt: string): Promise<string | null> {
  console.log("[generate-image] Using direct Gemini API");
  const model = "gemini-2.0-flash-exp";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Generate a professional, high-quality academic illustration: ${prompt}. Style: clean, professional, suitable for academic research paper.` }] }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("[generate-image] Gemini direct error:", response.status, errText.substring(0, 300));
    return null;
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  console.error("[generate-image] No image in Gemini direct response");
  return null;
}

async function generateWithLovableGateway(apiKey: string, prompt: string, modelKey: string): Promise<string | null> {
  const selectedModel = modelKey === "pro" ? "google/gemini-3-pro-image-preview" : "google/gemini-2.5-flash-image";
  console.log(`[generate-image] Using Lovable gateway, model: ${selectedModel}`);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: [{ role: "user", content: `Generate a professional, high-quality academic illustration: ${prompt}. Style: clean, professional, suitable for academic research paper.` }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("[generate-image] Lovable gateway error:", response.status, errText.substring(0, 300));
    if (response.status === 402 || response.status === 429) return null;
    return null;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

async function uploadToStorage(base64Url: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const base64Data = base64Url.replace(/^data:image\/\w+;base64,/, "");
  const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  
  const fileName = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
  const filePath = `generated/${fileName}`;

  const { error } = await supabase.storage
    .from("research-images")
    .upload(filePath, imageBytes, { contentType: "image/png", upsert: false });

  if (error) {
    console.error("Storage upload failed:", error.message);
    return base64Url; // fallback
  }

  const { data: publicUrlData } = supabase.storage.from("research-images").getPublicUrl(filePath);
  console.log(`[generate-image] Uploaded: ${publicUrlData.publicUrl}`);
  return publicUrlData.publicUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, model: modelKey, geminiApiKey } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let base64Url: string | null = null;
    let usedModel = "gemini-direct";

    // Strategy 1: Try user's Gemini API key directly (no credit limits)
    if (geminiApiKey) {
      base64Url = await generateWithGeminiDirect(geminiApiKey, prompt);
    }

    // Strategy 2: Fallback to Lovable Gateway
    if (!base64Url && LOVABLE_API_KEY) {
      usedModel = modelKey === "pro" ? "google/gemini-3-pro-image-preview" : "google/gemini-2.5-flash-image";
      base64Url = await generateWithLovableGateway(LOVABLE_API_KEY, prompt, modelKey || "standard");
    }

    if (!base64Url) {
      return new Response(JSON.stringify({ error: "Image generation failed - no available provider" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload to storage
    const imageUrl = await uploadToStorage(base64Url);

    return new Response(JSON.stringify({ imageUrl, model: usedModel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
