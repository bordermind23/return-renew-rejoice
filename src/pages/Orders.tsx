import { useState, useRef } from "react";
import { Search, Filter, Eye, Plus, Trash2, Upload, Download, FileSpreadsheet, ChevronDown, AlertCircle, CheckCircle2, Loader2, Edit, SquareCheck, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useOrders,
  useCreateOrder,
  useDeleteOrder,
  useBulkDeleteOrders,
  useBulkUpdateOrders,
  useBulkCreateOrders,
  type Order,
  type OrderInsert,
  type OrderUpdate,
} from "@/hooks/useOrders";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ImportError {
  row: number;
  message: string;
}

interface ImportProgress {
  isImporting: boolean;
  total: number;
  processed: number;
  errors: ImportError[];
  showResult: boolean;
  successCount: number;
}

// 模板字段
const templateHeaders = [
  "LPN编号", "产品名称", "买家备注", "退货原因", "库存属性", "店铺", "国家",
  "产品SKU", "订单号", "MSKU", "ASIN", "FNSKU", "退货数量", "发货仓库编号",
  "退货时间", "订购时间"
];

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditData, setBulkEditData] = useState<OrderUpdate>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importProgress, setImportProgress] = useState<ImportProgress>({
    isImporting: false,
    total: 0,
    processed: 0,
    errors: [],
    showResult: false,
    successCount: 0,
  });

  const [formData, setFormData] = useState<OrderInsert>({
    lpn: "",
    removal_order_id: "",
    order_number: "",
    store_name: "",
    station: "",
    removed_at: null,
    inbound_at: null,
    product_name: null,
    buyer_note: null,
    return_reason: null,
    inventory_attribute: null,
    country: null,
    product_sku: null,
    msku: null,
    asin: null,
    fnsku: null,
    return_quantity: 1,
    warehouse_location: null,
    return_time: null,
    order_time: null,
  });

  const { data: orders, isLoading } = useOrders();
  const createMutation = useCreateOrder();
  const deleteMutation = useDeleteOrder();
  const bulkDeleteMutation = useBulkDeleteOrders();
  const bulkUpdateMutation = useBulkUpdateOrders();
  const bulkCreateMutation = useBulkCreateOrders();

  const filteredData = (orders || []).filter((item) => {
    const matchesSearch =
      item.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.lpn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.product_name || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStore =
      storeFilter === "all" || item.store_name === storeFilter;

    return matchesSearch && matchesStore;
  });

  const stores = [...new Set((orders || []).map((o) => o.store_name))];

  const resetForm = () => {
    setFormData({
      lpn: "",
      removal_order_id: "",
      order_number: "",
      store_name: "",
      station: "",
      removed_at: null,
      inbound_at: null,
      product_name: null,
      buyer_note: null,
      return_reason: null,
      inventory_attribute: null,
      country: null,
      product_sku: null,
      msku: null,
      asin: null,
      fnsku: null,
      return_quantity: 1,
      warehouse_location: null,
      return_time: null,
      order_time: null,
    });
  };

  const handleSubmit = () => {
    if (!formData.lpn || !formData.order_number || !formData.store_name) {
      toast.error("请填写所有必填字段");
      return;
    }

    // 检查LPN+订单号组合是否重复
    const existingOrder = orders?.find(
      o => o.lpn === formData.lpn.trim() && o.order_number === formData.order_number.trim()
    );
    if (existingOrder) {
      toast.error(`LPN "${formData.lpn}" 与订单号 "${formData.order_number}" 的组合已存在，不能重复添加`);
      return;
    }

    createMutation.mutate(
      {
        ...formData,
        removed_at: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          resetForm();
        },
      }
    );
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  // 批量选择
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map(item => item.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // 批量删除
  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(selectedIds, {
      onSuccess: () => {
        setIsBulkDeleteOpen(false);
        setSelectedIds([]);
      }
    });
  };

  // 批量编辑
  const handleBulkEdit = () => {
    const updates: OrderUpdate = {};
    if (bulkEditData.store_name) updates.store_name = bulkEditData.store_name;
    if (bulkEditData.country) updates.country = bulkEditData.country;
    if (bulkEditData.inventory_attribute) updates.inventory_attribute = bulkEditData.inventory_attribute;

    if (Object.keys(updates).length === 0) {
      toast.error("请选择要更新的字段");
      return;
    }

    bulkUpdateMutation.mutate({ ids: selectedIds, updates }, {
      onSuccess: () => {
        setIsBulkEditOpen(false);
        setSelectedIds([]);
        setBulkEditData({});
      }
    });
  };

  // 下载模板
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      templateHeaders,
      ["LPN123456", "示例产品", "请小心处理", "商品有缺陷", "可售", "示例店铺", "美国", "SKU-001", "ORDER-001", "MSKU-001", "B08XXX", "FNSKU-001", "1", "0", "2024-01-15", "2024-01-10", "REMOVAL-001", "FBA-US"]
    ]);
    ws["!cols"] = templateHeaders.map(() => ({ wch: 15 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "退货订单模板");
    XLSX.writeFile(wb, "退货订单导入模板.xlsx");
    toast.success("模板下载成功");
  };

  // 验证行数据
  const validateRow = (row: string[], rowIndex: number): { valid: boolean; error?: string } => {
    if (!row[0]?.trim()) return { valid: false, error: `第${rowIndex}行：LPN编号不能为空` };
    if (!row[5]?.trim()) return { valid: false, error: `第${rowIndex}行：店铺不能为空` };
    if (!row[8]?.trim()) return { valid: false, error: `第${rowIndex}行：订单号不能为空` };
    return { valid: true };
  };

  // 导入文件
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportProgress({
      isImporting: true,
      total: 0,
      processed: 0,
      errors: [],
      showResult: false,
      successCount: 0,
    });

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });

          if (jsonData.length < 2) {
            toast.error("文件中没有数据");
            setImportProgress(prev => ({ ...prev, isImporting: false }));
            return;
          }

          const dataRows = jsonData.slice(1).filter(row => row.length > 0 && row.some(cell => cell));
          setImportProgress(prev => ({ ...prev, total: dataRows.length }));

          const errors: ImportError[] = [];
          const validItems: OrderInsert[] = [];
          // 创建已存在的LPN+订单号组合集合
          const existingCombinations = new Set(
            (orders || []).map(o => `${o.lpn}|${o.order_number}`)
          );
          const importedCombinations = new Set<string>();

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const rowIndex = i + 2;

            const validation = validateRow(row, rowIndex);
            if (!validation.valid) {
              errors.push({ row: rowIndex, message: validation.error! });
              continue;
            }

            const lpn = String(row[0]).trim();
            const orderNumber = String(row[8]).trim();
            const combination = `${lpn}|${orderNumber}`;

            if (existingCombinations.has(combination)) {
              errors.push({ row: rowIndex, message: `第${rowIndex}行：LPN "${lpn}" 与订单号 "${orderNumber}" 的组合已存在于系统中` });
              continue;
            }

            if (importedCombinations.has(combination)) {
              errors.push({ row: rowIndex, message: `第${rowIndex}行：LPN "${lpn}" 与订单号 "${orderNumber}" 的组合在导入文件中重复` });
              continue;
            }

            importedCombinations.add(combination);

            validItems.push({
              lpn,
              product_name: row[1] ? String(row[1]).trim() : null,
              buyer_note: row[2] ? String(row[2]).trim() : null,
              return_reason: row[3] ? String(row[3]).trim() : null,
              inventory_attribute: row[4] ? String(row[4]).trim() : null,
              store_name: String(row[5]).trim(),
              country: row[6] ? String(row[6]).trim() : null,
              product_sku: row[7] ? String(row[7]).trim() : null,
              order_number: String(row[8]).trim(),
              msku: row[9] ? String(row[9]).trim() : null,
              asin: row[10] ? String(row[10]).trim() : null,
              fnsku: row[11] ? String(row[11]).trim() : null,
              return_quantity: parseInt(String(row[12])) || 1,
              warehouse_location: row[13] ? String(row[13]).trim() : null,
              return_time: row[14] ? String(row[14]).trim() : null,
              order_time: row[15] ? String(row[15]).trim() : null,
              removal_order_id: "",
              station: "",
              removed_at: new Date().toISOString(),
              inbound_at: null,
            });
          }

          setImportProgress(prev => ({ ...prev, processed: dataRows.length, errors }));

          if (validItems.length === 0) {
            setImportProgress(prev => ({ ...prev, isImporting: false, showResult: true }));
            return;
          }

          bulkCreateMutation.mutate(validItems, {
            onSuccess: (data) => {
              setImportProgress(prev => ({
                ...prev,
                isImporting: false,
                showResult: true,
                successCount: data.length,
              }));
            },
            onError: (error) => {
              setImportProgress(prev => ({
                ...prev,
                isImporting: false,
                showResult: true,
                errors: [...prev.errors, { row: 0, message: `数据库写入失败: ${error.message}` }],
              }));
            }
          });
        } catch (error) {
          toast.error("解析文件失败");
          setImportProgress(prev => ({ ...prev, isImporting: false }));
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      toast.error("读取文件失败");
      setImportProgress(prev => ({ ...prev, isImporting: false }));
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 导出
  const handleExportExcel = () => {
    if (!orders || orders.length === 0) {
      toast.error("没有数据可导出");
      return;
    }

    const exportData = [
      templateHeaders,
      ...orders.map((item) => [
        item.lpn,
        item.product_name || "",
        item.buyer_note || "",
        item.return_reason || "",
        item.inventory_attribute || "",
        item.store_name,
        item.country || "",
        item.product_sku || "",
        item.order_number,
        item.msku || "",
        item.asin || "",
        item.fnsku || "",
        item.return_quantity,
        item.warehouse_location || "",
        item.return_time || "",
        item.order_time || "",
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(exportData);
    ws["!cols"] = templateHeaders.map(() => ({ wch: 15 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "退货订单列表");
    XLSX.writeFile(wb, `退货订单列表_${new Date().toLocaleDateString("zh-CN")}.xlsx`);
    toast.success("导出成功");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="退货订单列表"
        description="查看和管理所有退货订单"
        actions={
          <div className="flex gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  批量导入
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadTemplate}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  下载模板
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  导入文件
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
            />

            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="mr-2 h-4 w-4" />
              批量导出
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gradient-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  创建订单
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>创建新订单</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lpn">LPN编号 *</Label>
                      <Input id="lpn" value={formData.lpn} onChange={(e) => setFormData({ ...formData, lpn: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="order_number">订单号 *</Label>
                      <Input id="order_number" value={formData.order_number} onChange={(e) => setFormData({ ...formData, order_number: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="store_name">店铺 *</Label>
                      <Input id="store_name" value={formData.store_name} onChange={(e) => setFormData({ ...formData, store_name: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="product_name">产品名称</Label>
                      <Input id="product_name" value={formData.product_name || ""} onChange={(e) => setFormData({ ...formData, product_name: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="product_sku">产品SKU</Label>
                      <Input id="product_sku" value={formData.product_sku || ""} onChange={(e) => setFormData({ ...formData, product_sku: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="warehouse_location">发货仓库编号</Label>
                      <Input id="warehouse_location" value={formData.warehouse_location || ""} onChange={(e) => setFormData({ ...formData, warehouse_location: e.target.value || null })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country">国家</Label>
                      <Input id="country" value={formData.country || ""} onChange={(e) => setFormData({ ...formData, country: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fnsku">FNSKU</Label>
                      <Input id="fnsku" value={formData.fnsku || ""} onChange={(e) => setFormData({ ...formData, fnsku: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="asin">ASIN</Label>
                      <Input id="asin" value={formData.asin || ""} onChange={(e) => setFormData({ ...formData, asin: e.target.value || null })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="msku">MSKU</Label>
                      <Input id="msku" value={formData.msku || ""} onChange={(e) => setFormData({ ...formData, msku: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="return_reason">退货原因</Label>
                      <Input id="return_reason" value={formData.return_reason || ""} onChange={(e) => setFormData({ ...formData, return_reason: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inventory_attribute">库存属性</Label>
                      <Input id="inventory_attribute" value={formData.inventory_attribute || ""} onChange={(e) => setFormData({ ...formData, inventory_attribute: e.target.value || null })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="return_quantity">退货数量</Label>
                      <Input id="return_quantity" type="number" value={formData.return_quantity} onChange={(e) => setFormData({ ...formData, return_quantity: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="buyer_note">买家备注</Label>
                      <Input id="buyer_note" value={formData.buyer_note || ""} onChange={(e) => setFormData({ ...formData, buyer_note: e.target.value || null })} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>取消</Button>
                  <Button onClick={handleSubmit} disabled={createMutation.isPending}>创建</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* 导入进度 */}
      {(importProgress.isImporting || importProgress.showResult) && (
        <Card>
          <CardContent className="pt-6">
            {importProgress.isImporting ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="font-medium">正在导入数据...</span>
                </div>
                <Progress value={(importProgress.processed / importProgress.total) * 100} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {importProgress.errors.length === 0 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                    <span className="font-medium">
                      导入完成：成功 {importProgress.successCount} 条
                      {importProgress.errors.length > 0 && `，失败 ${importProgress.errors.length} 条`}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setImportProgress(prev => ({ ...prev, showResult: false }))}>关闭</Button>
                </div>
                {importProgress.errors.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg bg-destructive/10 p-3">
                    <p className="mb-2 text-sm font-medium text-destructive">错误详情：</p>
                    <ul className="space-y-1 text-sm text-destructive">
                      {importProgress.errors.map((error, index) => (
                        <li key={index}>{error.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 批量操作栏 */}
      {selectedIds.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-sm font-medium">已选择 {selectedIds.length} 条记录</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsBulkEditOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                批量编辑
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                批量删除
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>取消选择</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 筛选 */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索订单号、LPN或店铺名称..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="店铺筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部店铺</SelectItem>
            {stores.map((store) => (
              <SelectItem key={store} value={store}>{store}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 数据表格 */}
      <Card>
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-10">
                  <Checkbox checked={selectedIds.length === filteredData.length && filteredData.length > 0} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead className="font-semibold min-w-[100px]">LPN编号</TableHead>
                <TableHead className="font-semibold min-w-[120px]">产品名称</TableHead>
                <TableHead className="font-semibold min-w-[100px]">产品SKU</TableHead>
                <TableHead className="font-semibold min-w-[80px]">店铺</TableHead>
                <TableHead className="font-semibold min-w-[60px]">国家</TableHead>
                <TableHead className="font-semibold min-w-[100px]">退货原因</TableHead>
                <TableHead className="font-semibold min-w-[60px] text-center">退货数量</TableHead>
                <TableHead className="font-semibold min-w-[80px]">订单号</TableHead>
                <TableHead className="font-semibold min-w-[80px] text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">暂无订单记录</TableCell>
                </TableRow>
              ) : (
                filteredData.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell>
                      <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                    </TableCell>
                    <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">{item.lpn}</code></TableCell>
                    <TableCell><span className="line-clamp-1">{item.product_name || "-"}</span></TableCell>
                    <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.product_sku || "-"}</code></TableCell>
                    <TableCell className="text-muted-foreground">{item.store_name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.country || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{item.return_reason || "-"}</TableCell>
                    <TableCell className="text-center font-semibold">{item.return_quantity}</TableCell>
                    <TableCell className="font-medium">{item.order_number}</TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedOrder(item)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>

      <div className="text-sm text-muted-foreground">共 {filteredData.length} 条记录</div>

      {/* 订单详情 */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>订单详情</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4 text-sm">
              <div><p className="text-muted-foreground">LPN编号</p><p className="font-mono font-medium">{selectedOrder.lpn}</p></div>
              <div><p className="text-muted-foreground">订单号</p><p className="font-medium">{selectedOrder.order_number}</p></div>
              <div><p className="text-muted-foreground">产品名称</p><p className="font-medium">{selectedOrder.product_name || "-"}</p></div>
              <div><p className="text-muted-foreground">产品SKU</p><p className="font-medium">{selectedOrder.product_sku || "-"}</p></div>
              <div><p className="text-muted-foreground">店铺</p><p className="font-medium">{selectedOrder.store_name}</p></div>
              <div><p className="text-muted-foreground">国家</p><p className="font-medium">{selectedOrder.country || "-"}</p></div>
              <div><p className="text-muted-foreground">退货原因</p><p className="font-medium">{selectedOrder.return_reason || "-"}</p></div>
              <div><p className="text-muted-foreground">买家备注</p><p className="font-medium">{selectedOrder.buyer_note || "-"}</p></div>
              <div><p className="text-muted-foreground">退货数量</p><p className="font-medium">{selectedOrder.return_quantity}</p></div>
              <div><p className="text-muted-foreground">发货仓库编号</p><p className="font-medium">{selectedOrder.warehouse_location || "-"}</p></div>
              <div><p className="text-muted-foreground">FNSKU</p><p className="font-medium">{selectedOrder.fnsku || "-"}</p></div>
              <div><p className="text-muted-foreground">ASIN</p><p className="font-medium">{selectedOrder.asin || "-"}</p></div>
              <div><p className="text-muted-foreground">MSKU</p><p className="font-medium">{selectedOrder.msku || "-"}</p></div>
              <div><p className="text-muted-foreground">库存属性</p><p className="font-medium">{selectedOrder.inventory_attribute || "-"}</p></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 批量编辑对话框 */}
      <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量编辑 ({selectedIds.length} 条记录)</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>店铺</Label>
              <Input value={bulkEditData.store_name || ""} onChange={(e) => setBulkEditData({ ...bulkEditData, store_name: e.target.value || undefined })} placeholder="留空则不更新" />
            </div>
            <div className="space-y-2">
              <Label>国家</Label>
              <Input value={bulkEditData.country || ""} onChange={(e) => setBulkEditData({ ...bulkEditData, country: e.target.value || undefined })} placeholder="留空则不更新" />
            </div>
            <div className="space-y-2">
              <Label>库存属性</Label>
              <Input value={bulkEditData.inventory_attribute || ""} onChange={(e) => setBulkEditData({ ...bulkEditData, inventory_attribute: e.target.value || undefined })} placeholder="留空则不更新" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setIsBulkEditOpen(false); setBulkEditData({}); }}>取消</Button>
            <Button onClick={handleBulkEdit} disabled={bulkUpdateMutation.isPending}>确认更新</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>此操作无法撤销，确定要删除此订单吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量删除确认 */}
      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>确定要删除选中的 {selectedIds.length} 条订单吗？此操作无法撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}