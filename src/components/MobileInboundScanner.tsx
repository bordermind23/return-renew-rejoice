import { useState, useEffect } from "react";
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
      toast.error(`未找到物流跟踪号: ${trackingCode}`);
      return;
    }

    const inboundedCount = getInboundedCount(found.tracking_number);
    if (inboundedCount >= found.quantity) {
      toast.warning(`该物流号下的 ${found.quantity} 件货物已全部入库`);
      return;
    }

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
      toast.error(`LPN号 "${lpn}" 不存在于退货订单列表中`);
      return;
    }

    // 检查是否已扫描过
    if (scannedLpns.includes(lpn)) {
      toast.error("该LPN已扫描过");
      return;
    }

    // 检查是否已存在于入库记录
    const existingItem = inboundItems?.find(item => item.lpn === lpn);
    if (existingItem) {
      toast.error("该LPN已入库");
      return;
    }

    // 跳转到入库处理页面
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
      <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center p-6">
        {/* 已匹配货件信息卡片 */}
        {hasActiveShipment && matchedShipment && (
          <div className="w-full max-w-sm mb-8 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Truck className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium text-sm">当前货件</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs">
                更换
              </Button>
            </div>
            <p className="text-sm font-medium truncate mb-1">{matchedShipment.product_name}</p>
            <p className="text-xs text-muted-foreground mb-3">{matchedShipment.tracking_number}</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">入库进度</span>
              <span className="font-medium">{getInboundedCount(matchedShipment.tracking_number)} / {matchedShipment.quantity}</span>
            </div>
            <Progress 
              value={(getInboundedCount(matchedShipment.tracking_number) / matchedShipment.quantity) * 100}
              className="h-2 mt-2"
            />
          </div>
        )}

        {/* 中央浮动扫描按钮 */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
          <Button
            onClick={hasActiveShipment ? () => setStep("scan_lpn") : startScanning}
            className="relative h-32 w-32 rounded-full gradient-primary shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <div className="flex flex-col items-center gap-2">
              <ScanLine className="h-10 w-10" />
              <span className="text-sm font-medium">
                {hasActiveShipment ? "扫描LPN" : "开始扫描"}
              </span>
            </div>
          </Button>
        </div>

        {/* 提示文字 */}
        <p className="mt-8 text-sm text-muted-foreground text-center max-w-xs">
          {hasActiveShipment 
            ? `还有 ${remainingCount} 件待入库，点击按钮扫描LPN`
            : "点击按钮开始扫描物流跟踪号"}
        </p>

        {/* 今日统计 */}
        <div className="mt-8 flex gap-6 text-center">
          <div>
            <p className="text-2xl font-bold text-primary">{inboundItems?.length || 0}</p>
            <p className="text-xs text-muted-foreground">今日入库</p>
          </div>
        </div>
      </div>
    );
  }

  // 扫描物流号步骤
  if (step === "scan_tracking") {
    return (
      <div className="fixed inset-0 z-50 bg-background pt-[env(safe-area-inset-top,0px)]">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between p-4 border-b">
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
          <h2 className="font-semibold">扫描物流跟踪号</h2>
          <div className="w-10" />
        </div>

        <div className="flex flex-col items-center justify-center p-6 h-[calc(100%-80px)]">
          {/* 步骤指示 */}
          <div className="flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              1
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm">
              2
            </div>
          </div>

          {/* 扫描按钮 */}
          <div className="mb-8">
            <Scanner 
              onScan={handleTrackingScan} 
              buttonLabel=""
              buttonSize="lg"
              buttonClassName="h-28 w-28 rounded-full gradient-primary shadow-lg"
            />
          </div>

          <p className="text-lg font-medium mb-6">扫描包裹物流跟踪号</p>

          {/* 手动输入 */}
          <div className="w-full max-w-xs space-y-3">
            <p className="text-sm text-muted-foreground text-center">或手动输入</p>
            <div className="flex gap-2">
              <Input
                placeholder="输入物流跟踪号..."
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTrackingScan(trackingInput)}
                className="text-center"
              />
              <Button onClick={() => handleTrackingScan(trackingInput)} disabled={!trackingInput.trim()}>
                <ArrowRight className="h-4 w-4" />
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
      <div className="fixed inset-0 z-50 bg-background pt-[env(safe-area-inset-top,0px)]">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between p-4 border-b">
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
          <h2 className="font-semibold">扫描LPN入库</h2>
          <div className="w-10" />
        </div>

        <div className="flex flex-col items-center p-6">
          {/* 步骤指示 */}
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-full bg-green-500 text-white flex items-center justify-center">
              <CheckCircle className="h-4 w-4" />
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              2
            </div>
          </div>

          {/* 货件信息 */}
          <div className="w-full max-w-sm rounded-xl bg-muted/50 p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{matchedShipment.product_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{matchedShipment.tracking_number}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={(inboundedCount / matchedShipment.quantity) * 100} className="h-1.5 flex-1" />
                  <span className="text-xs font-medium">{inboundedCount}/{matchedShipment.quantity}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 剩余数量 */}
          <div className="mb-6">
            <Badge variant="secondary" className="text-base px-4 py-1">
              还剩 {remainingCount} 件待入库
            </Badge>
          </div>

          {/* 扫描按钮 */}
          <div className="mb-8">
            <Scanner 
              onScan={handleLpnScan} 
              buttonLabel=""
              buttonSize="lg"
              buttonClassName="h-28 w-28 rounded-full gradient-primary shadow-lg"
            />
          </div>

          <p className="text-lg font-medium mb-6">扫描产品LPN标签</p>

          {/* 手动输入 */}
          <div className="w-full max-w-xs space-y-3">
            <p className="text-sm text-muted-foreground text-center">或手动输入</p>
            <div className="flex gap-2">
              <Input
                placeholder="输入LPN号..."
                value={lpnInput}
                onChange={(e) => setLpnInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLpnScan(lpnInput)}
                className="text-center"
              />
              <Button onClick={() => handleLpnScan(lpnInput)} disabled={!lpnInput.trim()}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 已扫描的LPN */}
          {scannedLpns.length > 0 && (
            <div className="w-full max-w-sm mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">本次已扫描:</p>
              <div className="flex flex-wrap gap-2">
                {scannedLpns.map((lpn) => (
                  <Badge key={lpn} variant="outline" className="text-xs">
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
