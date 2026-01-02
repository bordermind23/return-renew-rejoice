import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "scanner-container";

  useEffect(() => {
    // Get available cameras when dialog opens
    if (isOpen) {
      // 延迟启动以确保对话框完全渲染
      const timer = setTimeout(() => {
        Html5Qrcode.getCameras()
          .then((devices) => {
            if (devices && devices.length > 0) {
              setCameras(devices);
              // 优先选择后置摄像头
              const backCameraIndex = devices.findIndex(
                (device) => device.label.toLowerCase().includes("back") || 
                            device.label.toLowerCase().includes("rear") ||
                            device.label.toLowerCase().includes("environment") ||
                            device.label.includes("后置")
              );
              const preferredIndex = backCameraIndex >= 0 ? backCameraIndex : 0;
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
      // Stop existing scanner if any
      if (scannerRef.current) {
        await scannerRef.current.stop();
      }

      scannerRef.current = new Html5Qrcode(scannerContainerId, {
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      });

      await scannerRef.current.start(
        cameraId,
        {
          fps: 15,
          qrbox: { width: 200, height: 200 },
          aspectRatio: 1,
          disableFlip: false,
        },
        (decodedText) => {
          // Success callback
          onScan(decodedText);
          handleClose();
        },
        () => {
          // Error callback - ignore scan errors
        }
      );
    } catch (err) {
      console.error("启动扫描器失败:", err);
      setError("启动摄像头失败，请重试");
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error("停止扫描器失败:", err);
      }
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
              请允许摄像头权限，并将条码或二维码对准取景框。
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
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      将条码或二维码对准框内
                    </p>
                    {cameras.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={switchCamera}
                      >
                        <SwitchCamera className="mr-2 h-4 w-4" />
                        切换摄像头
                      </Button>
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