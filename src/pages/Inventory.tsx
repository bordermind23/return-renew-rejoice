import { useState } from "react";
import { Search, Filter, Download, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { GradeBadge } from "@/components/ui/grade-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mockInventory, type InventoryItem } from "@/data/mockData";
import { toast } from "sonner";

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");

  const filteredData = mockInventory.filter((item) => {
    const matchesSearch =
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.productName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesWarehouse =
      warehouseFilter === "all" || item.warehouse === warehouseFilter;

    return matchesSearch && matchesWarehouse;
  });

  const columns = [
    {
      key: "sku",
      header: "SKU",
      render: (item: InventoryItem) => (
        <span className="font-mono font-medium text-primary">{item.sku}</span>
      ),
    },
    { key: "productName", header: "产品名称" },
    { key: "productCategory", header: "产品分类" },
    { key: "warehouse", header: "仓库" },
    {
      key: "totalStock",
      header: "总库存",
      render: (item: InventoryItem) => (
        <span className="text-lg font-bold">{item.totalStock}</span>
      ),
    },
    {
      key: "newStock",
      header: "全新",
      render: (item: InventoryItem) => (
        <div className="flex items-center gap-2">
          <GradeBadge grade="new" />
          <span className="font-medium">{item.newStock}</span>
        </div>
      ),
    },
    {
      key: "gradeAStock",
      header: "A级",
      render: (item: InventoryItem) => (
        <div className="flex items-center gap-2">
          <GradeBadge grade="A" />
          <span className="font-medium">{item.gradeAStock}</span>
        </div>
      ),
    },
    {
      key: "gradeBStock",
      header: "B级",
      render: (item: InventoryItem) => (
        <div className="flex items-center gap-2">
          <GradeBadge grade="B" />
          <span className="font-medium">{item.gradeBStock}</span>
        </div>
      ),
    },
    {
      key: "gradeCStock",
      header: "C级",
      render: (item: InventoryItem) => (
        <div className="flex items-center gap-2">
          <GradeBadge grade="C" />
          <span className="font-medium">{item.gradeCStock}</span>
        </div>
      ),
    },
  ];

  const handleExport = () => {
    toast.success("库存数据导出成功");
  };

  // Calculate totals
  const totals = filteredData.reduce(
    (acc, item) => ({
      total: acc.total + item.totalStock,
      new: acc.new + item.newStock,
      gradeA: acc.gradeA + item.gradeAStock,
      gradeB: acc.gradeB + item.gradeBStock,
      gradeC: acc.gradeC + item.gradeCStock,
    }),
    { total: 0, new: 0, gradeA: 0, gradeB: 0, gradeC: 0 }
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="库存管理"
        description="查看和管理所有仓库库存"
        actions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            导出数据
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-5">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">总库存</p>
          <p className="mt-1 text-2xl font-bold">{totals.total}</p>
        </div>
        <div className="rounded-xl border bg-success/10 p-4 text-center">
          <p className="text-sm text-success">全新</p>
          <p className="mt-1 text-2xl font-bold text-success">{totals.new}</p>
        </div>
        <div className="rounded-xl border bg-info/10 p-4 text-center">
          <p className="text-sm text-info">A级</p>
          <p className="mt-1 text-2xl font-bold text-info">{totals.gradeA}</p>
        </div>
        <div className="rounded-xl border bg-warning/10 p-4 text-center">
          <p className="text-sm text-warning">B级</p>
          <p className="mt-1 text-2xl font-bold text-warning">{totals.gradeB}</p>
        </div>
        <div className="rounded-xl border bg-destructive/10 p-4 text-center">
          <p className="text-sm text-destructive">C级</p>
          <p className="mt-1 text-2xl font-bold text-destructive">{totals.gradeC}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索SKU或产品名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="仓库筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部仓库</SelectItem>
            <SelectItem value="华东仓">华东仓</SelectItem>
            <SelectItem value="华南仓">华南仓</SelectItem>
            <SelectItem value="华北仓">华北仓</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        emptyMessage="暂无库存记录"
      />
    </div>
  );
}
