import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type VisualMode = "photo" | "technical_diagram" | "workflow_diagram" | "map_infographic" | "chart_infographic" | "ui_mockup";

function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

// ─── Text helpers ───────────────────────────────────────────────

async function runTextTask(system: string, user: string): Promise<string | null> {
  // Try Gemini first
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (geminiKey) {
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: user }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || "").join(" ").trim();
        if (text) return text;
      }
    } catch {}
  }
  // Fallback to Lovable
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content?.trim() || null;
      }
    } catch {}
  }
  return null;
}

async function translateToEnglish(text: string): Promise<string> {
  if (!containsArabic(text)) return text;
  try {
    const translated = await runTextTask(
      "Translate the following to precise English for image generation. Preserve the exact subject and details. Return ONLY the English translation.",
      text,
    );
    if (translated) {
      console.log(`[img] Translated: "${text.substring(0, 50)}" → "${translated.substring(0, 50)}"`);
      return translated;
    }
  } catch {}
  return text;
}

// ─── Visual mode detection ──────────────────────────────────────

function detectVisualMode(prompt: string, context?: string): VisualMode {
  const text = `${prompt} ${context || ""}`.toLowerCase();
  if (/(bar chart|line chart|pie chart|histogram|graph|trend|comparison chart|distribution chart)/.test(text)) return "chart_infographic";
  if (/(world map|regional map|heat map|geographic|global distribution|countries|regions)/.test(text)) return "map_infographic";
  if (/(workflow|flowchart|process flow|sequence diagram|pipeline|operational flow)/.test(text)) return "workflow_diagram";
  if (/(interface|dashboard|mobile app|web app|screen|control panel|ui|ux)/.test(text)) return "ui_mockup";
  if (/(diagram|architecture|block diagram|schematic|circuit|topology|framework|system layout)/.test(text)) return "technical_diagram";
  return "photo";
}

// ─── Prompt builder ─────────────────────────────────────────────

function buildPrompt(prompt: string, context?: string, visualMode: VisualMode = "photo"): string {
  const ctxPart = context ? ` Context: "${context}".` : "";
  const rules: Record<VisualMode, string> = {
    photo: `Generate a single ultra-realistic photograph of: "${prompt}".${ctxPart} Professional DSLR quality. Sharp focus, natural lighting, correct materials. NO text/labels/watermarks. NO cartoon/painting/illustration. NO fantasy/glowing effects. Clean professional composition.`,
    technical_diagram: `Generate a clean, precise technical diagram/visualization of: "${prompt}".${ctxPart} Professional engineering quality, accurate proportions, white background. NO text/labels/annotations. NO decorative elements.`,
    workflow_diagram: `Generate a clean professional process visualization of: "${prompt}".${ctxPart} Realistic equipment renders, organized layout, white background. NO text/labels. Minimal and clear.`,
    map_infographic: `Generate a clean geographic visualization of: "${prompt}".${ctxPart} Accurate geography, color-coded highlighting. NO text/labels/country names. Simple and professional.`,
    chart_infographic: `Generate a clean data visualization of: "${prompt}".${ctxPart} Clear visual elements (bars, circles, icons). NO text/numbers/labels. Visual proportions only.`,
    ui_mockup: `Generate a realistic modern interface mockup of: "${prompt}".${ctxPart} Contemporary UI/UX design, proper spacing. Realistic device frame. Minimal placeholder text.`,
  };
  return rules[visualMode];
}

// ─── Storage helpers ────────────────────────────────────────────

function getSupabaseAdmin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function uploadBytesToStorage(imageBytes: Uint8Array, contentType = "image/png"): Promise<string> {
  const supabase = getSupabaseAdmin();
  const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
  const fileName = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `generated/${fileName}`;
  const { error } = await supabase.storage.from("research-images").upload(filePath, imageBytes, { contentType, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = supabase.storage.from("research-images").getPublicUrl(filePath);
  return data.publicUrl;
}

async function uploadDataUrlToStorage(dataUrl: string): Promise<string> {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");
  const imageBytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  return uploadBytesToStorage(imageBytes, match[1]);
}

async function uploadFromUrl(remoteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(remoteUrl, { headers: { Accept: "image/*" } });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/png";
    if (!ct.startsWith("image/")) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength < 1000) return null; // too small = likely error
    return await uploadBytesToStorage(bytes, ct);
  } catch {
    return null;
  }
}

// ─── Provider 1: Lovable AI Gateway (Gemini image models) ──────

async function generateWithLovableGateway(prompt: string, visualMode: VisualMode, context?: string): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  const models = ["google/gemini-3.1-flash-image-preview", "google/gemini-3-pro-image-preview", "google/gemini-2.5-flash-image"];
  for (const model of models) {
    console.log(`[img] Lovable gateway: ${model}`);
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: buildPrompt(prompt, context, visualMode) }], modalities: ["image", "text"] }),
      });
      if (!res.ok) { console.error(`[img] Gateway ${model}: ${res.status}`); continue; }
      const data = await res.json();
      const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (url) return url;
    } catch (e) { console.error(`[img] Gateway ${model} error:`, e); }
  }
  return null;
}

// ─── Provider 2: Gemini Direct ──────────────────────────────────

async function generateWithGeminiDirect(apiKey: string, prompt: string, visualMode: VisualMode, context?: string): Promise<string | null> {
  const models = ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"];
  for (const model of models) {
    console.log(`[img] Gemini direct: ${model}`);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(prompt, context, visualMode) }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      });
      if (!res.ok) { console.error(`[img] ${model}: ${res.status}`); continue; }
      const data = await res.json();
      for (const part of data?.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
        }
      }
    } catch (e) { console.error(`[img] ${model} error:`, e); }
  }
  return null;
}

// ─── Provider 3: Cloudflare Workers AI ──────────────────────────

async function generateWithCloudflare(prompt: string, visualMode: VisualMode, context?: string): Promise<string | null> {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
  if (!accountId || !apiToken) return null;
  console.log("[img] Cloudflare FLUX-1-schnell");
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json", Accept: "image/png,application/json" },
      body: JSON.stringify({ prompt: buildPrompt(prompt, context, visualMode), steps: 8, seed: Math.floor(Math.random() * 1000000), width: 1024, height: 768 }),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await res.json();
      const b64 = data?.result?.image || data?.result?.base64;
      if (typeof b64 === "string" && b64.length > 100) return await uploadDataUrlToStorage(`data:image/png;base64,${b64}`);
    } else {
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength > 1000) return await uploadBytesToStorage(bytes, ct || "image/png");
    }
  } catch (e) { console.error("[img] Cloudflare error:", e); }
  return null;
}

// ─── Provider 4: Pollinations.ai (flux model) ───────────────────

async function generateWithPollinations(prompt: string, visualMode: VisualMode, context?: string, model = "flux"): Promise<string | null> {
  console.log(`[img] Pollinations (${model})`);
  try {
    const hint: Record<VisualMode, string> = {
      photo: "ultra realistic professional photography, natural lighting",
      technical_diagram: "clean technical visualization, white background",
      workflow_diagram: "clean process diagram, minimal layout",
      map_infographic: "geographic infographic, minimal design",
      chart_infographic: "data visualization, clean design",
      ui_mockup: "modern realistic interface mockup",
    };
    const full = [prompt, context ? `related to ${context}` : "", hint[visualMode], "high detail, no text, no labels, no watermark"].filter(Boolean).join(", ").substring(0, 200);
    const seed = Math.floor(Math.random() * 100000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}?width=1024&height=768&nologo=true&enhance=true&model=${model}&seed=${seed}`;
    return await uploadFromUrl(url);
  } catch (e) { console.error(`[img] Pollinations ${model} error:`, e); }
  return null;
}

// ─── Provider 5: Pollinations turbo model ───────────────────────

async function generateWithPollinationsTurbo(prompt: string, visualMode: VisualMode, context?: string): Promise<string | null> {
  return generateWithPollinations(prompt, visualMode, context, "turbo");
}

// ─── Provider 6: Pollinations flux-realism ──────────────────────

async function generateWithPollinationsRealism(prompt: string, visualMode: VisualMode, context?: string): Promise<string | null> {
  return generateWithPollinations(prompt, visualMode, context, "flux-realism");
}

// ─── Provider 7: Pollinations flux-pro ──────────────────────────

async function generateWithPollinationsPro(prompt: string, visualMode: VisualMode, context?: string): Promise<string | null> {
  return generateWithPollinations(prompt, visualMode, context, "flux-pro");
}

// ─── Provider 8: Pollinations flux-anime (for diagrams) ─────────

async function generateWithPollinationsAnime(prompt: string, visualMode: VisualMode, context?: string): Promise<string | null> {
  return generateWithPollinations(prompt, visualMode, context, "flux-anime");
}

// ─── Provider 9: Wikimedia Commons ──────────────────────────────

async function generateWithWikimediaCommons(prompt: string, visualMode: VisualMode, context?: string): Promise<string | null> {
  console.log("[img] Wikimedia Commons");
  const stopWords = new Set(["the","and","for","with","from","that","this","into","using","showing","image","figure","exactly","should","what","clean","modern"]);
  const base = `${context || ""} ${prompt}`.replace(/figure\s+\d+/gi, " ").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
  const keywords = base.split(" ").filter(w => w.length > 2 && !stopWords.has(w.toLowerCase())).slice(0, 8);
  const query = keywords.join(" ") || prompt;

  const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("generator", "search");
  searchUrl.searchParams.set("gsrsearch", query);
  searchUrl.searchParams.set("gsrnamespace", "6");
  searchUrl.searchParams.set("gsrlimit", "5");
  searchUrl.searchParams.set("prop", "imageinfo");
  searchUrl.searchParams.set("iiprop", "url");
  try {
    const response = await fetch(searchUrl.toString(), { headers: { "User-Agent": "LovableResearchBot/1.0" } });
    if (!response.ok) return null;
    const data = await response.json();
    const pages = Object.values(data?.query?.pages || {}) as any[];
    const urls = pages.flatMap(p => p.imageinfo?.map((i: any) => i.url) || []).filter((u: string) => /\.(png|jpe?g|webp)$/i.test(u));
    for (const remoteUrl of urls) {
      const uploaded = await uploadFromUrl(remoteUrl);
      if (uploaded) return uploaded;
    }
  } catch (e) { console.error("[img] Wikimedia error:", e); }
  return null;
}

// ─── Provider 10: Lorem Picsum (real photos) ────────────────────

async function generateWithLoremPicsum(prompt: string): Promise<string | null> {
  console.log("[img] Lorem Picsum");
  try {
    // Use a random seed based on prompt hash for variety
    const seed = Math.abs([...prompt].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) + Date.now();
    const url = `https://picsum.photos/seed/${seed}/1024/768`;
    return await uploadFromUrl(url);
  } catch { return null; }
}

// ─── Provider 11: Unsplash Source (free, no key needed) ─────────

async function generateWithUnsplash(prompt: string): Promise<string | null> {
  console.log("[img] Unsplash Source");
  try {
    const keywords = prompt.split(/\s+/).slice(0, 3).join(",");
    const url = `https://source.unsplash.com/1024x768/?${encodeURIComponent(keywords)}`;
    return await uploadFromUrl(url);
  } catch { return null; }
}

// ─── Provider 12: DiceBear (for UI/tech diagrams as fallback) ───

async function generateWithPlaceholder(prompt: string): Promise<string | null> {
  console.log("[img] Placeholder fallback");
  try {
    // Use placehold.co with descriptive text
    const shortDesc = prompt.substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '+');
    const url = `https://placehold.co/1024x768/e8e8e8/333?text=${shortDesc}`;
    return await uploadFromUrl(url);
  } catch { return null; }
}

// ─── Main serve handler ─────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, geminiApiKey, model, context } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Translate Arabic
    let finalPrompt = await translateToEnglish(prompt);
    let finalContext = context ? await translateToEnglish(context) : "";
    const visualMode = detectVisualMode(finalPrompt, finalContext);

    console.log(`[img] Mode: ${visualMode} | Prompt: "${finalPrompt.substring(0, 80)}"`);

    let imageUrl: string | null = null;
    let usedModel = "unknown";

    // Provider chain - try each in order until one succeeds

    // 1. User Gemini key
    if (!imageUrl && geminiApiKey) {
      imageUrl = await generateWithGeminiDirect(geminiApiKey, finalPrompt, visualMode, finalContext);
      if (imageUrl) usedModel = "gemini-user";
    }

    // 2. Server Gemini key
    if (!imageUrl) {
      const serverKey = Deno.env.get("GEMINI_API_KEY");
      if (serverKey) {
        imageUrl = await generateWithGeminiDirect(serverKey, finalPrompt, visualMode, finalContext);
        if (imageUrl) usedModel = "gemini-server";
      }
    }

    // 3. Lovable AI Gateway
    if (!imageUrl) {
      imageUrl = await generateWithLovableGateway(finalPrompt, visualMode, finalContext);
      if (imageUrl) usedModel = "lovable-gateway";
    }

    // 4. Cloudflare Workers AI
    if (!imageUrl) {
      imageUrl = await generateWithCloudflare(finalPrompt, visualMode, finalContext);
      if (imageUrl) usedModel = "cloudflare-flux";
    }

    // 5. Pollinations flux-realism (best for realistic photos)
    if (!imageUrl) {
      imageUrl = await generateWithPollinationsRealism(finalPrompt, visualMode, finalContext);
      if (imageUrl) usedModel = "pollinations-realism";
    }

    // 6. Pollinations flux (default model)
    if (!imageUrl) {
      imageUrl = await generateWithPollinations(finalPrompt, visualMode, finalContext);
      if (imageUrl) usedModel = "pollinations-flux";
    }

    // 7. Pollinations turbo
    if (!imageUrl) {
      imageUrl = await generateWithPollinationsTurbo(finalPrompt, visualMode, finalContext);
      if (imageUrl) usedModel = "pollinations-turbo";
    }

    // 8. Pollinations flux-pro
    if (!imageUrl) {
      imageUrl = await generateWithPollinationsPro(finalPrompt, visualMode, finalContext);
      if (imageUrl) usedModel = "pollinations-pro";
    }

    // 9. Pollinations flux-anime (useful for diagrams)
    if (!imageUrl && (visualMode === "technical_diagram" || visualMode === "workflow_diagram")) {
      imageUrl = await generateWithPollinationsAnime(finalPrompt, visualMode, finalContext);
      if (imageUrl) usedModel = "pollinations-anime";
    }

    // 10. Wikimedia Commons
    if (!imageUrl) {
      imageUrl = await generateWithWikimediaCommons(finalPrompt, visualMode, finalContext);
      if (imageUrl) usedModel = "wikimedia";
    }

    // 11. Unsplash
    if (!imageUrl) {
      imageUrl = await generateWithUnsplash(finalPrompt);
      if (imageUrl) usedModel = "unsplash";
    }

    // 12. Lorem Picsum
    if (!imageUrl) {
      imageUrl = await generateWithLoremPicsum(finalPrompt);
      if (imageUrl) usedModel = "picsum";
    }

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "All image providers failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Upload base64 data URLs to storage
    if (imageUrl.startsWith("data:")) {
      imageUrl = await uploadDataUrlToStorage(imageUrl);
    }

    console.log(`[img] Success: ${usedModel} → ${imageUrl.substring(0, 80)}...`);
    return new Response(JSON.stringify({ imageUrl, model: usedModel }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[img] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
