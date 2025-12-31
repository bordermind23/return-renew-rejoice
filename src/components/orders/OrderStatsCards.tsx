import { Package, PackageCheck, Truck, BarChart3 } from "lucide-react";

interface OrderStats {
  total: number;
  pending: number;
  arrived: number;
  shipped: number;
}

interface OrderStatsCardsProps {
  stats: OrderStats;
}

export function OrderStatsCards({ stats }: OrderStatsCardsProps) {
  const cards = [
    {
      label: "总订单",
      value: stats.total,
      icon: BarChart3,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "未到货",
      value: stats.pending,
      icon: Package,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      label: "已到货",
      value: stats.arrived,
      icon: PackageCheck,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      label: "已出库",
      value: stats.shipped,
      icon: Truck,
      color: "text-info",
      bgColor: "bg-info/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex items-center gap-3 p-4 bg-card rounded-xl border transition-shadow hover:shadow-sm"
        >
          <div className={`p-2.5 rounded-lg ${card.bgColor}`}>
            <card.icon className={`h-5 w-5 ${card.color}`} />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{card.value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
