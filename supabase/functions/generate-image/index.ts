import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL_MAP = {
  standard: {
    gemini: ["gemini-2.5-flash-image", "gemini-3.1-flash-image-preview"],
    gateway: ["google/gemini-2.5-flash-image", "google/gemini-3.1-flash-image-preview"],
  },
  pro: {
    gemini: ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"],
    gateway: ["google/gemini-3-pro-image-preview", "google/gemini-3.1-flash-image-preview", "google/gemini-2.5-flash-image"],
  },
} as const;

type ModelPreset = keyof typeof MODEL_MAP;

function getPrompt(prompt: string) {
  return `Generate one clean, professional academic illustration for: ${prompt}. Avoid text inside the image unless absolutely necessary.`;
}

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseKey);
}

async function uploadBytesToStorage(imageBytes: Uint8Array, contentType = "image/png"): Promise<string> {
  const supabase = getSupabaseAdmin();
  const extension = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
  const fileName = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const filePath = `generated/${fileName}`;

  const { error } = await supabase.storage
    .from("research-images")
    .upload(filePath, imageBytes, { contentType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: publicUrlData } = supabase.storage.from("research-images").getPublicUrl(filePath);
  return publicUrlData.publicUrl;
}

async function uploadDataUrlToStorage(dataUrl: string): Promise<string> {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image data URL");
  }

  const [, mimeType, base64Data] = match;
  const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  return uploadBytesToStorage(imageBytes, mimeType);
}

async function generateWithLovableGateway(apiKey: string, prompt: string, preset: ModelPreset): Promise<string | null> {
  const models = MODEL_MAP[preset].gateway;

  for (const model of models) {
    console.log(`[generate-image] Trying Lovable gateway: ${model}`);
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: getPrompt(prompt) }],
          modalities: ["image", "text"],
        }),
      });

      if (!res.ok) {
        console.error(`[generate-image] Gateway ${model}: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (imageUrl) return imageUrl;
    } catch (e) {
      console.error(`[generate-image] Gateway ${model} error:`, e);
    }
  }

  return null;
}

async function generateWithGeminiDirect(apiKey: string, prompt: string, preset: ModelPreset): Promise<string | null> {
  const models = MODEL_MAP[preset].gemini;

  for (const model of models) {
    console.log(`[generate-image] Trying Gemini direct: ${model}`);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: getPrompt(prompt) }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[generate-image] ${model}: ${res.status} ${errorText}`);
        continue;
      }

      const data = await res.json();
      for (const part of data?.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
        }
      }
    } catch (e) {
      console.error(`[generate-image] ${model} error:`, e);
    }
  }

  return null;
}

async function generateWithPollinations(prompt: string): Promise<string | null> {
  console.log("[generate-image] Using Pollinations.ai (free)");
  try {
    const shortPrompt = prompt.substring(0, 200);
    const encodedPrompt = encodeURIComponent(`${shortPrompt}, professional, clean, academic style, illustration`);
    const seed = Math.floor(Math.random() * 100000);
    const remoteUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=768&nologo=true&seed=${seed}`;

    const imageResponse = await fetch(remoteUrl, {
      headers: {
        Accept: "image/png,image/jpeg,image/webp,*/*",
      },
    });

    if (!imageResponse.ok) {
      console.error(`[generate-image] Pollinations fetch failed: ${imageResponse.status}`);
      return null;
    }

    const contentType = imageResponse.headers.get("content-type") || "image/png";
    const arrayBuffer = await imageResponse.arrayBuffer();

    if (!arrayBuffer.byteLength) {
      console.error("[generate-image] Pollinations returned empty body");
      return null;
    }

    const publicUrl = await uploadBytesToStorage(new Uint8Array(arrayBuffer), contentType);
    console.log("[generate-image] Pollinations image fetched and uploaded");
    return publicUrl;
  } catch (e) {
    console.error("[generate-image] Pollinations error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, geminiApiKey, model } = await req.json();
    const preset: ModelPreset = model === "pro" ? "pro" : "standard";

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imageUrl: string | null = null;
    let usedModel = "unknown";

    if (geminiApiKey) {
      imageUrl = await generateWithGeminiDirect(geminiApiKey, prompt, preset);
      if (imageUrl) usedModel = preset === "pro" ? "gemini-direct-user-pro" : "gemini-direct-user-flash";
    }

    if (!imageUrl) {
      const serverKey = Deno.env.get("GEMINI_API_KEY");
      if (serverKey) {
        imageUrl = await generateWithGeminiDirect(serverKey, prompt, preset);
        if (imageUrl) usedModel = preset === "pro" ? "gemini-direct-server-pro" : "gemini-direct-server-flash";
      }
    }

    if (!imageUrl) {
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableKey) {
        imageUrl = await generateWithLovableGateway(lovableKey, prompt, preset);
        if (imageUrl) usedModel = preset === "pro" ? "lovable-gateway-pro" : "lovable-gateway-flash";
      }
    }

    if (!imageUrl) {
      imageUrl = await generateWithPollinations(prompt);
      if (imageUrl) usedModel = "pollinations-free";
    }

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Image generation failed - all providers exhausted" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (imageUrl.startsWith("data:")) {
      imageUrl = await uploadDataUrlToStorage(imageUrl);
    }

    return new Response(JSON.stringify({ imageUrl, model: usedModel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
