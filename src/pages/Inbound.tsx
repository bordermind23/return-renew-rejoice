import { useState } from "react";
import { ScanLine, Camera, Package, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { GradeBadge } from "@/components/ui/grade-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
  useCreateInboundItem,
  useDeleteInboundItem,
  type InboundItem,
} from "@/hooks/useInboundItems";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const missingPartsList = [
  { id: "earbuds", label: "耳塞套" },
  { id: "cable", label: "充电线" },
  { id: "manual", label: "说明书" },
  { id: "box", label: "原装包装盒" },
  { id: "adapter", label: "电源适配器" },
];

export default function Inbound() {
  const [scanCode, setScanCode] = useState("");
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedMissingParts, setSelectedMissingParts] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  // Form state for creating inbound item
  const [formData, setFormData] = useState({
    removal_order_id: "",
    product_sku: "",
    product_name: "",
    return_reason: "",
  });

  const { data: inboundItems, isLoading } = useInboundItems();
  const createMutation = useCreateInboundItem();
  const deleteMutation = useDeleteInboundItem();

  const handleScan = () => {
    if (scanCode.trim()) {
      toast.success(`扫描成功: ${scanCode}`);
      setIsProcessDialogOpen(true);
    }
  };

  const handleProcessComplete = () => {
    if (!selectedGrade) {
      toast.error("请选择产品级别");
      return;
    }

    const missingPartsLabels = selectedMissingParts.map(
      (id) => missingPartsList.find((p) => p.id === id)?.label || id
    );

    createMutation.mutate(
      {
        lpn: scanCode || `LPN-${Date.now()}`,
        removal_order_id: formData.removal_order_id || "RM-AUTO",
        product_sku: formData.product_sku || "SKU-AUTO",
        product_name: formData.product_name || "未知产品",
        return_reason: formData.return_reason || notes,
        grade: selectedGrade as "A" | "B" | "C" | "new",
        missing_parts: missingPartsLabels,
        processed_at: new Date().toISOString(),
        processed_by: "操作员",
      },
      {
        onSuccess: () => {
          setIsProcessDialogOpen(false);
          setSelectedGrade("");
          setSelectedMissingParts([]);
          setScanCode("");
          setNotes("");
          setFormData({
            removal_order_id: "",
            product_sku: "",
            product_name: "",
            return_reason: "",
          });
        },
      }
    );
  };

  const toggleMissingPart = (partId: string) => {
    setSelectedMissingParts((prev) =>
      prev.includes(partId)
        ? prev.filter((id) => id !== partId)
        : [...prev, partId]
    );
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  const columns = [
    {
      key: "lpn",
      header: "LPN号",
      render: (item: InboundItem) => (
        <span className="font-mono font-medium text-primary">{item.lpn}</span>
      ),
    },
    { key: "removal_order_id", header: "移除订单号" },
    { key: "product_sku", header: "产品SKU" },
    { key: "product_name", header: "产品名称" },
    { key: "return_reason", header: "退货理由" },
    {
      key: "grade",
      header: "产品级别",
      render: (item: InboundItem) => <GradeBadge grade={item.grade} />,
    },
    {
      key: "missing_parts",
      header: "缺少配件",
      render: (item: InboundItem) =>
        item.missing_parts && item.missing_parts.length > 0
          ? item.missing_parts.join(", ")
          : "-",
    },
    {
      key: "processed_at",
      header: "处理时间",
      render: (item: InboundItem) =>
        new Date(item.processed_at).toLocaleString("zh-CN"),
    },
    { key: "processed_by", header: "处理人" },
    {
      key: "actions",
      header: "操作",
      render: (item: InboundItem) => (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteId(item.id);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="入库处理"
        description="扫描LPN进行产品检验和分级"
      />

      {/* Scan Section */}
      <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScanLine className="h-5 w-5 text-primary" />
            扫描入库
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Input
                placeholder="扫描或输入LPN号..."
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                className="text-lg"
              />
            </div>
            <Button onClick={handleScan} className="gradient-primary">
              <ScanLine className="mr-2 h-4 w-4" />
              确认扫描
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            通过手机照相机扫描后打开此页面确认入库数量，每一个退件里面的产品都需要拍照扫描
          </p>
        </CardContent>
      </Card>

      {/* Process Dialog */}
      <Dialog open={isProcessDialogOpen} onOpenChange={setIsProcessDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              产品入库处理
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Product Info Form */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="removal_order_id">移除订单号</Label>
                <Input
                  id="removal_order_id"
                  placeholder="输入移除订单号"
                  value={formData.removal_order_id}
                  onChange={(e) =>
                    setFormData({ ...formData, removal_order_id: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product_sku">产品SKU</Label>
                <Input
                  id="product_sku"
                  placeholder="输入产品SKU"
                  value={formData.product_sku}
                  onChange={(e) =>
                    setFormData({ ...formData, product_sku: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product_name">产品名称</Label>
                <Input
                  id="product_name"
                  placeholder="输入产品名称"
                  value={formData.product_name}
                  onChange={(e) =>
                    setFormData({ ...formData, product_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="return_reason">退货理由</Label>
                <Input
                  id="return_reason"
                  placeholder="输入退货理由"
                  value={formData.return_reason}
                  onChange={(e) =>
                    setFormData({ ...formData, return_reason: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Photo Upload Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>产品包装照片</Label>
                <div className="flex h-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 transition-colors hover:border-primary/50 hover:bg-primary/5">
                  <div className="text-center">
                    <Camera className="mx-auto h-8 w-8 text-muted-foreground" />
                    <span className="mt-2 block text-sm text-muted-foreground">
                      点击上传
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>产品内部照片</Label>
                <div className="flex h-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 transition-colors hover:border-primary/50 hover:bg-primary/5">
                  <div className="text-center">
                    <Camera className="mx-auto h-8 w-8 text-muted-foreground" />
                    <span className="mt-2 block text-sm text-muted-foreground">
                      点击上传
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Grade Selection */}
            <div className="space-y-2">
              <Label>设定产品级别</Label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="选择产品级别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">全新 - 未拆封</SelectItem>
                  <SelectItem value="A">A级 - 轻微使用痕迹</SelectItem>
                  <SelectItem value="B">B级 - 明显使用痕迹或缺少配件</SelectItem>
                  <SelectItem value="C">C级 - 功能或外观有问题</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Missing Parts */}
            <div className="space-y-3">
              <Label>缺少配件 (可多选)</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {missingPartsList.map((part) => (
                  <div
                    key={part.id}
                    className="flex items-center space-x-2 rounded-lg border p-3"
                  >
                    <Checkbox
                      id={part.id}
                      checked={selectedMissingParts.includes(part.id)}
                      onCheckedChange={() => toggleMissingPart(part.id)}
                    />
                    <label
                      htmlFor={part.id}
                      className="text-sm font-medium leading-none"
                    >
                      {part.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">备注</Label>
              <Textarea
                id="notes"
                placeholder="输入其他备注信息..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsProcessDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleProcessComplete}
              className="gradient-primary"
              disabled={createMutation.isPending}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              完成处理 & 打印标签
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Processed Items Table */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">已处理记录</h3>
        <DataTable
          columns={columns}
          data={inboundItems || []}
          emptyMessage="暂无入库处理记录"
        />
      </div>

      {/* Delete Confirmation */}
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
