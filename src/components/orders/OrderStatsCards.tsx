import { Package, PackageCheck, Truck, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderStats {
  total: number;
  pending: number;
  arrived: number;
  shipped: number;
}

type StatusFilter = "未到货" | "到货" | "出库" | null;

interface OrderStatsCardsProps {
  stats: OrderStats;
  activeFilter?: StatusFilter;
  onFilterClick?: (filter: StatusFilter) => void;
}

export function OrderStatsCards({ stats, activeFilter, onFilterClick }: OrderStatsCardsProps) {
  const cards: {
    label: string;
    value: number;
    icon: typeof Package;
    color: string;
    bgColor: string;
    filter: StatusFilter;
  }[] = [
    {
      label: "总订单",
      value: stats.total,
      icon: BarChart3,
      color: "text-primary",
      bgColor: "bg-primary/10",
      filter: null,
    },
    {
      label: "未到货",
      value: stats.pending,
      icon: Package,
      color: "text-warning",
      bgColor: "bg-warning/10",
      filter: "未到货",
    },
    {
      label: "已到货",
      value: stats.arrived,
      icon: PackageCheck,
      color: "text-success",
      bgColor: "bg-success/10",
      filter: "到货",
    },
    {
      label: "已出库",
      value: stats.shipped,
      icon: Truck,
      color: "text-info",
      bgColor: "bg-info/10",
      filter: "出库",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
      {cards.map((card) => {
        const isActive = activeFilter === card.filter || (activeFilter === null && card.filter === null);
        const isClickable = onFilterClick && card.filter !== null;
        
        return (
          <button
            key={card.label}
            onClick={() => isClickable && onFilterClick(card.filter === activeFilter ? null : card.filter)}
            disabled={!isClickable}
            className={cn(
              "flex items-center gap-2 sm:gap-3 p-2.5 sm:p-4 bg-card rounded-xl border transition-all text-left",
              isClickable && "cursor-pointer hover:shadow-md hover:border-primary/30 active:scale-[0.98]",
              isActive && card.filter !== null && "ring-2 ring-primary/30 border-primary/50",
              !isClickable && "cursor-default"
            )}
          >
            <div className={cn("p-1.5 sm:p-2.5 rounded-lg transition-colors", card.bgColor)}>
              <card.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", card.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold tabular-nums truncate">{card.value.toLocaleString()}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{card.label}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
