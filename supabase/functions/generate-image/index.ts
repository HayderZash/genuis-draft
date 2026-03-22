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

// Detect if text contains Arabic/non-Latin characters
function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

function extractTextFromGeminiResponse(data: any): string | null {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join(" ")
    .trim();

  return text || null;
}

async function runGeminiTextTask(system: string, user: string): Promise<string | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return null;

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 300,
        },
      }),
    });

    if (!res.ok) {
      console.error("[generate-image] Gemini text task failed:", res.status, await res.text());
      return null;
    }

    return extractTextFromGeminiResponse(await res.json());
  } catch (e) {
    console.error("[generate-image] Gemini text task error:", e);
    return null;
  }
}

async function runLovableTextTask(system: string, user: string): Promise<string | null> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return null;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[generate-image] Lovable text task failed:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error("[generate-image] Lovable text task error:", e);
    return null;
  }
}

async function runTextTask(system: string, user: string): Promise<string | null> {
  return await runGeminiTextTask(system, user) || await runLovableTextTask(system, user);
}

const DEFAULT_NEGATIVE_PROMPT = [
  "cartoon",
  "illustration",
  "drawing",
  "painting",
  "anime",
  "comic",
  "3d render",
  "cgi",
  "stylized",
  "abstract",
  "fantasy",
  "surreal",
  "deformed",
  "distorted",
  "extra limbs",
  "bad anatomy",
  "unrealistic face",
  "blurry",
  "low detail",
  "low quality",
  "text",
  "watermark",
  "logo",
  "caption",
  "unrelated objects",
].join(", ");

// Translate Arabic prompt to English using Lovable AI Gateway
async function translateToEnglish(text: string): Promise<string> {
  try {
    console.log("[generate-image] Translating Arabic prompt to English...");
    const translated = await runTextTask(
      "Translate the following user request into precise English for text-to-image generation. Preserve the exact subject, action, setting, and important details. Do not add new objects or artistic style words unless they are explicitly mentioned. Return ONLY the English translation.",
      text,
    );

    if (translated) {
      console.log(`[generate-image] Translated: "${text}" → "${translated}"`);
      return translated;
    }
  } catch (e) {
    console.error("[generate-image] Translation failed:", e);
  }
  return text;
}

function normalizePrompt(prompt: string): string {
  return prompt.replace(/\s+/g, " ").trim();
}

async function enhancePromptForRealism(prompt: string, context?: string): Promise<string> {
  const normalizedPrompt = normalizePrompt(prompt);
  const normalizedContext = context ? normalizePrompt(context) : "";

  try {
    const enhanced = await runTextTask(
      "You rewrite prompts for photorealistic image generation. Preserve the exact subject and meaning. Make the wording more precise, realistic, visually grounded, and accurate. Do not add unrelated objects, architecture, symbolism, fantasy details, or art styles. Return only one concise English prompt.",
      `Main request: ${normalizedPrompt}${normalizedContext ? `\nContext: ${normalizedContext}` : ""}`,
    );

    if (enhanced) {
      console.log(`[generate-image] Enhanced prompt: "${enhanced}"`);
      return normalizePrompt(enhanced);
    }
  } catch (e) {
    console.error("[generate-image] Prompt enhancement failed:", e);
  }

  return normalizedPrompt;
}

function getPrompt(prompt: string, context?: string) {
  const cleanPrompt = normalizePrompt(prompt);
  const cleanContext = context ? normalizePrompt(context) : "";
  const contextPart = cleanContext
    ? ` Context/topic: "${cleanContext}". Use it only to improve relevance and do not let it override the main subject.`
    : "";

  return [
    "Create one highly realistic, well-composed, visually clean, photorealistic image.",
    `Main subject to depict exactly: "${cleanPrompt}".`,
    contextPart,
    "Follow the user description literally and accurately.",
    "Use natural lighting, realistic materials, believable proportions, and a professional documentary or studio-photo look depending on the subject.",
    "Keep the scene organized and focused on the requested subject only.",
    "Do not add unrelated objects, symbolic elements, fantasy details, or decorative text.",
    "The result must look like a real photo, not an illustration.",
  ]
    .filter(Boolean)
    .join(" ");
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
  if (!match) throw new Error("Invalid image data URL");

  const [, mimeType, base64Data] = match;
  const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  return uploadBytesToStorage(imageBytes, mimeType);
}

async function generateWithLovableGateway(apiKey: string, prompt: string, preset: ModelPreset, context?: string): Promise<string | null> {
  for (const model of MODEL_MAP[preset].gateway) {
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
          messages: [{ role: "user", content: getPrompt(prompt, context) }],
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

async function generateWithGeminiDirect(apiKey: string, prompt: string, preset: ModelPreset, context?: string): Promise<string | null> {
  for (const model of MODEL_MAP[preset].gemini) {
    console.log(`[generate-image] Trying Gemini direct: ${model}`);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: getPrompt(prompt, context) }] }],
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

async function generateWithCloudflare(prompt: string, context?: string): Promise<string | null> {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");

  if (!accountId || !apiToken) return null;

  const models = [
    "@cf/stabilityai/stable-diffusion-xl-base-1.0",
    "@cf/bytedance/stable-diffusion-xl-lightning",
  ];

  for (const model of models) {
    console.log(`[generate-image] Trying Cloudflare: ${model}`);
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          Accept: "image/png,application/json",
        },
        body: JSON.stringify({
          prompt: getPrompt(prompt, context),
          negative_prompt: DEFAULT_NEGATIVE_PROMPT,
          num_steps: model.includes("lightning") ? 8 : 28,
          guidance: model.includes("lightning") ? 7.5 : 11,
          width: 1024,
          height: 768,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[generate-image] Cloudflare ${model}: ${res.status} ${errorText}`);
        continue;
      }

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await res.json();
        const base64 = data?.result?.image || data?.result?.base64 || data?.image;
        if (typeof base64 === "string" && base64.length > 100) {
          return await uploadDataUrlToStorage(`data:image/png;base64,${base64}`);
        }

        console.error(`[generate-image] Cloudflare ${model}: no image payload in JSON response`);
        continue;
      }

      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!bytes.byteLength) {
        console.error(`[generate-image] Cloudflare ${model}: empty binary response`);
        continue;
      }

      return await uploadBytesToStorage(bytes, contentType || "image/png");
    } catch (e) {
      console.error(`[generate-image] Cloudflare ${model} error:`, e);
    }
  }

  return null;
}

async function generateWithPollinations(prompt: string, context?: string): Promise<string | null> {
  console.log("[generate-image] Using Pollinations.ai (free)");
  try {
    const fullPrompt = context ? `${prompt}, related to ${context}` : prompt;
    const shortPrompt = fullPrompt.substring(0, 200);
    const encodedPrompt = encodeURIComponent(`${shortPrompt}, photorealistic real-life photo, realistic lighting, accurate subject, clean composition, professional photography, highly detailed, no illustration, no cartoon, no text`);
    const seed = Math.floor(Math.random() * 100000);
    const remoteUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=768&nologo=true&enhance=true&model=flux&seed=${seed}`;

    const imageResponse = await fetch(remoteUrl, {
      headers: { Accept: "image/png,image/jpeg,image/webp,*/*" },
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
    const { prompt, geminiApiKey, model, context } = await req.json();
    const preset: ModelPreset = model === "pro" ? "pro" : "standard";
    const imageContext = context || "";

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Translate Arabic prompts to English for better image generation
    let finalPrompt = prompt;
    let finalContext = imageContext;
    if (containsArabic(prompt)) {
      finalPrompt = await translateToEnglish(prompt);
    }
    if (finalContext && containsArabic(finalContext)) {
      finalContext = await translateToEnglish(finalContext);
    }

    if (!finalPrompt || finalPrompt === prompt) {
      // Translation failed or returned same text, keep original
      finalPrompt = prompt;
    }

    finalPrompt = await enhancePromptForRealism(finalPrompt, finalContext);

    console.log(`[generate-image] Final prompt: "${finalPrompt}"`);

    let imageUrl: string | null = null;
    let usedModel = "unknown";

    if (geminiApiKey) {
      imageUrl = await generateWithGeminiDirect(geminiApiKey, finalPrompt, preset, finalContext);
      if (imageUrl) usedModel = preset === "pro" ? "gemini-direct-user-pro" : "gemini-direct-user-flash";
    }

    if (!imageUrl) {
      const serverKey = Deno.env.get("GEMINI_API_KEY");
      if (serverKey) {
        imageUrl = await generateWithGeminiDirect(serverKey, finalPrompt, preset, finalContext);
        if (imageUrl) usedModel = preset === "pro" ? "gemini-direct-server-pro" : "gemini-direct-server-flash";
      }
    }

    if (!imageUrl) {
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableKey) {
        imageUrl = await generateWithLovableGateway(lovableKey, finalPrompt, preset, finalContext);
        if (imageUrl) usedModel = preset === "pro" ? "lovable-gateway-pro" : "lovable-gateway-flash";
      }
    }

    if (!imageUrl) {
      imageUrl = await generateWithPollinations(finalPrompt, finalContext);
      if (imageUrl) usedModel = "pollinations-free";
    }

    if (!imageUrl) {
      imageUrl = await generateWithCloudflare(finalPrompt, finalContext);
      if (imageUrl) usedModel = "cloudflare-workers-ai";
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