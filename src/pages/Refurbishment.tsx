import { useState, useRef, useEffect } from "react";
import { ScanLine, Camera, Video, CheckCircle, AlertCircle, Wrench, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { GradeBadge } from "@/components/ui/grade-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useInboundItems,
  useUpdateInboundItem,
  useCreateInboundItem,
  type InboundItem,
} from "@/hooks/useInboundItems";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Scanner } from "@/components/Scanner";
import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/useSound";
import { useLanguage } from "@/i18n/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { RefurbishmentMediaCapture } from "@/components/RefurbishmentMediaCapture";
import { useCameraPermission } from "@/hooks/useCameraPermission";

export default function Refurbishment() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [lpnInput, setLpnInput] = useState("");
  const [matchedItem, setMatchedItem] = useState<InboundItem | null>(null);
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [capturedVideos, setCapturedVideos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showMediaCapture, setShowMediaCapture] = useState(false);
  const [isNewLpn, setIsNewLpn] = useState(false);
  const [newLpnInput, setNewLpnInput] = useState("");
  
  const lpnInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const { data: inboundItems, isLoading } = useInboundItems();
  const updateMutation = useUpdateInboundItem();
  const createMutation = useCreateInboundItem();
  const { playSuccess, playError, playWarning } = useSound();
  
  // Pre-check camera permission on page load
  const { preRequestIfNeeded } = useCameraPermission();

  useEffect(() => {
    lpnInputRef.current?.focus();
    // Pre-check camera permission when page loads
    preRequestIfNeeded();
  }, [preRequestIfNeeded]);

  const handleScanLpn = (lpnValue?: string) => {
    const lpn = (lpnValue || lpnInput).trim();

    if (!lpn) {
      playError();
      toast.error("请输入LPN号");
      return;
    }

    const item = inboundItems?.find(i => i.lpn.toLowerCase() === lpn.toLowerCase());
    
    if (!item) {
      // 无入库记录，允许按无入库信息操作翻新流程
      playWarning();
      toast.warning("该LPN无入库记录，将按无入库信息操作翻新流程");
      setIsNewLpn(true);
      setNewLpnInput(lpn);
      setMatchedItem(null);
      setIsProcessDialogOpen(true);
      setLpnInput("");
      return;
    }

    if (item.refurbishment_grade) {
      playWarning();
      toast.warning("该LPN已完成翻新处理");
    }

    setIsNewLpn(false);
    setNewLpnInput("");
    setMatchedItem(item);
    setIsProcessDialogOpen(true);
    setLpnInput("");
    playSuccess();
  };

  const handleCameraScan = (code: string) => {
    handleScanLpn(code);
  };

  const uploadFile = async (file: File, type: 'photo' | 'video'): Promise<string | null> => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const fileExt = file.name.split('.').pop();
      const lpnForFile = matchedItem?.lpn || newLpnInput || 'unknown';
      const fileName = `${lpnForFile}-${type}-${Date.now()}.${fileExt}`;
      const filePath = `refurbishment/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Upload failed:', error);
      return null;
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newPhotos: string[] = [];

    for (const file of Array.from(files)) {
      const url = await uploadFile(file, 'photo');
      if (url) {
        newPhotos.push(url);
      }
    }

    setCapturedPhotos(prev => [...prev, ...newPhotos]);
    setIsUploading(false);
    toast.success(`已上传 ${newPhotos.length} 张照片`);
  };

  const handleVideoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newVideos: string[] = [];

    for (const file of Array.from(files)) {
      const url = await uploadFile(file, 'video');
      if (url) {
        newVideos.push(url);
      }
    }

    setCapturedVideos(prev => [...prev, ...newVideos]);
    setIsUploading(false);
    toast.success(`已上传 ${newVideos.length} 个视频`);
  };

  // 处理移动端媒体拍摄完成
  const handleMediaCaptureComplete = (photos: string[], videos: string[]) => {
    setCapturedPhotos(photos);
    setCapturedVideos(videos);
    setShowMediaCapture(false);
  };

  // 打开移动端拍摄界面
  const openMobileCapture = () => {
    if (!selectedGrade || (selectedGrade !== "B" && selectedGrade !== "C")) {
      toast.error("请先选择B级或C级");
      return;
    }
    setShowMediaCapture(true);
  };

  const handleProcessComplete = async () => {
    if (!selectedGrade) {
      toast.error("请选择产品等级");
      return;
    }

    // 检查是否是新LPN（无入库记录）
    if (isNewLpn && newLpnInput) {
      // B级需要拍照，C级需要拍照或视频
      if (selectedGrade === "B" && capturedPhotos.length === 0) {
        toast.error("B级产品需要拍摄刮痕/损坏照片");
        return;
      }

      if (selectedGrade === "C" && capturedPhotos.length === 0 && capturedVideos.length === 0) {
        toast.error("C级产品需要拍摄功能缺陷的照片或视频");
        return;
      }

      // 创建新的入库记录（无入库信息的翻新）
      const { supabase } = await import("@/integrations/supabase/client");
      
      createMutation.mutate(
        {
          lpn: newLpnInput,
          removal_order_id: "无入库信息",
          product_sku: "待同步",
          product_name: "待同步",
          return_reason: null,
          grade: selectedGrade as "A" | "B" | "C" | "new",
          processed_at: new Date().toISOString(),
          processed_by: user?.email || "未知用户",
          tracking_number: null,
          shipment_id: null,
          missing_parts: null,
          refurbishment_grade: selectedGrade,
          refurbishment_photos: capturedPhotos.length > 0 ? capturedPhotos : null,
          refurbishment_videos: capturedVideos.length > 0 ? capturedVideos : null,
          refurbishment_notes: notes ? `[无入库信息翻新] ${notes}` : "[无入库信息翻新]",
          refurbished_at: new Date().toISOString(),
          refurbished_by: user?.email || "未知用户",
        },
        {
          onSuccess: async () => {
            // 检查订单表是否已存在该LPN
            try {
              const { data: existingOrder } = await supabase
                .from("orders")
                .select("id, status")
                .ilike("lpn", newLpnInput)
                .maybeSingle();

              if (existingOrder) {
                // 已存在订单，更新状态为"到货"并关联等级
                await supabase
                  .from("orders")
                  .update({
                    status: "到货" as const,
                    grade: selectedGrade,
                    inbound_at: new Date().toISOString(),
                  })
                  .eq("id", existingOrder.id);
              } else {
                // 不存在订单，创建新记录
                await supabase.from("orders").insert({
                  lpn: newLpnInput,
                  removal_order_id: "无入库信息",
                  order_number: "待同步",
                  store_name: "待同步",
                  station: "待同步",
                  status: "待同步" as const,
                  grade: selectedGrade,
                });
              }
            } catch (error) {
              console.error("处理订单记录失败:", error);
            }
            
            playSuccess();
            toast.success("翻新处理完成（无入库信息）");
            resetForm();
            setIsProcessDialogOpen(false);
            setTimeout(() => lpnInputRef.current?.focus(), 100);
          },
        }
      );
      return;
    }

    if (!matchedItem) {
      toast.error("产品信息丢失");
      return;
    }

    // B级需要拍照，C级需要拍照或视频
    if (selectedGrade === "B" && capturedPhotos.length === 0) {
      toast.error("B级产品需要拍摄刮痕/损坏照片");
      return;
    }

    if (selectedGrade === "C" && capturedPhotos.length === 0 && capturedVideos.length === 0) {
      toast.error("C级产品需要拍摄功能缺陷的照片或视频");
      return;
    }

    updateMutation.mutate(
      {
        id: matchedItem.id,
        grade: selectedGrade as "A" | "B" | "C" | "new",
        refurbishment_grade: selectedGrade,
        refurbishment_photos: capturedPhotos.length > 0 ? capturedPhotos : null,
        refurbishment_videos: capturedVideos.length > 0 ? capturedVideos : null,
        refurbishment_notes: notes || null,
        refurbished_at: new Date().toISOString(),
        refurbished_by: user?.email || "未知用户",
      },
      {
        onSuccess: () => {
          playSuccess();
          toast.success("翻新处理完成");
          resetForm();
          setIsProcessDialogOpen(false);
          setTimeout(() => lpnInputRef.current?.focus(), 100);
        },
      }
    );
  };

  const resetForm = () => {
    setSelectedGrade("");
    setNotes("");
    setCapturedPhotos([]);
    setCapturedVideos([]);
    setMatchedItem(null);
    setShowMediaCapture(false);
    setIsNewLpn(false);
    setNewLpnInput("");
  };

  const removePhoto = (index: number) => {
    setCapturedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const removeVideo = (index: number) => {
    setCapturedVideos(prev => prev.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // 移动端拍摄界面
  if (showMediaCapture && (matchedItem || isNewLpn) && (selectedGrade === "B" || selectedGrade === "C")) {
    return (
      <RefurbishmentMediaCapture
        lpn={matchedItem?.lpn || newLpnInput}
        grade={selectedGrade as "B" | "C"}
        onComplete={handleMediaCaptureComplete}
        onCancel={() => setShowMediaCapture(false)}
        initialPhotos={capturedPhotos}
        initialVideos={capturedVideos}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      <PageHeader
        title={t.refurbishment?.title || "翻新处理"}
        description={t.refurbishment?.description || "扫描已入库的LPN号，进行翻新处理并设定产品等级"}
      />

      {/* 扫描LPN */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            {t.refurbishment?.scanLpn || "扫描LPN号"}
          </CardTitle>
          <CardDescription>
            {t.refurbishment?.scanLpnDesc || "扫描LPN号开始翻新处理（支持无入库记录的LPN）"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              ref={lpnInputRef}
              placeholder={t.refurbishment?.lpnPlaceholder || "输入或扫描LPN号..."}
              value={lpnInput}
              onChange={(e) => setLpnInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScanLpn()}
              className="text-lg"
            />
            <Button onClick={() => handleScanLpn()} className="gradient-primary">
              <ScanLine className="mr-2 h-4 w-4" />
              {t.common.confirm}
            </Button>
            <Scanner onScan={handleCameraScan} buttonLabel={t.common.view === "查看" ? "摄像头" : "Camera"} />
          </div>
        </CardContent>
      </Card>

      {/* 最近翻新记录 */}
      <Card>
        <CardHeader>
          <CardTitle>{t.refurbishment?.recentRecords || "最近翻新记录"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {inboundItems
              ?.filter(item => item.refurbishment_grade)
              .slice(0, 10)
              .map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{item.lpn}</Badge>
                    <span className="text-sm text-muted-foreground">{item.product_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GradeBadge grade={item.refurbishment_grade as "A" | "B" | "C"} />
                    <span className="text-xs text-muted-foreground">
                      {item.refurbished_at && new Date(item.refurbished_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            {(!inboundItems || inboundItems.filter(i => i.refurbishment_grade).length === 0) && (
              <p className="text-center text-muted-foreground py-8">
                {t.refurbishment?.noRecords || "暂无翻新记录"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 处理对话框 */}
      <Dialog open={isProcessDialogOpen} onOpenChange={setIsProcessDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg pr-8">
              <Wrench className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="truncate">{t.refurbishment?.processTitle || "翻新处理"} - {matchedItem?.lpn || newLpnInput}</span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="grid gap-4 py-4">
              {/* 无入库信息提示 */}
              {isNewLpn && (
                <div className="rounded-lg bg-warning/10 border border-warning/30 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-warning">无入库记录</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        该LPN ({newLpnInput}) 无入库记录，将按无入库信息操作翻新流程。产品信息将在后续导入时自动同步。
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 产品信息 - 已有入库记录 */}
              {matchedItem && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">{t.refurbishment?.productName || "产品名称"}</p>
                      <p className="font-medium">{matchedItem.product_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t.refurbishment?.productSku || "产品SKU"}</p>
                      <p className="font-medium">{matchedItem.product_sku}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t.refurbishment?.currentGrade || "当前等级"}</p>
                      <GradeBadge grade={matchedItem.grade as "A" | "B" | "C"} />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t.refurbishment?.inboundDate || "入库日期"}</p>
                      <p className="font-medium">{new Date(matchedItem.processed_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 级别选择 */}
              <div className="space-y-2">
                <Label className="text-sm">{t.refurbishment?.setGrade || "设定产品等级"} *</Label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedGrade("A")}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all",
                      selectedGrade === "A"
                        ? "border-info bg-info/10 ring-2 ring-info/30"
                        : "border-muted hover:border-info/50 hover:bg-info/5"
                    )}
                  >
                    <GradeBadge grade="A" />
                    <span className="mt-2 text-xs text-muted-foreground">{t.refurbishment?.gradeADesc || "轻微使用痕迹"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedGrade("B")}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all",
                      selectedGrade === "B"
                        ? "border-warning bg-warning/10 ring-2 ring-warning/30"
                        : "border-muted hover:border-warning/50 hover:bg-warning/5"
                    )}
                  >
                    <GradeBadge grade="B" />
                    <span className="mt-2 text-xs text-muted-foreground">{t.refurbishment?.gradeBDesc || "刮痕/外观损坏"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedGrade("C")}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all",
                      selectedGrade === "C"
                        ? "border-destructive bg-destructive/10 ring-2 ring-destructive/30"
                        : "border-muted hover:border-destructive/50 hover:bg-destructive/5"
                    )}
                  >
                    <GradeBadge grade="C" />
                    <span className="mt-2 text-xs text-muted-foreground">{t.refurbishment?.gradeCDesc || "功能缺陷"}</span>
                  </button>
                </div>
              </div>

              {/* B级提示 - 需要拍照 */}
              {selectedGrade === "B" && (
                <div className="rounded-lg bg-warning/10 border border-warning/30 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-warning">{t.refurbishment?.bGradeRequirement || "B级需要拍照记录"}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t.refurbishment?.bGradeHint || "请拍摄刮痕或损坏的位置"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* C级提示 - 需要拍照或视频 */}
              {selectedGrade === "C" && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">{t.refurbishment?.cGradeRequirement || "C级需要拍照或录视频"}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t.refurbishment?.cGradeHint || "请拍摄或录制功能缺陷的详情"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 移动端优化的拍摄按钮 */}
              {(selectedGrade === "B" || selectedGrade === "C") && isMobile && (
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full h-20 border-2 border-dashed flex flex-col items-center justify-center gap-2",
                    (selectedGrade === "B" && capturedPhotos.length === 0) && "border-warning",
                    (selectedGrade === "C" && capturedPhotos.length === 0 && capturedVideos.length === 0) && "border-destructive"
                  )}
                  onClick={openMobileCapture}
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-6 w-6 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">打开拍摄界面</p>
                      <p className="text-xs text-muted-foreground">
                        已拍摄：{capturedPhotos.length} 张照片
                        {selectedGrade === "C" && `，${capturedVideos.length} 个视频`}
                      </p>
                    </div>
                  </div>
                </Button>
              )}

              {/* 桌面端拍照上传 */}
              {(selectedGrade === "B" || selectedGrade === "C") && !isMobile && (
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    {t.refurbishment?.photos || "照片"} ({capturedPhotos.length})
                    {selectedGrade === "B" && capturedPhotos.length === 0 && (
                      <Badge variant="destructive" className="text-xs">{t.common.view === "查看" ? "必填" : "Required"}</Badge>
                    )}
                  </Label>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoCapture}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full h-16 border-2 border-dashed",
                      selectedGrade === "B" && capturedPhotos.length === 0 && "border-destructive"
                    )}
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <div className="text-center">
                      <Camera className="mx-auto h-5 w-5 text-muted-foreground" />
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {isUploading ? (t.common.processing) : (t.refurbishment?.clickToPhoto || "点击拍照或选择图片")}
                      </span>
                    </div>
                  </Button>
                  {capturedPhotos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {capturedPhotos.map((url, index) => (
                        <div key={index} className="relative flex-shrink-0 w-16 h-16 rounded overflow-hidden border group">
                          <img src={url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
                          >
                            {t.common.delete}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 桌面端视频上传 - 仅C级 */}
              {selectedGrade === "C" && !isMobile && (
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    {t.refurbishment?.videos || "视频"} ({capturedVideos.length})
                  </Label>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={handleVideoCapture}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-16 border-2 border-dashed"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <div className="text-center">
                      <Video className="mx-auto h-5 w-5 text-muted-foreground" />
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {isUploading ? (t.common.processing) : (t.refurbishment?.clickToVideo || "点击录制或选择视频")}
                      </span>
                    </div>
                  </Button>
                  {capturedVideos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {capturedVideos.map((url, index) => (
                        <div key={index} className="relative flex-shrink-0 w-24 h-16 rounded overflow-hidden border group">
                          <video src={url} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Video className="h-6 w-6 text-white drop-shadow-lg" />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeVideo(index)}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
                          >
                            {t.common.delete}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 移动端已拍摄的预览 */}
              {(selectedGrade === "B" || selectedGrade === "C") && isMobile && (capturedPhotos.length > 0 || capturedVideos.length > 0) && (
                <div className="space-y-2">
                  <Label className="text-sm">已拍摄媒体</Label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {capturedPhotos.map((url, index) => (
                      <div key={`photo-${index}`} className="relative flex-shrink-0 w-16 h-16 rounded overflow-hidden border">
                        <img src={url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                          照片
                        </div>
                      </div>
                    ))}
                    {capturedVideos.map((url, index) => (
                      <div key={`video-${index}`} className="relative flex-shrink-0 w-16 h-16 rounded overflow-hidden border">
                        <video src={url} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Video className="h-4 w-4 text-white drop-shadow-lg" />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                          视频
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 备注 */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm">{t.common.notes}</Label>
                <Textarea
                  id="notes"
                  placeholder={t.refurbishment?.notesPlaceholder || "输入翻新备注信息..."}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-3 pt-4 border-t flex-shrink-0 mt-4">
            <Button variant="outline" onClick={() => {
              setIsProcessDialogOpen(false);
              resetForm();
            }}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleProcessComplete}
              className="gradient-primary"
              disabled={updateMutation.isPending || createMutation.isPending || isUploading}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {isNewLpn ? "完成翻新（创建记录）" : (t.refurbishment?.complete || "完成翻新")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
