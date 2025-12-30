import { useState, useRef } from "react";
import { Camera, Check, X, ChevronRight, Trash2 } from "lucide-react";
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

interface NativePhotoCaptureProps {
  lpn: string;
  onComplete: (photos: Record<string, string>) => void;
  onCancel: () => void;
  steps?: PhotoStep[];
}

export function NativePhotoCapture({
  lpn,
  onComplete,
  onCancel,
  steps = DEFAULT_PHOTO_STEPS,
}: NativePhotoCaptureProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentStep = steps[currentStepIndex];
  const progress = (Object.keys(capturedPhotos).length / steps.length) * 100;

  // 触发原生相机
  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  // 处理文件选择
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentStep) return;

    setIsUploading(true);
    try {
      const publicUrl = await uploadPhoto(file, currentStep.id);
      
      const newPhotos = { ...capturedPhotos, [currentStep.id]: publicUrl };
      setCapturedPhotos(newPhotos);

      // 自动进入下一步
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
        toast.success(`${currentStep.label} 上传成功，请继续拍摄下一张`);
      } else {
        toast.success("所有照片拍摄完成！");
        onComplete(newPhotos);
      }
    } catch (error) {
      console.error("上传失败:", error);
      toast.error("照片上传失败，请重试");
    } finally {
      setIsUploading(false);
      // 清空 input 以便可以重新选择同一张照片
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 上传照片到存储
  const uploadPhoto = async (file: File, stepId: string): Promise<string> => {
    const fileName = `${lpn}/${stepId}_${Date.now()}.jpg`;
    
    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(fileName, file, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  // 跳过当前步骤
  const skipStep = () => {
    if (currentStep?.required) {
      toast.error("此步骤为必填项，不能跳过");
      return;
    }
    
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      finishCapture();
    }
  };

  // 删除已拍照片
  const deletePhoto = (stepId: string) => {
    const newPhotos = { ...capturedPhotos };
    delete newPhotos[stepId];
    setCapturedPhotos(newPhotos);
  };

  // 完成拍摄
  const finishCapture = () => {
    const missingRequired = steps
      .filter(step => step.required && !capturedPhotos[step.id])
      .map(step => step.label);
    
    if (missingRequired.length > 0) {
      toast.error(`请先完成必填项：${missingRequired.join("、")}`);
      return;
    }
    
    onComplete(capturedPhotos);
  };

  // 跳转到指定步骤
  const goToStep = (index: number) => {
    setCurrentStepIndex(index);
  };

  return (
    <div className="flex flex-col h-full w-full bg-background fixed inset-0 z-50">
      {/* 隐藏的文件输入，使用原生相机 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 顶部进度和标题 */}
      <div className="bg-background border-b p-4 space-y-3 pt-[calc(env(safe-area-inset-top,12px)+12px)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-sm text-muted-foreground flex-shrink-0">
              {currentStepIndex + 1}/{steps.length}
            </span>
            <span className="font-medium truncate">{currentStep?.label}</span>
            {currentStep?.required && (
              <span className="text-xs text-destructive flex-shrink-0">*必填</span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* 步骤列表 */}
      <div className="flex-1 overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom,12px)+100px)]">
        <div className="space-y-2">
          {steps.map((step, index) => {
            const isCompleted = !!capturedPhotos[step.id];
            const isCurrent = index === currentStepIndex;
            
            return (
              <div
                key={step.id}
                onClick={() => goToStep(index)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                  isCurrent && "border-primary bg-primary/5",
                  isCompleted && !isCurrent && "border-green-500 bg-green-50 dark:bg-green-950/20",
                  !isCurrent && !isCompleted && "border-muted hover:border-primary/50"
                )}
              >
                {/* 步骤序号或完成图标 */}
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0",
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </div>

                {/* 步骤信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{step.label}</span>
                    {step.required && (
                      <span className="text-xs text-destructive">*必填</span>
                    )}
                  </div>
                  {isCompleted && (
                    <span className="text-xs text-green-600 dark:text-green-400">已上传</span>
                  )}
                </div>

                {/* 缩略图或操作 */}
                {isCompleted ? (
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 rounded overflow-hidden border">
                      <img
                        src={capturedPhotos[step.id]}
                        alt={step.label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePhoto(step.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部操作按钮 */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 pb-[calc(env(safe-area-inset-bottom,12px)+12px)]">
        <div className="flex gap-3">
          {!currentStep?.required && !capturedPhotos[currentStep?.id || ""] && (
            <Button variant="outline" onClick={skipStep} className="h-12 px-4">
              跳过
            </Button>
          )}
          <Button
            className="flex-1 h-12 gradient-primary"
            onClick={triggerCamera}
            disabled={isUploading}
          >
            {isUploading ? (
              <span>上传中...</span>
            ) : capturedPhotos[currentStep?.id || ""] ? (
              <>
                <Camera className="mr-2 h-5 w-5" />
                重新拍摄
              </>
            ) : (
              <>
                <Camera className="mr-2 h-5 w-5" />
                拍照
              </>
            )}
          </Button>
          {Object.keys(capturedPhotos).length > 0 && (
            <Button variant="secondary" onClick={finishCapture} className="h-12 px-4">
              完成 ({Object.keys(capturedPhotos).length})
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
