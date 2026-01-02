import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Scan, SwitchCamera, X, Focus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

// LPN 常见是条形码（CODE128/CODE39）或二维码
const lpnFormats = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
];

const trackingFormats = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

const normalizeCode = (code: string) =>
  code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

const isValidLpn = (code: string): boolean => {
  const normalized = normalizeCode(code);
  return /^LPN[A-Z0-9]+$/.test(normalized);
};

const isMobileLike = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

const isTablet = (): boolean => {
  return typeof window !== "undefined" && window.innerWidth >= 768;
};

const SCANNING_STATE = 2;
const PAUSED_STATE = 3;

async function safeStopScanner(scanner: Html5Qrcode | null) {
  if (!scanner) return;
  try {
    const state = scanner.getState?.();
    if (state === SCANNING_STATE || state === PAUSED_STATE) {
      await scanner.stop();
    }
  } catch {
    // ignore
  }
}

/**
 * iPad/Safari 常见问题：
 * - 未授权前 enumerateDevices label 为空，无法靠 label 选后置
 * - facingMode: "environment" 有时会被忽略而打开前置
 *
 * 这里策略：
 * 1) 先用 getUserMedia 强行申请后置（exact），拿到真实 track settings.deviceId
 * 2) 立刻关闭这条 stream
 * 3) 再用 html5-qrcode 用 deviceId 精确启动
 */
async function resolveBackCameraDeviceId(): Promise<string | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;

  const tryConstraints: MediaStreamConstraints[] = [
    { video: { facingMode: { exact: "environment" } }, audio: false },
    { video: { facingMode: "environment" }, audio: false },
  ];

  for (const constraints of tryConstraints) {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks?.()[0];
      const settings = track?.getSettings?.();
      const deviceId = settings?.deviceId;
      // cleanup ASAP
      stream.getTracks().forEach((t) => t.stop());
      stream = null;

      if (deviceId) return deviceId;
    } catch {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    }
  }

  return null;
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
  const [lastScanHint, setLastScanHint] = useState<string | null>(null);
  const [compatMode, setCompatMode] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "scanner-container";

  const supportedFormats = useMemo(
    () => (scanType === "lpn" ? lpnFormats : trackingFormats),
    [scanType]
  );

  const getQrboxConfig = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1024;
    const tablet = isTablet();
    const desktop = w >= 1024;

    if (scanType === "lpn") {
      if (desktop) return { width: 640, height: 260 };
      return tablet ? { width: 420, height: 200 } : { width: 320, height: 160 };
    }

    if (desktop) return { width: 560, height: 280 };
    return tablet ? { width: 380, height: 220 } : { width: 280, height: 180 };
  };

  const start = async () => {
    setError(null);
    setIsScanning(true);
    setLastScanHint(null);

    const mobile = isMobileLike();
    const w = typeof window !== "undefined" ? window.innerWidth : 1024;
    const desktop = w >= 1024;

    try {
      // clean previous
      if (scannerRef.current) {
        await safeStopScanner(scannerRef.current);
        scannerRef.current = null;
      }

      // iPad/iPhone：强制拿到后置 deviceId
      let forcedDeviceId: string | null = null;
      if (mobile) {
        forcedDeviceId = await resolveBackCameraDeviceId();
      }

      scannerRef.current = new Html5Qrcode(scannerContainerId, {
        verbose: false,
        formatsToSupport: supportedFormats,
        experimentalFeatures: {
          // 桌面端禁用（不稳定），移动端可用；兼容模式=全禁
          useBarCodeDetectorIfSupported: mobile && !compatMode,
        },
      });

      const qrboxConfig = getQrboxConfig();
      const fps = mobile ? 25 : 15;

      // html5-qrcode 要求 cameraConfig 对象只能 1 个 key
      const cameraConfig: MediaTrackConstraints = forcedDeviceId
        ? { deviceId: { exact: forcedDeviceId } }
        : { facingMode: "environment" };

      const videoConstraints: MediaTrackConstraints | undefined = desktop
        ? { width: { ideal: 1920 }, height: { ideal: 1080 } }
        : undefined;

      await scannerRef.current.start(
        cameraConfig,
        {
          fps,
          qrbox: qrboxConfig,
          aspectRatio: qrboxConfig.width / qrboxConfig.height,
          disableFlip: true,
          videoConstraints,
        },
        (decodedText) => {
          const normalized = normalizeCode(decodedText);

          if (scanType === "lpn" && !isValidLpn(decodedText)) return;

          if ("vibrate" in navigator) {
            try {
              navigator.vibrate([50, 50, 50]);
            } catch {
              // ignore
            }
          }

          onScan(scanType === "lpn" ? normalized : decodedText.trim());
          void handleClose();
        },
        (err) => {
          if (!lastScanHint) {
            setLastScanHint(typeof err === "string" ? err : "识别中...");
          }
        }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`启动摄像头失败：${msg}`);
      setIsScanning(false);
    }
  };

  const stop = async () => {
    if (scannerRef.current) {
      await safeStopScanner(scannerRef.current);
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleClose = async () => {
    await stop();
    setIsOpen(false);
    setError(null);
  };

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => {
      void start();
    }, 50);

    return () => {
      window.clearTimeout(t);
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, scanType, compatMode]);

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
          setIsOpen(true);
        }}
        className={cn(
          buttonClassName,
          isLargeIconMode && "relative overflow-hidden touch-manipulation"
        )}
      >
        {isLargeIconMode ? (
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute top-3 left-3 w-5 h-5 border-l-3 border-t-3 border-white/80 rounded-tl-md" />
              <div className="absolute top-3 right-3 w-5 h-5 border-r-3 border-t-3 border-white/80 rounded-tr-md" />
              <div className="absolute bottom-3 left-3 w-5 h-5 border-l-3 border-b-3 border-white/80 rounded-bl-md" />
              <div className="absolute bottom-3 right-3 w-5 h-5 border-r-3 border-b-3 border-white/80 rounded-br-md" />
            </div>
            <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-white/90 to-transparent animate-pulse" />
            <Scan className="h-10 w-10 text-white drop-shadow-lg" strokeWidth={1.5} />
          </div>
        ) : (
          <>
            <Scan className={buttonLabel ? "mr-2 h-4 w-4" : "h-6 w-6"} />
            {buttonLabel}
          </>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={() => void handleClose()} modal>
        <DialogContent
          className={cn(
            "max-w-[90vw] sm:max-w-md w-full mx-auto z-[110]",
            scanType === "lpn" && "border-t-4 border-t-info"
          )}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle
              className={cn(
                "flex items-center gap-2",
                scanType === "lpn" ? "text-info" : "text-primary"
              )}
            >
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
                <Button variant="outline" className="mt-4" onClick={() => void start()}>
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
                          onClick={() => setCompatMode((v) => !v)}
                        >
                          <Focus className="mr-2 h-4 w-4" />
                          {compatMode ? "兼容模式: 开" : "兼容模式"}
                        </Button>
                      </div>
                    </div>

                    {lastScanHint && (
                      <p className="text-xs text-muted-foreground">识别提示：{lastScanHint}</p>
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
