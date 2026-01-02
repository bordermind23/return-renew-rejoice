import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // Use Lovable AI gateway with Gemini model for OCR
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
            content: `你是一个物流面单识别专家。你的任务是从物流面单照片中识别出物流跟踪号。

物流面单上通常有多个条形码和二维码，你需要识别出正确的物流跟踪号。

常见的物流跟踪号格式:
- 亚马逊FBA跟踪号通常以数字开头，如 166114969534313
- UPS跟踪号: 1Z开头
- FedEx跟踪号: 12-34位数字
- DHL跟踪号: 10位数字或字母数字组合
- 顺丰: SF开头
- 中通: 75开头
- 圆通: YT开头
- 韵达: 数字开头

请只返回识别到的物流跟踪号，不要包含其他文字。如果识别到多个可能的跟踪号，用逗号分隔返回。如果无法识别，返回空字符串。`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "请识别这张物流面单照片中的物流跟踪号。只返回跟踪号，不需要其他解释。"
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
        temperature: 0.1,
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
    const trackingNumbers = recognizedText
      .split(/[,，\n]/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length >= 8 && /^[A-Za-z0-9]+$/.test(s));

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
