import { useState, useEffect, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { X, SwitchCamera, Scan, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCameraPermission } from "@/hooks/useCameraPermission";

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
  // 使用 useRef 生成唯一ID，避免多个 Scanner 实例冲突
  const containerIdRef = useRef(`scanner-container-${Math.random().toString(36).substring(2, 9)}`);
  const scannerContainerId = containerIdRef.current;
  
  const { permissionState, isGranted, isDenied, requestPermission } = useCameraPermission();

  useEffect(() => {
    // Get available cameras when dialog opens
    if (isOpen) {
      const initializeScanner = async () => {
        // If permission is already granted, start immediately
        // If permission needs to be requested, do so
        if (isDenied) {
          setError("摄像头权限被拒绝，请在浏览器设置中允许访问摄像头后刷新页面");
          return;
        }

        // If permission state is unknown or prompt, try to request
        if (!isGranted) {
          const granted = await requestPermission();
          if (!granted) {
            setError("摄像头权限被拒绝，请在浏览器设置中允许访问摄像头");
            return;
          }
        }

        // Now we have permission, get cameras
        try {
          const devices = await Html5Qrcode.getCameras();
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
        } catch (err) {
          console.error("获取摄像头失败:", err);
          setError("无法访问摄像头，请确保已授权摄像头权限");
        }
      };

      // Small delay to ensure dialog is fully rendered
      const timer = setTimeout(initializeScanner, 100);
      return () => clearTimeout(timer);
    }

    return () => {
      stopScanner();
    };
  }, [isOpen, isGranted, isDenied, requestPermission]);

  const startScanner = async (cameraId: string) => {
    setError(null);
    setIsScanning(true);

    try {
      // Stop existing scanner if any
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch (e) {
          console.log("Scanner already stopped");
        }
        scannerRef.current = null;
      }

      // Wait for container to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      const container = document.getElementById(scannerContainerId);
      if (!container) {
        setError("扫描容器未就绪，请重试");
        setIsScanning(false);
        return;
      }

      // 条形码格式列表 - LPN通常使用这些格式
      const barcodeFormats = [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.QR_CODE, // 也支持QR以备不时之需
      ];

      scannerRef.current = new Html5Qrcode(scannerContainerId, {
        verbose: false,
        formatsToSupport: barcodeFormats,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      });

      // 不限制扫描区域 - 整个画面都能识别条形码
      await scannerRef.current.start(
        cameraId,
        {
          fps: 30, // 高帧率快速抓取
          disableFlip: false,
          videoConstraints: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } as MediaTrackConstraints
        },
        (decodedText) => {
          console.log("Scanned barcode:", decodedText);
          onScan(decodedText);
          handleClose();
        },
        () => {}
      );
    } catch (err) {
      console.error("启动扫描器失败:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes("Permission") || errorMsg.includes("NotAllowed")) {
        setError("摄像头权限被拒绝，请在设置中允许访问摄像头");
      } else if (errorMsg.includes("NotFound") || errorMsg.includes("NotReadable")) {
        setError("无法访问摄像头，请检查设备是否有可用摄像头");
      } else {
        setError("启动摄像头失败，请刷新页面重试");
      }
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
          console.log("Scanner button clicked, opening dialog");
          setIsOpen(true);
        }}
        className={cn(
          buttonClassName,
          isLargeIconMode && "relative overflow-hidden"
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

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className={cn(
          "max-w-[95vw] w-full mx-auto z-[110]",
          scanType === "lpn" ? "sm:max-w-2xl border-t-4 border-t-info" : "sm:max-w-md"
        )}>
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
                ? "请将条形码横向对准扫描区域" 
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
                {/* 
                  Scanner容器 - html5-qrcode会在这里注入video元素
                  添加CSS隐藏html5-qrcode自带的多余UI元素
                */}
                <div
                  id={scannerContainerId}
                  className={cn(
                    "relative w-full overflow-hidden rounded-lg bg-muted",
                    scanType === "lpn" 
                      ? "aspect-[16/9]" // 横向比例适合条形码
                      : "aspect-square sm:aspect-[4/3]",
                    // 隐藏html5-qrcode自带的多余扫描框
                    "[&>div]:!border-none [&_img]:hidden"
                  )}
                  style={{ maxHeight: "60vh" }}
                />

                {isScanning && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {scanType === "lpn" ? "将条形码横向对准框内" : "将条码或二维码对准框内"}
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