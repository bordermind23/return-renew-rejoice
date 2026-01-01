import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Upload, Loader2, X, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ShippingLabelCaptureProps {
  onTrackingRecognized: (trackingNumbers: string[], photoUrl: string) => void;
  onCancel?: () => void;
}

export function ShippingLabelCapture({ onTrackingRecognized, onCancel }: ShippingLabelCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognizedNumbers, setRecognizedNumbers] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 页面加载时自动启动摄像头
  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCapturing(true);
    } catch (error) {
      console.error("Failed to start camera:", error);
      setCameraError("无法访问摄像头，请检查权限设置");
      toast.error("无法访问摄像头");
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedImage(imageData);
      stopCamera();
      recognizeTracking(imageData);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setCapturedImage(imageData);
      recognizeTracking(imageData);
    };
    reader.readAsDataURL(file);
  };

  const recognizeTracking = async (imageData: string) => {
    setIsRecognizing(true);
    setRecognizedNumbers([]);

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
        
        // 找到匹配的跟踪号
        const matchedTrackingNumbers = shipments?.map(s => s.tracking_number) || [];
        
        let selectedTrackingNumber: string;
        
        if (matchedTrackingNumbers.length > 0) {
          // 使用匹配到的第一个跟踪号
          selectedTrackingNumber = matchedTrackingNumbers[0];
          toast.success(`自动匹配到移除货件物流号: ${selectedTrackingNumber}`);
        } else {
          // 没有匹配，使用第一个识别到的跟踪号
          selectedTrackingNumber = trackingNumbers[0];
          toast.info(`识别到物流号: ${selectedTrackingNumber}（未找到匹配的移除货件）`);
        }
        
        // 自动上传照片并确认
        await uploadPhotoAndConfirm(selectedTrackingNumber, imageData);
      } else {
        toast.warning("未能识别到物流跟踪号，请确保照片清晰或手动输入");
        setIsRecognizing(false);
      }
    } catch (error) {
      console.error("Recognition error:", error);
      toast.error("识别失败，请重试");
      setIsRecognizing(false);
    }
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
  };

  const handleCancel = () => {
    stopCamera();
    setCapturedImage(null);
    setRecognizedNumbers([]);
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
              将摄像头对准物流面单，点击拍摄按钮
            </p>
          </div>

          {/* 摄像头视图 - 默认显示 */}
          {isCapturing && !capturedImage && (
            <div className="space-y-4">
              <div className="relative aspect-video max-w-lg mx-auto rounded-lg overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* 取景框提示 */}
                <div className="absolute inset-4 border-2 border-white/50 border-dashed rounded-lg pointer-events-none" />
              </div>
              <div className="flex gap-3 justify-center">
                <Button onClick={capturePhoto} className="gradient-primary h-14 px-10 text-lg">
                  <Camera className="mr-2 h-6 w-6" />
                  拍摄
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                或者 <button 
                  className="text-primary underline" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  上传照片
                </button>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          )}

          {/* 摄像头错误时的备用选项 */}
          {cameraError && !capturedImage && !isCapturing && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
                <p className="text-sm">{cameraError}</p>
              </div>
              <div className="flex flex-col gap-3 max-w-md mx-auto">
                <Button onClick={startCamera} variant="outline" className="h-12">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  重试摄像头
                </Button>
                <Button 
                  className="gradient-primary h-12 px-6"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-5 w-5" />
                  上传照片
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          )}

          {/* 加载摄像头中 */}
          {!isCapturing && !capturedImage && !cameraError && (
            <div className="space-y-4">
              <div className="relative aspect-video max-w-lg mx-auto rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">正在启动摄像头...</p>
                </div>
              </div>
            </div>
          )}

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

              {/* 识别失败时显示重试选项 */}
              {recognizedNumbers.length === 0 && !isRecognizing && !isUploading && (
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={retakePhoto} className="h-10">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    重拍
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => recognizeTracking(capturedImage)}
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
