import { useState } from "react";
import { Package, PackageCheck, Truck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type OrderStatus = "未到货" | "到货" | "出库";

interface BulkStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (status: OrderStatus) => void;
  isLoading?: boolean;
}

const statusOptions: { value: OrderStatus; label: string; icon: React.ReactNode; color: string }[] = [
  {
    value: "未到货",
    label: "未到货",
    icon: <Package className="h-5 w-5" />,
    color: "border-warning/50 bg-warning/10 text-warning hover:bg-warning/20",
  },
  {
    value: "到货",
    label: "已到货",
    icon: <PackageCheck className="h-5 w-5" />,
    color: "border-success/50 bg-success/10 text-success hover:bg-success/20",
  },
  {
    value: "出库",
    label: "已出库",
    icon: <Truck className="h-5 w-5" />,
    color: "border-info/50 bg-info/10 text-info hover:bg-info/20",
  },
];

export function BulkStatusDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
  isLoading,
}: BulkStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | null>(null);

  const handleConfirm = () => {
    if (selectedStatus) {
      onConfirm(selectedStatus);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批量更新状态</DialogTitle>
          <DialogDescription>
            选择要将 {selectedCount} 条订单更新为的状态
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-4">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedStatus(option.value)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                selectedStatus === option.value
                  ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                  : option.color
              )}
            >
              {option.icon}
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedStatus || isLoading}
            className="gradient-primary"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            确认更新
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
