import { useState, useMemo } from "react";
import { Search, Filter, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { usePermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { InboundBatchList } from "@/components/InboundBatchList";
import { toast } from "sonner";

export default function InboundRecords() {
  const { can } = usePermissions();
  const canDeleteData = can.deleteData;
  
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  
  // 筛选状态
  const [searchTerm, setSearchTerm] = useState("");
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
  }, [inboundItems, searchTerm, dateFilter]);

  // 获取某物流号下的已入库数量（不包含当前正在删除的项目）
  const getInboundedCountExcluding = (trackingNumber: string, excludeIds: string[]) => {
    return (inboundItems || []).filter(
      item => item.tracking_number === trackingNumber && !excludeIds.includes(item.id)
    ).length;
  };

  // 更新货件状态（如果入库数量小于申报数量，将状态从 inbound 改回 arrived）
  const updateShipmentStatusAfterDelete = (trackingNumber: string, excludeIds: string[]) => {
    if (!trackingNumber || !shipments) return;
    
    // 找到该物流号的所有货件
    const matchedShipments = shipments.filter(s => s.tracking_number === trackingNumber);
    if (matchedShipments.length === 0) return;
    
    const totalQuantity = matchedShipments.reduce((sum, s) => sum + s.quantity, 0);
    const remainingInbounded = getInboundedCountExcluding(trackingNumber, excludeIds);
    
    // 如果删除后入库数量小于申报数量，更新货件状态
    if (remainingInbounded < totalQuantity) {
      matchedShipments.forEach(shipment => {
        if (shipment.status === "入库") {
          updateShipmentMutation.mutate({
            id: shipment.id,
            status: "未到货",
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
        
        // 更新货件差异数据
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
    
    // 收集需要更新状态的物流号
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
        
        // 记录物流号
        if (itemToDelete.tracking_number) {
          trackingNumbersToUpdate.add(itemToDelete.tracking_number);
        }
        
        deleteMutation.mutate(id);
        successCount++;
      }
    }
    
    // 更新所有相关货件的状态
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
    setDateFilter("all");
  };

  const hasActiveFilters = searchTerm || dateFilter !== "all";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      <PageHeader
        title="入库记录"
        description="查看所有已入库的产品记录"
      />

      {/* 筛选区域 - 移动端优化 */}
      <div className="space-y-3">
        {/* 搜索框 - 全宽 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索LPN、SKU、产品名称、物流号..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {/* 日期筛选和统计 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[100px] h-9 text-sm">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="today">今天</SelectItem>
                <SelectItem value="week">近7天</SelectItem>
                <SelectItem value="month">近30天</SelectItem>
              </SelectContent>
            </Select>
            
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-xs">
                {filteredItems.length}条
              </Badge>
            )}
            <span>共{inboundItems?.length || 0}条</span>
          </div>
        </div>
      </div>

      <InboundBatchList 
        items={filteredItems} 
        onDelete={(id) => setDeleteId(id)}
        onBatchDelete={handleBatchDeleteRequest}
        enableBatchSelect={canDeleteData}
        canDelete={canDeleteData}
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
              className="bg-destructive text-destructive-foreground"
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
              className="bg-destructive text-destructive-foreground"
            >
              确认删除 {deleteIds.length} 条
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
