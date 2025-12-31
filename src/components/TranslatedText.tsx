import { useTranslate } from "@/hooks/useTranslate";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TranslatedTextProps {
  text: string | null | undefined;
  className?: string;
}

export function TranslatedText({ text, className }: TranslatedTextProps) {
  const { translatedText, isLoading } = useTranslate(text);

  if (isLoading) {
    return (
      <span className={cn("inline-flex items-center gap-1", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-muted-foreground">翻译中...</span>
      </span>
    );
  }

  return <span className={className}>{translatedText}</span>;
}
