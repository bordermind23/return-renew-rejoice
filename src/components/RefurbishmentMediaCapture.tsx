import { useState, useRef } from "react";
import { Camera, Video, Check, X, Trash2, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

interface RefurbishmentMediaCaptureProps {
  lpn: string;
  grade: "B" | "C";
  onComplete: (photos: string[], videos: string[]) => void;
  onCancel: () => void;
  initialPhotos?: string[];
  initialVideos?: string[];
}

export function RefurbishmentMediaCapture({
  lpn,
  grade,
  onComplete,
  onCancel,
  initialPhotos = [],
  initialVideos = [],
}: RefurbishmentMediaCaptureProps) {
  const { t } = useLanguage();
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [videos, setVideos] = useState<string[]>(initialVideos);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"photo" | "video">("photo");
  const [previewMedia, setPreviewMedia] = useState<{ type: "photo" | "video"; url: string } | null>(null);
  
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const isPhotoRequired = grade === "B";
  const isVideoOrPhotoRequired = grade === "C";
  const hasRequiredMedia = grade === "B" 
    ? photos.length > 0 
    : (photos.length > 0 || videos.length > 0);

  // 上传文件到存储
  const uploadFile = async (file: File, type: "photo" | "video"): Promise<string> => {
    const fileExt = file.name.split('.').pop() || (type === "photo" ? "jpg" : "mp4");
    const fileName = `refurbishment/${lpn}/${type}_${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: true,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  // 处理照片拍摄
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newPhotos: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const url = await uploadFile(file, "photo");
        newPhotos.push(url);
      }
      setPhotos(prev => [...prev, ...newPhotos]);
      toast.success(`已上传 ${newPhotos.length} 张照片`);
    } catch (error) {
      console.error("上传失败:", error);
      toast.error("照片上传失败，请重试");
    } finally {
      setIsUploading(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    }
  };

  // 处理视频录制
  const handleVideoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newVideos: string[] = [];

    try {
      for (const file of Array.from(files)) {
        // 检查文件大小 (限制50MB)
        if (file.size > 50 * 1024 * 1024) {
          toast.error("视频文件过大，请限制在50MB以内");
          continue;
        }
        const url = await uploadFile(file, "video");
        newVideos.push(url);
      }
      setVideos(prev => [...prev, ...newVideos]);
      if (newVideos.length > 0) {
        toast.success(`已上传 ${newVideos.length} 个视频`);
      }
    } catch (error) {
      console.error("上传失败:", error);
      toast.error("视频上传失败，请重试");
    } finally {
      setIsUploading(false);
      if (videoInputRef.current) {
        videoInputRef.current.value = "";
      }
    }
  };

  // 删除照片
  const deletePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // 删除视频
  const deleteVideo = (index: number) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
  };

  // 完成拍摄
  const handleComplete = () => {
    if (!hasRequiredMedia) {
      if (grade === "B") {
        toast.error("B级产品需要拍摄刮痕/损坏照片");
      } else {
        toast.error("C级产品需要拍摄功能缺陷的照片或视频");
      }
      return;
    }
    onComplete(photos, videos);
  };

  const gradeInfo = grade === "B" 
    ? { color: "warning", label: "B级", desc: "刮痕/外观损坏" }
    : { color: "destructive", label: "C级", desc: "功能缺陷" };

  return (
    <div className="flex flex-col h-full w-full bg-background fixed inset-0 z-50">
      {/* 隐藏的文件输入 */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handlePhotoCapture}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={handleVideoCapture}
        className="hidden"
      />

      {/* 顶部标题栏 */}
      <div className="bg-background border-b p-4 pt-[calc(env(safe-area-inset-top,12px)+12px)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={cn(
              "px-2 py-1 rounded text-xs font-bold",
              grade === "B" ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive"
            )}>
              {gradeInfo.label}
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate">{lpn}</p>
              <p className="text-xs text-muted-foreground">{gradeInfo.desc}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 提示信息 */}
        <div className={cn(
          "mt-3 p-2 rounded-lg text-xs",
          grade === "B" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
        )}>
          {grade === "B" 
            ? t.refurbishment?.bGradeHint || "请拍摄刮痕或损坏的位置"
            : t.refurbishment?.cGradeHint || "请拍摄或录制功能缺陷的详情"
          }
        </div>

        {/* 标签切换 */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setActiveTab("photo")}
            className={cn(
              "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
              activeTab === "photo"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Camera className="h-4 w-4" />
            照片 ({photos.length})
            {isPhotoRequired && photos.length === 0 && (
              <span className="text-[10px] opacity-80">*必填</span>
            )}
          </button>
          {grade === "C" && (
            <button
              onClick={() => setActiveTab("video")}
              className={cn(
                "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                activeTab === "video"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Video className="h-4 w-4" />
              视频 ({videos.length})
            </button>
          )}
        </div>
      </div>

      {/* 媒体列表 */}
      <div className="flex-1 overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom,12px)+120px)]">
        {activeTab === "photo" ? (
          <div className="space-y-3">
            {photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Camera className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">暂无照片</p>
                <p className="text-xs mt-1">点击下方按钮开始拍照</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {photos.map((url, index) => (
                  <div 
                    key={index} 
                    className="relative aspect-square rounded-lg overflow-hidden border bg-muted"
                    onClick={() => setPreviewMedia({ type: "photo", url })}
                  >
                    <img 
                      src={url} 
                      alt={`Photo ${index + 1}`} 
                      className="w-full h-full object-cover" 
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePhoto(index);
                      }}
                      className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 flex items-center justify-center text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      #{index + 1}
                    </div>
                  </div>
                ))}
                {/* 添加更多照片按钮 */}
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isUploading}
                  className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="h-8 w-8 mb-1" />
                  <span className="text-xs">添加更多</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Video className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">暂无视频</p>
                <p className="text-xs mt-1">点击下方按钮开始录制</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {videos.map((url, index) => (
                  <div 
                    key={index} 
                    className="relative aspect-video rounded-lg overflow-hidden border bg-muted"
                    onClick={() => setPreviewMedia({ type: "video", url })}
                  >
                    <video 
                      src={url} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="h-6 w-6 text-primary ml-1" />
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteVideo(index);
                      }}
                      className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 flex items-center justify-center text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      #{index + 1}
                    </div>
                  </div>
                ))}
                {/* 添加更多视频按钮 */}
                <button
                  onClick={() => videoInputRef.current?.click()}
                  disabled={isUploading}
                  className="aspect-video rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="h-8 w-8 mb-1" />
                  <span className="text-xs">添加更多</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部操作按钮 */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 pb-[calc(env(safe-area-inset-bottom,12px)+12px)]">
        <div className="flex gap-3">
          <Button
            className="flex-1 h-14"
            variant="outline"
            onClick={() => {
              if (activeTab === "photo") {
                photoInputRef.current?.click();
              } else {
                videoInputRef.current?.click();
              }
            }}
            disabled={isUploading}
          >
            {isUploading ? (
              <span className="animate-pulse">上传中...</span>
            ) : activeTab === "photo" ? (
              <>
                <Camera className="mr-2 h-5 w-5" />
                拍照
              </>
            ) : (
              <>
                <Video className="mr-2 h-5 w-5" />
                录视频
              </>
            )}
          </Button>
          <Button
            className={cn(
              "flex-1 h-14",
              hasRequiredMedia ? "gradient-primary" : ""
            )}
            onClick={handleComplete}
            disabled={!hasRequiredMedia || isUploading}
          >
            <Check className="mr-2 h-5 w-5" />
            完成 ({photos.length + videos.length})
          </Button>
        </div>
      </div>

      {/* 媒体预览弹窗 */}
      {previewMedia && (
        <div 
          className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
          onClick={() => setPreviewMedia(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white h-10 w-10 z-10"
            onClick={() => setPreviewMedia(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          {previewMedia.type === "photo" ? (
            <img 
              src={previewMedia.url} 
              alt="Preview" 
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <video 
              src={previewMedia.url} 
              controls 
              autoPlay
              className="max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}
