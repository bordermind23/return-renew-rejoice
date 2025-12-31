import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// 缓存翻译结果，避免重复请求
const translationCache = new Map<string, string>();

export function useTranslate(text: string | null | undefined) {
  const [translatedText, setTranslatedText] = useState<string>(text || "-");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const translate = async () => {
      if (!text || text.trim() === "" || text === "-") {
        setTranslatedText(text || "-");
        return;
      }

      // 检查缓存
      if (translationCache.has(text)) {
        setTranslatedText(translationCache.get(text)!);
        return;
      }

      // 检查是否已经是中文（简单判断）
      const chineseRegex = /[\u4e00-\u9fa5]/;
      if (chineseRegex.test(text) && text.length > 2) {
        setTranslatedText(text);
        translationCache.set(text, text);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("translate-text", {
          body: { text },
        });

        if (error) {
          console.error("Translation error:", error);
          setTranslatedText(text);
        } else {
          const result = data.translatedText || text;
          translationCache.set(text, result);
          setTranslatedText(result);
        }
      } catch (err) {
        console.error("Translation failed:", err);
        setTranslatedText(text);
      } finally {
        setIsLoading(false);
      }
    };

    translate();
  }, [text]);

  return { translatedText, isLoading };
}
