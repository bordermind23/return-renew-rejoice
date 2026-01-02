import { useState, useEffect, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { X, SwitchCamera, Scan, Focus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ScannerProps {
  onScan: (code: string) => void;
  buttonLabel?: string;
  buttonVariant?: "default" | "outline" | "ghost" | "secondary";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  buttonClassName?: string;
  scanType?: "tracking" | "lpn";
}

// LPN 常见是条形码（CODE128/CODE39）或二维码，内容形如 LPNXXXXXXXXXXX
const lpnFormats = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
];

// 物流追踪号常用格式
const trackingFormats = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

// 验证/清洗 LPN：有些设备会读出空格、换行或其他分隔符
const normalizeCode = (code: string) => {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
};

// 验证LPN格式: LPNXXXXXXXXXXX（允许中间带分隔符，normalize 后校验）
const isValidLpn = (code: string): boolean => {
  const normalized = normalizeCode(code);
  return /^LPN[A-Z0-9]+$/.test(normalized);
};

// 检测是否是平板设备（屏幕宽度 >= 768px）
const isTablet = (): boolean => {
  return typeof window !== 'undefined' && window.innerWidth >= 768;
};

// 检测是否是移动设备（通过 userAgent）
const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export function Scanner({
  onScan,
  buttonLabel = "摄像头扫码",
  buttonVariant = "secondary",
  buttonSize = "default",
  buttonClassName = "",
  scanType = "tracking",
}: ScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [compatMode, setCompatMode] = useState(false);
  const [lastScanError, setLastScanError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "scanner-container";

  // 根据扫描类型选择支持的格式
  const supportedFormats = scanType === "lpn" ? lpnFormats : trackingFormats;

  // 根据设备类型和扫描类型动态调整扫描框大小
  // 平板设备使用更大的扫描框以适应更大的屏幕和更远的扫描距离
  const getQrboxConfig = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1024;
    const tablet = isTablet();
    const desktop = w >= 1024;

    if (scanType === "lpn") {
      // LPN多为横向条形码：桌面端通常距离更远，给更大的扫描框
      if (desktop) return { width: 640, height: 260 };
      return tablet ? { width: 420, height: 200 } : { width: 320, height: 160 };
    }

    // 物流追踪号兼容条码/二维码
    if (desktop) return { width: 560, height: 280 };
    return tablet ? { width: 380, height: 220 } : { width: 280, height: 180 };
  };

  useEffect(() => {
    // Get available cameras when dialog opens
    if (isOpen) {
      // 延迟启动以确保对话框完全渲染
      const timer = setTimeout(() => {
        Html5Qrcode.getCameras()
          .then((devices) => {
            console.log("Available cameras:", devices);
            if (devices && devices.length > 0) {
              setCameras(devices);
              const tablet = isTablet();
              // 优先选择后置摄像头（iPad 等设备在未授权前 label 可能为空）
              const backCameraIndex = devices.findIndex(
                (device) => device.label.toLowerCase().includes("back") ||
                            device.label.toLowerCase().includes("rear") ||
                            device.label.toLowerCase().includes("environment") ||
                            device.label.includes("后置")
              );
              const fallbackIndex = tablet ? devices.length - 1 : 0;
              const preferredIndex = backCameraIndex >= 0 ? backCameraIndex : fallbackIndex;
              setCurrentCameraIndex(preferredIndex);
              startScanner(devices[preferredIndex].id);
            } else {
              setError("未找到摄像头设备");
            }
          })
          .catch((err) => {
            console.error("获取摄像头失败:", err);
            setError("无法访问摄像头，请确保已授权摄像头权限");
          });
      }, 100);

      return () => clearTimeout(timer);
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async (cameraId: string) => {
    setError(null);
    setIsScanning(true);

    try {
      // Stop existing scanner if any - 检查扫描器状态避免 "cannot stop" 错误
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          // 只有在扫描中或暂停状态才停止
          if (state === 2 || state === 3) { // 2 = SCANNING, 3 = PAUSED
            await scannerRef.current.stop();
          }
        } catch {
          // 忽略获取状态或停止时的错误
        }
        scannerRef.current = null;
      }

      const mobile = isMobileDevice();
      
      // 关键修复：桌面端默认禁用 BarcodeDetector（Chrome 桌面版对 CODE_128 识别不稳定）
      // 只有在明确开启兼容模式时才完全禁用，否则移动端可以使用原生 API
      const useBarcodeDetector = mobile && !compatMode;

      // 创建扫描器实例，限制支持的格式以提升速度
      scannerRef.current = new Html5Qrcode(scannerContainerId, {
        verbose: false,
        formatsToSupport: supportedFormats,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: useBarcodeDetector,
        },
      });

      // 获取当前设备适配的扫描框配置
      const qrboxConfig = getQrboxConfig();
      const w = typeof window !== "undefined" ? window.innerWidth : 1024;
      const desktop = w >= 1024;

      // 桌面端：使用更高分辨率和更慢但更稳定的帧率
      // 移动端：保持原有配置
      const fps = mobile ? 25 : 15;

      // 统一使用 deviceId 约束
      const cameraConfig: MediaTrackConstraints = {
        deviceId: { exact: cameraId },
        ...(desktop
          ? {
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            }
          : {}),
      };

      console.log("Starting scanner with config:", {
        scanType,
        mobile,
        desktop,
        qrboxConfig,
        compatMode,
        useBarcodeDetector,
        fps,
      });

      setLastScanError(null);

      await scannerRef.current.start(
        cameraConfig,
        {
          fps,
          qrbox: qrboxConfig,
          aspectRatio: qrboxConfig.width / qrboxConfig.height,
          disableFlip: true,
        },
        (decodedText) => {
          const normalized = normalizeCode(decodedText);

          // LPN扫描时验证格式（先清洗，避免因空格/换行导致误判）
          if (scanType === "lpn" && !isValidLpn(decodedText)) {
            console.log("Invalid LPN format:", { raw: decodedText, normalized });
            return; // 忽略非LPN格式的扫描结果
          }

          // 扫描成功振动反馈
          if ("vibrate" in navigator) {
            try {
              navigator.vibrate([50, 50, 50]);
            } catch {}
          }
          console.log("Scan success:", { raw: decodedText, normalized });
          onScan(scanType === "lpn" ? normalized : decodedText.trim());
          handleClose();
        },
        (err) => {
          // 捕获少量错误用于诊断（避免刷屏）
          if (!lastScanError) {
            setLastScanError(typeof err === "string" ? err : "识别中...");
          }
        }
      );
    } catch (err) {
      console.error("启动扫描器失败:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`启动摄像头失败：${msg}`);
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        // 只有在扫描中或暂停状态才停止
        if (state === 2 || state === 3) { // 2 = SCANNING, 3 = PAUSED
          await scannerRef.current.stop();
        }
      } catch (err) {
        // 忽略停止时的错误
        console.log("Scanner stop skipped:", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanner();
    setIsOpen(false);
    setError(null);
  };

  const switchCamera = () => {
    if (cameras.length > 1) {
      const nextIndex = (currentCameraIndex + 1) % cameras.length;
      setCurrentCameraIndex(nextIndex);
      startScanner(cameras[nextIndex].id);
    }
  };

  // 判断是否是大按钮模式（无文字的扫描按钮）
  const isLargeIconMode = !buttonLabel && buttonSize === "lg";

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        size={buttonSize}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log("Scanner button clicked, scanType:", scanType);
          // 振动反馈
          if ('vibrate' in navigator) {
            try { navigator.vibrate(50); } catch {}
          }
          setIsOpen(true);
        }}
        onTouchEnd={(e) => {
          // 平板/触摸设备专用处理
          e.preventDefault();
          e.stopPropagation();
          console.log("Scanner button touched, scanType:", scanType);
          if ('vibrate' in navigator) {
            try { navigator.vibrate(50); } catch {}
          }
          setIsOpen(true);
        }}
        className={cn(
          buttonClassName,
          isLargeIconMode && "relative overflow-hidden touch-manipulation"
        )}
      >
        {isLargeIconMode ? (
          // 精美的扫描图标设计
          <div className="relative flex items-center justify-center">
            {/* 外层四角框 */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* 左上角 */}
              <div className="absolute top-3 left-3 w-5 h-5 border-l-3 border-t-3 border-white/80 rounded-tl-md" />
              {/* 右上角 */}
              <div className="absolute top-3 right-3 w-5 h-5 border-r-3 border-t-3 border-white/80 rounded-tr-md" />
              {/* 左下角 */}
              <div className="absolute bottom-3 left-3 w-5 h-5 border-l-3 border-b-3 border-white/80 rounded-bl-md" />
              {/* 右下角 */}
              <div className="absolute bottom-3 right-3 w-5 h-5 border-r-3 border-b-3 border-white/80 rounded-br-md" />
            </div>
            {/* 中心扫描线动画 */}
            <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-white/90 to-transparent animate-pulse" />
            {/* 中心图标 */}
            <Scan className="h-10 w-10 text-white drop-shadow-lg" strokeWidth={1.5} />
          </div>
        ) : (
          // 普通按钮模式
          <>
            <Scan className={buttonLabel ? "mr-2 h-4 w-4" : "h-6 w-6"} />
            {buttonLabel}
          </>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose} modal={true}>
        <DialogContent 
          className={cn(
            "max-w-[90vw] sm:max-w-md w-full mx-auto z-[110]",
            scanType === "lpn" && "border-t-4 border-t-info"
          )}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className={cn(
              "flex items-center gap-2",
              scanType === "lpn" ? "text-info" : "text-primary"
            )}>
              <Scan className="h-5 w-5" />
              {scanType === "lpn" ? "扫描LPN条码" : "扫描物流条码"}
            </DialogTitle>
          <DialogDescription>
              {scanType === "lpn" 
                ? "将LPN条形码/二维码对准取景框（例如：LPNHK347025163）" 
                : "请允许摄像头权限，并将条码或二维码对准取景框"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full bg-destructive/10 p-3 mb-4">
                  <X className="h-6 w-6 text-destructive" />
                </div>
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    if (cameras.length > 0) {
                      startScanner(cameras[currentCameraIndex].id);
                    }
                  }}
                >
                  重试
                </Button>
              </div>
            ) : (
              <>
                <div
                  id={scannerContainerId}
                  className="relative w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center"
                  style={{ minHeight: "250px", maxHeight: "60vh" }}
                />

                {isScanning && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {scanType === "lpn" ? "将LPN条码对准框内" : "将条码或二维码对准框内"}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const next = !compatMode;
                            setCompatMode(next);
                            if (cameras.length > 0) startScanner(cameras[currentCameraIndex].id);
                          }}
                        >
                          <Focus className="mr-2 h-4 w-4" />
                          {compatMode ? "兼容模式: 开" : "兼容模式"}
                        </Button>
                        {cameras.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={switchCamera}>
                            <SwitchCamera className="mr-2 h-4 w-4" />
                            切换摄像头
                          </Button>
                        )}
                      </div>
                    </div>

                    {lastScanError && (
                      <p className="text-xs text-muted-foreground">
                        识别提示：{lastScanError}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
