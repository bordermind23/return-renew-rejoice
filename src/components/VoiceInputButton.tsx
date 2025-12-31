import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export const VoiceInputButton = ({
  onTranscript,
  disabled = false,
  className,
}: VoiceInputButtonProps) => {
  const { isListening, isSupported, toggleListening } = useSpeechToText({
    onResult: (text) => {
      onTranscript(text);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  if (!isSupported) {
    return null;
  }

  return (
    <Button
      type="button"
      variant={isListening ? "destructive" : "outline"}
      size="sm"
      onClick={toggleListening}
      disabled={disabled}
      className={cn(
        "gap-1.5 transition-all",
        isListening && "animate-pulse",
        className
      )}
    >
      {isListening ? (
        <>
          <MicOff className="h-4 w-4" />
          停止录音
        </>
      ) : (
        <>
          <Mic className="h-4 w-4" />
          语音输入
        </>
      )}
    </Button>
  );
};
