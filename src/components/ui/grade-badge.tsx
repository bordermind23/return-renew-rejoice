import { cn } from "@/lib/utils";

type GradeType = "A" | "B" | "C";

interface GradeBadgeProps {
  grade: GradeType;
  className?: string;
}

const gradeConfig: Record<GradeType, { label: string; className: string }> = {
  A: {
    label: "A级",
    className: "bg-info text-info-foreground",
  },
  B: {
    label: "B级",
    className: "bg-warning text-warning-foreground",
  },
  C: {
    label: "C级",
    className: "bg-destructive text-destructive-foreground",
  },
};

export function GradeBadge({ grade, className }: GradeBadgeProps) {
  const config = gradeConfig[grade];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
