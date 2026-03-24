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

async function runTextTask(system: string, user: string): Promise<string | null> {
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
        const t = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || "").join(" ").trim();
        if (t) return t;
      }
    } catch {}
  }
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
      if (res.ok) { const d = await res.json(); return d.choices?.[0]?.message?.content?.trim() || null; }
    } catch {}
  }
  return null;
}

async function translateToEnglish(text: string): Promise<string> {
  if (!containsArabic(text)) return text;
  try {
    const r = await runTextTask("Translate to precise English for image generation. Return ONLY the translation.", text);
    if (r) { console.log(`[img] Translated`); return r; }
  } catch {}
  return text;
}

function detectVisualMode(prompt: string, context?: string): VisualMode {
  const t = `${prompt} ${context || ""}`.toLowerCase();
  if (/(bar chart|line chart|pie chart|histogram|graph|trend|comparison chart)/.test(t)) return "chart_infographic";
  if (/(world map|regional map|heat map|geographic|global distribution)/.test(t)) return "map_infographic";
  if (/(workflow|flowchart|process flow|sequence diagram|pipeline)/.test(t)) return "workflow_diagram";
  if (/(interface|dashboard|mobile app|web app|screen|control panel|ui|ux)/.test(t)) return "ui_mockup";
  if (/(diagram|architecture|block diagram|schematic|circuit|topology|framework)/.test(t)) return "technical_diagram";
  return "photo";
}

function buildPrompt(prompt: string, context?: string, visualMode: VisualMode = "photo"): string {
  const ctx = context ? ` Context: "${context}".` : "";
  const rules: Record<VisualMode, string> = {
    photo: `Generate a single ultra-realistic photograph of: "${prompt}".${ctx} Professional DSLR quality, sharp focus, natural lighting. NO text/labels/watermarks. NO cartoon/painting. Clean professional composition.`,
    technical_diagram: `Generate a clean precise technical diagram of: "${prompt}".${ctx} Professional engineering quality, white background. NO text/labels. NO decorative elements.`,
    workflow_diagram: `Generate a clean process visualization of: "${prompt}".${ctx} Organized layout, white background. NO text/labels.`,
    map_infographic: `Generate a clean geographic visualization of: "${prompt}".${ctx} Color-coded highlighting. NO text/labels.`,
    chart_infographic: `Generate a clean data visualization of: "${prompt}".${ctx} Visual proportions only. NO text/numbers.`,
    ui_mockup: `Generate a realistic modern interface mockup of: "${prompt}".${ctx} Contemporary UI/UX design. Minimal text.`,
  };
  return rules[visualMode];
}

// ─── Storage ────────────────────────────────────────────────────

function getSupabaseAdmin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function uploadBytes(bytes: Uint8Array, contentType = "image/png"): Promise<string> {
  const supabase = getSupabaseAdmin();
  const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
  const path = `generated/img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("research-images").upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return supabase.storage.from("research-images").getPublicUrl(path).data.publicUrl;
}

async function uploadDataUrl(dataUrl: string): Promise<string> {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL");
  return uploadBytes(Uint8Array.from(atob(m[2]), c => c.charCodeAt(0)), m[1]);
}

async function fetchAndUpload(url: string, timeout = 30000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "LovableBot/1.0", Accept: "image/*" } });
    clearTimeout(timer);
    if (!res.ok) { console.error(`[img] fetch ${res.status} for ${url.substring(0, 80)}`); return null; }
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) { console.error(`[img] Not image: ${ct}`); return null; }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength < 1000) { console.error(`[img] Too small: ${bytes.byteLength}`); return null; }
    return await uploadBytes(bytes, ct);
  } catch (e) { console.error(`[img] fetchAndUpload error:`, e); return null; }
}

// ─── Provider 1: Gemini Direct ──────────────────────────────────

async function tryGeminiDirect(apiKey: string, prompt: string, vm: VisualMode, ctx?: string): Promise<string | null> {
  for (const model of ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"]) {
    console.log(`[img] Gemini: ${model}`);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: buildPrompt(prompt, ctx, vm) }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
      });
      if (!res.ok) { console.error(`[img] ${model}: ${res.status}`); continue; }
      const data = await res.json();
      for (const part of data?.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
      }
    } catch (e) { console.error(`[img] ${model}:`, e); }
  }
  return null;
}

// ─── Provider 2: Lovable AI Gateway ─────────────────────────────

async function tryLovableGateway(prompt: string, vm: VisualMode, ctx?: string): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  for (const model of ["google/gemini-3.1-flash-image-preview", "google/gemini-3-pro-image-preview", "google/gemini-2.5-flash-image"]) {
    console.log(`[img] Gateway: ${model}`);
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: buildPrompt(prompt, ctx, vm) }], modalities: ["image", "text"] }),
      });
      if (!res.ok) { console.error(`[img] Gateway ${model}: ${res.status}`); continue; }
      const data = await res.json();
      const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (url) return url;
    } catch (e) { console.error(`[img] Gateway ${model}:`, e); }
  }
  return null;
}

// ─── Provider 3: Cloudflare Workers AI ──────────────────────────

async function tryCloudflare(prompt: string, vm: VisualMode, ctx?: string): Promise<string | null> {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
  if (!accountId || !apiToken) { console.log("[img] No Cloudflare creds"); return null; }
  
  const models = ["@cf/black-forest-labs/flux-1-schnell", "@cf/stabilityai/stable-diffusion-xl-base-1.0"];
  for (const model of models) {
    console.log(`[img] Cloudflare: ${model}`);
    try {
      const body: any = { prompt: buildPrompt(prompt, ctx, vm) };
      if (model.includes("flux")) {
        body.steps = 8;
        body.seed = Math.floor(Math.random() * 1000000);
        body.width = 1024;
        body.height = 768;
      } else {
        body.num_steps = 20;
      }
      
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) { 
        const errText = await res.text();
        console.error(`[img] CF ${model}: ${res.status} ${errText.substring(0, 200)}`); 
        continue; 
      }
      
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("image/")) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.byteLength > 1000) return await uploadBytes(bytes, ct);
      } else {
        const data = await res.json();
        const b64 = data?.result?.image;
        if (typeof b64 === "string" && b64.length > 100) {
          return await uploadDataUrl(`data:image/png;base64,${b64}`);
        }
        console.error(`[img] CF ${model}: unexpected response`, JSON.stringify(data).substring(0, 200));
      }
    } catch (e) { console.error(`[img] CF ${model}:`, e); }
  }
  return null;
}

// ─── Provider 4-7: Pollinations.ai (multiple models) ────────────

async function tryPollinations(prompt: string, vm: VisualMode, ctx?: string): Promise<string | null> {
  const hint: Record<VisualMode, string> = {
    photo: "ultra realistic professional photo",
    technical_diagram: "clean technical visualization, white background",
    workflow_diagram: "clean process diagram",
    map_infographic: "geographic infographic",
    chart_infographic: "data visualization",
    ui_mockup: "modern interface mockup",
  };
  
  const models = ["flux", "turbo", "flux-realism", "flux-pro"];
  const full = [prompt, ctx ? `related to ${ctx}` : "", hint[vm], "high detail, no text, no watermark"].filter(Boolean).join(", ").substring(0, 200);
  
  for (const model of models) {
    console.log(`[img] Pollinations: ${model}`);
    const seed = Math.floor(Math.random() * 100000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}?width=1024&height=768&nologo=true&enhance=true&model=${model}&seed=${seed}`;
    const result = await fetchAndUpload(url, 25000);
    if (result) return result;
  }
  return null;
}

// ─── Strict no-random-fallback mode ─────────────────────────────

function buildNoMatchErrorMessage(isArabicRequest: boolean): string {
  return isArabicRequest
    ? "تعذر توليد صورة مطابقة للوصف. تم تعطيل أي صور عشوائية أو بديلة غير مرتبطة بالموضوع، لذلك لن يتم إدراج صورة إلا إذا كانت ناتجة فعلاً من الوصف المطلوب."
    : "Could not generate an image that matches the prompt. Random or loosely related fallback images are disabled, so no image will be returned unless it is actually generated from the requested description.";
}

// ─── Main ───────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, geminiApiKey, model, context } = await req.json();
    if (!prompt) return new Response(JSON.stringify({ error: "Missing prompt" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const isArabicRequest = containsArabic(prompt) || containsArabic(context || "");
    const generationMode = model === "pro" ? "pro" : "standard";
    const finalPrompt = await translateToEnglish(prompt);
    const finalContext = context ? await translateToEnglish(context) : "";
    const vm = detectVisualMode(finalPrompt, finalContext);
    console.log(`[img] Mode: ${vm} | Quality: ${generationMode} | "${finalPrompt.substring(0, 80)}"`);

    let imageUrl: string | null = null;
    let usedModel = "unknown";

    // 1. User Gemini key
    if (geminiApiKey) {
      imageUrl = await tryGeminiDirect(geminiApiKey, finalPrompt, vm, finalContext);
      if (imageUrl) usedModel = "gemini-user";
    }

    // 2. Server Gemini key
    if (!imageUrl) {
      const sk = Deno.env.get("GEMINI_API_KEY");
      if (sk) {
        imageUrl = await tryGeminiDirect(sk, finalPrompt, vm, finalContext);
        if (imageUrl) usedModel = "gemini-server";
      }
    }

    // 3. Lovable AI Gateway
    if (!imageUrl) {
      imageUrl = await tryLovableGateway(finalPrompt, vm, finalContext);
      if (imageUrl) usedModel = "lovable-gateway";
    }

    // 4. Cloudflare Workers AI
    if (!imageUrl) {
      imageUrl = await tryCloudflare(finalPrompt, vm, finalContext);
      if (imageUrl) usedModel = "cloudflare";
    }

    // 5. Pollinations prompt-based generation
    if (!imageUrl) {
      imageUrl = await tryPollinations(finalPrompt, vm, finalContext);
      if (imageUrl) usedModel = "pollinations";
    }

    if (!imageUrl) {
      return new Response(JSON.stringify({
        error: buildNoMatchErrorMessage(isArabicRequest),
        code: "NO_PROMPT_MATCHED_IMAGE",
        randomFallbacksDisabled: true,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (imageUrl.startsWith("data:")) imageUrl = await uploadDataUrl(imageUrl);

    console.log(`[img] ✓ ${usedModel}`);
    return new Response(JSON.stringify({ imageUrl, model: usedModel }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[img] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
