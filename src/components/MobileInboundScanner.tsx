import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Package, CheckCircle, X, ArrowRight, Truck, AlertCircle, PackageCheck, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Scanner } from "@/components/Scanner";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { useRemovalShipments, useUpdateRemovalShipment, type RemovalShipment } from "@/hooks/useRemovalShipments";
import { useInboundItems } from "@/hooks/useInboundItems";
import { fetchOrdersByLpn } from "@/hooks/useOrdersByLpn";
import { supabase } from "@/integrations/supabase/client";
import { useSound } from "@/hooks/useSound";
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
  const navigate = useNavigate();
  const { playSuccess, playError, playWarning } = useSound();
  const [step, setStep] = useState<ScanStep>("idle");
  const [trackingInput, setTrackingInput] = useState("");
  const [lpnInput, setLpnInput] = useState("");
  const [matchedShipment, setMatchedShipment] = useState<RemovalShipment | null>(null);
  const [matchedShipments, setMatchedShipments] = useState<RemovalShipment[]>([]);
  const [scannedLpns, setScannedLpns] = useState<string[]>([]);
  const [isForceCompleteOpen, setIsForceCompleteOpen] = useState(false);
  
  // 拍照相关状态 - 使用原生相机
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognizedNumbers, setRecognizedNumbers] = useState<string[]>([]);
  const [shippingLabelPhoto, setShippingLabelPhoto] = useState<string | null>(null);
  const nativeCameraRef = useRef<HTMLInputElement>(null);

  const { data: shipments } = useRemovalShipments();
  const { data: inboundItems } = useInboundItems();
  const updateShipmentMutation = useUpdateRemovalShipment();

  // 获取该物流号已入库的LPN数量
  const getInboundedCount = (trackingNumber: string) => {
    return (inboundItems || []).filter(item => item.tracking_number === trackingNumber).length;
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

  // 开始扫描流程 - 直接触发原生相机
  const startScanning = () => {
    setStep("scan_tracking");
    setCapturedImage(null);
    setRecognizedNumbers([]);
    // 延迟触发原生相机，确保状态已更新
    setTimeout(() => {
      nativeCameraRef.current?.click();
    }, 100);
  };

  // 处理原生相机拍照结果
  const handleNativeCameraCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setCapturedImage(imageData);
      recognizeTracking(imageData);
    };
    reader.readAsDataURL(file);
    
    // 重置input以允许再次选择同一文件
    event.target.value = '';
  };

  // AI识别物流号 - 识别成功后自动进入LPN扫描
  const recognizeTracking = async (imageData: string) => {
    setIsRecognizing(true);
    setRecognizedNumbers([]);

    try {
      const { data, error } = await supabase.functions.invoke("recognize-tracking", {
        body: { imageBase64: imageData }
      });

      if (error) {
        console.error("Recognition error:", error);
        toast.error("识别失败，请重试");
        return;
      }

      if (data.trackingNumbers && data.trackingNumbers.length > 0) {
        const trackingNumbers = data.trackingNumbers;
        setRecognizedNumbers(trackingNumbers);
        vibrateSuccess();
        toast.success(`识别到物流号: ${trackingNumbers[0]}`);
        
        // 自动选择第一个识别到的物流号并进入LPN扫描
        await autoSelectTrackingNumber(trackingNumbers[0], imageData);
      } else {
        vibrateWarning();
        toast.warning("未能识别到物流号，请手动输入");
      }
    } catch (error) {
      console.error("Recognition error:", error);
      toast.error("识别失败");
    } finally {
      setIsRecognizing(false);
    }
  };

  // 自动选择物流号并进入LPN扫描（识别成功后自动调用）
  const autoSelectTrackingNumber = async (trackingNumber: string, imageData: string) => {
    const allMatched = shipments?.filter(
      s => s.tracking_number.toLowerCase() === trackingNumber.toLowerCase()
    ) || [];

    if (allMatched.length === 0) {
      vibrateError();
      playError();
      toast.error(`未找到物流跟踪号: ${trackingNumber}，请检查或手动输入`);
      return;
    }

    const totalQuantity = allMatched.reduce((sum, s) => sum + s.quantity, 0);
    const inboundedCount = getInboundedCount(allMatched[0].tracking_number);
    if (inboundedCount >= totalQuantity) {
      vibrateWarning();
      playWarning();
      toast.warning(`该物流号下的 ${totalQuantity} 件货物已全部入库`);
      return;
    }

    // 上传照片到storage
    try {
      const response = await fetch(imageData);
      const blob = await response.blob();
      const filename = `${trackingNumber}/${Date.now()}.jpg`;
      
      await supabase.storage
        .from("shipping-labels")
        .upload(filename, blob, {
          contentType: "image/jpeg",
          upsert: true
        });

      const { data: { publicUrl } } = supabase.storage
        .from("shipping-labels")
        .getPublicUrl(filename);

      setShippingLabelPhoto(publicUrl);
    } catch (error) {
      console.error("Upload error:", error);
    }

    vibrateSuccess();
    playSuccess();
    setMatchedShipment(allMatched[0]);
    setMatchedShipments(allMatched);
    setTrackingInput(trackingNumber);
    setScannedLpns([]);
    setCapturedImage(null);
    setRecognizedNumbers([]);
    setStep("scan_lpn");
    toast.success(`匹配成功: ${allMatched.length} 种产品，开始扫描LPN`);
  };

  // 选择识别到的物流号
  const selectTrackingNumber = async (trackingNumber: string) => {
    const allMatched = shipments?.filter(
      s => s.tracking_number.toLowerCase() === trackingNumber.toLowerCase()
    ) || [];

    if (allMatched.length === 0) {
      vibrateError();
      playError();
      toast.error(`未找到物流跟踪号: ${trackingNumber}`);
      return;
    }

    const totalQuantity = allMatched.reduce((sum, s) => sum + s.quantity, 0);
    const inboundedCount = getInboundedCount(allMatched[0].tracking_number);
    if (inboundedCount >= totalQuantity) {
      vibrateWarning();
      playWarning();
      toast.warning(`该物流号下的 ${totalQuantity} 件货物已全部入库`);
      return;
    }

    // 上传照片到storage
    if (capturedImage) {
      try {
        const response = await fetch(capturedImage);
        const blob = await response.blob();
        const filename = `${trackingNumber}/${Date.now()}.jpg`;
        
        await supabase.storage
          .from("shipping-labels")
          .upload(filename, blob, {
            contentType: "image/jpeg",
            upsert: true
          });

        const { data: { publicUrl } } = supabase.storage
          .from("shipping-labels")
          .getPublicUrl(filename);

        setShippingLabelPhoto(publicUrl);
      } catch (error) {
        console.error("Upload error:", error);
      }
    }

    vibrateSuccess();
    playSuccess();
    setMatchedShipment(allMatched[0]);
    setMatchedShipments(allMatched);
    setTrackingInput(trackingNumber);
    setScannedLpns([]);
    setCapturedImage(null);
    setRecognizedNumbers([]);
    setStep("scan_lpn");
    toast.success(`匹配成功: ${allMatched.length} 种产品`);
  };

  // 重拍照片 - 重新触发原生相机
  const retakePhoto = () => {
    setCapturedImage(null);
    setRecognizedNumbers([]);
    setTimeout(() => {
      nativeCameraRef.current?.click();
    }, 100);
  };

  // 处理物流号扫描（手动输入备用）
  const handleTrackingScan = (code: string) => {
    const trackingCode = code.trim();
    if (!trackingCode) return;

    const allMatched = shipments?.filter(
      s => s.tracking_number.toLowerCase() === trackingCode.toLowerCase()
    ) || [];

    if (allMatched.length === 0) {
      vibrateError();
      playError();
      toast.error(`未找到物流跟踪号: ${trackingCode}`);
      return;
    }

    const totalQuantity = allMatched.reduce((sum, s) => sum + s.quantity, 0);
    const inboundedCount = getInboundedCount(allMatched[0].tracking_number);
    if (inboundedCount >= totalQuantity) {
      vibrateWarning();
      playWarning();
      toast.warning(`该物流号下的 ${totalQuantity} 件货物已全部入库`);
      return;
    }

    vibrateSuccess();
    playSuccess();
    setMatchedShipment(allMatched[0]);
    setMatchedShipments(allMatched);
    setTrackingInput(trackingCode);
    setScannedLpns([]);
    setStep("scan_lpn");
    toast.success(`匹配成功: ${allMatched.length} 种产品`);
  };

  // 处理LPN扫描 - 跳转到新页面
  const handleLpnScan = async (code: string) => {
    const lpn = code.trim();
    if (!lpn) return;

    // 检查LPN是否存在于退货订单列表
    const lpnOrders = await fetchOrdersByLpn(lpn);
    if (lpnOrders.length === 0) {
      vibrateError();
      playError();
      toast.error(`LPN号 "${lpn}" 不存在于退货订单列表中`);
      setLpnInput("");
      return;
    }

    // 检查是否已扫描过
    if (scannedLpns.includes(lpn)) {
      vibrateWarning();
      playWarning();
      toast.error("该LPN已扫描过");
      setLpnInput("");
      return;
    }

    // 实时查询数据库检查是否已存在于入库记录（不依赖缓存）
    const { data: existingItems } = await supabase
      .from("inbound_items")
      .select("id")
      .eq("lpn", lpn)
      .limit(1);
    
    if (existingItems && existingItems.length > 0) {
      vibrateWarning();
      playWarning();
      toast.error("该LPN已入库");
      setLpnInput("");
      return;
    }

    // 成功振动和音效，然后跳转到处理页面（传递物流面单照片URL）
    vibrateSuccess();
    playSuccess();
    setLpnInput("");
    
    // 跳转到入库处理页面，包含物流面单照片URL
    const params = new URLSearchParams({
      lpn,
      tracking: matchedShipment?.tracking_number || "",
    });
    if (shippingLabelPhoto) {
      params.set("labelPhoto", shippingLabelPhoto);
    }
    navigate(`/inbound/process?${params.toString()}`);
  };

  // 重置
  const handleReset = () => {
    setStep("idle");
    setMatchedShipment(null);
    setMatchedShipments([]);
    setTrackingInput("");
    setLpnInput("");
    setScannedLpns([]);
  };

  // 关闭当前步骤
  const handleClose = () => {
    if (step === "scan_lpn" && matchedShipment) {
      setStep("idle");
    } else {
      handleReset();
    }
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
    playSuccess();
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
      playError();
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
    playSuccess();
    toast.success(`包裹入库完成！共 ${totalInbounded} 件货物`);
    handleReset();
  };

  // 空闲状态 - 显示主界面
  if (step === "idle") {
    const hasActiveShipment = matchedShipment !== null;
    const inboundedCount = matchedShipment ? getInboundedCount(matchedShipment.tracking_number) : 0;
    const totalQuantity = matchedShipments.reduce((sum, s) => sum + s.quantity, 0);
    const remainingCount = totalQuantity - inboundedCount;

    return (
      <div className="min-h-[calc(100vh-120px)] flex flex-col p-4 bg-gradient-to-b from-background to-muted/20">
        {/* 顶部标题 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">入库扫码</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hasActiveShipment ? "点击下方按钮继续扫描" : "点击开始扫描物流号"}
          </p>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* 已匹配货件卡片 - 简化显示 */}
          {hasActiveShipment && matchedShipment && (
            <div className="w-full max-w-sm mb-6 rounded-2xl bg-card border-2 border-primary/20 shadow-lg p-5 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <Badge variant="secondary" className="text-xs">当前货件</Badge>
                <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs text-muted-foreground">
                  更换
                </Button>
              </div>
              
              {/* 大进度显示 */}
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-primary mb-1">
                  {inboundedCount} <span className="text-muted-foreground text-xl font-normal">/ {totalQuantity}</span>
                </div>
                <p className="text-sm text-muted-foreground">已入库</p>
              </div>
              
              <Progress value={(inboundedCount / totalQuantity) * 100} className="h-3 rounded-full" />
              
              <p className="text-xs text-muted-foreground text-center mt-3 font-mono truncate">
                {matchedShipment.tracking_number}
              </p>
              
              {/* 快捷操作 */}
              {inboundedCount > 0 && (
                <div className="mt-4 pt-4 border-t">
                  {inboundedCount >= totalQuantity ? (
                    <Button onClick={handleCompletePackage} className="w-full h-12 bg-green-600 hover:bg-green-700 text-base">
                      <PackageCheck className="mr-2 h-5 w-5" />
                      完成包裹
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setIsForceCompleteOpen(true)} className="w-full h-11 border-amber-300 text-amber-700">
                      强制完成 (差 {remainingCount} 件)
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 大扫描按钮 */}
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-2xl pointer-events-none scale-110" />
            <Button
              onClick={hasActiveShipment ? () => setStep("scan_lpn") : startScanning}
              className="relative h-40 w-40 rounded-3xl gradient-primary shadow-2xl hover:shadow-3xl transition-all duration-300 active:scale-95"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Camera className="h-10 w-10" />
                </div>
                <span className="text-lg font-bold">
                  {hasActiveShipment ? "扫描LPN" : "拍摄面单"}
                </span>
              </div>
            </Button>
          </div>

          {/* 提示 */}
          {!hasActiveShipment && (
            <p className="mt-6 text-sm text-muted-foreground text-center">
              拍摄物流面单，自动识别跟踪号
            </p>
          )}
        </div>

        {/* 底部统计 */}
        <div className="mt-auto pt-6">
          <div className="flex items-center justify-center gap-3 px-5 py-4 bg-card rounded-2xl border shadow-sm">
            <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-3xl font-bold">{inboundItems?.length || 0}</p>
              <p className="text-xs text-muted-foreground">今日已入库</p>
            </div>
          </div>
        </div>

        {/* 强制完成确认抽屉 */}
        <Drawer open={isForceCompleteOpen} onOpenChange={setIsForceCompleteOpen}>
          <DrawerContent className="pb-8">
            <DrawerHeader>
              <DrawerTitle className="flex items-center justify-center gap-2 text-amber-600 text-lg">
                <AlertCircle className="h-5 w-5" />
                确认强制完成
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-6 pb-4 text-center">
              <p className="text-muted-foreground">
                申报 <span className="font-bold text-foreground">{totalQuantity}</span> 件，
                已入库 <span className="font-bold text-foreground">{inboundedCount}</span> 件，
                差异 <span className="font-bold text-amber-600">{remainingCount}</span> 件
              </p>
            </div>
            <DrawerFooter className="flex-row gap-3 px-6">
              <Button variant="outline" onClick={() => setIsForceCompleteOpen(false)} className="flex-1 h-12">
                取消
              </Button>
              <Button onClick={handleForceComplete} className="flex-1 h-12 bg-amber-600 hover:bg-amber-700">
                确认完成
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  // 拍摄物流面单步骤 - 使用原生相机
  if (step === "scan_tracking") {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* 隐藏的原生相机input */}
        <input
          ref={nativeCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleNativeCameraCapture}
        />
        
        {/* 顶部栏 */}
        <div className="flex items-center justify-between p-4 shrink-0 border-b">
          <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-full h-11 w-11">
            <X className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="text-sm font-medium">拍摄物流面单</p>
          </div>
          <div className="w-11" />
        </div>

        {/* 无照片时的提示界面 */}
        {!capturedImage && !isRecognizing && (
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <div className="text-center mb-8">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Camera className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">拍摄物流面单</h2>
              <p className="text-sm text-muted-foreground">
                点击下方按钮打开相机拍摄
              </p>
            </div>
            
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button 
                onClick={() => nativeCameraRef.current?.click()}
                className="h-14 text-lg gradient-primary"
              >
                <Camera className="mr-2 h-6 w-6" />
                打开相机
              </Button>
              
              {/* 手动输入备用 */}
              <div className="mt-6 pt-6 border-t w-full">
                <p className="text-xs text-muted-foreground text-center mb-3">或手动输入物流号</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="输入物流跟踪号"
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    className="h-12 text-center font-mono"
                  />
                  <Button 
                    onClick={() => handleTrackingScan(trackingInput)} 
                    className="h-12 px-4 gradient-primary"
                    disabled={!trackingInput}
                  >
                    确认
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 正在识别中 */}
        {isRecognizing && !capturedImage && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">正在识别物流号...</p>
            </div>
          </div>
        )}

        {/* 已拍摄照片 - 识别中或显示结果 */}
        {capturedImage && (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 relative bg-muted">
              <img
                src={capturedImage}
                alt="物流面单"
                className="absolute inset-0 w-full h-full object-contain"
              />
              {isRecognizing && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-primary" />
                    <p>正在识别物流号...</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* 识别结果 */}
            <div className="p-4 pb-8 bg-background border-t">
              {recognizedNumbers.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-center text-muted-foreground">识别成功，正在匹配...</p>
                </div>
              ) : !isRecognizing ? (
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">未能识别到物流号</p>
                </div>
              ) : null}
              
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={retakePhoto} className="flex-1 h-12">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  重拍
                </Button>
                {recognizedNumbers.length === 0 && !isRecognizing && (
                  <Button onClick={() => recognizeTracking(capturedImage)} className="flex-1 h-12">
                    重新识别
                  </Button>
                )}
              </div>
              
              {/* 手动输入备用 */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground text-center mb-3">或手动输入物流号</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="输入物流跟踪号"
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    className="h-12 text-center font-mono"
                  />
                  <Button 
                    onClick={() => handleTrackingScan(trackingInput)} 
                    className="h-12 px-4 gradient-primary"
                    disabled={!trackingInput}
                  >
                    确认
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 扫描LPN步骤
  if (step === "scan_lpn" && matchedShipment) {
    const totalQuantity = matchedShipments.reduce((sum, s) => sum + s.quantity, 0);
    const inboundedCount = getInboundedCount(matchedShipment.tracking_number);
    const remainingCount = totalQuantity - inboundedCount;

    // 按SKU分组显示进度
    const skuProgress = matchedShipments.map(shipment => {
      const skuInbounded = (inboundItems || []).filter(
        item => item.tracking_number === matchedShipment.tracking_number && item.product_sku === shipment.product_sku
      ).length;
      return {
        ...shipment,
        inbounded: skuInbounded,
      };
    });

    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-b from-primary/5 to-background flex flex-col pt-[env(safe-area-inset-top,0px)]">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between p-4 shrink-0">
          <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-full h-11 w-11 bg-muted/50">
            <X className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">步骤 2/2</p>
          </div>
          <div className="w-11" />
        </div>

        {/* 进度概览 - 固定在顶部 */}
        <div className="px-4 pb-4 shrink-0">
          <div className="bg-card rounded-2xl border-2 border-primary/20 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="text-center flex-1">
                <div className="text-3xl font-bold text-primary">{inboundedCount}</div>
                <p className="text-xs text-muted-foreground">已入库</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="text-center flex-1">
                <div className="text-3xl font-bold">{totalQuantity}</div>
                <p className="text-xs text-muted-foreground">总计</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="text-center flex-1">
                <div className={cn("text-3xl font-bold", remainingCount > 0 ? "text-amber-500" : "text-green-500")}>
                  {remainingCount}
                </div>
                <p className="text-xs text-muted-foreground">待入库</p>
              </div>
            </div>
            <Progress value={(inboundedCount / totalQuantity) * 100} className="h-2" />
          </div>
        </div>

        {/* 扫描区域 */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* 大扫描按钮 */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-2xl pointer-events-none scale-110" />
            <Scanner 
              onScan={handleLpnScan} 
              buttonLabel=""
              buttonSize="lg"
              buttonClassName="h-32 w-32 rounded-3xl gradient-primary shadow-2xl"
            />
          </div>
          
          <h2 className="text-xl font-bold mb-1">扫描LPN标签</h2>
          <p className="text-sm text-muted-foreground mb-6">扫描产品上的LPN条码</p>

          {/* 手动输入 */}
          <div className="w-full max-w-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <p className="text-xs text-muted-foreground px-2">或手动输入</p>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="flex gap-3">
              <Input
                placeholder="输入LPN号"
                value={lpnInput}
                onChange={(e) => setLpnInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLpnScan(lpnInput)}
                className="h-14 text-center font-mono text-lg rounded-xl"
              />
              <Button 
                onClick={() => handleLpnScan(lpnInput)} 
                size="icon" 
                className="h-14 w-14 gradient-primary shrink-0 rounded-xl"
                disabled={!lpnInput}
              >
                <ArrowRight className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>

        {/* 产品列表 - 可折叠 */}
        <div className="px-4 pb-4 shrink-0">
          <details className="bg-card rounded-xl border">
            <summary className="p-3 cursor-pointer text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                产品列表 ({skuProgress.length})
              </span>
              <span className="text-xs text-muted-foreground">展开查看</span>
            </summary>
            <div className="px-3 pb-3 space-y-2">
              {skuProgress.map((shipment, index) => (
                <div 
                  key={shipment.id} 
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg text-sm",
                    shipment.inbounded >= shipment.quantity 
                      ? "bg-green-50 dark:bg-green-950/30" 
                      : "bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {shipment.inbounded >= shipment.quantity ? (
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                    )}
                    <span className="truncate">{shipment.product_name}</span>
                  </div>
                  <Badge variant={shipment.inbounded >= shipment.quantity ? "default" : "outline"} className={cn(
                    "shrink-0 ml-2",
                    shipment.inbounded >= shipment.quantity && "bg-green-600"
                  )}>
                    {shipment.inbounded}/{shipment.quantity}
                  </Badge>
                </div>
              ))}
            </div>
          </details>
        </div>

        {/* 底部操作栏 */}
        <div className="shrink-0 bg-background border-t p-4 pb-[calc(env(safe-area-inset-bottom,12px)+12px)]">
          {inboundedCount >= totalQuantity ? (
            <Button onClick={handleCompletePackage} className="w-full h-14 bg-green-600 hover:bg-green-700 text-lg rounded-xl">
              <PackageCheck className="mr-2 h-6 w-6" />
              完成包裹
            </Button>
          ) : inboundedCount > 0 ? (
            <Button variant="outline" onClick={() => setIsForceCompleteOpen(true)} className="w-full h-14 border-amber-300 text-amber-700 text-base rounded-xl">
              <AlertCircle className="mr-2 h-5 w-5" />
              强制完成 (差 {remainingCount} 件)
            </Button>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-2">
              扫描第一个LPN开始入库
            </p>
          )}
        </div>

        {/* 强制完成确认抽屉 */}
        <Drawer open={isForceCompleteOpen} onOpenChange={setIsForceCompleteOpen}>
          <DrawerContent className="pb-8">
            <DrawerHeader>
              <DrawerTitle className="flex items-center justify-center gap-2 text-amber-600 text-lg">
                <AlertCircle className="h-5 w-5" />
                确认强制完成
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-6 pb-4 text-center">
              <p className="text-muted-foreground">
                申报 <span className="font-bold text-foreground">{totalQuantity}</span> 件，
                已入库 <span className="font-bold text-foreground">{inboundedCount}</span> 件，
                差异 <span className="font-bold text-amber-600">{remainingCount}</span> 件
              </p>
            </div>
            <DrawerFooter className="flex-row gap-3 px-6">
              <Button variant="outline" onClick={() => setIsForceCompleteOpen(false)} className="flex-1 h-12">
                取消
              </Button>
              <Button onClick={handleForceComplete} className="flex-1 h-12 bg-amber-600 hover:bg-amber-700">
                确认完成
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return null;
}
