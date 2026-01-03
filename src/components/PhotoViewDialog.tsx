import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn, Loader2, FileImage, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface PhotoItem {
  key: string;
  label: string;
  url: string;
}

interface PhotoWithSize extends PhotoItem {
  size?: number;
  loading?: boolean;
  error?: boolean; // 加载失败标记
}

interface PhotoViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  photos: PhotoItem[];
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// 获取图片文件大小
const fetchImageSize = async (url: string): Promise<{ size: number | null; error: boolean }> => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) {
      return { size: null, error: true };
    }
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      // 小于1KB的图片可能是无效的占位符
      return { size, error: size < 1024 };
    }
    // 如果HEAD请求没有返回content-length，尝试GET请求
    const getResponse = await fetch(url);
    if (!getResponse.ok) {
      return { size: null, error: true };
    }
    const blob = await getResponse.blob();
    // 小于1KB的图片可能是无效的占位符
    return { size: blob.size, error: blob.size < 1024 };
  } catch (error) {
    console.error('Failed to fetch image size:', error);
    return { size: null, error: true };
  }
};

export function PhotoViewDialog({
  open,
  onOpenChange,
  title,
  photos,
}: PhotoViewDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [photosWithSize, setPhotosWithSize] = useState<PhotoWithSize[]>([]);

  // 当照片列表变化时，获取文件大小
  useEffect(() => {
    if (!open || photos.length === 0) {
      setPhotosWithSize([]);
      return;
    }

    // 初始化带加载状态的照片列表
    setPhotosWithSize(photos.map(p => ({ ...p, loading: true })));

    // 异步获取每张照片的大小
    photos.forEach((photo, index) => {
      fetchImageSize(photo.url).then(result => {
        setPhotosWithSize(prev => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = { 
              ...updated[index], 
              size: result.size ?? undefined, 
              error: result.error,
              loading: false 
            };
          }
          return updated;
        });
      });
    });
  }, [open, photos]);

  const handlePrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedIndex !== null && selectedIndex < photos.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const handleClose = () => {
    setSelectedIndex(null);
    onOpenChange(false);
  };

  if (photos.length === 0) {
    return null;
  }

  return (
    <>
      {/* 缩略图网格弹窗 */}
      <Dialog open={open && selectedIndex === null} onOpenChange={handleClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileImage className="h-5 w-5 text-primary" />
              {title}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                共 {photos.length} 张照片
              </span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-1">
              {photosWithSize.map((photo, index) => (
                <div 
                  key={photo.key} 
                  className={cn(
                    "group relative rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow",
                    photo.error && "border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800"
                  )}
                >
                  {/* 图片区域 */}
                  <button
                    className="relative aspect-square w-full overflow-hidden bg-muted cursor-pointer"
                    onClick={() => !photo.error && setSelectedIndex(index)}
                  >
                    {photo.error ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-red-500 gap-2">
                        <AlertTriangle className="h-10 w-10" />
                        <span className="text-xs text-center px-2">图片无效或上传失败</span>
                      </div>
                    ) : (
                      <>
                        <img
                          src={photo.url}
                          alt={photo.label}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            // 图片加载失败时显示错误状态
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                        </div>
                      </>
                    )}
                  </button>
                  
                  {/* 信息区域 */}
                  <div className="p-3 space-y-1.5">
                    <p className="text-sm font-medium text-foreground truncate">
                      {photo.label}
                    </p>
                    <div className={cn(
                      "flex items-center gap-1.5 text-xs",
                      photo.error ? "text-red-500" : "text-muted-foreground"
                    )}>
                      {photo.loading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>加载中...</span>
                        </>
                      ) : photo.error ? (
                        <>
                          <AlertTriangle className="h-3 w-3" />
                          <span>上传失败</span>
                        </>
                      ) : photo.size ? (
                        <>
                          <FileImage className="h-3 w-3" />
                          <span className="font-mono">{formatFileSize(photo.size)}</span>
                        </>
                      ) : (
                        <span>大小未知</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* 全屏查看弹窗 */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden bg-black/95">
          <div className="relative w-full h-[90vh] flex items-center justify-center">
            {/* 关闭按钮 */}
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
              onClick={() => setSelectedIndex(null)}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* 图片标题和大小 */}
            <div className="absolute top-4 left-4 z-10">
              <p className="text-white font-medium">
                {selectedIndex !== null && photosWithSize[selectedIndex]?.label}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-white/60 text-sm">
                  {selectedIndex !== null && `${selectedIndex + 1} / ${photos.length}`}
                </span>
                {selectedIndex !== null && photosWithSize[selectedIndex]?.size && (
                  <span className="text-white/60 text-sm font-mono bg-white/10 px-2 py-0.5 rounded">
                    {formatFileSize(photosWithSize[selectedIndex].size!)}
                  </span>
                )}
              </div>
            </div>

            {/* 上一张按钮 */}
            {selectedIndex !== null && selectedIndex > 0 && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 text-white hover:bg-white/20"
                onClick={handlePrev}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
            )}

            {/* 图片 */}
            {selectedIndex !== null && photos[selectedIndex] && (
              <img
                src={photos[selectedIndex].url}
                alt={photos[selectedIndex].label}
                className="max-w-full max-h-full object-contain"
              />
            )}

            {/* 下一张按钮 */}
            {selectedIndex !== null && selectedIndex < photos.length - 1 && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 text-white hover:bg-white/20"
                onClick={handleNext}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            )}

            {/* 缩略图导航 */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/60 backdrop-blur-sm rounded-xl p-3 max-w-[90vw] overflow-x-auto">
              {photosWithSize.map((photo, index) => (
                <button
                  key={photo.key}
                  className={cn(
                    "relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all",
                    selectedIndex === index
                      ? "border-white ring-2 ring-white/30"
                      : "border-transparent opacity-60 hover:opacity-100"
                  )}
                  onClick={() => setSelectedIndex(index)}
                >
                  <img
                    src={photo.url}
                    alt={photo.label}
                    className="w-full h-full object-cover"
                  />
                  {/* 小尺寸标签 */}
                  {photo.size && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white text-center py-0.5 font-mono">
                      {formatFileSize(photo.size)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
