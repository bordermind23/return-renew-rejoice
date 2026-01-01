import { cn } from "@/lib/utils";

type GradeType = "A" | "B" | "C" | "new";

interface GradeBadgeProps {
  grade: GradeType | string;
  className?: string;
  size?: "sm" | "default" | "lg";
}

const gradeConfig: Record<string, { label: string; className: string }> = {
  A: {
    label: "A级",
    className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  B: {
    label: "B级",
    className: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  },
  C: {
    label: "C级",
    className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  },
  new: {
    label: "全新",
    className: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
  },
};

const sizeStyles = {
  sm: "px-1.5 py-0.5 text-[10px]",
  default: "px-2 py-0.5 text-xs",
  lg: "px-2.5 py-1 text-sm",
};

export function GradeBadge({ grade, className, size = "default" }: GradeBadgeProps) {
  const config = gradeConfig[grade] || {
    label: grade,
    className: "bg-muted text-muted-foreground border-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold border",
        "transition-colors",
        config.className,
        sizeStyles[size],
        className
      )}
    >
      {config.label}
    </span>
  );
}
