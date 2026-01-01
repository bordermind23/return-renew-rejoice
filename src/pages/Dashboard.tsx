import {
  PackageX,
  PackageCheck,
  Warehouse,
  ClipboardList,
  TrendingUp,
  AlertCircle,
  Package,
  Truck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useInboundItems } from "@/hooks/useInboundItems";
import { useInventoryItems } from "@/hooks/useInventoryItems";
import { useOrderStats, useOrdersPaginated } from "@/hooks/useOrders";

export default function Dashboard() {
  const { data: orderStats, isLoading: statsLoading } = useOrderStats();
  const { data: recentOrdersData, isLoading: ordersLoading } = useOrdersPaginated(1, 10);
  const { data: inboundItems, isLoading: inboundLoading } = useInboundItems();
  const { data: inventory, isLoading: inventoryLoading } = useInventoryItems();

  const isLoading = statsLoading || ordersLoading || inboundLoading || inventoryLoading;

  // 计算库存统计
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

  // 入库记录统计
  const pendingRefurbishment = (inboundItems || []).filter(
    (item) => !item.refurbished_at
  ).length;

  const completedRefurbishment = (inboundItems || []).filter(
    (item) => item.refurbished_at
  ).length;

  // 订单状态映射颜色
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "未到货":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">未到货</Badge>;
      case "到货":
        return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">到货</Badge>;
      case "出库":
        return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">出库</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const orderColumns = [
    { key: "internal_order_no", header: "内部单号" },
    { key: "lpn", header: "LPN" },
    { key: "product_name", header: "产品名称", render: (item: any) => (
      <span className="line-clamp-1 max-w-[200px]">{item.product_name || "-"}</span>
    )},
    { key: "store_name", header: "店铺" },
    {
      key: "status",
      header: "状态",
      render: (item: any) => getStatusBadge(item.status),
    },
    {
      key: "created_at",
      header: "创建日期",
      render: (item: any) =>
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
          title="总订单数"
          value={orderStats?.total || 0}
          subtitle="按唯一LPN统计"
          icon={ClipboardList}
          variant="primary"
        />
        <StatCard
          title="未到货"
          value={orderStats?.pending || 0}
          subtitle="等待送达"
          icon={Truck}
          variant="warning"
        />
        <StatCard
          title="已到货"
          value={orderStats?.arrived || 0}
          subtitle="待入库处理"
          icon={PackageCheck}
          variant="info"
        />
        <StatCard
          title="已出库"
          value={orderStats?.shipped || 0}
          subtitle="已完成处理"
          icon={Package}
          variant="success"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总库存量"
          value={totalStock}
          subtitle={`${(inventory || []).length} 个SKU`}
          icon={Warehouse}
          variant="success"
        />
        <StatCard
          title="入库记录"
          value={(inboundItems || []).length}
          subtitle={`待翻新 ${pendingRefurbishment} 件`}
          icon={PackageX}
          variant="primary"
        />
        <StatCard
          title="已翻新"
          value={completedRefurbishment}
          subtitle="完成质检分级"
          icon={PackageCheck}
          variant="info"
        />
        <StatCard
          title="库存SKU数"
          value={(inventory || []).length}
          subtitle="产品种类"
          icon={ClipboardList}
          variant="warning"
        />
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">库存分布</h3>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
          {totalStock > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">A级翻新</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-info"
                      style={{
                        width: `${(stockByGrade.gradeA / totalStock) * 100}%`,
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
                        width: `${(stockByGrade.gradeB / totalStock) * 100}%`,
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
                        width: `${(stockByGrade.gradeC / totalStock) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium">{stockByGrade.gradeC}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              暂无库存数据
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">订单状态概览</h3>
            <AlertCircle className="h-5 w-5 text-warning" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg bg-yellow-500/10 p-3">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
              <span className="text-sm flex-1">未到货订单</span>
              <span className="font-semibold">{orderStats?.pending || 0}</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-blue-500/10 p-3">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-sm flex-1">已到货待处理</span>
              <span className="font-semibold">{orderStats?.arrived || 0}</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-green-500/10 p-3">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm flex-1">已出库</span>
              <span className="font-semibold">{orderStats?.shipped || 0}</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-3">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-sm flex-1">入库质检完成</span>
              <span className="font-semibold">{(inboundItems || []).length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">最近订单</h3>
        <DataTable
          columns={orderColumns}
          data={recentOrdersData?.data || []}
          emptyMessage="暂无订单记录"
        />
      </div>
    </div>
  );
}
