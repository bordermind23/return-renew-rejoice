import { useState, useEffect } from "react";
import { ScanLine, Package, CheckCircle, X, ArrowRight, Truck, AlertCircle, Camera, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Scanner } from "@/components/Scanner";
import { NativePhotoCapture } from "@/components/NativePhotoCapture";
import { ScanFeedbackOverlay, type ScanFeedbackType } from "@/components/ScanFeedbackOverlay";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { useRemovalShipments, useUpdateRemovalShipment, type RemovalShipment } from "@/hooks/useRemovalShipments";
import { useInboundItems, useCreateInboundItem } from "@/hooks/useInboundItems";
import { useUpdateInventoryStock } from "@/hooks/useInventoryItems";
import { useProducts, useProductParts } from "@/hooks/useProducts";
import { fetchOrdersByLpn } from "@/hooks/useOrdersByLpn";
import { type Order, useUpdateOrder } from "@/hooks/useOrders";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// 振动反馈工具函数
const vibrate = (pattern: number | number[]) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // 忽略不支持振动的设备
    }
  }
};

const vibrateSuccess = () => vibrate([50, 50, 50]);
const vibrateError = () => vibrate(200);
const vibrateWarning = () => vibrate([100, 50, 100]);

type ScanStep = "idle" | "scan_tracking" | "scan_lpn";

interface MobileInboundScannerProps {
  initialTracking?: string;
}

export function MobileInboundScanner({ initialTracking }: MobileInboundScannerProps) {
  const [step, setStep] = useState<ScanStep>("idle");
  const [trackingInput, setTrackingInput] = useState("");
  const [lpnInput, setLpnInput] = useState("");
  const [matchedShipment, setMatchedShipment] = useState<RemovalShipment | null>(null);
  const [matchedShipments, setMatchedShipments] = useState<RemovalShipment[]>([]);
  const [scannedLpns, setScannedLpns] = useState<string[]>([]);

  // 处理对话框状态
  const [isProcessDrawerOpen, setIsProcessDrawerOpen] = useState(false);
  const [currentLpn, setCurrentLpn] = useState("");
  const [matchedOrders, setMatchedOrders] = useState<Order[]>([]);
  const [selectedMissingParts, setSelectedMissingParts] = useState<string[]>([]);
  const [hasProductDamage, setHasProductDamage] = useState(false);
  const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<Record<string, string>>({});
  const [skuMismatchWarning, setSkuMismatchWarning] = useState<{ lpnSku: string; shipmentSkus: string[] } | null>(null);
  const [overQuantityWarning, setOverQuantityWarning] = useState(false);
  const [isForceCompleteOpen, setIsForceCompleteOpen] = useState(false);
  
  // 扫描反馈动画状态
  const [scanFeedback, setScanFeedback] = useState<{ type: ScanFeedbackType; message?: string }>({ type: null });

  const showScanFeedback = (type: ScanFeedbackType, message?: string) => {
    setScanFeedback({ type, message });
  };

  const clearScanFeedback = () => {
    setScanFeedback({ type: null });
  };

  const { data: shipments } = useRemovalShipments();
  const { data: inboundItems } = useInboundItems();
  const { data: products } = useProducts();
  const createMutation = useCreateInboundItem();
  const updateShipmentMutation = useUpdateRemovalShipment();
  const updateInventoryMutation = useUpdateInventoryStock();
  const updateOrderMutation = useUpdateOrder();

  const currentOrderSku = matchedOrders.length > 0 && matchedOrders[0].product_sku
    ? matchedOrders[0].product_sku
    : matchedShipment?.product_sku;
  const matchedProduct = currentOrderSku
    ? products?.find(p => p.sku === currentOrderSku)
    : null;
  const { data: productParts } = useProductParts(matchedProduct?.id || null);

  // 获取该物流号已入库的LPN数量
  const getInboundedCount = (trackingNumber: string) => {
    return (inboundItems || []).filter(item => item.tracking_number === trackingNumber).length;
  };

  const getInboundedCountBySku = (trackingNumber: string, sku: string) => {
    return (inboundItems || []).filter(
      item => item.tracking_number === trackingNumber && item.product_sku === sku
    ).length;
  };

  // 初始化时如果有传入的物流号，自动进入扫描LPN步骤
  useEffect(() => {
    if (initialTracking && shipments) {
      const allMatched = shipments.filter(
        s => s.tracking_number.toLowerCase() === initialTracking.toLowerCase()
      );
      if (allMatched.length > 0) {
        const totalQuantity = allMatched.reduce((sum, s) => sum + s.quantity, 0);
        const inboundedCount = getInboundedCount(allMatched[0].tracking_number);
        if (inboundedCount < totalQuantity) {
          setMatchedShipment(allMatched[0]);
          setMatchedShipments(allMatched);
          setTrackingInput(allMatched[0].tracking_number);
          setStep("scan_lpn");
        }
      }
    }
  }, [initialTracking, shipments]);

  // 开始扫描流程
  const startScanning = () => {
    setStep("scan_tracking");
  };

  // 处理物流号扫描
  const handleTrackingScan = (code: string) => {
    const trackingCode = code.trim();
    if (!trackingCode) return;

    const allMatched = shipments?.filter(
      s => s.tracking_number.toLowerCase() === trackingCode.toLowerCase()
    ) || [];

    if (allMatched.length === 0) {
      vibrateError();
      showScanFeedback("error", "未找到物流跟踪号");
      toast.error(`未找到物流跟踪号: ${trackingCode}`);
      return;
    }

    const totalQuantity = allMatched.reduce((sum, s) => sum + s.quantity, 0);
    const inboundedCount = getInboundedCount(allMatched[0].tracking_number);
    if (inboundedCount >= totalQuantity) {
      vibrateWarning();
      showScanFeedback("warning", "货物已全部入库");
      toast.warning(`该物流号下的 ${totalQuantity} 件货物已全部入库`);
      return;
    }

    vibrateSuccess();
    showScanFeedback("success", `匹配成功: ${allMatched.length} 种产品`);
    setMatchedShipment(allMatched[0]);
    setMatchedShipments(allMatched);
    setTrackingInput(trackingCode);
    setScannedLpns([]);
    setTimeout(() => setStep("scan_lpn"), 800);
    const productNames = [...new Set(allMatched.map(s => s.product_name))];
    toast.success(`匹配成功: ${allMatched.length} 种产品`);
  };

  // 处理LPN扫描
  const handleLpnScan = async (code: string) => {
    const lpn = code.trim();
    if (!lpn) return;

    // 检查LPN是否存在于退货订单列表
    const lpnOrders = await fetchOrdersByLpn(lpn);
    if (lpnOrders.length === 0) {
      vibrateError();
      showScanFeedback("error", "LPN不在退货订单中");
      toast.error(`LPN号 "${lpn}" 不存在于退货订单列表中`);
      setLpnInput("");
      return;
    }

    // 检查是否已扫描过
    if (scannedLpns.includes(lpn)) {
      vibrateWarning();
      showScanFeedback("warning", "该LPN已扫描过");
      toast.error("该LPN已扫描过");
      setLpnInput("");
      return;
    }

    // 检查是否已存在于入库记录
    const existingItem = inboundItems?.find(item => item.lpn === lpn);
    if (existingItem) {
      vibrateWarning();
      showScanFeedback("warning", "该LPN已入库");
      toast.error("该LPN已入库");
      setLpnInput("");
      return;
    }

    // SKU匹配检查
    const lpnSku = lpnOrders[0].product_sku;
    const shipmentSkus = matchedShipments.map(s => s.product_sku);
    const isSkuMatched = !lpnSku || shipmentSkus.includes(lpnSku);
    
    if (!isSkuMatched) {
      setSkuMismatchWarning({
        lpnSku: lpnSku || "未知",
        shipmentSkus: shipmentSkus,
      });
    } else {
      setSkuMismatchWarning(null);
    }

    // 数量检查
    const totalQuantity = matchedShipments.reduce((sum, s) => sum + s.quantity, 0);
    const currentInbounded = getInboundedCount(matchedShipment?.tracking_number || "");
    const willExceed = currentInbounded + 1 > totalQuantity;
    
    if (willExceed) {
      setOverQuantityWarning(true);
      vibrateWarning();
    } else {
      setOverQuantityWarning(false);
    }

    // 成功振动并打开处理抽屉
    vibrateSuccess();
    showScanFeedback("success", "LPN匹配成功");
    setCurrentLpn(lpn);
    setMatchedOrders(lpnOrders);
    setTimeout(() => setIsProcessDrawerOpen(true), 600);
    setLpnInput("");
  };

  // 处理入库完成
  const handleProcessComplete = () => {
    if (!matchedShipment) {
      toast.error("货件信息丢失");
      return;
    }

    // 如果有配件缺失或产品损坏，必须拍照
    const needsPhoto = selectedMissingParts.length > 0 || hasProductDamage;
    if (needsPhoto && Object.keys(capturedPhotos).length === 0) {
      toast.error("配件缺失或产品损坏时必须拍照");
      return;
    }

    const orderSku = matchedOrders.length > 0 && matchedOrders[0].product_sku 
      ? matchedOrders[0].product_sku 
      : matchedShipment.product_sku;
    const orderProductName = matchedOrders.length > 0 && matchedOrders[0].product_name 
      ? matchedOrders[0].product_name 
      : matchedShipment.product_name;
    const returnQty = matchedOrders.length > 0 ? (matchedOrders[0].return_quantity || 1) : 1;

    const matchingShipmentBySku = matchedShipments.find(s => s.product_sku === orderSku) || matchedShipment;

    createMutation.mutate(
      {
        lpn: currentLpn,
        removal_order_id: matchingShipmentBySku.order_id,
        product_sku: orderSku,
        product_name: orderProductName,
        return_reason: null,
        grade: "A" as "A" | "B" | "C" | "new",
        missing_parts: selectedMissingParts.length > 0 ? selectedMissingParts : null,
        processed_at: new Date().toISOString(),
        processed_by: "操作员",
        tracking_number: matchedShipment.tracking_number,
        shipment_id: matchingShipmentBySku.id,
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
          updateInventoryMutation.mutate({
            sku: orderSku,
            product_name: orderProductName,
            grade: "A" as "A" | "B" | "C",
            quantity: returnQty,
          });

          matchedOrders.forEach(order => {
            updateOrderMutation.mutate({
              id: order.id,
              inbound_at: new Date().toISOString(),
            });
          });

          const newScannedLpns = [...scannedLpns, currentLpn];
          setScannedLpns(newScannedLpns);
          
          const totalInbounded = getInboundedCount(matchedShipment.tracking_number) + 1;
          const totalQuantity = matchedShipments.reduce((sum, s) => sum + s.quantity, 0);
          
          if (totalInbounded >= totalQuantity) {
            vibrateSuccess();
            setTimeout(() => vibrateSuccess(), 200);
            toast.success(`所有 ${totalQuantity} 件货物已扫描完成！`);
          } else {
            vibrateSuccess();
            toast.success(`入库成功！还剩 ${totalQuantity - totalInbounded} 件待入库`);
          }
          
          setIsProcessDrawerOpen(false);
          resetProcessForm();
        },
      }
    );
  };

  const resetProcessForm = () => {
    setSelectedMissingParts([]);
    setHasProductDamage(false);
    setCurrentLpn("");
    setCapturedPhotos({});
    setSkuMismatchWarning(null);
    setOverQuantityWarning(false);
    setMatchedOrders([]);
  };

  // 重置
  const handleReset = () => {
    setStep("idle");
    setMatchedShipment(null);
    setMatchedShipments([]);
    setTrackingInput("");
    setLpnInput("");
    setScannedLpns([]);
    resetProcessForm();
  };

  // 关闭当前步骤
  const handleClose = () => {
    if (step === "scan_lpn" && matchedShipment) {
      setStep("idle");
    } else {
      handleReset();
    }
  };

  const toggleMissingPart = (partName: string) => {
    setSelectedMissingParts((prev) =>
      prev.includes(partName)
        ? prev.filter((name) => name !== partName)
        : [...prev, partName]
    );
  };

  // 强制完成入库
  const handleForceComplete = () => {
    if (!matchedShipment || !matchedShipments.length) return;
    
    const totalInbounded = getInboundedCount(matchedShipment.tracking_number);
    const totalQuantity = matchedShipments.reduce((sum, s) => sum + s.quantity, 0);
    
    matchedShipments.forEach(shipment => {
      updateShipmentMutation.mutate({
        id: shipment.id,
        status: "inbound",
        note: `强制完成入库：实际入库 ${totalInbounded} 件，申报 ${totalQuantity} 件，差异 ${totalQuantity - totalInbounded} 件`,
      });
    });
    
    vibrateSuccess();
    toast.success(`已强制完成入库！实际入库 ${totalInbounded} 件，申报 ${totalQuantity} 件`);
    setIsForceCompleteOpen(false);
    handleReset();
  };

  // 完成包裹
  const handleCompletePackage = () => {
    if (!matchedShipment || !matchedShipments.length) return;
    
    const totalInbounded = getInboundedCount(matchedShipment.tracking_number);
    const totalQuantity = matchedShipments.reduce((sum, s) => sum + s.quantity, 0);
    
    if (totalInbounded < totalQuantity) {
      toast.error(`还有 ${totalQuantity - totalInbounded} 件未扫描`);
      return;
    }
    
    matchedShipments.forEach(shipment => {
      updateShipmentMutation.mutate({
        id: shipment.id,
        status: "inbound",
      });
    });
    
    vibrateSuccess();
    setTimeout(() => vibrateSuccess(), 200);
    toast.success(`包裹入库完成！共 ${totalInbounded} 件货物`);
    handleReset();
  };

  // 空闲状态 - 显示浮动按钮
  if (step === "idle") {
    const hasActiveShipment = matchedShipment !== null;
    const inboundedCount = matchedShipment ? getInboundedCount(matchedShipment.tracking_number) : 0;
    const totalQuantity = matchedShipments.reduce((sum, s) => sum + s.quantity, 0);
    const remainingCount = totalQuantity - inboundedCount;

    return (
      <>
        <ScanFeedbackOverlay 
          type={scanFeedback.type} 
          message={scanFeedback.message}
          onComplete={clearScanFeedback}
        />
        <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-muted/30">
        {/* 已匹配货件信息卡片 */}
        {hasActiveShipment && matchedShipment && (
          <div className="w-full max-w-sm mb-8 rounded-xl bg-card border shadow-sm p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <span className="font-semibold">当前货件</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset} className="h-8 text-xs">
                更换货件
              </Button>
            </div>
            <p className="font-medium truncate mb-1">{matchedShipment.product_name}</p>
            <p className="text-sm text-muted-foreground mb-4 font-mono">{matchedShipment.tracking_number}</p>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">入库进度</span>
              <span className="font-semibold text-primary">{inboundedCount} / {totalQuantity}</span>
            </div>
            <Progress 
              value={(inboundedCount / totalQuantity) * 100}
              className="h-2"
            />
            
            {/* 完成/强制完成按钮 */}
            {inboundedCount > 0 && (
              <div className="mt-4 pt-4 border-t space-y-2">
                {inboundedCount >= totalQuantity ? (
                  <Button onClick={handleCompletePackage} className="w-full bg-green-600 hover:bg-green-700">
                    <PackageCheck className="mr-2 h-4 w-4" />
                    完成包裹
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setIsForceCompleteOpen(true)} className="w-full border-amber-300 text-amber-700">
                    <AlertCircle className="mr-2 h-4 w-4" />
                    强制完成 (差 {remainingCount} 件)
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 中央浮动扫描按钮 */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/15 rounded-2xl blur-xl pointer-events-none" />
          <Button
            onClick={hasActiveShipment ? () => setStep("scan_lpn") : startScanning}
            className="relative h-36 w-36 rounded-2xl gradient-primary shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <ScanLine className="h-8 w-8" />
              </div>
              <span className="text-base font-semibold">
                {hasActiveShipment ? "扫描LPN" : "开始扫描"}
              </span>
            </div>
          </Button>
        </div>

        {/* 提示文字 */}
        <p className="mt-8 text-sm text-muted-foreground text-center max-w-xs leading-relaxed">
          {hasActiveShipment 
            ? `还有 ${remainingCount} 件待入库，点击按钮扫描LPN`
            : "点击按钮开始扫描物流跟踪号"}
        </p>

        {/* 今日统计 */}
        <div className="mt-10 px-6 py-4 bg-card rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inboundItems?.length || 0}</p>
              <p className="text-xs text-muted-foreground">今日已入库</p>
            </div>
          </div>
        </div>

        {/* 强制完成确认抽屉 */}
        <Drawer open={isForceCompleteOpen} onOpenChange={setIsForceCompleteOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-5 w-5" />
                确认强制完成
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <p className="text-sm text-muted-foreground mb-4">
                物流单申报 {totalQuantity} 件，实际入库 {inboundedCount} 件，差异 {remainingCount} 件。
                确定要强制完成入库吗？
              </p>
            </div>
            <DrawerFooter className="flex-row gap-3">
              <Button variant="outline" onClick={() => setIsForceCompleteOpen(false)} className="flex-1">
                取消
              </Button>
              <Button onClick={handleForceComplete} className="flex-1 bg-amber-600 hover:bg-amber-700">
                确认强制完成
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
        </div>
      </>
    );
  }

  // 扫描物流号步骤
  if (step === "scan_tracking") {
    return (
      <>
        <ScanFeedbackOverlay 
          type={scanFeedback.type} 
          message={scanFeedback.message}
          onComplete={clearScanFeedback}
        />
        <div className="fixed inset-0 z-50 bg-gradient-to-b from-background to-muted/30 pt-[env(safe-area-inset-top,0px)]">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between p-4 bg-background/80 backdrop-blur-sm border-b">
          <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-lg">
            <X className="h-5 w-5" />
          </Button>
          <h2 className="font-semibold text-lg">扫描物流跟踪号</h2>
          <div className="w-10" />
        </div>

        <div className="flex flex-col items-center justify-center p-6 h-[calc(100%-72px)]">
          {/* 步骤指示 */}
          <div className="flex items-center gap-3 mb-10 bg-card px-5 py-2 rounded-full border shadow-sm">
            <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
              1
            </div>
            <div className="h-px w-6 bg-border" />
            <div className="h-7 w-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-sm">
              2
            </div>
          </div>

          {/* 扫描按钮 */}
          <div className="mb-8 relative">
            <div className="absolute inset-0 bg-primary/15 rounded-2xl blur-xl pointer-events-none" />
            <Scanner 
              onScan={handleTrackingScan} 
              buttonLabel=""
              buttonSize="lg"
              buttonClassName="h-32 w-32 rounded-2xl gradient-primary shadow-xl"
            />
          </div>

          <p className="text-xl font-semibold mb-2">扫描物流跟踪号</p>
          <p className="text-sm text-muted-foreground mb-8">扫描包裹上的物流条码</p>

          {/* 手动输入 */}
          <div className="w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <p className="text-xs text-muted-foreground">或手动输入</p>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="输入物流跟踪号..."
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTrackingScan(trackingInput)}
                className="h-12 text-center font-mono"
              />
              <Button 
                onClick={() => handleTrackingScan(trackingInput)} 
                disabled={!trackingInput.trim()}
                className="h-12 w-12 rounded-xl"
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
        </div>
      </>
    );
  }

  // 扫描LPN步骤
  if (step === "scan_lpn" && matchedShipment) {
    const inboundedCount = getInboundedCount(matchedShipment.tracking_number);
    const totalQuantity = matchedShipments.reduce((sum, s) => sum + s.quantity, 0);
    const remainingCount = totalQuantity - inboundedCount;

    return (
      <>
        <ScanFeedbackOverlay 
          type={scanFeedback.type} 
          message={scanFeedback.message}
          onComplete={clearScanFeedback}
        />
        <div className="fixed inset-0 z-50 bg-gradient-to-b from-background to-muted/30 pt-[env(safe-area-inset-top,0px)]">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between p-4 bg-background/80 backdrop-blur-sm border-b">
          <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-lg">
            <X className="h-5 w-5" />
          </Button>
          <h2 className="font-semibold text-lg">扫描LPN入库</h2>
          <div className="w-10" />
        </div>

        <div className="flex flex-col items-center p-6 overflow-auto max-h-[calc(100%-72px)]">
          {/* 步骤指示 */}
          <div className="flex items-center gap-3 mb-6 bg-card px-5 py-2 rounded-full border shadow-sm">
            <div className="h-7 w-7 rounded-lg bg-green-500 text-white flex items-center justify-center">
              <CheckCircle className="h-4 w-4" />
            </div>
            <div className="h-px w-6 bg-green-500" />
            <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
              2
            </div>
          </div>

          {/* 货件信息 */}
          <div className="w-full max-w-sm rounded-xl bg-card border shadow-sm p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{matchedShipment.product_name}</p>
                <p className="text-sm text-muted-foreground mt-1 font-mono">{matchedShipment.tracking_number}</p>
                <div className="flex items-center gap-3 mt-3">
                  <Progress value={(inboundedCount / totalQuantity) * 100} className="h-2 flex-1" />
                  <span className="text-sm font-semibold text-primary">{inboundedCount}/{totalQuantity}</span>
                </div>
              </div>
            </div>
            
            {/* 完成/强制完成按钮 */}
            {inboundedCount > 0 && (
              <div className="mt-4 pt-4 border-t">
                {inboundedCount >= totalQuantity ? (
                  <Button onClick={handleCompletePackage} className="w-full bg-green-600 hover:bg-green-700">
                    <PackageCheck className="mr-2 h-4 w-4" />
                    完成包裹
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setIsForceCompleteOpen(true)} size="sm" className="w-full border-amber-300 text-amber-700">
                    <AlertCircle className="mr-2 h-4 w-4" />
                    强制完成
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* 剩余数量 */}
          <div className="mb-6">
            <Badge variant="secondary" className="text-sm px-5 py-1.5 rounded-lg font-medium">
              还剩 {remainingCount} 件待入库
            </Badge>
          </div>

          {/* 扫描按钮 */}
          <div className="mb-6 relative">
            <div className="absolute inset-0 bg-primary/15 rounded-2xl blur-xl pointer-events-none" />
            <Scanner 
              onScan={handleLpnScan} 
              buttonLabel=""
              buttonSize="lg"
              buttonClassName="h-32 w-32 rounded-2xl gradient-primary shadow-xl"
            />
          </div>

          <p className="text-xl font-semibold mb-2">扫描LPN标签</p>
          <p className="text-sm text-muted-foreground mb-6">扫描产品上的LPN条码</p>

          {/* 手动输入 */}
          <div className="w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <p className="text-xs text-muted-foreground">或手动输入</p>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="输入LPN号..."
                value={lpnInput}
                onChange={(e) => setLpnInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLpnScan(lpnInput)}
                className="h-12 text-center font-mono"
              />
              <Button 
                onClick={() => handleLpnScan(lpnInput)} 
                disabled={!lpnInput.trim()}
                className="h-12 w-12 rounded-xl"
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* 已扫描的LPN */}
          {scannedLpns.length > 0 && (
            <div className="w-full max-w-sm mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-3">本次已扫描:</p>
              <div className="flex flex-wrap gap-2">
                {scannedLpns.map((lpn) => (
                  <Badge key={lpn} variant="outline" className="text-xs py-1 px-3 rounded-lg font-mono">
                    {lpn}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 强制完成确认抽屉 */}
        <Drawer open={isForceCompleteOpen} onOpenChange={setIsForceCompleteOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-5 w-5" />
                确认强制完成
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <p className="text-sm text-muted-foreground mb-4">
                物流单申报 {totalQuantity} 件，实际入库 {inboundedCount} 件，差异 {remainingCount} 件。
                确定要强制完成入库吗？
              </p>
            </div>
            <DrawerFooter className="flex-row gap-3">
              <Button variant="outline" onClick={() => setIsForceCompleteOpen(false)} className="flex-1">
                取消
              </Button>
              <Button onClick={handleForceComplete} className="flex-1 bg-amber-600 hover:bg-amber-700">
                确认强制完成
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* 入库处理抽屉 */}
        <Drawer open={isProcessDrawerOpen} onOpenChange={setIsProcessDrawerOpen}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                产品入库处理 - {currentLpn}
              </DrawerTitle>
            </DrawerHeader>
            <ScrollArea className="flex-1 px-4 max-h-[60vh]">
              <div className="space-y-4 pb-4">
                {/* SKU不匹配警告 */}
                {skuMismatchWarning && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 border border-amber-300">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800">SKU不匹配</p>
                        <p className="text-amber-700">LPN: {skuMismatchWarning.lpnSku}</p>
                        <p className="text-amber-700">物流单: {skuMismatchWarning.shipmentSkus.join(", ")}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 超出数量警告 */}
                {overQuantityWarning && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 border border-red-300">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-red-800">超出申报数量</p>
                        <p className="text-red-700">本次入库将超出申报数量</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 退货订单信息 */}
                {matchedOrders.length > 0 && (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 border border-blue-200">
                    <p className="font-medium text-blue-900 dark:text-blue-100 mb-2 text-sm">退货订单信息</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><p className="text-muted-foreground">产品</p><p className="font-medium">{matchedOrders[0].product_name || "-"}</p></div>
                      <div><p className="text-muted-foreground">SKU</p><p className="font-medium">{matchedOrders[0].product_sku || "-"}</p></div>
                      <div><p className="text-muted-foreground">退货原因</p><p className="font-medium">{matchedOrders[0].return_reason || "-"}</p></div>
                      <div><p className="text-muted-foreground">买家备注</p><p className="font-medium">{matchedOrders[0].buyer_note || "-"}</p></div>
                    </div>
                  </div>
                )}

                {/* 缺少配件 */}
                <div className="space-y-2">
                  <Label className="text-sm">缺少配件</Label>
                  {productParts && productParts.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {productParts.map((part) => (
                        <div key={part.id} className="flex items-center space-x-2 rounded-lg border p-2">
                          <Checkbox
                            id={`mobile-${part.id}`}
                            checked={selectedMissingParts.includes(part.name)}
                            onCheckedChange={() => toggleMissingPart(part.name)}
                          />
                          <label htmlFor={`mobile-${part.id}`} className="text-sm cursor-pointer flex-1">
                            {part.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground p-2 bg-muted/50 rounded">暂无配件信息</p>
                  )}
                </div>

                {/* 产品损坏 */}
                <div className="flex items-center space-x-2 rounded-lg border p-3">
                  <Checkbox
                    id="mobile-damage"
                    checked={hasProductDamage}
                    onCheckedChange={(checked) => setHasProductDamage(checked as boolean)}
                  />
                  <label htmlFor="mobile-damage" className="text-sm cursor-pointer flex-1">
                    产品有损坏
                  </label>
                </div>

                {/* 拍照按钮 */}
                {(selectedMissingParts.length > 0 || hasProductDamage) && (
                  <div className="space-y-2">
                    <Label className="text-sm text-red-600">* 必须拍照</Label>
                    <Button
                      variant="outline"
                      className="w-full h-16 border-2 border-dashed"
                      onClick={() => setIsPhotoCaptureOpen(true)}
                    >
                      <div className="text-center">
                        <Camera className="mx-auto h-5 w-5 text-muted-foreground" />
                        <span className="mt-1 block text-sm">
                          {Object.keys(capturedPhotos).length > 0 
                            ? `已拍 ${Object.keys(capturedPhotos).length} 张` 
                            : "点击拍照"}
                        </span>
                      </div>
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
            <DrawerFooter className="flex-row gap-3 border-t pt-4">
              <Button variant="outline" onClick={() => { setIsProcessDrawerOpen(false); resetProcessForm(); }} className="flex-1">
                取消
              </Button>
              <Button 
                onClick={handleProcessComplete} 
                className="flex-1 gradient-primary"
                disabled={createMutation.isPending}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                确认入库
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* 原生拍照 */}
        {isPhotoCaptureOpen && (
          <NativePhotoCapture
            lpn={currentLpn}
            onComplete={(photos) => {
              setCapturedPhotos(photos);
              setIsPhotoCaptureOpen(false);
            }}
            onCancel={() => setIsPhotoCaptureOpen(false)}
          />
        )}
        </div>
      </>
    );
  }

  return null;
}
