import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ScanLine, Package, CheckCircle, X, ArrowRight, Truck, AlertCircle, PackageCheck } from "lucide-react";
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

    // 检查是否已存在于入库记录
    const existingItem = inboundItems?.find(item => item.lpn === lpn);
    if (existingItem) {
      vibrateWarning();
      playWarning();
      toast.error("该LPN已入库");
      setLpnInput("");
      return;
    }

    // 成功振动和音效，然后跳转到处理页面
    vibrateSuccess();
    playSuccess();
    setLpnInput("");
    
    // 跳转到入库处理页面
    navigate(`/inbound/process?lpn=${encodeURIComponent(lpn)}&tracking=${encodeURIComponent(matchedShipment?.tracking_number || "")}`);
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

  // 空闲状态 - 显示浮动按钮
  if (step === "idle") {
    const hasActiveShipment = matchedShipment !== null;
    const inboundedCount = matchedShipment ? getInboundedCount(matchedShipment.tracking_number) : 0;
    const totalQuantity = matchedShipments.reduce((sum, s) => sum + s.quantity, 0);
    const remainingCount = totalQuantity - inboundedCount;

    return (
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
    );
  }

  // 扫描物流号步骤
  if (step === "scan_tracking") {
    return (
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
                size="icon" 
                className="h-12 w-12 gradient-primary shrink-0"
                disabled={!trackingInput}
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
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
      <div className="fixed inset-0 z-50 bg-gradient-to-b from-background to-muted/30 flex flex-col pt-[env(safe-area-inset-top,0px)]">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between p-4 bg-background/80 backdrop-blur-sm border-b shrink-0">
          <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-lg">
            <X className="h-5 w-5" />
          </Button>
          <h2 className="font-semibold text-lg">扫描LPN入库</h2>
          <div className="w-10" />
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 pb-32 space-y-4">
            {/* 步骤指示 */}
            <div className="flex items-center justify-center gap-3 bg-card px-5 py-2 rounded-full border shadow-sm mx-auto w-fit">
              <div className="h-7 w-7 rounded-lg bg-green-500 text-white flex items-center justify-center text-sm">
                <CheckCircle className="h-4 w-4" />
              </div>
              <div className="h-px w-6 bg-primary" />
              <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                2
              </div>
            </div>

            {/* 货件产品列表 */}
            <div className="space-y-2">
              {skuProgress.map((shipment, index) => (
                <div 
                  key={shipment.id} 
                  className={cn(
                    "rounded-lg border p-4 transition-all",
                    shipment.inbounded >= shipment.quantity 
                      ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                      : "bg-card"
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                      shipment.inbounded >= shipment.quantity ? "bg-green-100 dark:bg-green-900" : "bg-primary/10"
                    )}>
                      {shipment.inbounded >= shipment.quantity ? (
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Package className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{shipment.product_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{shipment.tracking_number}</p>
                    </div>
                    <Badge variant={shipment.inbounded >= shipment.quantity ? "default" : "secondary"} className={cn(
                      shipment.inbounded >= shipment.quantity && "bg-green-600"
                    )}>
                      {shipment.inbounded}/{shipment.quantity}
                    </Badge>
                  </div>
                  <Progress 
                    value={(shipment.inbounded / shipment.quantity) * 100}
                    className={cn("h-1.5", shipment.inbounded >= shipment.quantity && "[&>div]:bg-green-500")}
                  />
                </div>
              ))}
            </div>

            {/* 剩余数量提示 */}
            <div className="text-center py-2">
              <Badge variant="outline" className="text-base px-4 py-1">
                还剩 {remainingCount} 件待入库
              </Badge>
            </div>

            {/* 扫描按钮 */}
            <div className="flex flex-col items-center pt-4">
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-primary/15 rounded-2xl blur-xl pointer-events-none" />
                <Scanner 
                  onScan={handleLpnScan} 
                  buttonLabel=""
                  buttonSize="lg"
                  buttonClassName="h-28 w-28 rounded-2xl gradient-primary shadow-xl"
                />
              </div>
              <p className="text-lg font-semibold">扫描LPN标签</p>
              <p className="text-sm text-muted-foreground">扫描产品上的LPN条码</p>
            </div>

            {/* 手动输入 */}
            <div className="space-y-3 pt-4">
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
                  size="icon" 
                  className="h-12 w-12 gradient-primary shrink-0"
                  disabled={!lpnInput}
                >
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* 底部操作栏 */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-4 pb-[calc(env(safe-area-inset-bottom,12px)+12px)]">
          <div className="flex gap-3">
            {inboundedCount >= totalQuantity ? (
              <Button onClick={handleCompletePackage} className="flex-1 h-12 bg-green-600 hover:bg-green-700">
                <PackageCheck className="mr-2 h-5 w-5" />
                完成包裹
              </Button>
            ) : inboundedCount > 0 ? (
              <Button variant="outline" onClick={() => setIsForceCompleteOpen(true)} className="flex-1 h-12 border-amber-300 text-amber-700">
                <AlertCircle className="mr-2 h-5 w-5" />
                强制完成 (差 {remainingCount} 件)
              </Button>
            ) : null}
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
    );
  }

  return null;
}
