import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL_MAP = {
  standard: {
    gemini: ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"],
    gateway: ["google/gemini-3.1-flash-image-preview", "google/gemini-2.5-flash-image"],
  },
  pro: {
    gemini: ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"],
    gateway: ["google/gemini-3-pro-image-preview", "google/gemini-3.1-flash-image-preview", "google/gemini-2.5-flash-image"],
  },
} as const;

type ModelPreset = keyof typeof MODEL_MAP;
type VisualMode = "photo" | "technical_diagram" | "workflow_diagram" | "map_infographic" | "chart_infographic" | "ui_mockup";

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
  return normalizedPrompt;
}

function detectVisualMode(prompt: string, context?: string): VisualMode {
  const text = `${prompt} ${context || ""}`.toLowerCase();

  if (/(bar chart|line chart|pie chart|area chart|histogram|graph|trend|comparison chart|cost comparison|distribution chart)/.test(text)) {
    return "chart_infographic";
  }

  if (/(world map|regional map|heat map|geographic|distribution of .* regions|map illustrating|global distribution|countries|regions)/.test(text)) {
    return "map_infographic";
  }

  if (/(workflow|flowchart|process flow|sequence diagram|pipeline|step-by-step process|operational flow)/.test(text)) {
    return "workflow_diagram";
  }

  if (/(interface|dashboard|mobile app|web app|website|screen|control panel|monitoring panel|ui|ux)/.test(text)) {
    return "ui_mockup";
  }

  if (/(diagram|architecture|block diagram|schematic|circuit|topology|framework|system layout|system architecture)/.test(text)) {
    return "technical_diagram";
  }

  return "photo";
}

function getPrompt(prompt: string, context?: string, visualMode: VisualMode = "photo") {
  const cleanPrompt = normalizePrompt(prompt);
  const cleanContext = context ? normalizePrompt(context) : "";
  const contextPart = cleanContext
    ? ` Context/topic: "${cleanContext}". Use it only to improve relevance and do not let it override the main subject.`
    : "";

  const promptByMode: Record<VisualMode, string[]> = {
    photo: [
      "Generate a single high-resolution, ultra-realistic photograph.",
      `Subject: "${cleanPrompt}".`,
      contextPart,
      "CRITICAL RULES:",
      "- Depict EXACTLY what is described, nothing more, nothing less.",
      "- Use professional DSLR camera quality: sharp focus, natural depth of field, correct perspective.",
      "- Lighting must be natural and physically accurate (sunlight, studio light, or ambient).",
      "- Materials must have correct textures: metal looks metallic, wood looks wooden, skin looks real.",
      "- Absolutely NO text, labels, watermarks, or written words anywhere in the image.",
      "- NO cartoon, illustration, painting, or artistic style - this must look like a real photograph.",
      "- NO fantasy elements, glowing effects, surreal distortions, or symbolic imagery.",
      "- Composition should be clean, focused, and professional like a stock photo or editorial image.",
    ],
    technical_diagram: [
      "Generate a single clean, precise technical diagram or product visualization.",
      `Subject: "${cleanPrompt}".`,
      contextPart,
      "CRITICAL RULES:",
      "- Create a professional engineering/academic visualization with accurate proportions and geometry.",
      "- Use clean lines, proper perspective, and organized layout on a white or light neutral background.",
      "- If showing equipment or components, render them realistically with correct materials and details.",
      "- Absolutely NO text, labels, annotations, or written words anywhere in the image.",
      "- NO decorative elements, fantasy, cartoon style, or low-quality AI artifacts.",
      "- The result should look like it belongs in a professional engineering textbook or product catalog.",
    ],
    workflow_diagram: [
      "Generate a single clean, professional process visualization.",
      `Subject: "${cleanPrompt}".`,
      contextPart,
      "CRITICAL RULES:",
      "- Show the process using realistic equipment renders, clean icons, or organized visual elements.",
      "- Use a white or light neutral background with clear visual flow (left to right or top to bottom).",
      "- Absolutely NO text, labels, annotations, or written words anywhere in the image.",
      "- Keep the layout minimal, organized, and easy to understand at a glance.",
      "- NO decorative scenery, fantasy elements, or unrelated objects.",
    ],
    map_infographic: [
      "Generate a single clean, accurate geographic visualization or map.",
      `Subject: "${cleanPrompt}".`,
      contextPart,
      "CRITICAL RULES:",
      "- Use accurate geography with clear color-coded highlighting for relevant regions.",
      "- Clean, minimal design on a white or light background.",
      "- Absolutely NO text, labels, country names, or written words anywhere in the image.",
      "- NO decorative icons, fantasy elements, or unrelated imagery.",
      "- The map should be simple, accurate, and professionally styled.",
    ],
    chart_infographic: [
      "Generate a single clean, professional data visualization or comparison graphic.",
      `Subject: "${cleanPrompt}".`,
      contextPart,
      "CRITICAL RULES:",
      "- Use clear visual elements: bars, circles, icons, or color-coded sections as appropriate.",
      "- Clean, minimal design on a white or light background.",
      "- Absolutely NO text, numbers, labels, or written words anywhere in the image.",
      "- Use only visual proportions and colors to convey the data comparison.",
      "- NO decorative elements, fantasy imagery, or cluttered compositions.",
    ],
    ui_mockup: [
      "Generate a single clean, modern, realistic interface design mockup.",
      `Subject: "${cleanPrompt}".`,
      contextPart,
      "CRITICAL RULES:",
      "- Use contemporary UI/UX design patterns with proper spacing, alignment, and hierarchy.",
      "- Render on a realistic device frame (phone, laptop, monitor) if appropriate.",
      "- Minimize any visible text to placeholder-style content only.",
      "- NO fantasy elements, decorative scenery, or unrealistic compositions.",
      "- The result should look like a professional design portfolio piece.",
    ],
  };

  return promptByMode[visualMode].filter(Boolean).join(" ");
}

async function validateGeneratedImage(candidateUrl: string, prompt: string, visualMode: VisualMode, context?: string): Promise<boolean> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return true;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a strict image-quality reviewer. Reject blank images, washed-out images, outdated low-quality AI-looking visuals, unrelated content, wrong visual type, and messy composition. Return ONLY 'PASS: ...' or 'FAIL: ...'.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Requested visual type: ${visualMode}. Main request: ${prompt}.${context ? ` Context: ${context}.` : ""} Reject if the image is blank, mostly empty, off-topic, low-detail, outdated-looking, cartoonish when it should not be, or does not clearly satisfy the request.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: candidateUrl,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[generate-image] Validation call failed:", res.status, await res.text());
      return true;
    }

    const data = await res.json();
    const verdict = data?.choices?.[0]?.message?.content?.trim() || "";
    console.log(`[generate-image] Validation verdict: ${verdict}`);
    return verdict.toUpperCase().startsWith("PASS");
  } catch (e) {
    console.error("[generate-image] Validation error:", e);
    return true;
  }
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

async function generateWithLovableGateway(apiKey: string, prompt: string, preset: ModelPreset, visualMode: VisualMode, context?: string): Promise<string | null> {
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
          messages: [{ role: "user", content: getPrompt(prompt, context, visualMode) }],
          modalities: ["image", "text"],
        }),
      });

      if (!res.ok) {
        console.error(`[generate-image] Gateway ${model}: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (imageUrl && await validateGeneratedImage(imageUrl, prompt, visualMode, context)) return imageUrl;
      if (imageUrl) console.warn(`[generate-image] Rejected low-quality image from ${model}`);
    } catch (e) {
      console.error(`[generate-image] Gateway ${model} error:`, e);
    }
  }

  return null;
}

async function generateWithGeminiDirect(apiKey: string, prompt: string, preset: ModelPreset, visualMode: VisualMode, context?: string): Promise<string | null> {
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
          contents: [{ parts: [{ text: getPrompt(prompt, context, visualMode) }] }],
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
          const imageUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
          if (await validateGeneratedImage(imageUrl, prompt, visualMode, context)) {
            return imageUrl;
          }
          console.warn(`[generate-image] Rejected low-quality image from ${model}`);
        }
      }
    } catch (e) {
      console.error(`[generate-image] ${model} error:`, e);
    }
  }

  return null;
}

async function generateWithCloudflare(prompt: string, visualMode: VisualMode, context?: string): Promise<string | null> {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");

  if (!accountId || !apiToken) return null;

  const models = [
    "@cf/black-forest-labs/flux-1-schnell",
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
          prompt: getPrompt(prompt, context, visualMode),
          steps: 8,
          seed: Math.floor(Math.random() * 1000000),
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
          const uploadedUrl = await uploadDataUrlToStorage(`data:image/png;base64,${base64}`);
          if (await validateGeneratedImage(uploadedUrl, prompt, visualMode, context)) {
            return uploadedUrl;
          }
          console.warn(`[generate-image] Rejected low-quality image from ${model}`);
          continue;
        }

        console.error(`[generate-image] Cloudflare ${model}: no image payload in JSON response`);
        continue;
      }

      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!bytes.byteLength) {
        console.error(`[generate-image] Cloudflare ${model}: empty binary response`);
        continue;
      }

      const uploadedUrl = await uploadBytesToStorage(bytes, contentType || "image/png");
      if (await validateGeneratedImage(uploadedUrl, prompt, visualMode, context)) {
        return uploadedUrl;
      }
      console.warn(`[generate-image] Rejected low-quality image from ${model}`);
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

    const visualMode = detectVisualMode(finalPrompt, finalContext);
    finalPrompt = await enhancePromptForRealism(finalPrompt, finalContext);

    console.log(`[generate-image] Visual mode: ${visualMode}`);
    console.log(`[generate-image] Final prompt: "${finalPrompt}"`);

    let imageUrl: string | null = null;
    let usedModel = "unknown";

    if (geminiApiKey) {
      imageUrl = await generateWithGeminiDirect(geminiApiKey, finalPrompt, preset, visualMode, finalContext);
      if (imageUrl) usedModel = preset === "pro" ? "gemini-direct-user-pro" : "gemini-direct-user-flash";
    }

    if (!imageUrl) {
      const serverKey = Deno.env.get("GEMINI_API_KEY");
      if (serverKey) {
        imageUrl = await generateWithGeminiDirect(serverKey, finalPrompt, preset, visualMode, finalContext);
        if (imageUrl) usedModel = preset === "pro" ? "gemini-direct-server-pro" : "gemini-direct-server-flash";
      }
    }

    if (!imageUrl) {
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableKey) {
        imageUrl = await generateWithLovableGateway(lovableKey, finalPrompt, preset, visualMode, finalContext);
        if (imageUrl) usedModel = preset === "pro" ? "lovable-gateway-pro" : "lovable-gateway-flash";
      }
    }

    if (!imageUrl) {
      imageUrl = await generateWithCloudflare(finalPrompt, visualMode, finalContext);
      if (imageUrl) usedModel = "cloudflare-flux";
    }

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "High-quality image generation failed. The premium providers are temporarily unavailable or out of quota." }), {
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