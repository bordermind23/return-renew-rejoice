import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  badge?: ReactNode;
}

export function PageHeader({ title, description, actions, className, badge }: PageHeaderProps) {
  return (
    <div className={cn(
      "mb-4 lg:mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
      className
    )}>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-xs lg:text-sm text-muted-foreground max-w-xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
