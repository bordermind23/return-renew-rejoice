import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { type Order } from "@/hooks/useOrders";
import { fetchOrdersByLpn } from "@/hooks/useOrdersByLpn";
import { useUpdateInventoryStock, useDecreaseInventoryStock } from "@/hooks/useInventoryItems";
import { useProducts, useProductParts, type ProductPart } from "@/hooks/useProducts";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Scanner } from "@/components/Scanner";
import { SequentialPhotoCapture } from "@/components/SequentialPhotoCapture";
import { MobileInboundScanner } from "@/components/MobileInboundScanner";
import { InboundBatchList } from "@/components/InboundBatchList";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

type InboundStep = "scan_tracking" | "scan_lpn" | "process";

export default function Inbound() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [currentStep, setCurrentStep] = useState<InboundStep>("scan_tracking");
  const [trackingInput, setTrackingInput] = useState("");
  const [lpnInput, setLpnInput] = useState("");
  const [matchedShipment, setMatchedShipment] = useState<RemovalShipment | null>(null);
  const [matchedOrders, setMatchedOrders] = useState<Order[]>([]);
  const [scannedLpns, setScannedLpns] = useState<string[]>([]);
  const [currentLpn, setCurrentLpn] = useState("");
  
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedMissingParts, setSelectedMissingParts] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<Record<string, string>>({});
  
  const lpnInputRef = useRef<HTMLInputElement>(null);
  const trackingInputRef = useRef<HTMLInputElement>(null);

  const { data: inboundItems, isLoading: inboundLoading } = useInboundItems();
  const { data: shipments, isLoading: shipmentsLoading } = useRemovalShipments();
  const ordersLoading = false;
  const { data: products } = useProducts();
  const createMutation = useCreateInboundItem();
  const deleteMutation = useDeleteInboundItem();
  const updateShipmentMutation = useUpdateRemovalShipment();
  const updateInventoryMutation = useUpdateInventoryStock();
  const decreaseInventoryMutation = useDecreaseInventoryStock();

  // 通过 SKU 找到对应产品并获取其配件
  const matchedProduct = matchedShipment 
    ? products?.find(p => p.sku === matchedShipment.product_sku)
    : null;
  const { data: productParts } = useProductParts(matchedProduct?.id || null);

  // 自动聚焦输入框
  useEffect(() => {
    if (currentStep === "scan_tracking" && trackingInputRef.current) {
      trackingInputRef.current.focus();
    } else if (currentStep === "scan_lpn" && lpnInputRef.current) {
      lpnInputRef.current.focus();
    }
  }, [currentStep]);

  // 从 URL 参数恢复物流号状态（手机端入库完成后返回）
  useEffect(() => {
    const trackingFromUrl = searchParams.get("tracking");
    if (trackingFromUrl && shipments) {
      const found = shipments.find(
        s => s.tracking_number.toLowerCase() === trackingFromUrl.toLowerCase()
      );
      if (found) {
        const inboundedCount = getInboundedCount(found.tracking_number);
        if (inboundedCount < found.quantity) {
          setMatchedShipment(found);
          setTrackingInput(found.tracking_number);
          setCurrentStep("scan_lpn");
        }
      }
    }
  }, [searchParams, shipments]);

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

  // 通过后端按 LPN 精确查询（避免 1000 行上限导致漏数据）
  const getOrdersByLpn = async (lpn: string) => {
    const matchedOrders = await fetchOrdersByLpn(lpn);
    console.log(`[getOrdersByLpn] LPN: ${lpn}, 找到 ${matchedOrders.length} 条订单`, matchedOrders);
    return matchedOrders;
  };


  // 扫描 LPN (支持手动输入和摄像头扫码)
  const handleScanLpn = async (lpnValue?: string) => {
    const lpn = (lpnValue || lpnInput).trim();

    if (!lpn) {
      toast.error("请输入LPN号");
      return;
    }

    // 检查LPN是否存在于退货订单列表（直接按LPN查询，避免 orders 1000 行上限）
    const lpnOrders = await getOrdersByLpn(lpn);
    if (lpnOrders.length === 0) {
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

    // 手机端跳转到新页面处理
    if (isMobile && matchedShipment) {
      navigate(`/inbound/process?lpn=${encodeURIComponent(lpn)}&tracking=${encodeURIComponent(matchedShipment.tracking_number)}`);
      setLpnInput("");
      return;
    }

    setCurrentLpn(lpn);
    console.log("[handleScanLpn] Found orders for LPN:", lpn, lpnOrders);
    setMatchedOrders(lpnOrders);
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

    // 配件标签直接使用选中的配件名称
    const missingPartsLabels = selectedMissingParts;

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
        // 照片字段
        lpn_label_photo: capturedPhotos.lpn_label_photo || null,
        packaging_photo_1: capturedPhotos.packaging_photo_1 || null,
        packaging_photo_2: capturedPhotos.packaging_photo_2 || null,
        packaging_photo_3: capturedPhotos.packaging_photo_3 || null,
        packaging_photo_4: capturedPhotos.packaging_photo_4 || null,
        packaging_photo_5: capturedPhotos.packaging_photo_5 || null,
        packaging_photo_6: capturedPhotos.packaging_photo_6 || null,
        accessories_photo: capturedPhotos.accessories_photo || null,
        detail_photo: capturedPhotos.detail_photo || null,
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
    setCapturedPhotos({});
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

  // 手机端和平板端使用独立的扫描界面
  if (isMobile) {
    return <MobileInboundScanner initialTracking={searchParams.get("tracking") || undefined} />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-6">
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg pr-8">
              <Package className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="truncate">产品入库处理 - {currentLpn}</span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="grid gap-4 py-4">
              {/* 退货订单信息 - 显示所有匹配的订单 */}
              {matchedOrders.length > 0 && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                    退货订单信息 {matchedOrders.length > 1 && <Badge variant="secondary" className="ml-2">{matchedOrders.length}条记录</Badge>}
                  </h4>
                  <div className="space-y-3">
                    {matchedOrders.map((order, index) => (
                      <div key={order.id} className={cn("grid grid-cols-2 gap-2 text-sm", index > 0 && "pt-3 border-t border-blue-200 dark:border-blue-700")}>
                        {matchedOrders.length > 1 && (
                          <div className="col-span-2 text-xs text-blue-600 dark:text-blue-400 font-medium">订单 {index + 1}</div>
                        )}
                        <div><p className="text-muted-foreground text-xs">产品名称</p><p className="font-medium text-sm">{order.product_name || "-"}</p></div>
                        <div><p className="text-muted-foreground text-xs">产品SKU</p><p className="font-medium text-sm">{order.product_sku || "-"}</p></div>
                        <div><p className="text-muted-foreground text-xs">退货原因</p><p className="font-medium text-sm">{order.return_reason || "-"}</p></div>
                        <div><p className="text-muted-foreground text-xs">买家备注</p><p className="font-medium text-sm">{order.buyer_note || "-"}</p></div>
                        <div><p className="text-muted-foreground text-xs">店铺</p><p className="font-medium text-sm">{order.store_name}</p></div>
                        <div><p className="text-muted-foreground text-xs">订单号</p><p className="font-medium text-sm">{order.order_number}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 产品信息（只读） */}
              {matchedShipment && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">产品名称</p>
                      <p className="font-medium">{matchedShipment.product_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">产品SKU</p>
                      <p className="font-medium">{matchedShipment.product_sku}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 退货理由 */}
              <div className="space-y-2">
                <Label htmlFor="return_reason" className="text-sm">退货理由</Label>
                <Input
                  id="return_reason"
                  placeholder="输入退货理由（可选）"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* 拍照上传 */}
              <div className="space-y-2">
                <Label className="text-sm">产品拍照 ({Object.keys(capturedPhotos).length}/9)</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-20 border-2 border-dashed"
                  onClick={() => setIsPhotoCaptureOpen(true)}
                >
                  <div className="text-center">
                    <Camera className="mx-auto h-6 w-6 text-muted-foreground" />
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {Object.keys(capturedPhotos).length > 0 
                        ? `已拍摄 ${Object.keys(capturedPhotos).length} 张，点击继续` 
                        : "点击开始顺序拍照"}
                    </span>
                  </div>
                </Button>
                {/* 已拍摄缩略图 */}
                {Object.keys(capturedPhotos).length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {Object.entries(capturedPhotos).map(([key, url]) => (
                      <div key={key} className="flex-shrink-0 w-12 h-12 rounded overflow-hidden border">
                        <img src={url} alt={key} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 级别选择 - 改为点击框 */}
              <div className="space-y-2">
                <Label className="text-sm">设定产品级别 *</Label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedGrade("A")}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all",
                      selectedGrade === "A"
                        ? "border-info bg-info/10 ring-2 ring-info/30"
                        : "border-muted hover:border-info/50 hover:bg-info/5"
                    )}
                  >
                    <GradeBadge grade="A" />
                    <span className="mt-2 text-xs text-muted-foreground">轻微使用痕迹</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedGrade("B")}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all",
                      selectedGrade === "B"
                        ? "border-warning bg-warning/10 ring-2 ring-warning/30"
                        : "border-muted hover:border-warning/50 hover:bg-warning/5"
                    )}
                  >
                    <GradeBadge grade="B" />
                    <span className="mt-2 text-xs text-muted-foreground">明显使用痕迹</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedGrade("C")}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all",
                      selectedGrade === "C"
                        ? "border-destructive bg-destructive/10 ring-2 ring-destructive/30"
                        : "border-muted hover:border-destructive/50 hover:bg-destructive/5"
                    )}
                  >
                    <GradeBadge grade="C" />
                    <span className="mt-2 text-xs text-muted-foreground">功能外观问题</span>
                  </button>
                </div>
              </div>

              {/* 缺少配件 - 使用产品配件列表 */}
              <div className="space-y-2">
                <Label className="text-sm">缺少配件 (可多选)</Label>
                {productParts && productParts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {productParts.map((part) => (
                      <div
                        key={part.id}
                        className="flex items-center space-x-2 rounded-lg border p-2"
                      >
                        <Checkbox
                          id={part.id}
                          checked={selectedMissingParts.includes(part.name)}
                          onCheckedChange={() => toggleMissingPart(part.name)}
                        />
                        <label
                          htmlFor={part.id}
                          className="text-sm font-medium leading-none cursor-pointer flex-1"
                        >
                          {part.name} {part.quantity > 1 && <span className="text-muted-foreground">x{part.quantity}</span>}
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
                    {matchedProduct ? "该产品暂无配件信息，请在产品管理中添加" : "未匹配到产品配件信息"}
                  </p>
                )}
              </div>

              {/* 备注 */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm">备注</Label>
                <Textarea
                  id="notes"
                  placeholder="输入其他备注信息..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-3 pt-4 border-t flex-shrink-0 mt-4">
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

      {/* 已处理记录 - 按批次分组 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">已入库记录</h3>
        <InboundBatchList 
          items={inboundItems || []} 
          onDelete={(id) => setDeleteId(id)} 
        />
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

      {/* 顺序拍照弹窗 - 使用全屏模式 */}
      {isPhotoCaptureOpen && (
        <SequentialPhotoCapture
          lpn={currentLpn}
          onComplete={(photos) => {
            setCapturedPhotos(photos);
            setIsPhotoCaptureOpen(false);
          }}
          onCancel={() => setIsPhotoCaptureOpen(false)}
        />
      )}
    </div>
  );
}
