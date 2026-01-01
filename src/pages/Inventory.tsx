import { useState, useMemo } from "react";
import { Search, Download, Package, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { GradeBadge } from "@/components/ui/grade-badge";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  useInventoryItems,
  type InventoryItem,
} from "@/hooks/useInventoryItems";
import { useProducts } from "@/hooks/useProducts";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// 合并后的库存项目类型
interface MergedInventoryItem {
  id: string;
  sku: string;
  product_name: string;
  product_category: string | null;
  product_image: string | null;
  total_stock: number;
  grade_a_stock: number;
  grade_b_stock: number;
  grade_c_stock: number;
}

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: inventory, isLoading: isLoadingInventory } = useInventoryItems();
  const { data: products, isLoading: isLoadingProducts } = useProducts();

  // 合并产品和库存数据
  const mergedData = useMemo(() => {
    const inventoryBySku = new Map<string, InventoryItem>();
    (inventory || []).forEach(item => {
      inventoryBySku.set(item.sku, item);
    });

    const result: MergedInventoryItem[] = [];
    const processedSkus = new Set<string>();

    // 首先处理所有产品
    (products || []).forEach(product => {
      const inventoryItem = inventoryBySku.get(product.sku);
      processedSkus.add(product.sku);
      
      result.push({
        id: product.id,
        sku: product.sku,
        product_name: product.name,
        product_category: product.category,
        product_image: product.image || inventoryItem?.product_image || null,
        total_stock: inventoryItem?.total_stock || 0,
        grade_a_stock: inventoryItem?.grade_a_stock || 0,
        grade_b_stock: inventoryItem?.grade_b_stock || 0,
        grade_c_stock: inventoryItem?.grade_c_stock || 0,
      });
    });

    // 添加不在产品表中但在库存表中的SKU
    (inventory || []).forEach(item => {
      if (!processedSkus.has(item.sku)) {
        result.push({
          id: item.id,
          sku: item.sku,
          product_name: item.product_name,
          product_category: item.product_category,
          product_image: item.product_image,
          total_stock: item.total_stock,
          grade_a_stock: item.grade_a_stock,
          grade_b_stock: item.grade_b_stock,
          grade_c_stock: item.grade_c_stock,
        });
      }
    });

    return result;
  }, [inventory, products]);

  const filteredData = mergedData.filter((item) => {
    const matchesSearch =
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const columns = [
    {
      key: "product_image",
      header: "图片",
      render: (item: MergedInventoryItem) => (
        item.product_image ? (
          <HoverCard>
            <HoverCardTrigger asChild>
              <img
                src={item.product_image}
                alt={item.product_name}
                className="h-12 w-12 rounded-xl object-cover cursor-pointer border-2 border-transparent hover:border-primary/30 transition-all shadow-sm"
              />
            </HoverCardTrigger>
            <HoverCardContent className="w-72 p-3" side="right">
              <img
                src={item.product_image}
                alt={item.product_name}
                className="w-full rounded-lg object-contain"
              />
            </HoverCardContent>
          </HoverCard>
        ) : (
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
            <Package className="h-5 w-5" />
          </div>
        )
      ),
    },
    {
      key: "sku",
      header: "SKU",
      render: (item: MergedInventoryItem) => (
        <span className="font-mono text-sm font-medium text-primary bg-primary/5 px-2 py-1 rounded">
          {item.sku}
        </span>
      ),
    },
    { 
      key: "product_name", 
      header: "产品名称",
      render: (item: MergedInventoryItem) => (
        <span className="font-medium line-clamp-2 max-w-[200px]">{item.product_name}</span>
      ),
    },
    { 
      key: "product_category", 
      header: "分类",
      render: (item: MergedInventoryItem) => (
        item.product_category ? (
          <Badge variant="secondary" className="font-normal">
            {item.product_category}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )
      ),
    },
    {
      key: "total_stock",
      header: "总库存",
      render: (item: MergedInventoryItem) => (
        <span className={`text-xl font-bold tabular-nums ${item.total_stock === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
          {item.total_stock.toLocaleString()}
        </span>
      ),
    },
    {
      key: "grade_a_stock",
      header: "A级",
      render: (item: MergedInventoryItem) => (
        <div className="flex items-center gap-2">
          <GradeBadge grade="A" />
          <span className={`font-semibold tabular-nums ${item.grade_a_stock === 0 ? 'text-muted-foreground' : ''}`}>
            {item.grade_a_stock.toLocaleString()}
          </span>
        </div>
      ),
    },
    {
      key: "grade_b_stock",
      header: "B级",
      render: (item: MergedInventoryItem) => (
        <div className="flex items-center gap-2">
          <GradeBadge grade="B" />
          <span className={`font-semibold tabular-nums ${item.grade_b_stock === 0 ? 'text-muted-foreground' : ''}`}>
            {item.grade_b_stock.toLocaleString()}
          </span>
        </div>
      ),
    },
    {
      key: "grade_c_stock",
      header: "C级",
      render: (item: MergedInventoryItem) => (
        <div className="flex items-center gap-2">
          <GradeBadge grade="C" />
          <span className={`font-semibold tabular-nums ${item.grade_c_stock === 0 ? 'text-muted-foreground' : ''}`}>
            {item.grade_c_stock.toLocaleString()}
          </span>
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
      total: acc.total + item.total_stock,
      gradeA: acc.gradeA + item.grade_a_stock,
      gradeB: acc.gradeB + item.grade_b_stock,
      gradeC: acc.gradeC + item.grade_c_stock,
    }),
    { total: 0, gradeA: 0, gradeB: 0, gradeC: 0 }
  );

  const isLoading = isLoadingInventory || isLoadingProducts;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      <PageHeader
        title="库存管理"
        description={`展示所有产品SKU及其库存情况`}
        badge={
          <Badge variant="outline" className="font-normal">
            共 {mergedData.length} 个SKU
          </Badge>
        }
        actions={
          <Button variant="outline" onClick={handleExport} className="shadow-sm">
            <Download className="mr-2 h-4 w-4" />
            导出数据
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总库存"
          value={totals.total}
          icon={Warehouse}
          variant="primary"
        />
        <StatCard
          title="A级库存"
          value={totals.gradeA}
          icon={Package}
          variant="info"
        />
        <StatCard
          title="B级库存"
          value={totals.gradeB}
          icon={Package}
          variant="warning"
        />
        <StatCard
          title="C级库存"
          value={totals.gradeC}
          icon={Package}
          variant="destructive"
        />
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索SKU或产品名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background/50"
            />
          </div>
          {searchTerm && (
            <Badge variant="secondary" className="font-normal">
              筛选结果: {filteredData.length} 条
            </Badge>
          )}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        emptyMessage="暂无产品SKU记录"
        emptyIcon={<Warehouse className="h-12 w-12 opacity-30" />}
      />
    </div>
  );
}
