import { cn } from "@/lib/utils";
import { Truck, Package, PackageCheck, RefreshCw } from "lucide-react";
import type { OrderStatus } from "@/hooks/useOrders";

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "default" | "lg";
}

const statusConfig: Record<OrderStatus, { 
  label: string; 
  className: string;
  bgClassName: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  '未到货': {
    label: '未到货',
    className: 'text-yellow-600 dark:text-yellow-400',
    bgClassName: 'bg-yellow-500/10 border-yellow-500/30',
    icon: Truck,
  },
  '到货': {
    label: '到货',
    className: 'text-blue-600 dark:text-blue-400',
    bgClassName: 'bg-blue-500/10 border-blue-500/30',
    icon: Package,
  },
  '出库': {
    label: '出库',
    className: 'text-green-600 dark:text-green-400',
    bgClassName: 'bg-green-500/10 border-green-500/30',
    icon: PackageCheck,
  },
  '待同步': {
    label: '待同步',
    className: 'text-orange-600 dark:text-orange-400',
    bgClassName: 'bg-orange-500/10 border-orange-500/30',
    icon: RefreshCw,
  },
};

const sizeStyles = {
  sm: "px-1.5 py-0.5 text-[10px] gap-1",
  default: "px-2 py-1 text-xs gap-1.5",
  lg: "px-3 py-1.5 text-sm gap-2",
};

const iconSizeStyles = {
  sm: "h-3 w-3",
  default: "h-3.5 w-3.5",
  lg: "h-4 w-4",
};

export function OrderStatusBadge({ 
  status, 
  className, 
  showIcon = true,
  size = "default" 
}: OrderStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig['未到货'];
  const Icon = config.icon;
  
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-medium rounded-lg border",
        "transition-colors",
        config.className,
        config.bgClassName,
        sizeStyles[size],
        className
      )}
    >
      {showIcon && <Icon className={iconSizeStyles[size]} />}
      {config.label}
    </span>
  );
}
