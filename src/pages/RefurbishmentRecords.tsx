import { useState } from "react";
import { History, Trash2, Eye, Search, X, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { GradeBadge } from "@/components/ui/grade-badge";
import { StatCard } from "@/components/ui/stat-card";
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
import { useInboundItems, useClearRefurbishment, useBulkClearRefurbishment, type InboundItem } from "@/hooks/useInboundItems";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { format } from "date-fns";
import { EmptyState } from "@/components/ui/empty-state";

export default function RefurbishmentRecords() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [viewItem, setViewItem] = useState<InboundItem | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  const { data: inboundItems, isLoading } = useInboundItems();
  const clearRefurbishmentMutation = useClearRefurbishment();
  const bulkClearMutation = useBulkClearRefurbishment();

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

  // 统计
  const stats = {
    total: refurbishedItems.length,
    gradeA: refurbishedItems.filter(i => i.refurbishment_grade === 'A').length,
    gradeB: refurbishedItems.filter(i => i.refurbishment_grade === 'B').length,
    gradeC: refurbishedItems.filter(i => i.refurbishment_grade === 'C').length,
  };

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
    setIsBulkDeleteOpen(true);
  };

  const confirmBatchDelete = () => {
    bulkClearMutation.mutate(selectedItems, {
      onSuccess: () => {
        setSelectedItems([]);
        setIsBulkDeleteOpen(false);
      }
    });
  };

  const handleDeleteSingle = (id: string) => {
    setDeleteId(id);
  };

  const confirmDeleteSingle = () => {
    if (deleteId) {
      clearRefurbishmentMutation.mutate(deleteId, {
        onSuccess: () => {
          setDeleteId(null);
        }
      });
    }
  };

  const handleViewItem = (item: InboundItem) => {
    setViewItem(item);
    setIsViewDialogOpen(true);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setGradeFilter("all");
  };

  const hasActiveFilters = searchQuery || gradeFilter !== "all";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      <PageHeader
        title={t.nav?.refurbishmentRecords || "翻新记录"}
        description="查看所有翻新处理记录"
        badge={
          <Badge variant="outline" className="font-normal">
            共 {refurbishedItems.length} 条
          </Badge>
        }
      />

      {/* 统计卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总翻新"
          value={stats.total}
          icon={History}
          variant="primary"
        />
        <StatCard
          title="A级翻新"
          value={stats.gradeA}
          icon={Package}
          variant="info"
        />
        <StatCard
          title="B级翻新"
          value={stats.gradeB}
          icon={Package}
          variant="warning"
        />
        <StatCard
          title="C级翻新"
          value={stats.gradeC}
          icon={Package}
          variant="destructive"
        />
      </div>

      {/* 筛选区域 */}
      <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索LPN、产品名称、SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background/50"
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
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              清除筛选
            </Button>
          )}
          {hasActiveFilters && (
            <Badge variant="secondary" className="font-normal self-center">
              筛选结果: {filteredItems.length} 条
            </Badge>
          )}
        </div>
      </div>

      {/* 批量操作 */}
      {selectedItems.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm">
              已选择 <strong className="text-primary">{selectedItems.length}</strong> 条记录
            </span>
            <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              批量删除
            </Button>
          </div>
        </div>
      )}

      {/* 记录列表 */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">翻新记录</h3>
          </div>
        </div>
        <div className="p-0">
          {filteredItems.length === 0 ? (
            <EmptyState
              icon={History}
              title="暂无翻新记录"
              description="翻新处理完成后，记录将显示在这里"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="font-semibold">LPN</TableHead>
                    <TableHead className="font-semibold">产品名称</TableHead>
                    <TableHead className="font-semibold">SKU</TableHead>
                    <TableHead className="font-semibold">翻新等级</TableHead>
                    <TableHead className="font-semibold">翻新时间</TableHead>
                    <TableHead className="font-semibold">操作员</TableHead>
                    <TableHead className="text-right font-semibold">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {item.lpn}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <span className="line-clamp-1 font-medium">{item.product_name}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm text-muted-foreground">{item.product_sku}</span>
                      </TableCell>
                      <TableCell>
                        <GradeBadge grade={item.refurbishment_grade as "A" | "B" | "C"} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.refurbished_at 
                          ? format(new Date(item.refurbished_at), "yyyy-MM-dd HH:mm")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.refurbished_by || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewItem(item)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteSingle(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* 查看详情对话框 */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <History className="h-5 w-5 text-primary" />
              </div>
              <span>翻新记录详情 - {viewItem?.lpn}</span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            {viewItem && (
              <div className="space-y-4 py-4">
                {/* 基本信息 */}
                <div className="rounded-xl bg-muted/30 p-4">
                  <h4 className="text-sm font-semibold mb-3 text-foreground">基本信息</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">LPN</p>
                      <p className="font-mono font-medium">{viewItem.lpn}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">产品SKU</p>
                      <p className="font-mono font-medium">{viewItem.product_sku}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">产品名称</p>
                      <p className="font-medium">{viewItem.product_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">翻新等级</p>
                      <GradeBadge grade={viewItem.refurbishment_grade as "A" | "B" | "C"} />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">翻新时间</p>
                      <p className="font-medium">
                        {viewItem.refurbished_at 
                          ? format(new Date(viewItem.refurbished_at), "yyyy-MM-dd HH:mm:ss")
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">操作员</p>
                      <p className="font-medium">{viewItem.refurbished_by || "-"}</p>
                    </div>
                  </div>
                </div>

                {/* 翻新备注 */}
                {viewItem.refurbishment_notes && (
                  <div className="rounded-xl bg-muted/30 p-4">
                    <h4 className="text-sm font-semibold mb-2">翻新备注</h4>
                    <p className="text-sm text-muted-foreground">{viewItem.refurbishment_notes}</p>
                  </div>
                )}

                {/* 照片 */}
                {viewItem.refurbishment_photos && viewItem.refurbishment_photos.length > 0 && (
                  <div className="rounded-xl bg-muted/30 p-4">
                    <h4 className="text-sm font-semibold mb-3">翻新照片 ({viewItem.refurbishment_photos.length})</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {viewItem.refurbishment_photos.map((photo, index) => (
                        <a key={index} href={photo} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={photo} 
                            alt={`翻新照片 ${index + 1}`}
                            className="w-full aspect-square object-cover rounded-lg border-2 border-transparent hover:border-primary/30 transition-all shadow-sm"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* 视频 */}
                {viewItem.refurbishment_videos && viewItem.refurbishment_videos.length > 0 && (
                  <div className="rounded-xl bg-muted/30 p-4">
                    <h4 className="text-sm font-semibold mb-3">翻新视频 ({viewItem.refurbishment_videos.length})</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {viewItem.refurbishment_videos.map((video, index) => (
                        <video 
                          key={index}
                          src={video} 
                          controls
                          className="w-full rounded-lg border shadow-sm"
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

      {/* 单条删除确认对话框 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除翻新记录</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将清除该条目的翻新信息（包括翻新等级、照片、视频等），入库记录将保留。确定要继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteSingle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量删除确认对话框 */}
      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除选中的 <span className="font-semibold text-foreground">{selectedItems.length}</span> 条翻新记录吗？翻新信息将被清除，但入库记录会保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmBatchDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
