import { cn } from "@/lib/utils";
import { Truck, PackageCheck, Package, CheckCircle, Clock, Archive } from "lucide-react";

type StatusType = "shipping" | "arrived" | "inbound" | "shelved" | "pending" | "completed";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  showIcon?: boolean;
}

const statusConfig: Record<StatusType, { 
  label: string; 
  className: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  shipping: {
    label: "发货中",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    icon: Truck,
  },
  arrived: {
    label: "到货",
    className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
    icon: Package,
  },
  inbound: {
    label: "入库",
    className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    icon: PackageCheck,
  },
  shelved: {
    label: "上架",
    className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
    icon: Archive,
  },
  pending: {
    label: "待处理",
    className: "bg-muted text-muted-foreground border-border",
    icon: Clock,
  },
  completed: {
    label: "已完成",
    className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
    icon: CheckCircle,
  },
};

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium",
        "transition-colors",
        config.className,
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </span>
  );
}
