import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ScanLine, Camera, Package, CheckCircle, Search, PackageCheck, AlertCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  useInboundItems,
  useCreateInboundItem,
} from "@/hooks/useInboundItems";
import { useRemovalShipments, useUpdateRemovalShipment, type RemovalShipment } from "@/hooks/useRemovalShipments";
import { type Order, useUpdateOrder } from "@/hooks/useOrders";
import { fetchOrdersByLpn } from "@/hooks/useOrdersByLpn";
import { useUpdateInventoryStock } from "@/hooks/useInventoryItems";
import { useProducts, useProductParts } from "@/hooks/useProducts";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Scanner } from "@/components/Scanner";
import { SequentialPhotoCapture } from "@/components/SequentialPhotoCapture";
import { MobileInboundScanner } from "@/components/MobileInboundScanner";
import { TranslatedText } from "@/components/TranslatedText";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSound } from "@/hooks/useSound";

type InboundStep = "scan_tracking" | "scan_lpn" | "process";

export default function InboundScan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [currentStep, setCurrentStep] = useState<InboundStep>("scan_tracking");
  const [trackingInput, setTrackingInput] = useState("");
  const [lpnInput, setLpnInput] = useState("");
  const [matchedShipment, setMatchedShipment] = useState<RemovalShipment | null>(null);
  const [matchedShipments, setMatchedShipments] = useState<RemovalShipment[]>([]);
  const [matchedOrders, setMatchedOrders] = useState<Order[]>([]);
  const [scannedLpns, setScannedLpns] = useState<string[]>([]);
  const [currentLpn, setCurrentLpn] = useState("");
  
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false);
  const [selectedMissingParts, setSelectedMissingParts] = useState<string[]>([]);
  const [hasProductDamage, setHasProductDamage] = useState(false);
  const [notes, setNotes] = useState("");
  const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<Record<string, string>>({});
  const [isForceCompleteDialogOpen, setIsForceCompleteDialogOpen] = useState(false);
  
  const lpnInputRef = useRef<HTMLInputElement>(null);
  const trackingInputRef = useRef<HTMLInputElement>(null);

  const { data: inboundItems, isLoading: inboundLoading } = useInboundItems();
  const { data: shipments, isLoading: shipmentsLoading } = useRemovalShipments();
  const ordersLoading = false;
  const { data: products } = useProducts();
  const createMutation = useCreateInboundItem();
  const updateShipmentMutation = useUpdateRemovalShipment();
  const updateInventoryMutation = useUpdateInventoryStock();
  const updateOrderMutation = useUpdateOrder();
  const { playSuccess, playError, playWarning } = useSound();

  const currentOrderSku = matchedOrders.length > 0 && matchedOrders[0].product_sku
    ? matchedOrders[0].product_sku
    : matchedShipment?.product_sku;
  const matchedProduct = currentOrderSku
    ? products?.find(p => p.sku === currentOrderSku)
    : null;
  const { data: productParts } = useProductParts(matchedProduct?.id || null);

  useEffect(() => {
    if (currentStep === "scan_tracking" && trackingInputRef.current) {
      trackingInputRef.current.focus();
    } else if (currentStep === "scan_lpn" && lpnInputRef.current) {
      lpnInputRef.current.focus();
    }
  }, [currentStep]);

  useEffect(() => {
    const trackingFromUrl = searchParams.get("tracking");
    if (trackingFromUrl && shipments) {
      const allMatched = shipments.filter(
        s => s.tracking_number.toLowerCase() === trackingFromUrl.toLowerCase()
      );
      if (allMatched.length > 0) {
        const totalQuantity = allMatched.reduce((sum, s) => sum + s.quantity, 0);
        const inboundedCount = getInboundedCount(trackingFromUrl);
        if (inboundedCount < totalQuantity) {
          setMatchedShipment(allMatched[0]);
          setMatchedShipments(allMatched);
          setTrackingInput(allMatched[0].tracking_number);
          setCurrentStep("scan_lpn");
        }
      }
    }
  }, [searchParams, shipments]);

  const getInboundedCount = (trackingNumber: string) => {
    return (inboundItems || []).filter(item => item.tracking_number === trackingNumber).length;
  };

  const getInboundedCountBySku = (trackingNumber: string, sku: string) => {
    return (inboundItems || []).filter(
      item => item.tracking_number === trackingNumber && item.product_sku === sku
    ).length;
  };

  const handleScanTracking = () => {
    if (!trackingInput.trim()) {
      playError();
      toast.error("请输入物流跟踪号");
      return;
    }

    const allMatched = shipments?.filter(
      s => s.tracking_number.toLowerCase() === trackingInput.trim().toLowerCase()
    ) || [];

    if (allMatched.length === 0) {
      playError();
      toast.error(`未找到物流跟踪号: ${trackingInput}`);
      return;
    }

    const totalQuantity = allMatched.reduce((sum, s) => sum + s.quantity, 0);
    const inboundedCount = getInboundedCount(allMatched[0].tracking_number);
    if (inboundedCount >= totalQuantity) {
      playWarning();
      toast.warning(`该物流号下的 ${totalQuantity} 件货物已全部入库`);
      return;
    }

    setMatchedShipment(allMatched[0]);
    setMatchedShipments(allMatched);
    setScannedLpns([]);
    setCurrentStep("scan_lpn");
    
    playSuccess();
    const productNames = [...new Set(allMatched.map(s => s.product_name))];
    toast.success(`匹配成功: ${allMatched.length} 种产品 (${productNames.slice(0, 2).join(", ")}${productNames.length > 2 ? "..." : ""})`);
  };

  const getOrdersByLpn = async (lpn: string) => {
    const matchedOrders = await fetchOrdersByLpn(lpn);
    return matchedOrders;
  };

  const [skuMismatchWarning, setSkuMismatchWarning] = useState<{
    lpnSku: string;
    shipmentSkus: string[];
  } | null>(null);

  const [overQuantityWarning, setOverQuantityWarning] = useState(false);

  const handleScanLpn = async (lpnValue?: string) => {
    const lpn = (lpnValue || lpnInput).trim();

    if (!lpn) {
      playError();
      toast.error("请输入LPN号");
      return;
    }

    const lpnOrders = await getOrdersByLpn(lpn);
    if (lpnOrders.length === 0) {
      playError();
      toast.error(`LPN号 "${lpn}" 不存在于退货订单列表中，请先在退货订单列表中添加该LPN`);
      setLpnInput("");
      return;
    }

    if (scannedLpns.includes(lpn)) {
      playWarning();
      toast.error("该LPN已扫描过");
      setLpnInput("");
      return;
    }

    const existingItem = inboundItems?.find(item => item.lpn === lpn);
    if (existingItem) {
      playWarning();
      toast.error("该LPN已入库");
      setLpnInput("");
      return;
    }

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

    const totalQuantity = matchedShipments.reduce((sum, s) => sum + s.quantity, 0);
    const currentInbounded = getInboundedCount(matchedShipment?.tracking_number || "");
    const willExceed = currentInbounded + 1 > totalQuantity;
    
    if (willExceed) {
      setOverQuantityWarning(true);
      playWarning();
    } else {
      setOverQuantityWarning(false);
    }

    if (isMobile && matchedShipment) {
      navigate(`/inbound/process?lpn=${encodeURIComponent(lpn)}&tracking=${encodeURIComponent(matchedShipment.tracking_number)}`);
      setLpnInput("");
      return;
    }

    setCurrentLpn(lpn);
    setMatchedOrders(lpnOrders);
    setIsProcessDialogOpen(true);
    setLpnInput("");
  };

  const handleCameraScanTracking = (code: string) => {
    setTrackingInput(code);
    
    const allMatched = shipments?.filter(
      s => s.tracking_number.toLowerCase() === code.trim().toLowerCase()
    ) || [];

    if (allMatched.length === 0) {
      playError();
      toast.error(`未找到物流跟踪号: ${code}`);
      return;
    }

    const totalQuantity = allMatched.reduce((sum, s) => sum + s.quantity, 0);
    const inboundedCount = getInboundedCount(allMatched[0].tracking_number);
    if (inboundedCount >= totalQuantity) {
      playWarning();
      toast.warning(`该物流号下的 ${totalQuantity} 件货物已全部入库`);
      return;
    }

    setMatchedShipment(allMatched[0]);
    setMatchedShipments(allMatched);
    setScannedLpns([]);
    setCurrentStep("scan_lpn");
    
    playSuccess();
    const productNames = [...new Set(allMatched.map(s => s.product_name))];
    toast.success(`匹配成功: ${allMatched.length} 种产品 (${productNames.slice(0, 2).join(", ")}${productNames.length > 2 ? "..." : ""})`);
  };

  const handleCameraScanLpn = (code: string) => {
    handleScanLpn(code);
  };

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

    const missingPartsLabels = selectedMissingParts;

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
        missing_parts: missingPartsLabels.length > 0 ? missingPartsLabels : null,
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
            playSuccess();
            setTimeout(() => playSuccess(), 200);
            toast.success(`所有 ${totalQuantity} 件货物已扫描完成，请点击"完成包裹"确认入库！`);
          } else {
            playSuccess();
            toast.success(`入库成功！还剩 ${totalQuantity - totalInbounded} 件待入库`);
          }
          
          setIsProcessDialogOpen(false);
          resetProcessForm();
          
          setTimeout(() => {
            lpnInputRef.current?.focus();
          }, 100);
        },
      }
    );
  };

  const resetProcessForm = () => {
    setSelectedMissingParts([]);
    setHasProductDamage(false);
    setNotes("");
    setCurrentLpn("");
    setCapturedPhotos({});
    setSkuMismatchWarning(null);
    setOverQuantityWarning(false);
  };

  const handleReset = () => {
    setCurrentStep("scan_tracking");
    setMatchedShipment(null);
    setMatchedShipments([]);
    setScannedLpns([]);
    setTrackingInput("");
    setLpnInput("");
    setSkuMismatchWarning(null);
    setOverQuantityWarning(false);
    resetProcessForm();
  };

  const toggleMissingPart = (partId: string) => {
    setSelectedMissingParts((prev) =>
      prev.includes(partId)
        ? prev.filter((id) => id !== partId)
        : [...prev, partId]
    );
  };

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
    
    playSuccess();
    toast.success(`已强制完成入库！实际入库 ${totalInbounded} 件，申报 ${totalQuantity} 件`);
    setIsForceCompleteDialogOpen(false);
    handleReset();
  };

  const handleCompletePackage = () => {
    if (!matchedShipment || !matchedShipments.length) return;
    
    const totalInbounded = getInboundedCount(matchedShipment.tracking_number);
    const totalQuantity = matchedShipments.reduce((sum, s) => sum + s.quantity, 0);
    
    if (totalInbounded < totalQuantity) {
      toast.error(`还有 ${totalQuantity - totalInbounded} 件未扫描，请继续扫描或使用"强制完成"`);
      return;
    }
    
    matchedShipments.forEach(shipment => {
      updateShipmentMutation.mutate({
        id: shipment.id,
        status: "inbound",
      });
    });
    
    playSuccess();
    setTimeout(() => playSuccess(), 200);
    toast.success(`包裹入库完成！共 ${totalInbounded} 件货物`);
    handleReset();
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

  if (isMobile) {
    return <MobileInboundScanner initialTracking={searchParams.get("tracking") || undefined} />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      <PageHeader
        title="入库扫码"
        description="扫描物流跟踪号匹配货件，逐个扫描LPN进行入库"
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
                  已匹配货件 {matchedShipments.length > 1 && `(${matchedShipments.length} 种产品)`}
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
                  <p className="font-medium">
                    {matchedShipments.length > 1 
                      ? `${[...new Set(matchedShipments.map(s => s.order_id))].length} 个订单`
                      : matchedShipment.order_id
                    }
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">承运商</p>
                  <p className="font-medium">{matchedShipment.carrier}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">总件数</p>
                  <p className="font-medium">{matchedShipments.reduce((sum, s) => sum + s.quantity, 0)} 件</p>
                </div>
              </div>

              {/* 产品列表 */}
              {matchedShipments.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">包含产品：</p>
                  <div className="space-y-2">
                    {matchedShipments.map((shipment, idx) => {
                      const inboundedForSku = getInboundedCountBySku(matchedShipment.tracking_number, shipment.product_sku);
                      const isComplete = inboundedForSku >= shipment.quantity;
                      return (
                        <div key={idx} className={cn(
                          "flex items-center justify-between text-sm rounded-md px-3 py-2",
                          isComplete ? "bg-green-50 dark:bg-green-950/30" : "bg-muted/30"
                        )}>
                          <div className="flex items-center gap-3">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{shipment.product_sku}</code>
                            <span className="text-muted-foreground">{shipment.product_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isComplete && <CheckCircle className="h-4 w-4 text-green-500" />}
                            <Badge variant={isComplete ? "secondary" : "outline"}>
                              已扫 {inboundedForSku} / 总 {shipment.quantity} 件
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 入库进度 */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">入库进度</span>
                  <span className="text-sm font-medium">
                    {getInboundedCount(matchedShipment.tracking_number)} / {matchedShipments.reduce((sum, s) => sum + s.quantity, 0)}
                  </span>
                </div>
                <Progress 
                  value={(getInboundedCount(matchedShipment.tracking_number) / matchedShipments.reduce((sum, s) => sum + s.quantity, 0)) * 100} 
                />
                
                {/* 强制完成按钮 */}
                {getInboundedCount(matchedShipment.tracking_number) > 0 && 
                 getInboundedCount(matchedShipment.tracking_number) < matchedShipments.reduce((sum, s) => sum + s.quantity, 0) && (
                  <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-amber-800 dark:text-amber-200">入库数量少于申报数量</p>
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            差异: {matchedShipments.reduce((sum, s) => sum + s.quantity, 0) - getInboundedCount(matchedShipment.tracking_number)} 件
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/50"
                        onClick={() => setIsForceCompleteDialogOpen(true)}
                      >
                        强制完成
                      </Button>
                    </div>
                  </div>
                )}
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

              {/* 完成包裹按钮 */}
              {matchedShipment && getInboundedCount(matchedShipment.tracking_number) >= matchedShipments.reduce((sum, s) => sum + s.quantity, 0) && (
                <div className="mt-4 pt-4 border-t">
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-700">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-green-800 dark:text-green-200">全部LPN已扫描完成</p>
                          <p className="text-sm text-green-600 dark:text-green-400">
                            共 {getInboundedCount(matchedShipment.tracking_number)} 件货物，点击确认完成入库
                          </p>
                        </div>
                      </div>
                      <Button 
                        onClick={handleCompletePackage}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="lg"
                      >
                        <PackageCheck className="mr-2 h-5 w-5" />
                        完成包裹
                      </Button>
                    </div>
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
              {/* SKU不匹配警告 */}
              {skuMismatchWarning && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-4 border border-amber-300 dark:border-amber-700">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-800 dark:text-amber-200">
                        ⚠️ SKU不匹配警告
                      </h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        LPN产品SKU: <span className="font-mono font-bold">{skuMismatchWarning.lpnSku}</span>
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        物流单申报SKU: <span className="font-mono">{skuMismatchWarning.shipmentSkus.join(", ")}</span>
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        请确认此LPN是否属于当前物流单，或联系管理员处理
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 超出申报数量警告 */}
              {overQuantityWarning && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-4 border border-red-300 dark:border-red-700">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-800 dark:text-red-200">
                        ⚠️ 超出申报数量
                      </h4>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        物流单申报数量: {matchedShipments.reduce((sum, s) => sum + s.quantity, 0)} 件
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        已入库数量: {getInboundedCount(matchedShipment?.tracking_number || "")} 件
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                        本次入库将超出申报数量，请核实后继续操作
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 退货订单信息 */}
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
                        <div><p className="text-muted-foreground text-xs">退货原因</p><p className="font-medium text-sm">{order.return_reason || "-"}</p></div>
                        <div><p className="text-muted-foreground text-xs">买家备注</p><p className="font-medium text-sm"><TranslatedText text={order.buyer_note} /></p></div>
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

              {/* 缺少配件 */}
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

              {/* 产品损坏选项 */}
              <div className="space-y-2">
                <Label className="text-sm">产品状态</Label>
                <div className="flex items-center space-x-2 rounded-lg border p-3">
                  <Checkbox
                    id="product_damage"
                    checked={hasProductDamage}
                    onCheckedChange={(checked) => setHasProductDamage(!!checked)}
                  />
                  <label
                    htmlFor="product_damage"
                    className="text-sm font-medium leading-none cursor-pointer flex-1"
                  >
                    产品损坏
                  </label>
                </div>
              </div>

              {/* 拍照上传 - 配件缺失或产品损坏时必须拍照 */}
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2">
                  产品拍照 ({Object.keys(capturedPhotos).length}/9)
                  {(selectedMissingParts.length > 0 || hasProductDamage) && (
                    <Badge variant="destructive" className="text-xs">必填</Badge>
                  )}
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full h-20 border-2 border-dashed",
                    (selectedMissingParts.length > 0 || hasProductDamage) && Object.keys(capturedPhotos).length === 0 && "border-destructive"
                  )}
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
                {(selectedMissingParts.length > 0 || hasProductDamage) && Object.keys(capturedPhotos).length === 0 && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    配件缺失或产品损坏时必须拍照
                  </p>
                )}
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

      {/* 强制完成确认对话框 */}
      <AlertDialog open={isForceCompleteDialogOpen} onOpenChange={setIsForceCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认强制完成入库</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>当前入库数量少于物流单申报数量：</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>申报数量: {matchedShipments.reduce((sum, s) => sum + s.quantity, 0)} 件</li>
                  <li>已入库数量: {getInboundedCount(matchedShipment?.tracking_number || "")} 件</li>
                  <li className="text-amber-600 dark:text-amber-400">
                    差异: {matchedShipments.reduce((sum, s) => sum + s.quantity, 0) - getInboundedCount(matchedShipment?.tracking_number || "")} 件
                  </li>
                </ul>
                <p className="text-sm pt-2">确认强制完成后，此物流单将标记为已完成入库，差异信息将记录在备注中。</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceComplete}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              确认强制完成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 顺序拍照弹窗 */}
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
