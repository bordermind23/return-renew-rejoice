import { useState, useMemo, useRef } from "react";
import { ChevronDown, ChevronRight, Package, Trash2, Image, Eye, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PhotoViewDialog } from "@/components/PhotoViewDialog";
import { type InboundItem, useBatchUpdateShippingLabel } from "@/hooks/useInboundItems";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface InboundBatchListProps {
  items: InboundItem[];
  onDelete: (id: string) => void;
  onBatchDelete?: (ids: string[]) => void;
  enableBatchSelect?: boolean;
  canDelete?: boolean;
}

interface BatchGroup {
  trackingNumber: string;
  items: InboundItem[];
  totalCount: number;
  latestProcessedAt: string;
  productName: string;
  productSku: string;
}

export function InboundBatchList({ items, onDelete, onBatchDelete, enableBatchSelect = false, canDelete = true }: InboundBatchListProps) {
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [photoViewItem, setPhotoViewItem] = useState<InboundItem | null>(null);
  const [batchPhotoViewItem, setBatchPhotoViewItem] = useState<BatchGroup | null>(null);
  const [shippingLabelUrl, setShippingLabelUrl] = useState<string | null>(null); // 单独查看物流面单
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // 补传面单相关状态
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadingBatch, setUploadingBatch] = useState<BatchGroup | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const batchUpdateShippingLabelMutation = useBatchUpdateShippingLabel();

  // 按物流跟踪号分组
  const batches = useMemo(() => {
    const grouped = items.reduce((acc, item) => {
      const key = item.tracking_number || "unknown";
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {} as Record<string, InboundItem[]>);

    // 转换为数组并排序（最新处理的在前）
    return Object.entries(grouped)
      .map(([trackingNumber, batchItems]): BatchGroup => ({
        trackingNumber,
        items: batchItems.sort((a, b) => 
          new Date(b.processed_at).getTime() - new Date(a.processed_at).getTime()
        ),
        totalCount: batchItems.length,
        latestProcessedAt: batchItems.reduce((latest, item) => 
          new Date(item.processed_at) > new Date(latest) ? item.processed_at : latest,
          batchItems[0].processed_at
        ),
        productName: batchItems[0].product_name,
        productSku: batchItems[0].product_sku,
      }))
      .sort((a, b) => 
        new Date(b.latestProcessedAt).getTime() - new Date(a.latestProcessedAt).getTime()
      );
  }, [items]);

  const toggleBatch = (trackingNumber: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(trackingNumber)) {
        next.delete(trackingNumber);
      } else {
        next.add(trackingNumber);
      }
      return next;
    });
  };

  // 获取照片数量（不含物流面单，因为物流面单单独展示）
  const getPhotoCount = (item: InboundItem, excludeShippingLabel = false) => {
    const photoFields = excludeShippingLabel
      ? [
          'lpn_label_photo', 'packaging_photo_1', 'packaging_photo_2', 
          'packaging_photo_3', 'packaging_photo_4', 'packaging_photo_5',
          'packaging_photo_6', 'accessories_photo', 'detail_photo',
          'product_photo', 'package_photo'
        ] as const
      : [
          'shipping_label_photo', 'lpn_label_photo', 'packaging_photo_1', 'packaging_photo_2', 
          'packaging_photo_3', 'packaging_photo_4', 'packaging_photo_5',
          'packaging_photo_6', 'accessories_photo', 'detail_photo',
          'product_photo', 'package_photo'
        ] as const;
    return photoFields.filter(field => item[field as keyof InboundItem]).length;
  };

  // 获取批次的物流面单照片
  const getBatchShippingLabelPhoto = (batch: BatchGroup): string | null => {
    for (const item of batch.items) {
      if (item.shipping_label_photo) {
        return item.shipping_label_photo;
      }
    }
    return null;
  };


  // 选择相关函数
  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectBatch = (batch: BatchGroup) => {
    const batchIds = batch.items.map(item => item.id);
    const allSelected = batchIds.every(id => selectedIds.has(id));
    
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        batchIds.forEach(id => next.delete(id));
      } else {
        batchIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allIds = items.map(item => item.id);
    const allSelected = allIds.every(id => selectedIds.has(id));
    
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const getBatchSelectState = (batch: BatchGroup): "all" | "some" | "none" => {
    const batchIds = batch.items.map(item => item.id);
    const selectedCount = batchIds.filter(id => selectedIds.has(id)).length;
    if (selectedCount === 0) return "none";
    if (selectedCount === batchIds.length) return "all";
    return "some";
  };

  const handleBatchDelete = () => {
    if (onBatchDelete && selectedIds.size > 0) {
      onBatchDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  // 补传面单相关函数
  const handleOpenUploadDialog = (batch: BatchGroup) => {
    setUploadingBatch(batch);
    setPreviewImage(null);
    setUploadDialogOpen(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadConfirm = async () => {
    if (!uploadingBatch || !previewImage) return;
    
    setIsUploading(true);
    try {
      // Convert base64 to blob
      const response = await fetch(previewImage);
      const blob = await response.blob();
      
      // Generate unique filename
      const filename = `${uploadingBatch.trackingNumber}/${Date.now()}.jpg`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("shipping-labels")
        .upload(filename, blob, {
          contentType: "image/jpeg",
          upsert: true
        });

      if (uploadError) {
        toast.error("照片上传失败");
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("shipping-labels")
        .getPublicUrl(filename);

      // Update all inbound items with this tracking number
      await batchUpdateShippingLabelMutation.mutateAsync({
        trackingNumber: uploadingBatch.trackingNumber,
        shippingLabelPhoto: publicUrl,
      });

      setUploadDialogOpen(false);
      setUploadingBatch(null);
      setPreviewImage(null);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("补传面单失败");
    } finally {
      setIsUploading(false);
    }
  };

  const allSelected = items.length > 0 && items.every(item => selectedIds.has(item.id));
  const someSelected = items.some(item => selectedIds.has(item.id)) && !allSelected;

  if (batches.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        暂无入库处理记录
      </Card>
    );
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* 批量操作栏 - 移动端优化 */}
      {enableBatchSelect && (
        <div className="flex items-center justify-between p-2 sm:p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 sm:gap-3">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
              {...(someSelected ? { "data-state": "indeterminate" } : {})}
            />
            <span className="text-xs sm:text-sm text-muted-foreground">
              {selectedIds.size > 0 
                ? `已选 ${selectedIds.size} 条` 
                : "全选"}
            </span>
          </div>
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBatchDelete}
              className="h-8 text-xs sm:text-sm"
            >
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
              删除({selectedIds.size})
            </Button>
          )}
        </div>
      )}

      {batches.map((batch) => {
        const batchSelectState = getBatchSelectState(batch);
        const shippingLabelPhoto = getBatchShippingLabelPhoto(batch);
        return (
          <Collapsible
            key={batch.trackingNumber}
            open={expandedBatches.has(batch.trackingNumber)}
            onOpenChange={() => toggleBatch(batch.trackingNumber)}
          >
            <Card className="overflow-hidden">
              {/* 批次头部 - 移动端优化 */}
              <div className="flex items-start sm:items-center">
                {enableBatchSelect && (
                  <div 
                    className="pl-3 sm:pl-4 pt-3 sm:py-4 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={batchSelectState === "all"}
                      onCheckedChange={() => toggleSelectBatch(batch)}
                      className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
                      {...(batchSelectState === "some" ? { "data-state": "indeterminate" } : {})}
                    />
                  </div>
                )}
                <CollapsibleTrigger asChild>
                  <button className={cn(
                    "flex-1 p-3 sm:p-4 flex items-start sm:items-center gap-2 sm:gap-4 hover:bg-muted/50 transition-colors text-left",
                    enableBatchSelect && "pl-2"
                  )}>
                    <div className="flex-shrink-0 mt-0.5 sm:mt-0">
                      {expandedBatches.has(batch.trackingNumber) ? (
                        <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-medium text-sm sm:text-base truncate max-w-[140px] sm:max-w-none">{batch.trackingNumber}</span>
                        <Badge variant="secondary" className="flex-shrink-0 text-xs">
                          {batch.totalCount}件
                        </Badge>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate mt-0.5">
                        {batch.productName}
                      </p>
                      {/* 移动端显示日期和面单按钮 */}
                      <div className="flex items-center gap-2 mt-1.5 sm:hidden">
                        <span className="text-xs text-muted-foreground">
                          {new Date(batch.latestProcessedAt).toLocaleDateString("zh-CN")}
                        </span>
                        {shippingLabelPhoto && (
                          <Badge variant="outline" className="text-xs text-primary border-primary/30 px-1.5 py-0">
                            <Image className="h-2.5 w-2.5 mr-0.5" />
                            面单
                          </Badge>
                        )}
                      </div>
                    </div>
                    {/* 桌面端日期显示 */}
                    <div className="hidden sm:block text-right text-sm text-muted-foreground flex-shrink-0">
                      <p>{new Date(batch.latestProcessedAt).toLocaleDateString("zh-CN")}</p>
                      <p>{new Date(batch.latestProcessedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </button>
                </CollapsibleTrigger>
                {/* 批次操作按钮 - 移动端隐藏文字 */}
                <div className="pr-2 sm:pr-4 pt-3 sm:pt-0 flex-shrink-0 flex items-center gap-1 sm:gap-2">
                  {shippingLabelPhoto ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 sm:h-8 px-2 sm:px-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShippingLabelUrl(shippingLabelPhoto);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline ml-1">查看面单</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 sm:h-8 px-2 sm:px-3 text-orange-600 border-orange-300 hover:bg-orange-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenUploadDialog(batch);
                      }}
                    >
                      <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline ml-1">补传面单</span>
                    </Button>
                  )}
                </div>
              </div>
              
              <CollapsibleContent>
                <div className="border-t">
                  {/* 移动端使用卡片列表，桌面端使用表格 */}
                  <div className="sm:hidden">
                    {batch.items.map((item) => {
                      const photoCount = getPhotoCount(item, true);
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <div 
                          key={item.id}
                          className={cn(
                            "p-3 border-b last:border-b-0",
                            isSelected && "bg-primary/5"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {enableBatchSelect && (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectItem(item.id)}
                                className="mt-1"
                              />
                            )}
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium truncate">
                                  {item.lpn}
                                </code>
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  {new Date(item.processed_at).toLocaleDateString("zh-CN")}
                                </span>
                              </div>
                              {item.missing_parts && item.missing_parts.length > 0 && (
                                <p className="text-xs text-orange-600">
                                  缺: {item.missing_parts.join(", ")}
                                </p>
                              )}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {photoCount > 0 && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-1.5 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPhotoViewItem(item);
                                      }}
                                    >
                                      <Image className="h-3 w-3 mr-0.5" />
                                      {photoCount}张
                                    </Button>
                                  )}
                                </div>
                                {canDelete && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDelete(item.id);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* 桌面端表格 */}
                  <div className="hidden sm:block">
                    <ScrollArea className="w-full">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            {enableBatchSelect && (
                              <TableHead className="w-[50px]"></TableHead>
                            )}
                            <TableHead className="font-semibold min-w-[100px]">LPN号</TableHead>
                            <TableHead className="font-semibold min-w-[120px]">缺少配件</TableHead>
                            <TableHead className="font-semibold min-w-[60px] text-center">照片</TableHead>
                            <TableHead className="font-semibold min-w-[130px]">处理时间</TableHead>
                            <TableHead className="font-semibold min-w-[60px] text-center">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batch.items.map((item) => {
                            const photoCount = getPhotoCount(item, true);
                            const isSelected = selectedIds.has(item.id);
                            return (
                              <TableRow 
                                key={item.id} 
                                className={cn(
                                  "hover:bg-muted/20",
                                  isSelected && "bg-primary/5"
                                )}
                              >
                                {enableBatchSelect && (
                                  <TableCell>
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => toggleSelectItem(item.id)}
                                    />
                                  </TableCell>
                                )}
                                <TableCell>
                                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">
                                    {item.lpn}
                                  </code>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {item.missing_parts && item.missing_parts.length > 0
                                    ? item.missing_parts.join(", ")
                                    : "-"}
                                </TableCell>
                                <TableCell className="text-center">
                                  {photoCount > 0 ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPhotoViewItem(item);
                                      }}
                                    >
                                      <Image className="h-4 w-4 mr-1" />
                                      {photoCount}
                                    </Button>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {new Date(item.processed_at).toLocaleString("zh-CN")}
                                </TableCell>
                                <TableCell>
                                  <div className="flex justify-center">
                                    {canDelete && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDelete(item.id);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {/* 照片查看弹窗 - 使用优化后的 PhotoViewDialog */}
      {photoViewItem && (
        <PhotoViewDialog
          open={!!photoViewItem}
          onOpenChange={() => setPhotoViewItem(null)}
          title={`入库照片 - ${photoViewItem.lpn}`}
          photos={[
            { key: 'lpn_label_photo', label: 'LPN标签' },
            { key: 'packaging_photo_1', label: '包装照片1' },
            { key: 'packaging_photo_2', label: '包装照片2' },
            { key: 'packaging_photo_3', label: '包装照片3' },
            { key: 'packaging_photo_4', label: '包装照片4' },
            { key: 'packaging_photo_5', label: '包装照片5' },
            { key: 'packaging_photo_6', label: '包装照片6' },
            { key: 'accessories_photo', label: '配件照片' },
            { key: 'detail_photo', label: '细节照片' },
            { key: 'product_photo', label: '产品照片' },
            { key: 'package_photo', label: '包裹照片' },
          ]
            .map(({ key, label }) => {
              const url = photoViewItem[key as keyof InboundItem] as string | null;
              return url ? { key, label, url } : null;
            })
            .filter((item): item is { key: string; label: string; url: string } => item !== null)}
        />
      )}

      {/* 批次所有照片查看弹窗 */}
      {batchPhotoViewItem && (
        <PhotoViewDialog
          open={!!batchPhotoViewItem}
          onOpenChange={() => setBatchPhotoViewItem(null)}
          title={`批次照片 - ${batchPhotoViewItem.trackingNumber}`}
          photos={(() => {
            const photos: { key: string; label: string; url: string }[] = [];
            const photoFields = [
              { key: 'shipping_label_photo', label: '物流面单' },
              { key: 'lpn_label_photo', label: 'LPN标签' },
              { key: 'packaging_photo_1', label: '包装照片1' },
              { key: 'packaging_photo_2', label: '包装照片2' },
              { key: 'packaging_photo_3', label: '包装照片3' },
              { key: 'packaging_photo_4', label: '包装照片4' },
              { key: 'packaging_photo_5', label: '包装照片5' },
              { key: 'packaging_photo_6', label: '包装照片6' },
              { key: 'accessories_photo', label: '配件照片' },
              { key: 'detail_photo', label: '细节照片' },
              { key: 'product_photo', label: '产品照片' },
              { key: 'package_photo', label: '包裹照片' },
            ] as const;
            
            // 收集批次内所有入库记录的所有照片
            batchPhotoViewItem.items.forEach((item, itemIndex) => {
              photoFields.forEach(({ key, label }) => {
                const url = item[key as keyof InboundItem] as string | null;
                if (url) {
                  photos.push({
                    key: `${key}_${item.id}`,
                    label: batchPhotoViewItem.items.length > 1 
                      ? `${label} (${item.lpn})` 
                      : label,
                    url
                  });
                }
              });
            });
            
            return photos;
          })()}
        />
      )}

      {/* 单独查看物流面单弹窗 */}
      {shippingLabelUrl && (
        <PhotoViewDialog
          open={!!shippingLabelUrl}
          onOpenChange={() => setShippingLabelUrl(null)}
          title="物流面单"
          photos={[{ key: 'shipping_label', label: '物流面单', url: shippingLabelUrl }]}
        />
      )}

      {/* 补传面单对话框 */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>补传物流面单</DialogTitle>
            <DialogDescription>
              为物流号 <code className="bg-muted px-1.5 py-0.5 rounded font-medium">{uploadingBatch?.trackingNumber}</code> 上传面单照片，将应用到该批次的 {uploadingBatch?.totalCount} 条入库记录。
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* 隐藏的文件输入 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            
            {/* 预览区域 */}
            {previewImage ? (
              <div className="relative aspect-video rounded-lg overflow-hidden border bg-muted">
                <img
                  src={previewImage}
                  alt="预览"
                  className="w-full h-full object-contain"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-2 right-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  重新选择
                </Button>
              </div>
            ) : (
              <button
                className="w-full aspect-video rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/50 hover:border-primary/50 hover:bg-muted/70 transition-colors flex flex-col items-center justify-center gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">点击选择图片或拍照</p>
              </button>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadDialogOpen(false);
                setPreviewImage(null);
              }}
              disabled={isUploading}
            >
              取消
            </Button>
            <Button
              onClick={handleUploadConfirm}
              disabled={!previewImage || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  上传中...
                </>
              ) : (
                "确认上传"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
