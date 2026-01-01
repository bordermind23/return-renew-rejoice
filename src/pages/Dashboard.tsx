import {
  PackageX,
  PackageCheck,
  Warehouse,
  ClipboardList,
  TrendingUp,
  AlertCircle,
  Package,
  Truck,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useInboundItems } from "@/hooks/useInboundItems";
import { useInventoryItems } from "@/hooks/useInventoryItems";
import { useOrderStats } from "@/hooks/useOrders";

export default function Dashboard() {
  const { data: orderStats, isLoading: statsLoading } = useOrderStats();
  const { data: inboundItems, isLoading: inboundLoading } = useInboundItems();
  const { data: inventory, isLoading: inventoryLoading } = useInventoryItems();

  const isLoading = statsLoading || inboundLoading || inventoryLoading;

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

  // 今日入库统计
  const todayInbound = (inboundItems || []).filter(
    (item) => new Date(item.processed_at).toDateString() === new Date().toDateString()
  ).length;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader 
        title="仪表盘" 
        description="退货翻新系统概览"
        badge={
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
            <Sparkles className="h-3 w-3 mr-1" />
            实时数据
          </Badge>
        }
      />

      {/* 主要订单统计 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/orders">
          <StatCard
            title="总订单数"
            value={orderStats?.total || 0}
            subtitle="按唯一LPN统计"
            icon={ClipboardList}
            variant="primary"
          />
        </Link>
        <Link to="/orders">
          <StatCard
            title="未到货"
            value={orderStats?.pending || 0}
            subtitle="等待送达"
            icon={Truck}
            variant="warning"
          />
        </Link>
        <Link to="/orders">
          <StatCard
            title="已到货"
            value={orderStats?.arrived || 0}
            subtitle="待入库处理"
            icon={PackageCheck}
            variant="info"
          />
        </Link>
        <Link to="/orders">
          <StatCard
            title="已出库"
            value={orderStats?.shipped || 0}
            subtitle="已完成处理"
            icon={Package}
            variant="success"
          />
        </Link>
      </div>

      {/* 次要统计 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/inventory">
          <StatCard
            title="总库存量"
            value={totalStock}
            subtitle={`${(inventory || []).length} 个SKU`}
            icon={Warehouse}
            variant="success"
          />
        </Link>
        <Link to="/inbound/records">
          <StatCard
            title="待翻新"
            value={pendingRefurbishment}
            subtitle={`今日入库 ${todayInbound} 件`}
            icon={PackageX}
            variant="warning"
          />
        </Link>
        <Link to="/refurbishment/records">
          <StatCard
            title="已翻新"
            value={completedRefurbishment}
            subtitle="完成质检分级"
            icon={PackageCheck}
            variant="info"
          />
        </Link>
      </div>

      {/* 详细信息卡片 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 库存分布 */}
        <div className="group rounded-2xl border bg-card p-6 shadow-sm transition-all hover:shadow-md">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">库存分布</h3>
            </div>
            <Link to="/inventory">
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                查看详情
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          {totalStock > 0 ? (
            <div className="space-y-5">
              {[
                { label: "A级翻新", value: stockByGrade.gradeA, color: "bg-blue-500" },
                { label: "B级翻新", value: stockByGrade.gradeB, color: "bg-yellow-500" },
                { label: "C级翻新", value: stockByGrade.gradeC, color: "bg-red-500" },
              ].map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold tabular-nums">
                      {item.value.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${item.color} transition-all duration-500`}
                      style={{
                        width: `${Math.max((item.value / totalStock) * 100, 2)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 opacity-30 mb-3" />
              <p className="text-sm">暂无库存数据</p>
            </div>
          )}
        </div>

        {/* 订单状态概览 */}
        <div className="group rounded-2xl border bg-card p-6 shadow-sm transition-all hover:shadow-md">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-warning/10 p-2.5">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              <h3 className="text-lg font-semibold">状态概览</h3>
            </div>
            <Link to="/orders">
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                查看订单
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {[
              { label: "未到货订单", value: orderStats?.pending || 0, color: "yellow" },
              { label: "已到货待处理", value: orderStats?.arrived || 0, color: "blue" },
              { label: "已出库", value: orderStats?.shipped || 0, color: "green" },
              { label: "入库质检完成", value: (inboundItems || []).length, color: "primary" },
            ].map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-3 rounded-xl p-3.5 transition-colors
                  ${item.color === 'yellow' ? 'bg-yellow-500/10 hover:bg-yellow-500/15' : ''}
                  ${item.color === 'blue' ? 'bg-blue-500/10 hover:bg-blue-500/15' : ''}
                  ${item.color === 'green' ? 'bg-green-500/10 hover:bg-green-500/15' : ''}
                  ${item.color === 'primary' ? 'bg-primary/10 hover:bg-primary/15' : ''}
                `}
              >
                <div className={`h-2.5 w-2.5 rounded-full
                  ${item.color === 'yellow' ? 'bg-yellow-500' : ''}
                  ${item.color === 'blue' ? 'bg-blue-500' : ''}
                  ${item.color === 'green' ? 'bg-green-500' : ''}
                  ${item.color === 'primary' ? 'bg-primary' : ''}
                `} />
                <span className="text-sm flex-1">{item.label}</span>
                <span className="font-bold tabular-nums text-lg">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
