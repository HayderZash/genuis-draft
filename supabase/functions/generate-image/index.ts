import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function generateWithLovableGateway(apiKey: string, prompt: string): Promise<string | null> {
  const models = ["google/gemini-3.1-flash-image-preview", "google/gemini-2.5-flash-image", "google/gemini-3-pro-image-preview"];
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
          messages: [{ role: "user", content: `Generate a professional academic illustration: ${prompt}` }],
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

async function generateWithPollinations(prompt: string): Promise<string | null> {
  console.log("[generate-image] Trying Pollinations.ai (free)");
  try {
    const encodedPrompt = encodeURIComponent(`Professional academic illustration: ${prompt}, clean, high quality, suitable for research paper`);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=600&nologo=true&seed=${Date.now()}`;
    
    // Verify the URL works by doing a HEAD request
    const check = await fetch(imageUrl, { method: "GET", redirect: "follow" });
    if (check.ok) {
      console.log("[generate-image] Pollinations.ai success");
      return imageUrl;
    }
    console.error(`[generate-image] Pollinations check failed: ${check.status}`);
  } catch (e) {
    console.error("[generate-image] Pollinations error:", e);
  }
  return null;
}

async function generateWithGeminiDirect(apiKey: string, prompt: string): Promise<string | null> {
  // Use imagen model for image generation
  const models = ["gemini-2.0-flash-exp"];
  for (const model of models) {
    console.log(`[generate-image] Trying Gemini direct: ${model}`);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate a professional academic illustration: ${prompt}` }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      });
      if (!res.ok) {
        console.error(`[generate-image] ${model}: ${res.status}`);
        continue;
      }
      const data = await res.json();
      for (const part of (data?.candidates?.[0]?.content?.parts || [])) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    } catch (e) {
      console.error(`[generate-image] ${model} error:`, e);
    }
  }
  return null;
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
    return base64Url;
  }

  const { data: publicUrlData } = supabase.storage.from("research-images").getPublicUrl(filePath);
  return publicUrlData.publicUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, geminiApiKey } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imageUrl: string | null = null;
    let usedModel = "unknown";

    // Strategy 1: User Gemini key
    if (geminiApiKey) {
      imageUrl = await generateWithGeminiDirect(geminiApiKey, prompt);
      if (imageUrl) usedModel = "gemini-direct-user";
    }

    // Strategy 2: Server Gemini key
    if (!imageUrl) {
      const serverKey = Deno.env.get("GEMINI_API_KEY");
      if (serverKey) {
        imageUrl = await generateWithGeminiDirect(serverKey, prompt);
        if (imageUrl) usedModel = "gemini-direct-server";
      }
    }

    // Strategy 3: Lovable Gateway
    if (!imageUrl) {
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableKey) {
        imageUrl = await generateWithLovableGateway(lovableKey, prompt);
        if (imageUrl) usedModel = "lovable-gateway";
      }
    }

    // Strategy 4: Pollinations.ai (FREE, no API key needed)
    if (!imageUrl) {
      imageUrl = await generateWithPollinations(prompt);
      if (imageUrl) usedModel = "pollinations-free";
    }

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Image generation failed - all providers exhausted" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload base64 to storage if needed
    if (imageUrl.startsWith("data:")) {
      imageUrl = await uploadToStorage(imageUrl);
    }

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
