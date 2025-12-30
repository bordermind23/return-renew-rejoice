import { useState, useRef } from "react";
import { Camera, CheckCircle, Upload, X, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GradeBadge } from "@/components/ui/grade-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GradeEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lpn: string;
  currentGrade: string | null;
  onSave: (grade: string, reason: string, photos: string[]) => void;
  isLoading?: boolean;
}

export function GradeEditDialog({
  open,
  onOpenChange,
  lpn,
  currentGrade,
  onSave,
  isLoading = false,
}: GradeEditDialogProps) {
  const [selectedGrade, setSelectedGrade] = useState<string>(currentGrade || "");
  const [changeReason, setChangeReason] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newPhotos: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `${lpn}/grade_change_${Date.now()}_${i}.${fileExt}`;
        const filePath = `grade-changes/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, file);

        if (uploadError) {
          console.error("上传失败:", uploadError);
          toast.error(`上传照片失败: ${uploadError.message}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(filePath);

        newPhotos.push(urlData.publicUrl);
      }

      setPhotos((prev) => [...prev, ...newPhotos]);
      if (newPhotos.length > 0) {
        toast.success(`成功上传 ${newPhotos.length} 张照片`);
      }
    } catch (error) {
      console.error("上传出错:", error);
      toast.error("上传照片时出错");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!selectedGrade) {
      toast.error("请选择新的等级");
      return;
    }
    if (!changeReason.trim()) {
      toast.error("请填写更改原因");
      return;
    }
    onSave(selectedGrade, changeReason, photos);
  };

  const handleClose = () => {
    setSelectedGrade(currentGrade || "");
    setChangeReason("");
    setPhotos([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>更改产品等级</DialogTitle>
          <DialogDescription>
            LPN: {lpn}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* 当前等级显示 */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">当前等级:</span>
              {currentGrade ? (
                <GradeBadge grade={currentGrade as "A" | "B" | "C"} />
              ) : (
                <span className="text-sm text-muted-foreground">未评级</span>
              )}
            </div>

            {/* 新等级选择 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">选择新等级 *</Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { grade: "A", label: "轻微使用痕迹", color: "border-blue-500 bg-blue-500/10" },
                  { grade: "B", label: "明显使用痕迹", color: "border-yellow-500 bg-yellow-500/10" },
                  { grade: "C", label: "功能外观问题", color: "border-red-500 bg-red-500/10" },
                ].map(({ grade, label, color }) => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => setSelectedGrade(grade)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                      selectedGrade === grade
                        ? color
                        : "border-muted hover:border-muted-foreground/30"
                    )}
                  >
                    <GradeBadge grade={grade as "A" | "B" | "C"} />
                    <span className="mt-2 text-xs text-muted-foreground text-center">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 更改原因 */}
            <div className="space-y-2">
              <Label htmlFor="change_reason" className="text-sm font-medium">
                更改原因 *
              </Label>
              <Textarea
                id="change_reason"
                placeholder="请详细说明更改等级的原因..."
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            {/* 拍照上传 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                拍照佐证 ({photos.length} 张)
              </Label>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              
              <Button
                type="button"
                variant="outline"
                className="w-full h-16 border-2 border-dashed"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span>上传中...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Camera className="h-5 w-5 text-muted-foreground" />
                    <span className="text-muted-foreground">点击拍照或选择图片</span>
                  </div>
                )}
              </Button>

              {/* 已上传的照片预览 */}
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((url, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border group">
                      <img
                        src={url}
                        alt={`照片 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removePhoto(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || !selectedGrade || !changeReason.trim()}
            className="gradient-primary"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            确认更改
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
