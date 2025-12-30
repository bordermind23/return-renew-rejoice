import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, X, SwitchCamera } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ScannerProps {
  onScan: (code: string) => void;
  buttonLabel?: string;
  buttonVariant?: "default" | "outline" | "ghost" | "secondary";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  buttonClassName?: string;
}

export function Scanner({
  onScan,
  buttonLabel = "摄像头扫码",
  buttonVariant = "secondary",
  buttonSize = "default",
  buttonClassName = "",
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

      scannerRef.current = new Html5Qrcode(scannerContainerId);

      await scannerRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
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
        className={buttonClassName}
      >
        <Camera className={buttonLabel ? "mr-2 h-4 w-4" : "h-6 w-6"} />
        {buttonLabel}
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md z-[110]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              扫描条码/二维码
            </DialogTitle>
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
                  className="relative w-full overflow-hidden rounded-lg bg-muted"
                  style={{ minHeight: "300px" }}
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