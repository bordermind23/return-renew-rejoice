import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check - require valid user session
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("Authentication failed:", authError?.message || "Invalid token");
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);

    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      console.error("No image provided");
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 验证和清理图片数据
    let cleanImageUrl = imageBase64;
    
    // 检查是否是有效的 data URL
    if (imageBase64.startsWith("data:")) {
      // 验证 data URL 格式
      const dataUrlRegex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
      if (!dataUrlRegex.test(imageBase64)) {
        console.error("Invalid data URL format");
        return new Response(
          JSON.stringify({ error: "Invalid image format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      cleanImageUrl = imageBase64;
    } else {
      // 如果是纯 base64，添加前缀
      cleanImageUrl = `data:image/jpeg;base64,${imageBase64}`;
    }

    // 验证 base64 数据长度
    const base64Part = cleanImageUrl.split(",")[1];
    if (!base64Part || base64Part.length < 100) {
      console.error("Image data too small or invalid");
      return new Response(
        JSON.stringify({ error: "Image data invalid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Received image for tracking recognition, size:", Math.round(base64Part.length / 1024), "KB");

    // Use Lovable AI gateway with Gemini Flash model for better OCR accuracy
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `你是一个专业的物流面单识别系统。请识别图片中的物流跟踪号，包括：
1. 条形码下方或旁边的数字/字母组合
2. 二维码（QR Code）中包含的跟踪号信息
3. 任何明显标注的跟踪号、运单号、快递单号

注意事项：
- 图片可能有阴影、光照不均或拍摄角度问题，请尽力识别
- 如果QR码包含URL，请提取其中的跟踪号部分
- 优先识别主要的物流跟踪号

常见格式参考：
- UPS: 1Z开头+16位字母数字（如1ZV8K8976840784249）
- FedEx: 12-34位纯数字
- 亚马逊FBA: 15位数字（如166114969534313）
- DHL: 10位数字
- 顺丰: SF开头+12位数字
- 中通: 75/73开头+12位数字
- 圆通: YT开头+15位数字
- 德邦: DPK开头
- 韵达: 13位数字

只返回识别到的跟踪号，多个用逗号分隔。如果无法识别，返回空字符串。`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "请识别这张物流面单图片中的跟踪号（包括条形码和二维码）"
              },
              {
                type: "image_url",
                image_url: {
                  url: cleanImageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 200,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to recognize tracking number", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const recognizedText = data.choices?.[0]?.message?.content?.trim() || "";

    console.log("Recognized tracking numbers:", recognizedText);

    // Parse the response to extract tracking numbers
    // Normalize: remove spaces and non-alphanumeric chars (common in OCR like "1Z K45 ...")
    const trackingNumbers = recognizedText
      .split(/[,，\n]/)
      .map((s: string) => s.trim())
      .filter(Boolean)
      .map((s: string) => s.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
      .filter((s: string) => s.length >= 8 && /^[A-Z0-9]+$/.test(s));

    return new Response(
      JSON.stringify({ 
        success: true,
        trackingNumbers,
        rawText: recognizedText
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in recognize-tracking function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
