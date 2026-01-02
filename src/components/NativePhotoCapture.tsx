import { useState, useRef, useCallback } from "react";
import { Camera, Check, X, ChevronRight, Trash2, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

export interface PhotoStep {
  id: string;
  label: string;
  required?: boolean;
}

// 完整拍照步骤（产品破损/缺少配件时使用）
export const FULL_PHOTO_STEPS: PhotoStep[] = [
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

// 简单拍照步骤（正常情况只拍1张）
export const SIMPLE_PHOTO_STEPS: PhotoStep[] = [
  { id: "accessories_photo", label: "产品配件展示图", required: true },
];

// 默认使用简单模式
export const DEFAULT_PHOTO_STEPS: PhotoStep[] = SIMPLE_PHOTO_STEPS;

interface UploadTask {
  stepId: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  localUrl: string;
  remoteUrl?: string;
}

interface NativePhotoCaptureProps {
  lpn: string;
  onComplete: (photos: Record<string, string>) => void;
  onCancel: () => void;
  steps?: PhotoStep[];
}

// 图片压缩配置
const COMPRESSION_CONFIG = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  mimeType: 'image/jpeg',
};

// 图片压缩函数
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      let { width, height } = img;
      
      // 计算缩放比例
      if (width > COMPRESSION_CONFIG.maxWidth) {
        height = (height * COMPRESSION_CONFIG.maxWidth) / width;
        width = COMPRESSION_CONFIG.maxWidth;
      }
      if (height > COMPRESSION_CONFIG.maxHeight) {
        width = (width * COMPRESSION_CONFIG.maxHeight) / height;
        height = COMPRESSION_CONFIG.maxHeight;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // 绘制图片
      ctx?.drawImage(img, 0, 0, width, height);
      
      // 转换为 Blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log(`图片压缩: ${(file.size / 1024).toFixed(1)}KB -> ${(blob.size / 1024).toFixed(1)}KB`);
            resolve(blob);
          } else {
            reject(new Error('图片压缩失败'));
          }
        },
        COMPRESSION_CONFIG.mimeType,
        COMPRESSION_CONFIG.quality
      );
    };
    
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = URL.createObjectURL(file);
  });
}

export function NativePhotoCapture({
  lpn,
  onComplete,
  onCancel,
  steps = DEFAULT_PHOTO_STEPS,
}: NativePhotoCaptureProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<Record<string, string>>({});
  const [uploadTasks, setUploadTasks] = useState<Record<string, UploadTask>>({});
  const isMobile = useIsMobile();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadQueueRef = useRef<Map<string, AbortController>>(new Map());

  const currentStep = steps[currentStepIndex];
  const completedCount = Object.keys(capturedPhotos).length;
  const progress = (completedCount / steps.length) * 100;
  
  // 计算上传状态
  const uploadingCount = Object.values(uploadTasks).filter(t => t.status === 'uploading' || t.status === 'pending').length;
  const hasUploadingTasks = uploadingCount > 0;

  // 后台上传函数
  const uploadInBackground = useCallback(async (
    file: File, 
    stepId: string, 
    localUrl: string
  ) => {
    // 更新状态为上传中
    setUploadTasks(prev => ({
      ...prev,
      [stepId]: { stepId, status: 'uploading', localUrl }
    }));

    try {
      // 先压缩图片
      const compressedBlob = await compressImage(file);
      
      // 上传到存储
      const fileName = `${lpn}/${stepId}_${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from("product-images")
        .upload(fileName, compressedBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(data.path);

      const remoteUrl = urlData.publicUrl;

      // 更新为已上传的远程URL
      setCapturedPhotos(prev => ({ ...prev, [stepId]: remoteUrl }));
      setUploadTasks(prev => ({
        ...prev,
        [stepId]: { stepId, status: 'success', localUrl, remoteUrl }
      }));

    } catch (error) {
      console.error(`上传失败 [${stepId}]:`, error);
      setUploadTasks(prev => ({
        ...prev,
        [stepId]: { stepId, status: 'error', localUrl }
      }));
      toast.error(`${steps.find(s => s.id === stepId)?.label || '照片'} 上传失败`);
    }
  }, [lpn, steps]);

  // 触发原生相机
  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  // 处理文件选择 - 立即显示预览，后台上传
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentStep) return;

    // 创建本地预览URL
    const localUrl = URL.createObjectURL(file);
    
    // 立即更新UI显示本地预览
    setCapturedPhotos(prev => ({ ...prev, [currentStep.id]: localUrl }));
    
    // 启动后台上传
    uploadInBackground(file, currentStep.id, localUrl);

    // 立即进入下一步
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      toast.success(`${currentStep.label} 拍摄成功，正在后台上传...`);
    } else {
      toast.success("所有照片拍摄完成，正在后台上传...");
    }

    // 清空 input 以便可以重新选择
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
    // 取消正在进行的上传
    const controller = uploadQueueRef.current.get(stepId);
    if (controller) {
      controller.abort();
      uploadQueueRef.current.delete(stepId);
    }
    
    const newPhotos = { ...capturedPhotos };
    delete newPhotos[stepId];
    setCapturedPhotos(newPhotos);
    
    setUploadTasks(prev => {
      const updated = { ...prev };
      delete updated[stepId];
      return updated;
    });
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

    // 检查是否有上传失败的
    const failedUploads = Object.values(uploadTasks).filter(t => t.status === 'error');
    if (failedUploads.length > 0) {
      toast.error(`有 ${failedUploads.length} 张照片上传失败，请重新拍摄`);
      return;
    }

    // 检查是否还有正在上传的
    if (hasUploadingTasks) {
      toast.info("照片正在上传中，请稍候...");
      return;
    }
    
    onComplete(capturedPhotos);
  };

  // 跳转到指定步骤
  const goToStep = (index: number) => {
    setCurrentStepIndex(index);
  };

  // 获取步骤的上传状态
  const getStepUploadStatus = (stepId: string) => {
    return uploadTasks[stepId]?.status;
  };

  return (
    <div className={cn(
      "fixed inset-0 z-50 bg-black/60 flex items-center justify-center",
      isMobile && "bg-background"
    )}>
      <div className={cn(
        "flex flex-col bg-background",
        // 桌面端：居中弹窗样式
        !isMobile && "w-full max-w-lg max-h-[85vh] rounded-xl shadow-2xl border overflow-hidden",
        // 移动端：全屏样式
        isMobile && "h-full w-full"
      )}>
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
        <div className={cn(
          "bg-background border-b p-4 space-y-3",
          isMobile && "pt-[calc(env(safe-area-inset-top,12px)+12px)]"
        )}>
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
            <div className="flex items-center gap-2">
              {hasUploadingTasks && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>上传中 {uploadingCount}</span>
                </div>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* 步骤列表 */}
        <div className={cn(
          "flex-1 overflow-y-auto p-4",
          isMobile && "pb-[calc(env(safe-area-inset-bottom,12px)+100px)]"
        )}>
          <div className="space-y-2">
            {steps.map((step, index) => {
              const isCompleted = !!capturedPhotos[step.id];
              const isCurrent = index === currentStepIndex;
              const uploadStatus = getStepUploadStatus(step.id);
              
              return (
                <div
                  key={step.id}
                  onClick={() => goToStep(index)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                    isCurrent && "border-primary bg-primary/5",
                    isCompleted && !isCurrent && uploadStatus === 'success' && "border-green-500 bg-green-50 dark:bg-green-950/20",
                    isCompleted && !isCurrent && uploadStatus === 'uploading' && "border-blue-500 bg-blue-50 dark:bg-blue-950/20",
                    isCompleted && !isCurrent && uploadStatus === 'error' && "border-red-500 bg-red-50 dark:bg-red-950/20",
                    !isCurrent && !isCompleted && "border-muted hover:border-primary/50"
                  )}
                >
                  {/* 步骤序号或状态图标 */}
                  <div
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0",
                      isCompleted && uploadStatus === 'success'
                        ? "bg-green-500 text-white"
                        : isCompleted && uploadStatus === 'uploading'
                        ? "bg-blue-500 text-white"
                        : isCompleted && uploadStatus === 'error'
                        ? "bg-red-500 text-white"
                        : isCurrent
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted && uploadStatus === 'success' ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : isCompleted && uploadStatus === 'uploading' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isCompleted && uploadStatus === 'error' ? (
                      <X className="h-3.5 w-3.5" />
                    ) : (
                      index + 1
                    )}
                  </div>

                  {/* 步骤信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{step.label}</span>
                      {step.required && (
                        <span className="text-xs text-destructive">*必填</span>
                      )}
                    </div>
                    {isCompleted && (
                      <span className={cn(
                        "text-xs",
                        uploadStatus === 'success' && "text-green-600 dark:text-green-400",
                        uploadStatus === 'uploading' && "text-blue-600 dark:text-blue-400",
                        uploadStatus === 'error' && "text-red-600 dark:text-red-400"
                      )}>
                        {uploadStatus === 'success' && "已上传"}
                        {uploadStatus === 'uploading' && "上传中..."}
                        {uploadStatus === 'error' && "上传失败，请重新拍摄"}
                        {!uploadStatus && "处理中..."}
                      </span>
                    )}
                  </div>

                  {/* 缩略图或操作 */}
                  {isCompleted ? (
                    <div className="flex items-center gap-2">
                      <div className="relative w-10 h-10 rounded overflow-hidden border">
                        <img
                          src={capturedPhotos[step.id]}
                          alt={step.label}
                          className="w-full h-full object-cover"
                        />
                        {uploadStatus === 'uploading' && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <Upload className="h-3 w-3 text-white animate-pulse" />
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePhoto(step.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
        <div className={cn(
          "bg-background border-t p-4",
          isMobile && "fixed bottom-0 left-0 right-0 pb-[calc(env(safe-area-inset-bottom,12px)+12px)]"
        )}>
          <div className="flex gap-2">
            {!currentStep?.required && !capturedPhotos[currentStep?.id || ""] && (
              <Button variant="outline" onClick={skipStep} className="h-10 px-3 text-sm">
                跳过
              </Button>
            )}
            <Button
              className="flex-1 h-10 gradient-primary text-sm"
              onClick={triggerCamera}
            >
              {capturedPhotos[currentStep?.id || ""] ? (
                <>
                  <Camera className="mr-1.5 h-4 w-4" />
                  重新拍摄
                </>
              ) : (
                <>
                  <Camera className="mr-1.5 h-4 w-4" />
                  拍照
                </>
              )}
            </Button>
            {completedCount > 0 && (
              <Button 
                variant="secondary" 
                onClick={finishCapture} 
                className="h-10 px-3 text-sm"
                disabled={hasUploadingTasks}
              >
                {hasUploadingTasks ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    上传中
                  </>
                ) : (
                  `完成 (${completedCount})`
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
