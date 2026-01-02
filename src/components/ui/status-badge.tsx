import { cn } from "@/lib/utils";

type StatusType = "shipping" | "arrived" | "inbound" | "shelved" | "pending" | "completed" | "未到货" | "入库";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  shipping: {
    label: "发货中",
    className: "bg-info/10 text-info border-info/20",
  },
  arrived: {
    label: "到货",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  inbound: {
    label: "入库",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  shelved: {
    label: "上架",
    className: "bg-success/10 text-success border-success/20",
  },
  pending: {
    label: "待处理",
    className: "bg-muted text-muted-foreground border-border",
  },
  completed: {
    label: "已完成",
    className: "bg-success/10 text-success border-success/20",
  },
  "未到货": {
    label: "未到货",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  "入库": {
    label: "入库",
    className: "bg-success/10 text-success border-success/20",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config?.className,
        className
      )}
    >
      {config?.label || status}
    </span>
  );
}
