import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScanFeedbackType = "success" | "error" | "warning" | null;

interface ScanFeedbackOverlayProps {
  type: ScanFeedbackType;
  message?: string;
  onComplete?: () => void;
  duration?: number;
}

export function ScanFeedbackOverlay({ 
  type, 
  message, 
  onComplete,
  duration = 1200
}: ScanFeedbackOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (type) {
      setIsVisible(true);
      setIsExiting(false);
      
      const exitTimer = setTimeout(() => {
        setIsExiting(true);
      }, duration - 300);
      
      const completeTimer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, duration);

      return () => {
        clearTimeout(exitTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [type, duration, onComplete]);

  if (!isVisible || !type) return null;

  const config = {
    success: {
      icon: CheckCircle,
      bgColor: "bg-green-500",
      ringColor: "ring-green-400/50",
      iconColor: "text-white",
      pulseColor: "bg-green-400",
    },
    error: {
      icon: XCircle,
      bgColor: "bg-destructive",
      ringColor: "ring-destructive/50",
      iconColor: "text-white",
      pulseColor: "bg-red-400",
    },
    warning: {
      icon: AlertTriangle,
      bgColor: "bg-amber-500",
      ringColor: "ring-amber-400/50",
      iconColor: "text-white",
      pulseColor: "bg-amber-400",
    },
  };

  const { icon: Icon, bgColor, ringColor, iconColor, pulseColor } = config[type];

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm",
        "transition-opacity duration-300",
        isExiting ? "opacity-0" : "opacity-100"
      )}
    >
      <div 
        className={cn(
          "relative flex flex-col items-center gap-4",
          "transition-all duration-300",
          isExiting ? "scale-90 opacity-0" : "scale-100 opacity-100"
        )}
      >
        {/* Pulse ring animation */}
        <div className="relative">
          <div 
            className={cn(
              "absolute inset-0 rounded-full animate-ping opacity-30",
              pulseColor
            )}
            style={{ 
              width: "120px", 
              height: "120px",
              animationDuration: "0.8s",
              animationIterationCount: "2"
            }}
          />
          <div 
            className={cn(
              "absolute inset-0 rounded-full animate-pulse opacity-20",
              pulseColor
            )}
            style={{ 
              width: "150px", 
              height: "150px",
              marginLeft: "-15px",
              marginTop: "-15px"
            }}
          />
          
          {/* Main icon container */}
          <div 
            className={cn(
              "relative h-[120px] w-[120px] rounded-full flex items-center justify-center",
              "ring-4 shadow-2xl",
              bgColor,
              ringColor,
              "animate-scale-in"
            )}
          >
            <Icon 
              className={cn(
                "h-16 w-16",
                iconColor,
                type === "success" && "animate-bounce-check"
              )} 
              strokeWidth={2.5}
            />
          </div>
        </div>

        {/* Message */}
        {message && (
          <p 
            className={cn(
              "text-lg font-semibold text-foreground text-center max-w-[250px]",
              "animate-fade-in"
            )}
            style={{ animationDelay: "100ms" }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
