import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/hooks/useOrders";

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  '未到货': {
    label: '未到货',
    className: 'text-yellow-600 dark:text-yellow-400',
  },
  '到货': {
    label: '入库',
    className: 'text-blue-600 dark:text-blue-400',
  },
  '出库': {
    label: '出库',
    className: 'text-green-600 dark:text-green-400',
  },
  '待同步': {
    label: '待同步',
    className: 'text-orange-600 dark:text-orange-400',
  },
};

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig['未到货'];
  
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
