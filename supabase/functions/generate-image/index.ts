import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODELS: Record<string, string> = {
  "stable-diffusion-xl": "@cf/stabilityai/stable-diffusion-xl-base-1.0",
  "flux-1-schnell": "@cf/black-forest-labs/flux-1-schnell",
  "dreamshaper": "@cf/lykon/dreamshaper-8-lcm",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, model: modelKey } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");

    if (!accountId || !apiToken) {
      return new Response(JSON.stringify({ error: "Cloudflare credentials not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedModel = MODELS[modelKey || "stable-diffusion-xl"] || MODELS["stable-diffusion-xl"];
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${selectedModel}`;

    const enhancedPrompt = `${prompt}, professional studio photography, cinematic lighting, 8k resolution, hyper-realistic, clean background, commercial quality`;

    const body: Record<string, unknown> = { prompt: enhancedPrompt };
    
    // flux-1-schnell uses num_steps
    if (modelKey === "flux-1-schnell") {
      body.num_steps = 8;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("Cloudflare error:", response.status, errText);
      return new Response(JSON.stringify({ error: `Image generation failed: ${response.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cloudflare returns raw image bytes
    const imageBytes = new Uint8Array(await response.arrayBuffer());
    
    // Convert to base64 in chunks to avoid stack overflow
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < imageBytes.length; i += chunkSize) {
      const chunk = imageBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);
    const imageUrl = `data:image/png;base64,${base64}`;

    return new Response(JSON.stringify({ imageUrl, model: selectedModel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
