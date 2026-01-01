import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GradeBadge } from "@/components/ui/grade-badge";
import { cn } from "@/lib/utils";

type Grade = "A" | "B" | "C";

interface BulkGradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (grade: Grade) => void;
  isLoading?: boolean;
}

const gradeOptions: { value: Grade; label: string; description: string }[] = [
  { value: "A", label: "A级", description: "全新/完好状态" },
  { value: "B", label: "B级", description: "轻微瑕疵/需简单翻新" },
  { value: "C", label: "C级", description: "明显损坏/需维修" },
];

export function BulkGradeDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
  isLoading,
}: BulkGradeDialogProps) {
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);

  const handleConfirm = () => {
    if (selectedGrade) {
      onConfirm(selectedGrade);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批量修改等级</DialogTitle>
          <DialogDescription>
            选择要将 {selectedCount} 条订单更新为的等级
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-4">
          {gradeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedGrade(option.value)}
              className={cn(
                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                selectedGrade === option.value
                  ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <GradeBadge grade={option.value} className="scale-125" />
              <div className="text-center">
                <p className="text-sm font-medium">{option.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
              </div>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedGrade || isLoading}
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
