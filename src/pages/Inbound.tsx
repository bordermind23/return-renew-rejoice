import { useState, useRef, useEffect } from "react";
import { ScanLine, Camera, Package, CheckCircle, Trash2, Search, PackageCheck, AlertCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { GradeBadge } from "@/components/ui/grade-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  useInboundItems,
  useCreateInboundItem,
  useDeleteInboundItem,
  type InboundItem,
} from "@/hooks/useInboundItems";
import { useRemovalShipments, useUpdateRemovalShipment, type RemovalShipment } from "@/hooks/useRemovalShipments";
import { useOrders, type Order } from "@/hooks/useOrders";
import { useUpdateInventoryStock, useDecreaseInventoryStock } from "@/hooks/useInventoryItems";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Scanner } from "@/components/Scanner";

const missingPartsList = [
  { id: "earbuds", label: "耳塞套" },
  { id: "cable", label: "充电线" },
  { id: "manual", label: "说明书" },
  { id: "box", label: "原装包装盒" },
  { id: "adapter", label: "电源适配器" },
];

type InboundStep = "scan_tracking" | "scan_lpn" | "process";

export default function Inbound() {
  const [currentStep, setCurrentStep] = useState<InboundStep>("scan_tracking");
  const [trackingInput, setTrackingInput] = useState("");
  const [lpnInput, setLpnInput] = useState("");
  const [matchedShipment, setMatchedShipment] = useState<RemovalShipment | null>(null);
  const [matchedOrder, setMatchedOrder] = useState<Order | null>(null);
  const [scannedLpns, setScannedLpns] = useState<string[]>([]);
  const [currentLpn, setCurrentLpn] = useState("");
  
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedMissingParts, setSelectedMissingParts] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [returnReason, setReturnReason] = useState("");
  
  const lpnInputRef = useRef<HTMLInputElement>(null);
  const trackingInputRef = useRef<HTMLInputElement>(null);

  const { data: inboundItems, isLoading: inboundLoading } = useInboundItems();
  const { data: shipments, isLoading: shipmentsLoading } = useRemovalShipments();
  const { data: orders, isLoading: ordersLoading } = useOrders();
  const createMutation = useCreateInboundItem();
  const deleteMutation = useDeleteInboundItem();
  const updateShipmentMutation = useUpdateRemovalShipment();
  const updateInventoryMutation = useUpdateInventoryStock();
  const decreaseInventoryMutation = useDecreaseInventoryStock();

  // 自动聚焦输入框
  useEffect(() => {
    if (currentStep === "scan_tracking" && trackingInputRef.current) {
      trackingInputRef.current.focus();
    } else if (currentStep === "scan_lpn" && lpnInputRef.current) {
      lpnInputRef.current.focus();
    }
  }, [currentStep]);

  // 获取该物流号已入库的LPN数量
  const getInboundedCount = (trackingNumber: string) => {
    return (inboundItems || []).filter(item => item.tracking_number === trackingNumber).length;
  };

  // 扫描物流跟踪号
  const handleScanTracking = () => {
    if (!trackingInput.trim()) {
      toast.error("请输入物流跟踪号");
      return;
    }

    const found = shipments?.find(
      s => s.tracking_number.toLowerCase() === trackingInput.trim().toLowerCase()
    );

    if (!found) {
      toast.error(`未找到物流跟踪号: ${trackingInput}`);
      return;
    }

    const inboundedCount = getInboundedCount(found.tracking_number);
    if (inboundedCount >= found.quantity) {
      toast.warning(`该物流号下的 ${found.quantity} 件货物已全部入库`);
      return;
    }

    setMatchedShipment(found);
    setScannedLpns([]);
    setCurrentStep("scan_lpn");
    toast.success(`匹配成功: ${found.product_name}`);
  };

  // 验证 LPN 是否存在于退货订单列表并获取订单信息
  const getOrderByLpn = (lpn: string) => {
    return orders?.find(o => o.lpn === lpn);
  };

  const validateLpnExists = (lpn: string): boolean => {
    return !!getOrderByLpn(lpn);
  };

  // 扫描 LPN (支持手动输入和摄像头扫码)
  const handleScanLpn = (lpnValue?: string) => {
    const lpn = (lpnValue || lpnInput).trim();
    
    if (!lpn) {
      toast.error("请输入LPN号");
      return;
    }

    // 检查LPN是否存在于退货订单列表
    if (!validateLpnExists(lpn)) {
      toast.error(`LPN号 "${lpn}" 不存在于退货订单列表中，请先在退货订单列表中添加该LPN`);
      setLpnInput("");
      return;
    }

    // 检查是否已扫描过
    if (scannedLpns.includes(lpn)) {
      toast.error("该LPN已扫描过");
      setLpnInput("");
      return;
    }

    // 检查是否已存在于入库记录
    const existingItem = inboundItems?.find(item => item.lpn === lpn);
    if (existingItem) {
      toast.error("该LPN已入库");
      setLpnInput("");
      return;
    }

    setCurrentLpn(lpn);
    setMatchedOrder(getOrderByLpn(lpn) || null);
    setIsProcessDialogOpen(true);
    setLpnInput("");
  };

  // 处理摄像头扫描物流号
  const handleCameraScanTracking = (code: string) => {
    setTrackingInput(code);
    const found = shipments?.find(
      s => s.tracking_number.toLowerCase() === code.trim().toLowerCase()
    );

    if (!found) {
      toast.error(`未找到物流跟踪号: ${code}`);
      return;
    }

    const inboundedCount = getInboundedCount(found.tracking_number);
    if (inboundedCount >= found.quantity) {
      toast.warning(`该物流号下的 ${found.quantity} 件货物已全部入库`);
      return;
    }

    setMatchedShipment(found);
    setScannedLpns([]);
    setCurrentStep("scan_lpn");
    toast.success(`匹配成功: ${found.product_name}`);
  };

  // 处理摄像头扫描LPN
  const handleCameraScanLpn = (code: string) => {
    handleScanLpn(code);
  };

  // 完成单个 LPN 处理
  const handleProcessComplete = () => {
    if (!selectedGrade) {
      toast.error("请选择产品级别");
      return;
    }

    if (!matchedShipment) {
      toast.error("货件信息丢失");
      return;
    }

    const missingPartsLabels = selectedMissingParts.map(
      (id) => missingPartsList.find((p) => p.id === id)?.label || id
    );

    createMutation.mutate(
      {
        lpn: currentLpn,
        removal_order_id: matchedShipment.order_id,
        product_sku: matchedShipment.product_sku,
        product_name: matchedShipment.product_name,
        return_reason: returnReason || null,
        grade: selectedGrade as "A" | "B" | "C" | "new",
        missing_parts: missingPartsLabels.length > 0 ? missingPartsLabels : null,
        processed_at: new Date().toISOString(),
        processed_by: "操作员",
        tracking_number: matchedShipment.tracking_number,
        shipment_id: matchedShipment.id,
      },
      {
        onSuccess: () => {
          // 同步更新库存
          updateInventoryMutation.mutate({
            sku: matchedShipment.product_sku,
            product_name: matchedShipment.product_name,
            grade: selectedGrade as "A" | "B" | "C",
            quantity: 1,
          });

          const newScannedLpns = [...scannedLpns, currentLpn];
          setScannedLpns(newScannedLpns);
          
          // 检查是否全部完成
          const totalInbounded = getInboundedCount(matchedShipment.tracking_number) + 1;
          
          if (totalInbounded >= matchedShipment.quantity) {
            // 更新货件状态为已入库
            updateShipmentMutation.mutate({
              id: matchedShipment.id,
              status: "inbound"
            });
            toast.success(`所有 ${matchedShipment.quantity} 件货物已全部入库！`);
            handleReset();
          } else {
            toast.success(`入库成功！还剩 ${matchedShipment.quantity - totalInbounded} 件待入库`);
          }
          
          setIsProcessDialogOpen(false);
          resetProcessForm();
          
          // 聚焦回 LPN 输入框
          setTimeout(() => {
            lpnInputRef.current?.focus();
          }, 100);
        },
      }
    );
  };

  const resetProcessForm = () => {
    setSelectedGrade("");
    setSelectedMissingParts([]);
    setNotes("");
    setReturnReason("");
    setCurrentLpn("");
  };

  const handleReset = () => {
    setCurrentStep("scan_tracking");
    setMatchedShipment(null);
    setScannedLpns([]);
    setTrackingInput("");
    setLpnInput("");
    resetProcessForm();
  };

  const toggleMissingPart = (partId: string) => {
    setSelectedMissingParts((prev) =>
      prev.includes(partId)
        ? prev.filter((id) => id !== partId)
        : [...prev, partId]
    );
  };

  const handleDelete = () => {
    if (deleteId && inboundItems) {
      // 找到要删除的入库记录
      const itemToDelete = inboundItems.find(item => item.id === deleteId);
      
      if (itemToDelete) {
        // 先扣减库存
        decreaseInventoryMutation.mutate({
          sku: itemToDelete.product_sku,
          grade: itemToDelete.grade as "A" | "B" | "C",
          quantity: 1,
        });
      }
      
      // 删除入库记录
      deleteMutation.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  const isLoading = inboundLoading || shipmentsLoading || ordersLoading;

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
        description="先扫描物流跟踪号匹配货件，再逐个扫描LPN进行入库"
      />

      {/* 步骤指示器 */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`flex items-center gap-2 ${currentStep === "scan_tracking" ? "text-primary font-medium" : "text-muted-foreground"}`}>
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${currentStep === "scan_tracking" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            1
          </div>
          <span>扫描物流号</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 ${currentStep === "scan_lpn" ? "text-primary font-medium" : "text-muted-foreground"}`}>
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${currentStep === "scan_lpn" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            2
          </div>
          <span>扫描LPN入库</span>
        </div>
      </div>

      {/* 步骤1：扫描物流跟踪号 */}
      {currentStep === "scan_tracking" && (
        <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5 text-primary" />
              第一步：扫描物流跟踪号
            </CardTitle>
            <CardDescription>
              扫描包裹上的物流跟踪号，系统将自动匹配移除货件记录
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Input
                  ref={trackingInputRef}
                  placeholder="扫描或输入物流跟踪号..."
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScanTracking()}
                  className="text-lg"
                />
              </div>
              <Button onClick={handleScanTracking} className="gradient-primary">
                <ScanLine className="mr-2 h-4 w-4" />
                确认扫描
              </Button>
              <Scanner onScan={handleCameraScanTracking} buttonLabel="摄像头" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 步骤2：扫描 LPN */}
      {currentStep === "scan_lpn" && matchedShipment && (
        <>
          {/* 匹配到的货件信息 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PackageCheck className="h-5 w-5 text-green-500" />
                  已匹配货件
                </CardTitle>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  重新扫描
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">物流跟踪号</p>
                  <p className="font-medium">{matchedShipment.tracking_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">移除订单号</p>
                  <p className="font-medium">{matchedShipment.order_id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">产品名称</p>
                  <p className="font-medium">{matchedShipment.product_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">产品SKU</p>
                  <p className="font-medium">{matchedShipment.product_sku}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">承运商</p>
                  <p className="font-medium">{matchedShipment.carrier}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">店铺</p>
                  <p className="font-medium">{matchedShipment.store_name || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">国家</p>
                  <p className="font-medium">{matchedShipment.country || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">总件数</p>
                  <p className="font-medium">{matchedShipment.quantity} 件</p>
                </div>
              </div>

              {/* 入库进度 */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">入库进度</span>
                  <span className="text-sm font-medium">
                    {getInboundedCount(matchedShipment.tracking_number) + scannedLpns.length} / {matchedShipment.quantity}
                  </span>
                </div>
                <Progress 
                  value={((getInboundedCount(matchedShipment.tracking_number) + scannedLpns.length) / matchedShipment.quantity) * 100} 
                />
              </div>
            </CardContent>
          </Card>

          {/* 扫描 LPN */}
          <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ScanLine className="h-5 w-5 text-primary" />
                第二步：扫描LPN号
              </CardTitle>
              <CardDescription>
                逐个扫描产品的LPN号进行入库处理
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-1">
                  <Input
                    ref={lpnInputRef}
                    placeholder="扫描或输入LPN号..."
                    value={lpnInput}
                    onChange={(e) => setLpnInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleScanLpn()}
                    className="text-lg"
                  />
                </div>
                <Button onClick={() => handleScanLpn()} className="gradient-primary">
                  <ScanLine className="mr-2 h-4 w-4" />
                  确认扫描
                </Button>
                <Scanner onScan={handleCameraScanLpn} buttonLabel="摄像头" />
              </div>

              {/* 本次已扫描的 LPN 列表 */}
              {scannedLpns.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">本次已扫描 LPN：</p>
                  <div className="flex flex-wrap gap-2">
                    {scannedLpns.map((lpn) => (
                      <Badge key={lpn} variant="secondary">
                        {lpn}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* 处理对话框 */}
      <Dialog open={isProcessDialogOpen} onOpenChange={setIsProcessDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              产品入库处理 - {currentLpn}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* 退货订单信息 */}
            {matchedOrder && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">退货订单信息</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground">产品名称</p><p className="font-medium">{matchedOrder.product_name || "-"}</p></div>
                  <div><p className="text-muted-foreground">产品SKU</p><p className="font-medium">{matchedOrder.product_sku || "-"}</p></div>
                  <div><p className="text-muted-foreground">退货原因</p><p className="font-medium">{matchedOrder.return_reason || "-"}</p></div>
                  <div><p className="text-muted-foreground">买家备注</p><p className="font-medium">{matchedOrder.buyer_note || "-"}</p></div>
                  <div><p className="text-muted-foreground">店铺</p><p className="font-medium">{matchedOrder.store_name}</p></div>
                  <div><p className="text-muted-foreground">国家</p><p className="font-medium">{matchedOrder.country || "-"}</p></div>
                  <div><p className="text-muted-foreground">FNSKU</p><p className="font-medium">{matchedOrder.fnsku || "-"}</p></div>
                  <div><p className="text-muted-foreground">ASIN</p><p className="font-medium">{matchedOrder.asin || "-"}</p></div>
                </div>
              </div>
            )}

            {/* 产品信息（只读） */}
            {matchedShipment && (
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">产品名称</p>
                    <p className="font-medium">{matchedShipment.product_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">产品SKU</p>
                    <p className="font-medium">{matchedShipment.product_sku}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 退货理由 */}
            <div className="space-y-2">
              <Label htmlFor="return_reason">退货理由</Label>
              <Input
                id="return_reason"
                placeholder="输入退货理由（可选）"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
              />
            </div>

            {/* 拍照上传 */}
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

            {/* 级别选择 */}
            <div className="space-y-2">
              <Label>设定产品级别 *</Label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="选择产品级别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A级 - 轻微使用痕迹</SelectItem>
                  <SelectItem value="B">B级 - 明显使用痕迹或缺少配件</SelectItem>
                  <SelectItem value="C">C级 - 功能或外观有问题</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 缺少配件 */}
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
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {part.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* 备注 */}
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
            <Button variant="outline" onClick={() => {
              setIsProcessDialogOpen(false);
              resetProcessForm();
            }}>
              取消
            </Button>
            <Button
              onClick={handleProcessComplete}
              className="gradient-primary"
              disabled={createMutation.isPending}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              完成入库
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 已处理记录表格 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">已入库记录</h3>
        <Card>
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold min-w-[120px]">LPN号</TableHead>
                  <TableHead className="font-semibold min-w-[140px]">物流跟踪号</TableHead>
                  <TableHead className="font-semibold min-w-[120px]">移除订单号</TableHead>
                  <TableHead className="font-semibold min-w-[100px]">产品SKU</TableHead>
                  <TableHead className="font-semibold min-w-[150px]">产品名称</TableHead>
                  <TableHead className="font-semibold min-w-[80px]">级别</TableHead>
                  <TableHead className="font-semibold min-w-[120px]">缺少配件</TableHead>
                  <TableHead className="font-semibold min-w-[150px]">处理时间</TableHead>
                  <TableHead className="font-semibold min-w-[80px] text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!inboundItems || inboundItems.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      暂无入库处理记录
                    </TableCell>
                  </TableRow>
                ) : (
                  inboundItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">{item.lpn}</code>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.tracking_number || "-"}
                      </TableCell>
                      <TableCell>{item.removal_order_id}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.product_sku}</code>
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-1" title={item.product_name}>{item.product_name}</span>
                      </TableCell>
                      <TableCell>
                        <GradeBadge grade={item.grade as "A" | "B" | "C"} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.missing_parts && item.missing_parts.length > 0
                          ? item.missing_parts.join(", ")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(item.processed_at).toLocaleString("zh-CN")}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
        
        <div className="text-sm text-muted-foreground">
          共 {inboundItems?.length || 0} 条入库记录
        </div>
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
