import { useState } from "react";
import { ScanLine, Camera, Package, CheckCircle } from "lucide-react";
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
  DialogTrigger,
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
import { mockInboundItems, type InboundItem } from "@/data/mockData";
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

  const handleScan = () => {
    if (scanCode.trim()) {
      toast.success(`扫描成功: ${scanCode}`);
      setIsProcessDialogOpen(true);
      setScanCode("");
    }
  };

  const handleProcessComplete = () => {
    if (!selectedGrade) {
      toast.error("请选择产品级别");
      return;
    }
    setIsProcessDialogOpen(false);
    setSelectedGrade("");
    setSelectedMissingParts([]);
    toast.success("入库处理完成，已生成新的LPN标签");
  };

  const toggleMissingPart = (partId: string) => {
    setSelectedMissingParts((prev) =>
      prev.includes(partId)
        ? prev.filter((id) => id !== partId)
        : [...prev, partId]
    );
  };

  const columns = [
    {
      key: "lpn",
      header: "LPN号",
      render: (item: InboundItem) => (
        <span className="font-mono font-medium text-primary">{item.lpn}</span>
      ),
    },
    { key: "removalOrderId", header: "移除订单号" },
    { key: "productSku", header: "产品SKU" },
    { key: "productName", header: "产品名称" },
    { key: "returnReason", header: "退货理由" },
    {
      key: "grade",
      header: "产品级别",
      render: (item: InboundItem) => <GradeBadge grade={item.grade} />,
    },
    {
      key: "missingParts",
      header: "缺少配件",
      render: (item: InboundItem) =>
        item.missingParts && item.missingParts.length > 0
          ? item.missingParts.join(", ")
          : "-",
    },
    { key: "processedAt", header: "处理时间" },
    { key: "processedBy", header: "处理人" },
  ];

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
            {/* Product Info */}
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">产品名称:</span>
                  <span className="ml-2 font-medium">运动蓝牙耳机</span>
                </div>
                <div>
                  <span className="text-muted-foreground">SKU:</span>
                  <span className="ml-2 font-medium">SKU-001</span>
                </div>
                <div>
                  <span className="text-muted-foreground">移除订单:</span>
                  <span className="ml-2 font-medium">RM-2024-001</span>
                </div>
                <div>
                  <span className="text-muted-foreground">退货理由:</span>
                  <span className="ml-2 font-medium">尺寸不合适</span>
                </div>
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
              <Textarea id="notes" placeholder="输入其他备注信息..." />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsProcessDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleProcessComplete} className="gradient-primary">
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
          data={mockInboundItems}
          emptyMessage="暂无入库处理记录"
        />
      </div>
    </div>
  );
}
