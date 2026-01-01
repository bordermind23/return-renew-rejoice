import { useState } from "react";
import { History, Trash2, Eye, Search, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { GradeBadge } from "@/components/ui/grade-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useInboundItems, useDeleteInboundItem, type InboundItem } from "@/hooks/useInboundItems";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { format } from "date-fns";

export default function RefurbishmentRecords() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [viewItem, setViewItem] = useState<InboundItem | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const { data: inboundItems, isLoading } = useInboundItems();
  const deleteMutation = useDeleteInboundItem();

  // 只显示已翻新的记录
  const refurbishedItems = inboundItems?.filter(item => item.refurbishment_grade) || [];

  // 应用筛选
  const filteredItems = refurbishedItems.filter(item => {
    const matchesSearch = 
      item.lpn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product_sku.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesGrade = gradeFilter === "all" || item.refurbishment_grade === gradeFilter;
    
    return matchesSearch && matchesGrade;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(filteredItems.map(item => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, id]);
    } else {
      setSelectedItems(prev => prev.filter(i => i !== id));
    }
  };

  const handleBatchDelete = () => {
    if (selectedItems.length === 0) {
      toast.error("请选择要删除的记录");
      return;
    }

    if (!confirm(`确定要删除 ${selectedItems.length} 条记录吗？`)) {
      return;
    }

    // 逐个删除
    selectedItems.forEach(id => {
      deleteMutation.mutate(id);
    });

    setSelectedItems([]);
    toast.success(`已删除 ${selectedItems.length} 条记录`);
  };

  const handleViewItem = (item: InboundItem) => {
    setViewItem(item);
    setIsViewDialogOpen(true);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setGradeFilter("all");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      <PageHeader
        title={t.nav?.refurbishmentRecords || "翻新记录"}
        description="查看所有翻新处理记录"
      />

      {/* 筛选区域 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索LPN、产品名称、SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="全部等级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部等级</SelectItem>
                <SelectItem value="A">A级</SelectItem>
                <SelectItem value="B">B级</SelectItem>
                <SelectItem value="C">C级</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || gradeFilter !== "all") && (
              <Button variant="ghost" size="icon" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 批量操作 */}
      {selectedItems.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">
                已选择 <strong>{selectedItems.length}</strong> 条记录
              </span>
              <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                批量删除
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 记录列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            翻新记录 ({filteredItems.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t.refurbishment?.noRecords || "暂无翻新记录"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>LPN</TableHead>
                    <TableHead>产品名称</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>翻新等级</TableHead>
                    <TableHead>翻新时间</TableHead>
                    <TableHead>操作员</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.lpn}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.product_name}</TableCell>
                      <TableCell>{item.product_sku}</TableCell>
                      <TableCell>
                        <GradeBadge grade={item.refurbishment_grade as "A" | "B" | "C"} />
                      </TableCell>
                      <TableCell>
                        {item.refurbished_at 
                          ? format(new Date(item.refurbished_at), "yyyy-MM-dd HH:mm")
                          : "-"}
                      </TableCell>
                      <TableCell>{item.refurbished_by || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewItem(item)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 查看详情对话框 */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              翻新记录详情 - {viewItem?.lpn}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            {viewItem && (
              <div className="space-y-4 py-4">
                {/* 基本信息 */}
                <div className="rounded-lg bg-muted/50 p-4">
                  <h4 className="text-sm font-medium mb-3">基本信息</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">LPN</p>
                      <p className="font-medium">{viewItem.lpn}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">产品SKU</p>
                      <p className="font-medium">{viewItem.product_sku}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">产品名称</p>
                      <p className="font-medium">{viewItem.product_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">翻新等级</p>
                      <GradeBadge grade={viewItem.refurbishment_grade as "A" | "B" | "C"} />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">翻新时间</p>
                      <p className="font-medium">
                        {viewItem.refurbished_at 
                          ? format(new Date(viewItem.refurbished_at), "yyyy-MM-dd HH:mm:ss")
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">操作员</p>
                      <p className="font-medium">{viewItem.refurbished_by || "-"}</p>
                    </div>
                  </div>
                </div>

                {/* 翻新备注 */}
                {viewItem.refurbishment_notes && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <h4 className="text-sm font-medium mb-2">翻新备注</h4>
                    <p className="text-sm text-muted-foreground">{viewItem.refurbishment_notes}</p>
                  </div>
                )}

                {/* 照片 */}
                {viewItem.refurbishment_photos && viewItem.refurbishment_photos.length > 0 && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <h4 className="text-sm font-medium mb-3">翻新照片 ({viewItem.refurbishment_photos.length})</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {viewItem.refurbishment_photos.map((photo, index) => (
                        <a key={index} href={photo} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={photo} 
                            alt={`翻新照片 ${index + 1}`}
                            className="w-full aspect-square object-cover rounded-lg border hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* 视频 */}
                {viewItem.refurbishment_videos && viewItem.refurbishment_videos.length > 0 && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <h4 className="text-sm font-medium mb-3">翻新视频 ({viewItem.refurbishment_videos.length})</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {viewItem.refurbishment_videos.map((video, index) => (
                        <video 
                          key={index}
                          src={video} 
                          controls
                          className="w-full rounded-lg border"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
