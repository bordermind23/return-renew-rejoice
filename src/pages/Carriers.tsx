import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Trash2, Truck } from "lucide-react";
import { useCarriers, useCreateCarrier, useDeleteCarrier } from "@/hooks/useCarriers";
import { Skeleton } from "@/components/ui/skeleton";

const Carriers = () => {
  const [newCarrierName, setNewCarrierName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: carriers, isLoading } = useCarriers();
  const createMutation = useCreateCarrier();
  const deleteMutation = useDeleteCarrier();

  const handleAdd = () => {
    if (!newCarrierName.trim()) return;
    createMutation.mutate(newCarrierName.trim(), {
      onSuccess: () => setNewCarrierName(""),
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="物流承运商"
          description="管理系统中的物流承运商"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="物流承运商"
        description="管理系统中的物流承运商"
      />

      {/* 添加承运商 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">添加新承运商</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="输入承运商名称"
              value={newCarrierName}
              onChange={(e) => setNewCarrierName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="max-w-sm"
            />
            <Button onClick={handleAdd} disabled={!newCarrierName.trim() || createMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              添加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 承运商列表 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {carriers?.map((carrier) => (
          <Card key={carrier.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <span className="font-medium">{carrier.name}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteId(carrier.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </div>

      {carriers?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          暂无承运商，请添加
        </div>
      )}

      {/* 删除确认 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个承运商吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Carriers;
