import {
  PackageX,
  PackageCheck,
  Warehouse,
  ClipboardList,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRemovalShipments, type RemovalShipment } from "@/hooks/useRemovalShipments";
import { useInboundItems } from "@/hooks/useInboundItems";
import { useInventoryItems } from "@/hooks/useInventoryItems";
import { useOrders } from "@/hooks/useOrders";

export default function Dashboard() {
  const { data: shipments, isLoading: shipmentsLoading } = useRemovalShipments();
  const { data: inboundItems, isLoading: inboundLoading } = useInboundItems();
  const { data: inventory, isLoading: inventoryLoading } = useInventoryItems();
  const { data: orders, isLoading: ordersLoading } = useOrders();

  const isLoading = shipmentsLoading || inboundLoading || inventoryLoading || ordersLoading;

  const recentRemovals = (shipments || []).slice(0, 5);

  // Calculate stats
  const pendingShipments = (shipments || []).filter(
    (s) => s.status === "shipping" || s.status === "arrived"
  ).length;

  const pendingInbound = (shipments || []).filter(
    (s) => s.status === "arrived"
  ).length;

  const totalStock = (inventory || []).reduce(
    (acc, item) => acc + item.total_stock,
    0
  );

  const stockByGrade = (inventory || []).reduce(
    (acc, item) => ({
      gradeA: acc.gradeA + item.grade_a_stock,
      gradeB: acc.gradeB + item.grade_b_stock,
      gradeC: acc.gradeC + item.grade_c_stock,
    }),
    { gradeA: 0, gradeB: 0, gradeC: 0 }
  );

  const shippingCount = (shipments || []).filter(
    (s) => s.status === "shipping"
  ).length;

  const arrivedCount = (shipments || []).filter(
    (s) => s.status === "arrived"
  ).length;

  const todayShelved = (shipments || []).filter(
    (s) =>
      s.status === "shelved" &&
      new Date(s.updated_at).toDateString() === new Date().toDateString()
  ).length;

  const removalColumns = [
    { key: "order_id", header: "订单号" },
    { key: "product_name", header: "产品名称" },
    { key: "quantity", header: "数量" },
    {
      key: "status",
      header: "状态",
      render: (item: RemovalShipment) => <StatusBadge status={item.status} />,
    },
    {
      key: "created_at",
      header: "创建日期",
      render: (item: RemovalShipment) =>
        new Date(item.created_at).toLocaleDateString("zh-CN"),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader title="仪表盘" description="退货翻新系统概览" />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="待处理移除货件"
          value={pendingShipments}
          subtitle={`本周新增 ${(shipments || []).length} 件`}
          icon={PackageX}
          variant="primary"
          trend={{ value: 15, isPositive: true }}
        />
        <StatCard
          title="待入库处理"
          value={pendingInbound}
          subtitle="需要分级检验"
          icon={PackageCheck}
          variant="warning"
        />
        <StatCard
          title="总库存量"
          value={totalStock}
          subtitle={`${(inventory || []).length} 个SKU`}
          icon={Warehouse}
          variant="success"
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="本月订单"
          value={(orders || []).length}
          subtitle={`已完成 ${(orders || []).filter((o) => o.inbound_at).length} 单`}
          icon={ClipboardList}
          variant="info"
        />
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">库存分布</h3>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">A级翻新</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-info"
                    style={{
                      width: `${totalStock > 0 ? (stockByGrade.gradeA / totalStock) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium">{stockByGrade.gradeA}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">B级翻新</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-warning"
                    style={{
                      width: `${totalStock > 0 ? (stockByGrade.gradeB / totalStock) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium">{stockByGrade.gradeB}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">C级翻新</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-destructive"
                    style={{
                      width: `${totalStock > 0 ? (stockByGrade.gradeC / totalStock) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium">{stockByGrade.gradeC}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">待处理提醒</h3>
            <AlertCircle className="h-5 w-5 text-warning" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg bg-warning/10 p-3">
              <div className="h-2 w-2 rounded-full bg-warning" />
              <span className="text-sm">{arrivedCount} 件货物已到货等待入库</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-info/10 p-3">
              <div className="h-2 w-2 rounded-full bg-info" />
              <span className="text-sm">{shippingCount} 件货物正在运输中</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-3">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-sm">{(inboundItems || []).length} 件产品已完成质检分级</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-success/10 p-3">
              <div className="h-2 w-2 rounded-full bg-success" />
              <span className="text-sm">{todayShelved} 件产品今日已上架</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">最近移除货件</h3>
        <DataTable
          columns={removalColumns}
          data={recentRemovals}
          emptyMessage="暂无移除货件记录"
        />
      </div>
    </div>
  );
}
