import { useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
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

interface PhotoViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  photos: PhotoItem[];
}

export function PhotoViewDialog({
  open,
  onOpenChange,
  title,
  photos,
}: PhotoViewDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-1">
              {photos.map((photo, index) => (
                <div key={photo.key} className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {photo.label}
                  </p>
                  <button
                    className="relative aspect-square w-full rounded-lg border overflow-hidden bg-muted group cursor-pointer"
                    onClick={() => setSelectedIndex(index)}
                  >
                    <img
                      src={photo.url}
                      alt={photo.label}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
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

            {/* 图片标题 */}
            <div className="absolute top-4 left-4 z-10">
              <p className="text-white font-medium">
                {selectedIndex !== null && photos[selectedIndex]?.label}
              </p>
              <p className="text-white/60 text-sm">
                {selectedIndex !== null && `${selectedIndex + 1} / ${photos.length}`}
              </p>
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
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 rounded-lg p-2">
              {photos.map((photo, index) => (
                <button
                  key={photo.key}
                  className={cn(
                    "w-12 h-12 rounded overflow-hidden border-2 transition-all",
                    selectedIndex === index
                      ? "border-white"
                      : "border-transparent opacity-50 hover:opacity-100"
                  )}
                  onClick={() => setSelectedIndex(index)}
                >
                  <img
                    src={photo.url}
                    alt={photo.label}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
