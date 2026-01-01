import { useState, useMemo } from "react";
import { Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { GradeBadge } from "@/components/ui/grade-badge";
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
                className="h-10 w-10 rounded-lg object-cover cursor-pointer border"
              />
            </HoverCardTrigger>
            <HoverCardContent className="w-64 p-2">
              <img
                src={item.product_image}
                alt={item.product_name}
                className="w-full rounded-lg object-contain"
              />
            </HoverCardContent>
          </HoverCard>
        ) : (
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">
            无图
          </div>
        )
      ),
    },
    {
      key: "sku",
      header: "SKU",
      render: (item: MergedInventoryItem) => (
        <span className="font-mono font-medium text-primary">{item.sku}</span>
      ),
    },
    { key: "product_name", header: "产品名称" },
    { key: "product_category", header: "产品分类" },
    {
      key: "total_stock",
      header: "总库存",
      render: (item: MergedInventoryItem) => (
        <span className={`text-lg font-bold ${item.total_stock === 0 ? 'text-muted-foreground' : ''}`}>
          {item.total_stock}
        </span>
      ),
    },
    {
      key: "grade_a_stock",
      header: "A级",
      render: (item: MergedInventoryItem) => (
        <div className="flex items-center gap-2">
          <GradeBadge grade="A" />
          <span className={`font-medium ${item.grade_a_stock === 0 ? 'text-muted-foreground' : ''}`}>
            {item.grade_a_stock}
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
          <span className={`font-medium ${item.grade_b_stock === 0 ? 'text-muted-foreground' : ''}`}>
            {item.grade_b_stock}
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
          <span className={`font-medium ${item.grade_c_stock === 0 ? 'text-muted-foreground' : ''}`}>
            {item.grade_c_stock}
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
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="库存管理"
        description={`展示所有产品SKU及其库存情况（共 ${mergedData.length} 个SKU）`}
        actions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            导出数据
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">总库存</p>
          <p className="mt-1 text-2xl font-bold">{totals.total}</p>
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
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        emptyMessage="暂无产品SKU记录"
      />
    </div>
  );
}
