import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Package, Trash2, Image, CheckSquare, Square, Minus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { GradeBadge } from "@/components/ui/grade-badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { type InboundItem } from "@/hooks/useInboundItems";
import { cn } from "@/lib/utils";

interface InboundBatchListProps {
  items: InboundItem[];
  onDelete: (id: string) => void;
  onBatchDelete?: (ids: string[]) => void;
  enableBatchSelect?: boolean;
}

interface BatchGroup {
  trackingNumber: string;
  items: InboundItem[];
  totalCount: number;
  latestProcessedAt: string;
  productName: string;
  productSku: string;
}

export function InboundBatchList({ items, onDelete, onBatchDelete, enableBatchSelect = false }: InboundBatchListProps) {
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [photoViewItem, setPhotoViewItem] = useState<InboundItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const getPhotoCount = (item: InboundItem) => {
    const photoFields = [
      'lpn_label_photo', 'packaging_photo_1', 'packaging_photo_2', 
      'packaging_photo_3', 'packaging_photo_4', 'packaging_photo_5',
      'packaging_photo_6', 'accessories_photo', 'detail_photo',
      'product_photo', 'package_photo'
    ] as const;
    return photoFields.filter(field => item[field]).length;
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
    <div className="space-y-3">
      {/* 批量操作栏 */}
      {enableBatchSelect && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
              {...(someSelected ? { "data-state": "indeterminate" } : {})}
            />
            <span className="text-sm text-muted-foreground">
              {selectedIds.size > 0 
                ? `已选择 ${selectedIds.size} 条记录` 
                : "全选"}
            </span>
          </div>
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBatchDelete}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              批量删除 ({selectedIds.size})
            </Button>
          )}
        </div>
      )}

      {batches.map((batch) => {
        const batchSelectState = getBatchSelectState(batch);
        return (
          <Collapsible
            key={batch.trackingNumber}
            open={expandedBatches.has(batch.trackingNumber)}
            onOpenChange={() => toggleBatch(batch.trackingNumber)}
          >
            <Card className="overflow-hidden">
              <div className="flex items-center">
                {enableBatchSelect && (
                  <div 
                    className="pl-4 py-4 flex-shrink-0"
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
                    "flex-1 p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left",
                    enableBatchSelect && "pl-2"
                  )}>
                    <div className="flex-shrink-0">
                      {expandedBatches.has(batch.trackingNumber) ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{batch.trackingNumber}</span>
                        <Badge variant="secondary" className="flex-shrink-0">
                          {batch.totalCount} 件
                        </Badge>
                        {batch.items.some(item => item.product_sku === "待同步") && (
                          <Badge variant="outline" className="flex-shrink-0 border-amber-500 text-amber-600 bg-amber-50">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            待同步
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {batch.productName} · {batch.productSku}
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground flex-shrink-0">
                      <p>{new Date(batch.latestProcessedAt).toLocaleDateString("zh-CN")}</p>
                      <p>{new Date(batch.latestProcessedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </button>
                </CollapsibleTrigger>
              </div>
              
              <CollapsibleContent>
                <div className="border-t">
                  <ScrollArea className="w-full">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          {enableBatchSelect && (
                            <TableHead className="w-[50px]"></TableHead>
                          )}
                          <TableHead className="font-semibold min-w-[100px]">LPN号</TableHead>
                          <TableHead className="font-semibold min-w-[80px]">级别</TableHead>
                          <TableHead className="font-semibold min-w-[120px]">缺少配件</TableHead>
                          <TableHead className="font-semibold min-w-[60px] text-center">照片</TableHead>
                          <TableHead className="font-semibold min-w-[130px]">处理时间</TableHead>
                          <TableHead className="font-semibold min-w-[60px] text-center">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batch.items.map((item) => {
                          const photoCount = getPhotoCount(item);
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
                                <div className="flex items-center gap-2">
                                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">
                                    {item.lpn}
                                  </code>
                                  {item.product_sku === "待同步" && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500 text-amber-600 bg-amber-50">
                                      待同步
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <GradeBadge grade={item.grade as "A" | "B" | "C"} />
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
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {/* 照片查看弹窗 */}
      <Dialog open={!!photoViewItem} onOpenChange={() => setPhotoViewItem(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>产品照片 - {photoViewItem?.lpn}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            {photoViewItem && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-1">
                {[
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
                ].map(({ key, label }) => {
                  const url = photoViewItem[key as keyof InboundItem] as string | null;
                  if (!url) return null;
                  return (
                    <div key={key} className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">{label}</p>
                      <div className="aspect-square rounded-lg border overflow-hidden bg-muted">
                        <img
                          src={url}
                          alt={label}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
