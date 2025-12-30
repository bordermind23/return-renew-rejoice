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
import { mockRemovalShipments, mockInboundItems } from "@/data/mockData";

export default function Dashboard() {
  const recentRemovals = mockRemovalShipments.slice(0, 5);
  const recentInbound = mockInboundItems.slice(0, 5);

  const removalColumns = [
    { key: "orderId", header: "订单号" },
    { key: "productName", header: "产品名称" },
    { key: "quantity", header: "数量" },
    {
      key: "status",
      header: "状态",
      render: (item: (typeof mockRemovalShipments)[0]) => (
        <StatusBadge status={item.status} />
      ),
    },
    { key: "createdAt", header: "创建日期" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="仪表盘"
        description="退货翻新系统概览"
      />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="待处理移除货件"
          value={12}
          subtitle="本周新增 5 件"
          icon={PackageX}
          variant="primary"
          trend={{ value: 15, isPositive: true }}
        />
        <StatCard
          title="待入库处理"
          value={28}
          subtitle="需要分级检验"
          icon={PackageCheck}
          variant="warning"
        />
        <StatCard
          title="总库存量"
          value={503}
          subtitle="4 个仓库"
          icon={Warehouse}
          variant="success"
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="本月订单"
          value={156}
          subtitle="已完成 142 单"
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
              <span className="text-sm text-muted-foreground">全新</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-3/5 rounded-full bg-success" />
                </div>
                <span className="text-sm font-medium">280</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">A级翻新</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-2/5 rounded-full bg-info" />
                </div>
                <span className="text-sm font-medium">140</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">B级翻新</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-1/4 rounded-full bg-warning" />
                </div>
                <span className="text-sm font-medium">62</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">C级翻新</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-1/6 rounded-full bg-destructive" />
                </div>
                <span className="text-sm font-medium">21</span>
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
              <span className="text-sm">5 件货物已到货等待入库</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-info/10 p-3">
              <div className="h-2 w-2 rounded-full bg-info" />
              <span className="text-sm">3 件货物正在运输中</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-3">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-sm">8 件产品等待质检分级</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-success/10 p-3">
              <div className="h-2 w-2 rounded-full bg-success" />
              <span className="text-sm">12 件产品今日已上架</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">最近移除货件</h3>
        <DataTable columns={removalColumns} data={recentRemovals} />
      </div>
    </div>
  );
}
