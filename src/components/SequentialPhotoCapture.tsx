import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Check, RotateCcw, X, ChevronRight, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PhotoStep {
  id: string;
  label: string;
  required?: boolean;
}

export const DEFAULT_PHOTO_STEPS: PhotoStep[] = [
  { id: "lpn_label_photo", label: "LPN标签", required: true },
  { id: "packaging_photo_1", label: "产品包装图1", required: true },
  { id: "packaging_photo_2", label: "产品包装图2" },
  { id: "packaging_photo_3", label: "产品包装图3" },
  { id: "packaging_photo_4", label: "产品包装图4" },
  { id: "packaging_photo_5", label: "产品包装图5" },
  { id: "packaging_photo_6", label: "产品包装图6" },
  { id: "accessories_photo", label: "产品配件展示图" },
  { id: "detail_photo", label: "产品细节图" },
];

interface SequentialPhotoCaptureProps {
  lpn: string;
  onComplete: (photos: Record<string, string>) => void;
  onCancel: () => void;
  steps?: PhotoStep[];
}

export function SequentialPhotoCapture({
  lpn,
  onComplete,
  onCancel,
  steps = DEFAULT_PHOTO_STEPS,
}: SequentialPhotoCaptureProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const currentStep = steps[currentStepIndex];
  const progress = (Object.keys(capturedPhotos).length / steps.length) * 100;

  // 初始化摄像头
  const initCamera = useCallback(async () => {
    try {
      // 先停止现有流
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
        };
      }
    } catch (error) {
      console.error("无法访问摄像头:", error);
      toast.error("无法访问摄像头，请检查权限设置");
    }
  }, []);

  // 停止摄像头
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    initCamera();
    return () => stopCamera();
  }, [initCamera, stopCamera]);

  // 拍照
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setPreviewUrl(dataUrl);
  };

  // 上传照片到存储
  const uploadPhoto = async (dataUrl: string, stepId: string): Promise<string> => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    
    const fileName = `${lpn}/${stepId}_${Date.now()}.jpg`;
    
    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(fileName, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  // 确认并上传当前照片
  const confirmAndUpload = async () => {
    if (!previewUrl || !currentStep) return;

    setIsUploading(true);
    try {
      const publicUrl = await uploadPhoto(previewUrl, currentStep.id);
      
      const newPhotos = { ...capturedPhotos, [currentStep.id]: publicUrl };
      setCapturedPhotos(newPhotos);
      setPreviewUrl(null);

      // 自动进入下一步
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
        toast.success(`${currentStep.label} 上传成功，请继续拍摄下一张`);
      } else {
        // 全部完成
        toast.success("所有照片拍摄完成！");
        onComplete(newPhotos);
      }
    } catch (error) {
      console.error("上传失败:", error);
      toast.error("照片上传失败，请重试");
    } finally {
      setIsUploading(false);
    }
  };

  // 重拍当前照片
  const retakePhoto = () => {
    setPreviewUrl(null);
  };

  // 跳过当前步骤（仅非必填）
  const skipStep = () => {
    if (currentStep?.required) {
      toast.error("此步骤为必填项，不能跳过");
      return;
    }
    
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onComplete(capturedPhotos);
    }
  };

  // 完成拍摄（允许部分完成）
  const finishCapture = () => {
    // 检查必填项
    const missingRequired = steps
      .filter(step => step.required && !capturedPhotos[step.id])
      .map(step => step.label);
    
    if (missingRequired.length > 0) {
      toast.error(`请先完成必填项：${missingRequired.join("、")}`);
      return;
    }
    
    onComplete(capturedPhotos);
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {/* 顶部进度和标题 */}
      <div className="bg-background/95 backdrop-blur p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {currentStepIndex + 1} / {steps.length}
            </span>
            <span className="font-medium">{currentStep?.label}</span>
            {currentStep?.required && (
              <span className="text-xs text-destructive">*必填</span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Progress value={progress} className="h-2" />
        
        {/* 步骤指示器 */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs",
                index === currentStepIndex
                  ? "bg-primary text-primary-foreground"
                  : capturedPhotos[step.id]
                  ? "bg-green-500 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {capturedPhotos[step.id] ? (
                <Check className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 摄像头/预览区域 */}
      <div className="flex-1 relative">
        {previewUrl ? (
          // 预览已拍照片
          <img
            src={previewUrl}
            alt="预览"
            className="w-full h-full object-contain"
          />
        ) : (
          // 实时摄像头画面
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
        
        {/* 拍摄引导框 */}
        {!previewUrl && cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="border-2 border-white/50 rounded-lg w-[80%] h-[60%] flex items-center justify-center">
              <span className="text-white/70 text-sm bg-black/50 px-3 py-1 rounded">
                {currentStep?.label}
              </span>
            </div>
          </div>
        )}

        {/* 隐藏的 canvas 用于捕获 */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* 底部操作按钮 */}
      <div className="bg-background/95 backdrop-blur p-4">
        {previewUrl ? (
          // 预览状态：确认/重拍
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={retakePhoto}
              disabled={isUploading}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              重拍
            </Button>
            <Button
              className="flex-1 gradient-primary"
              onClick={confirmAndUpload}
              disabled={isUploading}
            >
              {isUploading ? (
                "上传中..."
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  确认上传
                </>
              )}
            </Button>
          </div>
        ) : (
          // 拍摄状态
          <div className="flex gap-3">
            {!currentStep?.required && (
              <Button variant="outline" onClick={skipStep}>
                跳过
              </Button>
            )}
            <Button
              className="flex-1 gradient-primary"
              onClick={capturePhoto}
              disabled={!cameraReady}
            >
              <Camera className="mr-2 h-4 w-4" />
              拍照
            </Button>
            {Object.keys(capturedPhotos).length > 0 && (
              <Button variant="secondary" onClick={finishCapture}>
                完成 ({Object.keys(capturedPhotos).length})
              </Button>
            )}
          </div>
        )}

        {/* 已拍摄的缩略图 */}
        {Object.keys(capturedPhotos).length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {steps.map((step) => (
              capturedPhotos[step.id] && (
                <div
                  key={step.id}
                  className="flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 border-green-500"
                >
                  <img
                    src={capturedPhotos[step.id]}
                    alt={step.label}
                    className="w-full h-full object-cover"
                  />
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
