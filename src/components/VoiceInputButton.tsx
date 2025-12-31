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

const SoundWaveAnimation = () => (
  <div className="flex items-center gap-0.5 h-4">
    {[1, 2, 3, 4].map((i) => (
      <span
        key={i}
        className="w-0.5 bg-white rounded-full animate-pulse"
        style={{
          height: `${Math.random() * 50 + 50}%`,
          animationDelay: `${i * 0.1}s`,
          animationDuration: `${0.3 + i * 0.1}s`,
        }}
      />
    ))}
  </div>
);

const LiveSoundWave = () => (
  <div className="flex items-center gap-0.5 h-4">
    <span className="w-0.5 bg-white rounded-full animate-[soundwave_0.5s_ease-in-out_infinite]" style={{ animationDelay: "0s" }} />
    <span className="w-0.5 bg-white rounded-full animate-[soundwave_0.5s_ease-in-out_infinite]" style={{ animationDelay: "0.1s" }} />
    <span className="w-0.5 bg-white rounded-full animate-[soundwave_0.5s_ease-in-out_infinite]" style={{ animationDelay: "0.2s" }} />
    <span className="w-0.5 bg-white rounded-full animate-[soundwave_0.5s_ease-in-out_infinite]" style={{ animationDelay: "0.3s" }} />
  </div>
);

export const VoiceInputButton = ({
  onTranscript,
  disabled = false,
  className,
}: VoiceInputButtonProps) => {
  const { isListening, isSupported, toggleListening, transcript } = useSpeechToText({
    onResult: (text) => {
      onTranscript(text);
      toast.success("语音已识别");
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
        "gap-1.5 transition-all duration-200 min-w-[100px]",
        isListening && "shadow-lg shadow-destructive/30",
        className
      )}
    >
      {isListening ? (
        <>
          <LiveSoundWave />
          <span className="ml-1">录音中...</span>
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
