import { useState, useRef } from "react";
import { Camera, Upload, Loader2, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface ShippingLabelCaptureProps {
  onTrackingRecognized: (trackingNumbers: string[], photoUrl: string) => void;
  onCancel?: () => void;
}

export function ShippingLabelCapture({ onTrackingRecognized, onCancel }: ShippingLabelCaptureProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognizedNumbers, setRecognizedNumbers] = useState<string[]>([]);
  const [matchedNumbers, setMatchedNumbers] = useState<string[]>([]);
  const [showSelection, setShowSelection] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 优化压缩图片 - 提高识别准确率
  const compressImage = (imageData: string, maxWidth: number = 1600, quality: number = 0.85): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        
        // 如果图片过大，按比例缩小（保持较高分辨率以提高OCR准确率）
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        
        // 确保尺寸是偶数（某些编码器要求）
        width = Math.floor(width / 2) * 2;
        height = Math.floor(height / 2) * 2;
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // 使用高质量缩放
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);
          
          // 生成标准格式的 base64（确保格式正确）
          const result = canvas.toDataURL("image/jpeg", quality);
          console.log("Image compressed:", { 
            originalSize: Math.round(imageData.length / 1024), 
            compressedSize: Math.round(result.length / 1024),
            dimensions: `${width}x${height}`
          });
          resolve(result);
        } else {
          resolve(imageData);
        }
      };
      img.onerror = () => {
        console.error("Failed to load image for compression");
        resolve(imageData);
      };
      img.src = imageData;
    });
  };

  // 处理拍照或上传的图片
  const handleImageCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      setCapturedImage(imageData);
      
      // 压缩后再识别
      const compressedImage = await compressImage(imageData);
      recognizeTracking(compressedImage);
    };
    reader.readAsDataURL(file);
    
    // 重置 input 以便可以重复选择同一文件
    event.target.value = "";
  };

  const recognizeTracking = async (imageData: string) => {
    setIsRecognizing(true);
    setRecognizedNumbers([]);
    setMatchedNumbers([]);
    setShowSelection(false);

    try {
      const { data, error } = await supabase.functions.invoke("recognize-tracking", {
        body: { imageBase64: imageData }
      });

      if (error) {
        console.error("Recognition error:", error);
        toast.error("识别失败，请重试");
        setIsRecognizing(false);
        return;
      }

      if (data.trackingNumbers && data.trackingNumbers.length > 0) {
        const trackingNumbers: string[] = data.trackingNumbers;
        setRecognizedNumbers(trackingNumbers);
        
        // 查询 removal_shipments 匹配识别到的跟踪号
        const { data: shipments, error: queryError } = await supabase
          .from("removal_shipments")
          .select("tracking_number")
          .in("tracking_number", trackingNumbers);
        
        if (queryError) {
          console.error("Query error:", queryError);
        }
        
        // 找到匹配的跟踪号（去重）
        const matchedTrackingNumbers = [...new Set(shipments?.map(s => s.tracking_number) || [])];
        setMatchedNumbers(matchedTrackingNumbers);
        
        if (matchedTrackingNumbers.length > 1) {
          // 多个匹配，让用户选择
          setShowSelection(true);
          setIsRecognizing(false);
          toast.info(`识别到 ${matchedTrackingNumbers.length} 个匹配的物流号，请选择`);
        } else if (matchedTrackingNumbers.length === 1) {
          // 只有一个匹配，自动使用
          toast.success(`自动匹配到移除货件物流号: ${matchedTrackingNumbers[0]}`);
          await uploadPhotoAndConfirm(matchedTrackingNumbers[0], imageData);
        } else {
          // 没有匹配，使用第一个识别到的跟踪号
          toast.info(`识别到物流号: ${trackingNumbers[0]}（未找到匹配的移除货件）`);
          await uploadPhotoAndConfirm(trackingNumbers[0], imageData);
        }
      } else {
        toast.warning("未能识别到物流跟踪号，请确保照片清晰或重新拍摄");
        setIsRecognizing(false);
      }
    } catch (error) {
      console.error("Recognition error:", error);
      toast.error("识别失败，请重试");
      setIsRecognizing(false);
    }
  };

  const handleSelectTracking = async (trackingNumber: string) => {
    setShowSelection(false);
    toast.success(`已选择物流号: ${trackingNumber}`);
    await uploadPhotoAndConfirm(trackingNumber, capturedImage || undefined);
  };

  const uploadPhotoAndConfirm = async (trackingNumber: string, imageData?: string) => {
    const imageToUpload = imageData || capturedImage;
    if (!imageToUpload) return;

    setIsUploading(true);
    try {
      // Convert base64 to blob
      const response = await fetch(imageToUpload);
      const blob = await response.blob();
      
      // Generate unique filename
      const filename = `${trackingNumber}/${Date.now()}.jpg`;
      
      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("shipping-labels")
        .upload(filename, blob, {
          contentType: "image/jpeg",
          upsert: true
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("照片上传失败");
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("shipping-labels")
        .getPublicUrl(filename);

      onTrackingRecognized([trackingNumber], publicUrl);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("照片上传失败");
    } finally {
      setIsUploading(false);
      setIsRecognizing(false);
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setRecognizedNumbers([]);
    setMatchedNumbers([]);
    setShowSelection(false);
  };

  const handleCancel = () => {
    setCapturedImage(null);
    setRecognizedNumbers([]);
    setMatchedNumbers([]);
    setShowSelection(false);
    onCancel?.();
  };

  return (
    <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardContent className="pt-6 pb-6">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary/10">
            <Camera className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">拍摄物流面单</h2>
            <p className="text-sm text-muted-foreground">
              点击下方按钮拍摄或上传物流面单照片
            </p>
          </div>

          {/* 隐藏的文件输入 - 原生相机 */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageCapture}
          />
          
          {/* 隐藏的文件输入 - 相册上传 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageCapture}
          />

          {/* 未拍照时显示拍摄/上传按钮 */}
          {!capturedImage && !isRecognizing && (
            <div className="space-y-4">
              <div className="relative aspect-video max-w-lg mx-auto rounded-lg overflow-hidden bg-muted/50 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <div className="text-center p-6">
                  <Camera className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">点击下方按钮开始拍摄</p>
                </div>
              </div>
              
              <div className="flex flex-col gap-3 max-w-md mx-auto">
                <Button 
                  className="gradient-primary h-14 px-8 text-lg"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="mr-2 h-5 w-5" />
                  拍摄照片
                </Button>
                <Button 
                  variant="outline"
                  className="h-12"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  从相册选择
                </Button>
              </div>
            </div>
          )}

          {/* 已拍照，显示预览和识别状态 */}
          {capturedImage && (
            <div className="space-y-4">
              <div className="relative aspect-video max-w-lg mx-auto rounded-lg overflow-hidden">
                <img
                  src={capturedImage}
                  alt="物流面单"
                  className="w-full h-full object-contain bg-muted"
                />
                {(isRecognizing || isUploading) && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p>{isRecognizing ? "正在识别物流号..." : "正在处理..."}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 多个匹配时显示选择界面 */}
              {showSelection && matchedNumbers.length > 1 && (
                <div className="space-y-3 max-w-md mx-auto">
                  <p className="text-sm font-medium text-foreground">
                    识别到多个匹配的物流号，请选择:
                  </p>
                  <div className="grid gap-2">
                    {matchedNumbers.map((num) => (
                      <Button
                        key={num}
                        variant="outline"
                        className="h-12 justify-start text-left font-mono hover:bg-primary/10 hover:border-primary"
                        onClick={() => handleSelectTracking(num)}
                      >
                        <CheckCircle className="mr-3 h-5 w-5 text-primary" />
                        <span className="flex-1">{num}</span>
                        <Badge variant="secondary" className="ml-2">已匹配</Badge>
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-3 justify-center pt-2">
                    <Button variant="outline" onClick={retakePhoto} className="h-10">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      重拍
                    </Button>
                    <Button variant="ghost" onClick={handleCancel} className="h-10">
                      取消
                    </Button>
                  </div>
                </div>
              )}

              {/* 识别失败时显示重试选项 */}
              {recognizedNumbers.length === 0 && !isRecognizing && !isUploading && !showSelection && (
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={retakePhoto} className="h-10">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    重拍
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => capturedImage && recognizeTracking(capturedImage)}
                    className="h-10"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    重新识别
                  </Button>
                  <Button variant="ghost" onClick={handleCancel} className="h-10">
                    取消
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
