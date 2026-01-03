import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Upload, Loader2, RefreshCw, CheckCircle, Keyboard, AlertTriangle, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  
  // 手动输入状态
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualTrackingNumber, setManualTrackingNumber] = useState("");
  
  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  
  // 清晰度检测状态
  const [clarityWarning, setClarityWarning] = useState<string | null>(null);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // 清晰度检测函数 - 使用拉普拉斯方差
  const detectImageClarity = useCallback((imageData: string): Promise<{ isBlurry: boolean; score: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 200; // 采样尺寸
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          resolve({ isBlurry: false, score: 100 });
          return;
        }
        
        // 缩放图片到采样尺寸
        ctx.drawImage(img, 0, 0, size, size);
        const imageDataObj = ctx.getImageData(0, 0, size, size);
        const data = imageDataObj.data;
        
        // 转换为灰度并计算拉普拉斯方差
        const gray: number[] = [];
        for (let i = 0; i < data.length; i += 4) {
          gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }
        
        // 拉普拉斯算子
        let sum = 0;
        let sumSq = 0;
        let count = 0;
        
        for (let y = 1; y < size - 1; y++) {
          for (let x = 1; x < size - 1; x++) {
            const idx = y * size + x;
            const laplacian = 
              gray[idx - size] + gray[idx + size] + 
              gray[idx - 1] + gray[idx + 1] - 
              4 * gray[idx];
            sum += laplacian;
            sumSq += laplacian * laplacian;
            count++;
          }
        }
        
        const mean = sum / count;
        const variance = (sumSq / count) - (mean * mean);
        
        // 方差阈值：低于100认为模糊
        const isBlurry = variance < 100;
        resolve({ isBlurry, score: Math.round(variance) });
      };
      img.onerror = () => resolve({ isBlurry: false, score: 100 });
      img.src = imageData;
    });
  }, []);

  // 图像增强 - 增加对比度和亮度，处理阴影问题
  const enhanceImageContrast = useCallback((imageData: string, contrast: number = 1.3, brightness: number = 1.1): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          resolve(imageData);
          return;
        }
        
        // 绘制原图
        ctx.drawImage(img, 0, 0);
        
        // 获取像素数据
        const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageDataObj.data;
        
        // 对每个像素应用对比度和亮度增强
        for (let i = 0; i < data.length; i += 4) {
          // 应用亮度
          data[i] = Math.min(255, data[i] * brightness);     // R
          data[i + 1] = Math.min(255, data[i + 1] * brightness); // G
          data[i + 2] = Math.min(255, data[i + 2] * brightness); // B
          
          // 应用对比度 (以128为中心点)
          data[i] = Math.min(255, Math.max(0, ((data[i] - 128) * contrast) + 128));
          data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1] - 128) * contrast) + 128));
          data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2] - 128) * contrast) + 128));
        }
        
        // 写回处理后的像素数据
        ctx.putImageData(imageDataObj, 0, 0);
        
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.onerror = () => resolve(imageData);
      img.src = imageData;
    });
  }, []);

  // 优化压缩图片 - 平衡速度和识别准确率
  const compressImage = (imageData: string, maxWidth: number = 1200, quality: number = 0.75): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        
        // 减小尺寸加快上传和识别速度
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
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);
          
          // 使用适中质量平衡速度和准确率
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

  // 统一处理图片文件
  const processImageFile = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      setCapturedImage(imageData);
      setClarityWarning(null);
      
      // 检测清晰度
      const { isBlurry, score } = await detectImageClarity(imageData);
      if (isBlurry) {
        setClarityWarning(`照片可能模糊（清晰度: ${score}），建议重新拍摄`);
      }
      
      // 先增强对比度处理阴影，再压缩
      const enhancedImage = await enhanceImageContrast(imageData);
      const compressedImage = await compressImage(enhancedImage);
      recognizeTracking(compressedImage);
    };
    reader.readAsDataURL(file);
  }, [detectImageClarity, enhanceImageContrast]);

  // 处理拍照或上传的图片
  const handleImageCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    await processImageFile(file);
    
    // 重置 input 以便可以重复选择同一文件
    event.target.value = "";
  };

  // 拖拽事件处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        processImageFile(file);
      } else {
        toast.error("请拖入图片文件");
      }
    }
  }, [processImageFile]);

  // 粘贴事件监听
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // 如果已有图片或正在处理，忽略
      if (capturedImage || isRecognizing) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            toast.info("检测到粘贴的图片，正在处理...");
            processImageFile(file);
          }
          break;
        }
      }
    };
    
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [capturedImage, isRecognizing, processImageFile]);

  const recognizeTracking = async (imageData: string) => {
    setIsRecognizing(true);
    setRecognizedNumbers([]);
    setMatchedNumbers([]);
    setShowSelection(false);
    setShowManualInput(false);

    try {
      const { data, error } = await supabase.functions.invoke("recognize-tracking", {
        body: { imageBase64: imageData }
      });

      if (error) {
        console.error("Recognition error:", error);
        toast.error("识别失败，请重试或手动输入");
        setShowManualInput(true);
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
        toast.warning("未能识别到物流跟踪号，请手动输入或重新拍摄");
        setShowManualInput(true);
        setIsRecognizing(false);
      }
    } catch (error) {
      console.error("Recognition error:", error);
      toast.error("识别失败，请手动输入物流号");
      setShowManualInput(true);
      setIsRecognizing(false);
    }
  };

  const handleSelectTracking = async (trackingNumber: string) => {
    setShowSelection(false);
    toast.success(`已选择物流号: ${trackingNumber}`);
    await uploadPhotoAndConfirm(trackingNumber, capturedImage || undefined);
  };

  // 手动输入确认
  const handleManualConfirm = async () => {
    const trimmed = manualTrackingNumber.trim().toUpperCase();
    if (trimmed.length < 8) {
      toast.error("物流号至少需要8位字符");
      return;
    }
    if (!/^[A-Z0-9]+$/.test(trimmed)) {
      toast.error("物流号只能包含字母和数字");
      return;
    }
    
    setShowManualInput(false);
    toast.success(`使用手动输入的物流号: ${trimmed}`);
    await uploadPhotoAndConfirm(trimmed, capturedImage || undefined);
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
    setShowManualInput(false);
    setClarityWarning(null);
    setManualTrackingNumber("");
  };

  const handleCancel = () => {
    setCapturedImage(null);
    setRecognizedNumbers([]);
    setMatchedNumbers([]);
    setShowSelection(false);
    setShowManualInput(false);
    setClarityWarning(null);
    setManualTrackingNumber("");
    onCancel?.();
  };

  return (
    <>
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
                {/* 拖拽上传区域 */}
                <div 
                  ref={dropZoneRef}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative aspect-video max-w-lg mx-auto rounded-lg overflow-hidden border-2 border-dashed transition-all duration-200 flex items-center justify-center cursor-pointer ${
                    isDragging 
                      ? "border-primary bg-primary/10 scale-[1.02]" 
                      : "border-muted-foreground/30 bg-muted/50 hover:border-primary/50 hover:bg-muted/70"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="text-center p-6">
                    {isDragging ? (
                      <>
                        <Upload className="h-12 w-12 mx-auto mb-3 text-primary animate-bounce" />
                        <p className="text-sm font-medium text-primary">松开鼠标上传图片</p>
                      </>
                    ) : (
                      <>
                        <Camera className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">点击或拖拽图片到此处</p>
                        <p className="text-xs text-muted-foreground/70 mt-1 flex items-center justify-center gap-1">
                          <ClipboardPaste className="h-3 w-3" />
                          电脑端支持 Ctrl+V 粘贴截图
                        </p>
                      </>
                    )}
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

                {/* 清晰度警告 */}
                {clarityWarning && !isRecognizing && !isUploading && (
                  <div className="flex items-center justify-center gap-2 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400 px-4 py-2 rounded-lg max-w-lg mx-auto">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">{clarityWarning}</span>
                  </div>
                )}

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

                {/* 识别失败或需要手动输入时显示选项 */}
                {showManualInput && !isRecognizing && !isUploading && (
                  <div className="space-y-3 max-w-md mx-auto">
                    <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-4 py-3 rounded-lg">
                      <Keyboard className="h-5 w-5 flex-shrink-0" />
                      <span className="text-sm font-medium">未能自动识别物流号，请手动输入或重新拍摄</span>
                    </div>
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
                      <Button 
                        className="h-10"
                        onClick={() => {
                          setShowManualInput(false);
                          // 打开手动输入对话框
                          setTimeout(() => setShowManualInput(true), 100);
                        }}
                      >
                        <Keyboard className="mr-2 h-4 w-4" />
                        手动输入
                      </Button>
                    </div>
                  </div>
                )}

                {/* 普通识别失败（非手动输入模式）时显示重试选项 */}
                {recognizedNumbers.length === 0 && !isRecognizing && !isUploading && !showSelection && !showManualInput && (
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

      {/* 手动输入物流号对话框 */}
      <Dialog open={showManualInput && capturedImage !== null} onOpenChange={(open) => {
        if (!open) setShowManualInput(false);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              手动输入物流号
            </DialogTitle>
            <DialogDescription>
              请输入物流面单上的跟踪号码（至少8位字母或数字）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="例如: 1Z999AA10123456784"
              value={manualTrackingNumber}
              onChange={(e) => setManualTrackingNumber(e.target.value.toUpperCase())}
              className="font-mono text-lg h-12"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleManualConfirm();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              提示：可以直接粘贴复制的物流号
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowManualInput(false)}>
              取消
            </Button>
            <Button onClick={handleManualConfirm} disabled={manualTrackingNumber.trim().length < 8}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
