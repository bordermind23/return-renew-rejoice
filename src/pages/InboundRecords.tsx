import { useState } from "react";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
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
import { Skeleton } from "@/components/ui/skeleton";
import { InboundBatchList } from "@/components/InboundBatchList";

export default function InboundRecords() {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: inboundItems, isLoading } = useInboundItems();
  const deleteMutation = useDeleteInboundItem();
  const decreaseInventoryMutation = useDecreaseInventoryStock();

  const handleDelete = () => {
    if (deleteId && inboundItems) {
      const itemToDelete = inboundItems.find(item => item.id === deleteId);
      
      if (itemToDelete) {
        const fetchAndDecrease = async () => {
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
        };
        fetchAndDecrease();
      }
      
      deleteMutation.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

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

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            共 {inboundItems?.length || 0} 条入库记录
          </div>
        </div>
        <InboundBatchList 
          items={inboundItems || []} 
          onDelete={(id) => setDeleteId(id)} 
        />
      </div>

      {/* 删除确认 */}
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
    </div>
  );
}
