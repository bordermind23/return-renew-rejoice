import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Camera, Package, CheckCircle, Search, PackageCheck, AlertCircle, ChevronRight, ScanLine } from "lucide-react";
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
import { NativePhotoCapture, getPhotoSteps } from "@/components/NativePhotoCapture";
import { MobileInboundScanner } from "@/components/MobileInboundScanner";
import { ShippingLabelCapture } from "@/components/ShippingLabelCapture";
import { TranslatedText } from "@/components/TranslatedText";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSound } from "@/hooks/useSound";

type InboundStep = "scan_tracking" | "scan_lpn" | "process";

// localStorage key for pending inbound session
const PENDING_INBOUND_KEY = "pending_inbound_session";

interface PendingInboundSession {
  trackingNumber: string;
  timestamp: number;
}

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
  const [isPendingSessionDialogOpen, setIsPendingSessionDialogOpen] = useState(false);
  const [pendingSession, setPendingSession] = useState<PendingInboundSession | null>(null);
  const [shippingLabelPhoto, setShippingLabelPhoto] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  
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

  // 获取当前物流号下已入库的产品列表
  const currentTrackingInboundItems = useMemo(() => {
    if (!inboundItems || !matchedShipment) return [];
    return inboundItems.filter(item => item.tracking_number === matchedShipment.tracking_number);
  }, [inboundItems, matchedShipment]);

  // 用于标记是否已经检查过未完成会话（只在页面初始加载时检查一次）
  const [hasCheckedPendingSession, setHasCheckedPendingSession] = useState(false);

  // 检查是否有未完成的入库会话 - 只在页面初始加载且当前没有进行入库时检查
  useEffect(() => {
    // 如果已经检查过，或者当前已经在进行入库，则不再检查
    if (hasCheckedPendingSession || currentStep !== "scan_tracking" || matchedShipment) {
      return;
    }
    
    const savedSession = localStorage.getItem(PENDING_INBOUND_KEY);
    if (savedSession && shipments && inboundItems) {
      try {
        const session = JSON.parse(savedSession) as PendingInboundSession;
        // 检查会话是否在24小时内
        const isRecent = Date.now() - session.timestamp < 24 * 60 * 60 * 1000;
        
        if (isRecent) {
          // 检查该物流号是否还有未完成的入库
          const allMatched = shipments.filter(
            s => s.tracking_number === session.trackingNumber
          );
          
          if (allMatched.length > 0) {
            const totalQuantity = allMatched.reduce((sum, s) => sum + s.quantity, 0);
            const inboundedCount = inboundItems.filter(
              item => item.tracking_number === session.trackingNumber
            ).length;
            
            // 有入库记录但未完成
            if (inboundedCount > 0 && inboundedCount < totalQuantity) {
              setPendingSession(session);
              setIsPendingSessionDialogOpen(true);
              setHasCheckedPendingSession(true);
              return;
            }
          }
        }
        // 清除过期或无效的会话
        localStorage.removeItem(PENDING_INBOUND_KEY);
      } catch {
        localStorage.removeItem(PENDING_INBOUND_KEY);
      }
    }
    setHasCheckedPendingSession(true);
  }, [shipments, inboundItems, hasCheckedPendingSession, currentStep, matchedShipment]);

  // 保存当前入库会话到localStorage
  useEffect(() => {
    if (matchedShipment && currentStep === "scan_lpn") {
      const session: PendingInboundSession = {
        trackingNumber: matchedShipment.tracking_number,
        timestamp: Date.now(),
      };
      localStorage.setItem(PENDING_INBOUND_KEY, JSON.stringify(session));
    }
  }, [matchedShipment, currentStep]);

  // 判断是否处于入库进行中（有入库记录但未完成）
  const isInboundInProgress = useMemo(() => {
    if (!matchedShipment || !matchedShipments.length || currentStep !== "scan_lpn") return false;
    const totalQuantity = matchedShipments.reduce((sum, s) => sum + s.quantity, 0);
    const inboundedCount = (inboundItems || []).filter(
      item => item.tracking_number === matchedShipment.tracking_number
    ).length;
    return inboundedCount > 0 && inboundedCount < totalQuantity;
  }, [matchedShipment, matchedShipments, currentStep, inboundItems]);

  // 用于导航警告对话框
  const [isLeaveWarningOpen, setIsLeaveWarningOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // 暴露全局方法供侧边栏使用
  useEffect(() => {
    if (isInboundInProgress) {
      (window as any).__inboundInProgress = true;
      (window as any).__showInboundLeaveWarning = (targetPath: string) => {
        setPendingNavigation(targetPath);
        setIsLeaveWarningOpen(true);
      };
    } else {
      (window as any).__inboundInProgress = false;
      (window as any).__showInboundLeaveWarning = null;
    }
    
    return () => {
      (window as any).__inboundInProgress = false;
      (window as any).__showInboundLeaveWarning = null;
    };
  }, [isInboundInProgress]);

  // 确认离开时执行导航
  const handleConfirmLeave = () => {
    if (pendingNavigation) {
      setIsLeaveWarningOpen(false);
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  // 处理浏览器刷新/关闭时的警告
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isInboundInProgress) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isInboundInProgress]);

  // 恢复未完成的会话
  const handleRestoreSession = () => {
    if (!pendingSession || !shipments) return;
    
    const allMatched = shipments.filter(
      s => s.tracking_number === pendingSession.trackingNumber
    );
    
    if (allMatched.length > 0) {
      setMatchedShipment(allMatched[0]);
      setMatchedShipments(allMatched);
      setTrackingInput(pendingSession.trackingNumber);
      setCurrentStep("scan_lpn");
      toast.success("已恢复未完成的入库会话");
    }
    
    setIsPendingSessionDialogOpen(false);
  };

  // 清除未完成的会话
  const handleClearSession = () => {
    localStorage.removeItem(PENDING_INBOUND_KEY);
    setPendingSession(null);
    setIsPendingSessionDialogOpen(false);
    toast.info("已清除未完成的入库数据");
  };

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

  const handleShippingLabelRecognized = (trackingNumbers: string[], photoUrl: string) => {
    if (trackingNumbers.length === 0) {
      playError();
      toast.error("未识别到物流跟踪号");
      return;
    }

    // 尝试匹配第一个识别到的物流号
    const trackingNumber = trackingNumbers[0];
    
    const allMatched = shipments?.filter(
      s => s.tracking_number.toLowerCase() === trackingNumber.toLowerCase()
    ) || [];

    if (allMatched.length === 0) {
      playError();
      toast.error(`未找到物流跟踪号: ${trackingNumber}`);
      return;
    }

    const totalQuantity = allMatched.reduce((sum, s) => sum + s.quantity, 0);
    const inboundedCount = getInboundedCount(allMatched[0].tracking_number);
    if (inboundedCount >= totalQuantity) {
      playWarning();
      toast.warning(`该物流号下的 ${totalQuantity} 件货物已全部入库`);
      return;
    }

    // 保存物流面单照片URL
    setShippingLabelPhoto(photoUrl);
    setMatchedShipment(allMatched[0]);
    setMatchedShipments(allMatched);
    setTrackingInput(trackingNumber);
    setScannedLpns([]);
    setCurrentStep("scan_lpn");
    
    playSuccess();
    const productNames = [...new Set(allMatched.map(s => s.product_name))];
    toast.success(`匹配成功: ${allMatched.length} 种产品 (${productNames.slice(0, 2).join(", ")}${productNames.length > 2 ? "..." : ""})`);
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
          damage_photo_1: capturedPhotos.damage_photo_1 || null,
          damage_photo_2: capturedPhotos.damage_photo_2 || null,
          damage_photo_3: capturedPhotos.damage_photo_3 || null,
          package_accessories_photo: capturedPhotos.package_accessories_photo || null,
          shipping_label_photo: shippingLabelPhoto || null,
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
    
    // 清除localStorage中的会话
    localStorage.removeItem(PENDING_INBOUND_KEY);
    
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
    
    // 清除localStorage中的会话
    localStorage.removeItem(PENDING_INBOUND_KEY);
    
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
      {/* 页面标题 - 简化 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">入库扫码</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {currentStep === "scan_tracking" ? "请扫描物流跟踪号开始入库" : "请逐个扫描LPN完成入库"}
          </p>
        </div>
        {currentStep === "scan_lpn" && (
          <Button variant="outline" onClick={handleReset}>
            返回重新扫描
          </Button>
        )}
      </div>

      {/* 步骤指示器 - 更大更清晰 */}
      <div className="flex items-center gap-4">
        <div className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-full transition-all",
          currentStep === "scan_tracking" 
            ? "bg-primary text-primary-foreground shadow-lg" 
            : "bg-muted/50 text-muted-foreground"
        )}>
          <div className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold",
            currentStep === "scan_tracking" ? "bg-primary-foreground/20" : "bg-muted"
          )}>
            {currentStep !== "scan_tracking" ? <CheckCircle className="h-5 w-5" /> : "1"}
          </div>
          <span className="font-medium">拍摄物流面单</span>
        </div>
        <div className="h-0.5 w-8 bg-muted" />
        <div className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-full transition-all",
          currentStep === "scan_lpn" 
            ? "bg-info text-info-foreground shadow-lg" 
            : "bg-muted/50 text-muted-foreground"
        )}>
          <div className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold",
            currentStep === "scan_lpn" ? "bg-info-foreground/20" : "bg-muted"
          )}>
            2
          </div>
          <span className="font-medium">扫描LPN入库</span>
        </div>
      </div>

      {/* 步骤1：拍摄物流面单 */}
      {currentStep === "scan_tracking" && (
        <div className="space-y-6">
          {/* 主要方式：拍照识别 */}
          <ShippingLabelCapture
            onTrackingRecognized={handleShippingLabelRecognized}
            onCancel={() => setShowManualInput(false)}
          />

          {/* 备用方式：手动输入 */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">
                  如果拍照无法识别，可以手动输入物流号
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowManualInput(!showManualInput)}
                >
                  {showManualInput ? "收起" : "展开"}
                </Button>
              </div>
              {showManualInput && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Input
                    ref={trackingInputRef}
                    placeholder="手动输入物流跟踪号..."
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleScanTracking()}
                    className="h-10"
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleScanTracking} variant="secondary" className="h-10 px-4">
                      <ScanLine className="mr-2 h-4 w-4" />
                      确认
                    </Button>
                    <Scanner onScan={handleCameraScanTracking} buttonLabel="扫码" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 步骤2：扫描 LPN */}
      {currentStep === "scan_lpn" && matchedShipment && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* 左侧：LPN扫描区域 - 主操作区 */}
          <div className="lg:col-span-2 space-y-6">
            {/* LPN扫描卡片 - 蓝色主题 */}
            <Card className="border-2 border-info/40 bg-gradient-to-br from-info/5 to-info/10 shadow-lg">
              <CardContent className="pt-6 pb-6">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-info/10">
                    <ScanLine className="h-7 w-7 text-info" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-info">扫描LPN号</h2>
                    <p className="text-sm text-muted-foreground">
                      逐个扫描产品的LPN号进行入库
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center max-w-lg mx-auto">
                    <Input
                      ref={lpnInputRef}
                      placeholder="扫描或输入LPN号..."
                      value={lpnInput}
                      onChange={(e) => setLpnInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleScanLpn()}
                      className="text-lg h-12 text-center sm:text-left border-info/30 focus-visible:ring-info"
                    />
                    <div className="flex gap-2">
                      <Button onClick={() => handleScanLpn()} className="gradient-lpn h-12 px-6">
                        <ScanLine className="mr-2 h-5 w-5" />
                        确认
                      </Button>
                      <Scanner onScan={handleCameraScanLpn} buttonLabel="摄像头" scanType="lpn" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 完成包裹提示 */}
            {matchedShipment && getInboundedCount(matchedShipment.tracking_number) >= matchedShipments.reduce((sum, s) => sum + s.quantity, 0) && (
              <Card className="border-2 border-green-500/50 bg-green-50 dark:bg-green-950/30 shadow-lg">
                <CardContent className="py-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-green-800 dark:text-green-200 text-lg">全部LPN已扫描完成</p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          共 {getInboundedCount(matchedShipment.tracking_number)} 件货物
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={handleCompletePackage}
                      className="bg-green-600 hover:bg-green-700 text-white h-12 px-6"
                      size="lg"
                    >
                      <PackageCheck className="mr-2 h-5 w-5" />
                      完成包裹
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 已入库产品列表 */}
            {currentTrackingInboundItems.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-5 w-5 text-info" />
                    已入库 ({currentTrackingInboundItems.length} 件)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {currentTrackingInboundItems.map((item, index) => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-7 w-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <span className="text-xs font-medium text-green-600 dark:text-green-400">{index + 1}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{item.product_name}</p>
                            <code className="text-xs bg-muted px-1 rounded">{item.lpn}</code>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={item.grade === "A" ? "default" : item.grade === "B" ? "secondary" : "outline"}>
                            {item.grade}级
                          </Badge>
                          {item.missing_parts && item.missing_parts.length > 0 && (
                            <Badge variant="destructive" className="text-xs">缺配件</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 右侧：货件信息面板 */}
          <div className="space-y-4">
            {/* 进度卡片 - 蓝色主题 */}
            <Card className="bg-info/5 border-info/20">
              <CardContent className="pt-4 pb-4">
                <div className="text-center space-y-3">
                  <div className="text-3xl font-bold text-info">
                    {getInboundedCount(matchedShipment.tracking_number)} / {matchedShipments.reduce((sum, s) => sum + s.quantity, 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">入库进度</p>
                  <Progress 
                    value={(getInboundedCount(matchedShipment.tracking_number) / matchedShipments.reduce((sum, s) => sum + s.quantity, 0)) * 100} 
                    className="h-2 [&>div]:bg-info"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 货件信息 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageCheck className="h-4 w-4 text-green-500" />
                  货件信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">物流号</span>
                  <code className="font-medium bg-muted px-1.5 py-0.5 rounded text-xs">{matchedShipment.tracking_number}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">承运商</span>
                  <span className="font-medium">{matchedShipment.carrier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">产品种类</span>
                  <span className="font-medium">{matchedShipments.length} 种</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">总件数</span>
                  <span className="font-medium">{matchedShipments.reduce((sum, s) => sum + s.quantity, 0)} 件</span>
                </div>
              </CardContent>
            </Card>

            {/* 产品列表 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">待入库产品</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {matchedShipments.map((shipment, idx) => {
                  const inboundedForSku = getInboundedCountBySku(matchedShipment.tracking_number, shipment.product_sku);
                  const isComplete = inboundedForSku >= shipment.quantity;
                  return (
                    <div key={idx} className={cn(
                      "flex items-center justify-between text-sm rounded-lg px-3 py-2.5",
                      isComplete ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800" : "bg-muted/50"
                    )}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{shipment.product_name}</p>
                        <code className="text-xs text-muted-foreground">{shipment.product_sku}</code>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {isComplete && <CheckCircle className="h-4 w-4 text-green-500" />}
                        <Badge variant={isComplete ? "secondary" : "outline"} className="text-xs">
                          {inboundedForSku}/{shipment.quantity}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* 强制完成按钮 */}
            {getInboundedCount(matchedShipment.tracking_number) > 0 && 
             getInboundedCount(matchedShipment.tracking_number) < matchedShipments.reduce((sum, s) => sum + s.quantity, 0) && (
              <Card className="border-amber-200 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">数量不足</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                        差 {matchedShipments.reduce((sum, s) => sum + s.quantity, 0) - getInboundedCount(matchedShipment.tracking_number)} 件
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300"
                        onClick={() => setIsForceCompleteDialogOpen(true)}
                      >
                        强制完成入库
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* 处理对话框 - 拍照时隐藏 */}
      <Dialog open={isProcessDialogOpen && !isPhotoCaptureOpen} onOpenChange={setIsProcessDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg pr-8">
              <Package className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="truncate">产品入库处理 - {currentLpn}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="-mx-6 px-6">
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="notes" className="text-sm">备注</Label>
                  <VoiceInputButton
                    onTranscript={(text) => setNotes((prev) => prev ? `${prev} ${text}` : text)}
                  />
                </div>
                <Textarea
                  id="notes"
                  placeholder="输入其他备注信息..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            </div>
          </div>
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

      {/* 原生拍照弹窗 */}
      {isPhotoCaptureOpen && (
        <NativePhotoCapture
          lpn={currentLpn}
          steps={getPhotoSteps(hasProductDamage, selectedMissingParts.length > 0)}
          onComplete={(photos) => {
            setCapturedPhotos(photos);
            setIsPhotoCaptureOpen(false);
          }}
          onCancel={() => setIsPhotoCaptureOpen(false)}
        />
      )}

      {/* 未完成入库会话恢复对话框 */}
      <AlertDialog open={isPendingSessionDialogOpen} onOpenChange={setIsPendingSessionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              发现未完成的入库
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>检测到您有一个未完成的入库操作：</p>
                <div className="rounded-lg bg-muted p-3 space-y-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground">物流跟踪号：</span>
                    <code className="ml-1 font-medium bg-background px-1.5 py-0.5 rounded">
                      {pendingSession?.trackingNumber}
                    </code>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    开始时间：{pendingSession && new Date(pendingSession.timestamp).toLocaleString("zh-CN")}
                  </p>
                </div>
                <p className="text-sm">是否继续之前的入库操作？</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel onClick={handleClearSession} className="border-destructive text-destructive hover:bg-destructive/10">
              清零重新开始
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreSession} className="gradient-primary">
              继续入库
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 页面切换警告对话框 */}
      <AlertDialog open={isLeaveWarningOpen} onOpenChange={setIsLeaveWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              入库尚未完成
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>您当前有一个正在进行的入库操作尚未完成。</p>
                <div className="rounded-lg bg-muted p-3 space-y-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground">物流跟踪号：</span>
                    <code className="ml-1 font-medium bg-background px-1.5 py-0.5 rounded">
                      {matchedShipment?.tracking_number}
                    </code>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    已入库: {getInboundedCount(matchedShipment?.tracking_number || "")} / {matchedShipments.reduce((sum, s) => sum + s.quantity, 0)} 件
                  </p>
                </div>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  离开此页面后，您可以稍后通过"继续入库"功能恢复此操作。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel onClick={() => setIsLeaveWarningOpen(false)}>
              继续入库
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmLeave}
              className="bg-amber-600 hover:bg-amber-700"
            >
              确认离开
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
