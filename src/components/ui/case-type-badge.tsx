import { cn } from "@/lib/utils";
import type { CaseType } from "@/hooks/useCases";
import { caseTypeLabels } from "@/hooks/useCases";
import { Package, AlertTriangle, Wrench, XCircle, HelpCircle } from "lucide-react";

interface CaseTypeBadgeProps {
  type: CaseType;
  className?: string;
  showIcon?: boolean;
}

const typeConfig: Record<CaseType, { className: string; icon: typeof Package }> = {
  lpn_missing: {
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    icon: Package,
  },
  sku_mismatch: {
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    icon: AlertTriangle,
  },
  accessory_missing: {
    className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
    icon: Wrench,
  },
  product_damaged: {
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle,
  },
  other: {
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
    icon: HelpCircle,
  },
};

export function CaseTypeBadge({ type, className, showIcon = true }: CaseTypeBadgeProps) {
  const config = typeConfig[type] || typeConfig.other;
  const Icon = config.icon;
  
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        config.className,
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {caseTypeLabels[type]}
    </span>
  );
}
