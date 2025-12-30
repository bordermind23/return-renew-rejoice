import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ScanLine, Package, CheckCircle, X, ArrowRight, Truck, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Scanner } from "@/components/Scanner";
import { useRemovalShipments, type RemovalShipment } from "@/hooks/useRemovalShipments";
import { useInboundItems } from "@/hooks/useInboundItems";
import { fetchOrdersByLpn } from "@/hooks/useOrdersByLpn";
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

// 成功振动 - 短促两次
const vibrateSuccess = () => vibrate([50, 50, 50]);

// 失败振动 - 长振动一次
const vibrateError = () => vibrate(200);

// 警告振动 - 中等振动两次
const vibrateWarning = () => vibrate([100, 50, 100]);

type ScanStep = "idle" | "scan_tracking" | "scan_lpn";

interface MobileInboundScannerProps {
  initialTracking?: string;
}

export function MobileInboundScanner({ initialTracking }: MobileInboundScannerProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<ScanStep>("idle");
  const [trackingInput, setTrackingInput] = useState("");
  const [lpnInput, setLpnInput] = useState("");
  const [matchedShipment, setMatchedShipment] = useState<RemovalShipment | null>(null);
  const [scannedLpns, setScannedLpns] = useState<string[]>([]);

  const { data: shipments } = useRemovalShipments();
  const { data: inboundItems } = useInboundItems();

  // 获取该物流号已入库的LPN数量
  const getInboundedCount = (trackingNumber: string) => {
    return (inboundItems || []).filter(item => item.tracking_number === trackingNumber).length;
  };

  // 初始化时如果有传入的物流号，自动进入扫描LPN步骤
  useEffect(() => {
    if (initialTracking && shipments) {
      const found = shipments.find(
        s => s.tracking_number.toLowerCase() === initialTracking.toLowerCase()
      );
      if (found) {
        const inboundedCount = getInboundedCount(found.tracking_number);
        if (inboundedCount < found.quantity) {
          setMatchedShipment(found);
          setTrackingInput(found.tracking_number);
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

    const found = shipments?.find(
      s => s.tracking_number.toLowerCase() === trackingCode.toLowerCase()
    );

    if (!found) {
      vibrateError();
      toast.error(`未找到物流跟踪号: ${trackingCode}`);
      return;
    }

    const inboundedCount = getInboundedCount(found.tracking_number);
    if (inboundedCount >= found.quantity) {
      vibrateWarning();
      toast.warning(`该物流号下的 ${found.quantity} 件货物已全部入库`);
      return;
    }

    vibrateSuccess();
    setMatchedShipment(found);
    setTrackingInput(trackingCode);
    setScannedLpns([]);
    setStep("scan_lpn");
    toast.success(`匹配成功: ${found.product_name}`);
  };

  // 处理LPN扫描
  const handleLpnScan = async (code: string) => {
    const lpn = code.trim();
    if (!lpn) return;

    // 检查LPN是否存在于退货订单列表
    const lpnOrders = await fetchOrdersByLpn(lpn);
    if (lpnOrders.length === 0) {
      vibrateError();
      toast.error(`LPN号 "${lpn}" 不存在于退货订单列表中`);
      return;
    }

    // 检查是否已扫描过
    if (scannedLpns.includes(lpn)) {
      vibrateWarning();
      toast.error("该LPN已扫描过");
      return;
    }

    // 检查是否已存在于入库记录
    const existingItem = inboundItems?.find(item => item.lpn === lpn);
    if (existingItem) {
      vibrateWarning();
      toast.error("该LPN已入库");
      return;
    }

    // 成功振动并跳转到入库处理页面
    vibrateSuccess();
    if (matchedShipment) {
      navigate(`/inbound/process?lpn=${encodeURIComponent(lpn)}&tracking=${encodeURIComponent(matchedShipment.tracking_number)}`);
    }
  };

  // 重置
  const handleReset = () => {
    setStep("idle");
    setMatchedShipment(null);
    setTrackingInput("");
    setLpnInput("");
    setScannedLpns([]);
  };

  // 关闭当前步骤
  const handleClose = () => {
    if (step === "scan_lpn" && matchedShipment) {
      // 如果在扫描LPN阶段，保留货件信息返回待命状态
      setStep("idle");
    } else {
      handleReset();
    }
  };

  // 空闲状态 - 显示浮动按钮
  if (step === "idle") {
    const hasActiveShipment = matchedShipment !== null;
    const remainingCount = matchedShipment 
      ? matchedShipment.quantity - getInboundedCount(matchedShipment.tracking_number)
      : 0;

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
              <span className="font-semibold text-primary">{getInboundedCount(matchedShipment.tracking_number)} / {matchedShipment.quantity}</span>
            </div>
            <Progress 
              value={(getInboundedCount(matchedShipment.tracking_number) / matchedShipment.quantity) * 100}
              className="h-2"
            />
          </div>
        )}

        {/* 中央浮动扫描按钮 - 方形设计 */}
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

          {/* 扫描按钮 - 方形设计 */}
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
    );
  }

  // 扫描LPN步骤
  if (step === "scan_lpn" && matchedShipment) {
    const inboundedCount = getInboundedCount(matchedShipment.tracking_number);
    const remainingCount = matchedShipment.quantity - inboundedCount;

    return (
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
                  <Progress value={(inboundedCount / matchedShipment.quantity) * 100} className="h-2 flex-1" />
                  <span className="text-sm font-semibold text-primary">{inboundedCount}/{matchedShipment.quantity}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 剩余数量 */}
          <div className="mb-6">
            <Badge variant="secondary" className="text-sm px-5 py-1.5 rounded-lg font-medium">
              还剩 {remainingCount} 件待入库
            </Badge>
          </div>

          {/* 扫描按钮 - 方形设计 */}
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
      </div>
    );
  }

  return null;
}
