import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "info" | "destructive";
  onClick?: () => void;
  className?: string;
}

const variantStyles = {
  default: "bg-card border hover:border-primary/30",
  primary: "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 hover:border-primary/40",
  success: "bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border-green-500/20 hover:border-green-500/40",
  warning: "bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-transparent border-yellow-500/20 hover:border-yellow-500/40",
  info: "bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20 hover:border-blue-500/40",
  destructive: "bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent border-destructive/20 hover:border-destructive/40",
};

const iconStyles = {
  default: "bg-primary/10 text-primary",
  primary: "bg-primary/15 text-primary",
  success: "bg-green-500/15 text-green-600 dark:text-green-400",
  warning: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  info: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  destructive: "bg-destructive/15 text-destructive",
};

const valueStyles = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-green-600 dark:text-green-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  info: "text-blue-600 dark:text-blue-400",
  destructive: "text-destructive",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  onClick,
  className,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-0.5",
        onClick && "cursor-pointer",
        variantStyles[variant],
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-current opacity-5 blur-2xl transition-transform duration-500 group-hover:scale-150" />
      
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">
            {title}
          </p>
          <p className={cn(
            "text-3xl font-bold tracking-tight",
            valueStyles[variant]
          )}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground/80 mt-1">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className="flex items-center gap-1.5 text-xs mt-2">
              <span className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
                trend.isPositive 
                  ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                  : "bg-destructive/10 text-destructive"
              )}>
                {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
              <span className="text-muted-foreground">较上周</span>
            </div>
          )}
        </div>
        <div className={cn(
          "rounded-xl p-2.5 transition-transform duration-300 group-hover:scale-110",
          iconStyles[variant]
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
