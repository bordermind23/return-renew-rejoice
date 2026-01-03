import { cn } from "@/lib/utils";
import type { CaseStatus } from "@/hooks/useCases";
import { caseStatusLabels } from "@/hooks/useCases";

interface CaseStatusBadgeProps {
  status: CaseStatus;
  className?: string;
}

const statusConfig: Record<CaseStatus, { className: string }> = {
  pending: {
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
  },
  submitted: {
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  in_progress: {
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  approved: {
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  rejected: {
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  closed: {
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  },
  voided: {
    className: 'bg-gray-200 text-gray-500 dark:bg-gray-700/50 dark:text-gray-500 line-through',
  },
};

export function CaseStatusBadge({ status, className }: CaseStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium",
        config.className,
        className
      )}
    >
      {caseStatusLabels[status]}
    </span>
  );
}
