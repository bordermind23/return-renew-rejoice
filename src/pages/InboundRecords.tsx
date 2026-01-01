import { useState, useMemo } from "react";
import { Search, X, Package, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useInboundItems,
  useDeleteInboundItem,
} from "@/hooks/useInboundItems";
import { fetchOrdersByLpn } from "@/hooks/useOrdersByLpn";
import { useDecreaseInventoryStock } from "@/hooks/useInventoryItems";
import { useRemovalShipments, useUpdateRemovalShipment } from "@/hooks/useRemovalShipments";
import { Skeleton } from "@/components/ui/skeleton";
import { InboundBatchList } from "@/components/InboundBatchList";
import { toast } from "sonner";

export default function InboundRecords() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  
  // 筛选状态
  const [searchTerm, setSearchTerm] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const { data: inboundItems, isLoading } = useInboundItems();
  const { data: shipments } = useRemovalShipments();
  const deleteMutation = useDeleteInboundItem();
  const decreaseInventoryMutation = useDecreaseInventoryStock();
  const updateShipmentMutation = useUpdateRemovalShipment();

  // 筛选后的数据
  const filteredItems = useMemo(() => {
    if (!inboundItems) return [];
    
    return inboundItems.filter(item => {
      // 搜索过滤
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          item.lpn.toLowerCase().includes(search) ||
          item.product_sku.toLowerCase().includes(search) ||
          item.product_name.toLowerCase().includes(search) ||
          (item.tracking_number?.toLowerCase().includes(search) ?? false);
        if (!matchesSearch) return false;
      }
      
      // 级别过滤
      if (gradeFilter !== "all" && item.grade !== gradeFilter) {
        return false;
      }
      
      // 日期过滤
      if (dateFilter !== "all") {
        const itemDate = new Date(item.processed_at);
        const now = new Date();
        
        switch (dateFilter) {
          case "today":
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (itemDate < today) return false;
            break;
          case "week":
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (itemDate < weekAgo) return false;
            break;
          case "month":
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (itemDate < monthAgo) return false;
            break;
        }
      }
      
      return true;
    });
  }, [inboundItems, searchTerm, gradeFilter, dateFilter]);

  // 统计数据
  const stats = useMemo(() => {
    const items = inboundItems || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return {
      total: items.length,
      gradeA: items.filter(i => i.grade === 'A').length,
      gradeB: items.filter(i => i.grade === 'B').length,
      gradeC: items.filter(i => i.grade === 'C').length,
      today: items.filter(i => new Date(i.processed_at) >= today).length,
    };
  }, [inboundItems]);

  // 获取某物流号下的已入库数量（不包含当前正在删除的项目）
  const getInboundedCountExcluding = (trackingNumber: string, excludeIds: string[]) => {
    return (inboundItems || []).filter(
      item => item.tracking_number === trackingNumber && !excludeIds.includes(item.id)
    ).length;
  };

  // 更新货件状态
  const updateShipmentStatusAfterDelete = (trackingNumber: string, excludeIds: string[]) => {
    if (!trackingNumber || !shipments) return;
    
    const matchedShipments = shipments.filter(s => s.tracking_number === trackingNumber);
    if (matchedShipments.length === 0) return;
    
    const totalQuantity = matchedShipments.reduce((sum, s) => sum + s.quantity, 0);
    const remainingInbounded = getInboundedCountExcluding(trackingNumber, excludeIds);
    
    if (remainingInbounded < totalQuantity) {
      matchedShipments.forEach(shipment => {
        if (shipment.status === "inbound") {
          updateShipmentMutation.mutate({
            id: shipment.id,
            status: "arrived",
            note: `入库记录删除：剩余入库 ${remainingInbounded} 件，申报 ${totalQuantity} 件`,
          });
        }
      });
    }
  };

  const handleDelete = async () => {
    if (deleteId && inboundItems) {
      const itemToDelete = inboundItems.find(item => item.id === deleteId);
      
      if (itemToDelete) {
        try {
          const orders = await fetchOrdersByLpn(itemToDelete.lpn);
          const returnQty = orders.length > 0 ? (orders[0].return_quantity || 1) : 1;
          decreaseInventoryMutation.mutate({
            sku: itemToDelete.product_sku,
            grade: itemToDelete.grade as "A" | "B" | "C",
            quantity: returnQty,
          });
        } catch (error) {
          decreaseInventoryMutation.mutate({
            sku: itemToDelete.product_sku,
            grade: itemToDelete.grade as "A" | "B" | "C",
            quantity: 1,
          });
        }
        
        if (itemToDelete.tracking_number) {
          updateShipmentStatusAfterDelete(itemToDelete.tracking_number, [deleteId]);
        }
      }
      
      deleteMutation.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  const handleBatchDelete = async () => {
    if (deleteIds.length === 0 || !inboundItems) return;
    
    let successCount = 0;
    const trackingNumbersToUpdate = new Set<string>();
    
    for (const id of deleteIds) {
      const itemToDelete = inboundItems.find(item => item.id === id);
      
      if (itemToDelete) {
        try {
          const orders = await fetchOrdersByLpn(itemToDelete.lpn);
          const returnQty = orders.length > 0 ? (orders[0].return_quantity || 1) : 1;
          decreaseInventoryMutation.mutate({
            sku: itemToDelete.product_sku,
            grade: itemToDelete.grade as "A" | "B" | "C",
            quantity: returnQty,
          });
        } catch (error) {
          decreaseInventoryMutation.mutate({
            sku: itemToDelete.product_sku,
            grade: itemToDelete.grade as "A" | "B" | "C",
            quantity: 1,
          });
        }
        
        if (itemToDelete.tracking_number) {
          trackingNumbersToUpdate.add(itemToDelete.tracking_number);
        }
        
        deleteMutation.mutate(id);
        successCount++;
      }
    }
    
    trackingNumbersToUpdate.forEach(trackingNumber => {
      updateShipmentStatusAfterDelete(trackingNumber, deleteIds);
    });
    
    toast.success(`已删除 ${successCount} 条入库记录`);
    setDeleteIds([]);
    setIsBatchDeleteOpen(false);
  };

  const handleBatchDeleteRequest = (ids: string[]) => {
    setDeleteIds(ids);
    setIsBatchDeleteOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setGradeFilter("all");
    setDateFilter("all");
  };

  const hasActiveFilters = searchTerm || gradeFilter !== "all" || dateFilter !== "all";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      <PageHeader
        title="入库记录"
        description="查看所有已入库的产品记录"
        badge={
          <Badge variant="outline" className="font-normal">
            共 {inboundItems?.length || 0} 条
          </Badge>
        }
      />

      {/* 统计卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总入库"
          value={stats.total}
          subtitle={`今日入库 ${stats.today} 件`}
          icon={ClipboardList}
          variant="primary"
        />
        <StatCard
          title="A级"
          value={stats.gradeA}
          icon={Package}
          variant="info"
        />
        <StatCard
          title="B级"
          value={stats.gradeB}
          icon={Package}
          variant="warning"
        />
        <StatCard
          title="C级"
          value={stats.gradeC}
          icon={Package}
          variant="destructive"
        />
      </div>

      {/* 筛选区域 */}
      <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-1">
            {/* 搜索框 */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索LPN、SKU、产品名称、物流号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background/50"
              />
            </div>
            
            {/* 级别筛选 */}
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="全部级别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部级别</SelectItem>
                <SelectItem value="A">A级</SelectItem>
                <SelectItem value="B">B级</SelectItem>
                <SelectItem value="C">C级</SelectItem>
              </SelectContent>
            </Select>
            
            {/* 日期筛选 */}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="全部时间" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部时间</SelectItem>
                <SelectItem value="today">今天</SelectItem>
                <SelectItem value="week">最近7天</SelectItem>
                <SelectItem value="month">最近30天</SelectItem>
              </SelectContent>
            </Select>
            
            {/* 清除筛选 */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
                <X className="h-4 w-4 mr-1" />
                清除筛选
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            {hasActiveFilters && (
              <Badge variant="secondary" className="font-normal">
                筛选结果: {filteredItems.length} 条
              </Badge>
            )}
          </div>
        </div>
      </div>

      <InboundBatchList 
        items={filteredItems} 
        onDelete={(id) => setDeleteId(id)}
        onBatchDelete={handleBatchDeleteRequest}
        enableBatchSelect
      />

      {/* 单个删除确认 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销，确定要删除此入库记录吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量删除确认 */}
      <AlertDialog open={isBatchDeleteOpen} onOpenChange={setIsBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              您即将删除 <span className="font-semibold text-foreground">{deleteIds.length}</span> 条入库记录。
              此操作无法撤销，确定要继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除 {deleteIds.length} 条
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
