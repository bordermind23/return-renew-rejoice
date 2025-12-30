import React, { useState, useRef, useMemo } from "react";
import { Search, Filter, Eye, Plus, Trash2, Upload, Download, FileSpreadsheet, ChevronDown, AlertCircle, CheckCircle2, Loader2, Edit, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Camera, Pencil, ChevronUp } from "lucide-react";
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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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
import { GradeBadge } from "@/components/ui/grade-badge";
import { GradeEditDialog } from "@/components/GradeEditDialog";
import { PhotoViewDialog } from "@/components/PhotoViewDialog";
import {
  useOrdersPaginated,
  useOrderStores,
  useCreateOrder,
  useUpdateOrder,
  useDeleteOrder,
  useBulkDeleteOrders,
  useBulkUpdateOrders,
  useBulkCreateOrders,
  type Order,
  type OrderInsert,
  type OrderUpdate,
} from "@/hooks/useOrders";
import { useInboundItems } from "@/hooks/useInboundItems";
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditData, setBulkEditData] = useState<OrderUpdate>({});
  const [gradeEditOrder, setGradeEditOrder] = useState<Order | null>(null);
  const [photoViewOrder, setPhotoViewOrder] = useState<Order | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

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
    grade: null,
  });

  const { data: paginatedData, isLoading } = useOrdersPaginated(currentPage, pageSize, debouncedSearch, storeFilter);
  const { data: stores = [] } = useOrderStores();
  const { data: inboundItems } = useInboundItems();
  const updateOrderMutation = useUpdateOrder();

  // 创建 LPN 到入库记录的映射
  const inboundByLpn = (inboundItems || []).reduce((acc, item) => {
    acc[item.lpn] = item;
    return acc;
  }, {} as Record<string, typeof inboundItems[0]>);

  const [photoViewLpn, setPhotoViewLpn] = useState<string | null>(null);
  const photoInboundItem = photoViewOrder ? inboundByLpn[photoViewOrder.lpn] : null;
  
  // 构建照片列表
  const getPhotoList = (item: typeof inboundItems[0] | undefined) => {
    if (!item) return [];
    const photoFields = [
      { key: 'lpn_label_photo', label: 'LPN标签' },
      { key: 'packaging_photo_1', label: '包装照片1' },
      { key: 'packaging_photo_2', label: '包装照片2' },
      { key: 'packaging_photo_3', label: '包装照片3' },
      { key: 'packaging_photo_4', label: '包装照片4' },
      { key: 'packaging_photo_5', label: '包装照片5' },
      { key: 'packaging_photo_6', label: '包装照片6' },
      { key: 'accessories_photo', label: '配件照片' },
      { key: 'detail_photo', label: '细节照片' },
    ] as const;
    return photoFields
      .filter(f => item[f.key])
      .map(f => ({ key: f.key, label: f.label, url: item[f.key] as string }));
  };

  const handleGradeSave = (grade: string, reason: string, photos: string[]) => {
    if (!gradeEditOrder) return;
    updateOrderMutation.mutate(
      { id: gradeEditOrder.id, grade },
      {
        onSuccess: () => {
          toast.success("等级已更新");
          setGradeEditOrder(null);
        },
      }
    );
  };

  const createMutation = useCreateOrder();
  const deleteMutation = useDeleteOrder();
  const bulkDeleteMutation = useBulkDeleteOrders();
  const bulkUpdateMutation = useBulkUpdateOrders();
  const bulkCreateMutation = useBulkCreateOrders();

  const orders = paginatedData?.data || [];
  const totalCount = paginatedData?.totalCount || 0;
  const totalPages = paginatedData?.totalPages || 1;

  // 按内部订单号分组（只分组有2个或以上LPN的订单）
  const { groupedOrders, singleOrders } = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    orders.forEach(order => {
      const key = order.internal_order_no || `no-group-${order.id}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(order);
    });
    
    const multiLpnGroups: { internalOrderNo: string | null; orders: Order[]; totalQuantity: number }[] = [];
    const singles: Order[] = [];
    
    Object.entries(groups).forEach(([key, items]) => {
      if (items.length >= 2 && !key.startsWith('no-group-')) {
        multiLpnGroups.push({
          internalOrderNo: key,
          orders: items,
          totalQuantity: items.reduce((sum, o) => sum + o.return_quantity, 0),
        });
      } else {
        singles.push(...items);
      }
    });
    
    return { groupedOrders: multiLpnGroups, singleOrders: singles };
  }, [orders]);

  // 切换分组展开/折叠
  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // 展开/折叠全部分组
  const toggleAllGroups = () => {
    if (expandedGroups.size === groupedOrders.length) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(groupedOrders.map(g => g.internalOrderNo || g.orders[0].id)));
    }
  };
  
  // 是否有可折叠的分组
  const hasGroups = groupedOrders.length > 0;

  // 搜索防抖
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(1);
    }, 300);
  };

  // 店铺筛选变化时重置页码
  const handleStoreFilterChange = (value: string) => {
    setStoreFilter(value);
    setCurrentPage(1);
  };

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
      grade: null,
    });
  };

  const handleSubmit = () => {
    if (!formData.lpn || !formData.order_number || !formData.store_name) {
      toast.error("请填写所有必填字段");
      return;
    }

    const existingLpn = orders?.find(o => o.lpn === formData.lpn.trim());
    if (existingLpn) {
      toast.error(`LPN号 "${formData.lpn}" 已存在，不能重复添加`);
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
    if (selectedIds.length === orders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map(item => item.id));
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
          // 存储现有数据的 LPN+订单号 组合
          const existingLpnOrderMap = new Map<string, Set<string>>();
          (orders || []).forEach(o => {
            if (!existingLpnOrderMap.has(o.lpn)) {
              existingLpnOrderMap.set(o.lpn, new Set());
            }
            existingLpnOrderMap.get(o.lpn)!.add(o.order_number);
          });
          
          // 存储导入文件中的 LPN+订单号 组合
          const importedLpnOrderMap = new Map<string, Set<string>>();

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

            // 检查系统中是否存在相同 LPN 且相同订单号
            if (existingLpnOrderMap.has(lpn) && existingLpnOrderMap.get(lpn)!.has(orderNumber)) {
              errors.push({ row: rowIndex, message: `第${rowIndex}行：LPN号 "${lpn}" 与订单号 "${orderNumber}" 的组合已存在于系统中` });
              continue;
            }

            // 检查导入文件中是否存在相同 LPN 且相同订单号
            if (importedLpnOrderMap.has(lpn) && importedLpnOrderMap.get(lpn)!.has(orderNumber)) {
              errors.push({ row: rowIndex, message: `第${rowIndex}行：LPN号 "${lpn}" 与订单号 "${orderNumber}" 的组合在导入文件中重复` });
              continue;
            }

            // 记录当前行的 LPN+订单号 组合
            if (!importedLpnOrderMap.has(lpn)) {
              importedLpnOrderMap.set(lpn, new Set());
            }
            importedLpnOrderMap.get(lpn)!.add(orderNumber);

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
              grade: null,
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
          <div className="flex gap-2 flex-wrap justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Upload className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">批量导入</span>
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
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

            <Button variant="outline" size="sm" className="h-9" onClick={handleExportExcel}>
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">批量导出</span>
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gradient-primary h-9" size="sm">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">创建订单</span>
                  <span className="sm:hidden">新建</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>创建新订单</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5">
                    <div className="sticky top-0 bg-destructive/10 px-4 py-2 border-b border-destructive/20">
                      <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        错误详情 ({importProgress.errors.length} 条)
                      </p>
                    </div>
                    <div className="divide-y divide-destructive/10">
                      {importProgress.errors.map((error, index) => (
                        <div key={index} className="px-4 py-2.5 hover:bg-destructive/5">
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-8 h-5 rounded bg-destructive/20 text-destructive text-xs font-bold flex items-center justify-center">
                              {error.row > 0 ? `#${error.row}` : "!"}
                            </span>
                            <p className="text-sm text-destructive/90 leading-relaxed">{error.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
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
          <CardContent className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span className="text-sm font-medium">已选择 {selectedIds.length} 条记录</span>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setIsBulkEditOpen(true)}>
                <Edit className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">批量编辑</span>
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">批量删除</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>取消</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 筛选 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索订单号、LPN或店铺名称..." value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)} className="pl-10" />
        </div>
        <Select value={storeFilter} onValueChange={handleStoreFilterChange}>
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
        {/* 展开/折叠全部分组（仅当有分组时显示） */}
        {hasGroups && (
          <Button
            variant="outline"
            size="sm"
            className="h-10"
            onClick={toggleAllGroups}
          >
            {expandedGroups.size === groupedOrders.length ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            <span className="hidden sm:inline">{expandedGroups.size === groupedOrders.length ? "折叠全部" : "展开全部"}</span>
          </Button>
        )}
      </div>

      {/* 数据表格 */}
      <Card>
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-10">
                  <Checkbox checked={selectedIds.length === orders.length && orders.length > 0} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead className="font-semibold min-w-[110px]">内部订单号</TableHead>
                <TableHead className="font-semibold min-w-[100px]">LPN编号</TableHead>
                <TableHead className="font-semibold min-w-[120px]">产品名称</TableHead>
                <TableHead className="font-semibold min-w-[100px]">产品SKU</TableHead>
                <TableHead className="font-semibold min-w-[70px] text-center">等级</TableHead>
                <TableHead className="font-semibold min-w-[60px] text-center">照片</TableHead>
                <TableHead className="font-semibold min-w-[80px]">店铺</TableHead>
                <TableHead className="font-semibold min-w-[60px]">国家</TableHead>
                <TableHead className="font-semibold min-w-[100px]">退货原因</TableHead>
                <TableHead className="font-semibold min-w-[60px] text-center">退货数量</TableHead>
                <TableHead className="font-semibold min-w-[80px]">订单号</TableHead>
                <TableHead className="font-semibold min-w-[80px] text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="h-32 text-center text-muted-foreground">暂无订单记录</TableCell>
                </TableRow>
              ) : (
                <>
                  {/* 分组订单（2+个LPN） */}
                  {groupedOrders.map((group) => {
                    const groupKey = group.internalOrderNo || group.orders[0].id;
                    const isExpanded = expandedGroups.has(groupKey);
                    const firstOrder = group.orders[0];
                    
                    return (
                      <React.Fragment key={`group-${groupKey}`}>
                        {/* 分组头部行 */}
                        <TableRow 
                          className="bg-primary/5 hover:bg-primary/10 cursor-pointer"
                          onClick={() => toggleGroup(groupKey)}
                        >
                          <TableCell>
                            <Checkbox 
                              checked={group.orders.every(o => selectedIds.includes(o.id))} 
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedIds(prev => [...new Set([...prev, ...group.orders.map(o => o.id)])]);
                                } else {
                                  setSelectedIds(prev => prev.filter(id => !group.orders.some(o => o.id === id)));
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); toggleGroup(groupKey); }}>
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                              <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-semibold">
                                {group.internalOrderNo || "未分组"}
                              </code>
                              <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full bg-primary/20 text-primary text-xs font-semibold">
                                {group.orders.length} LPN
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground text-xs">展开查看</span>
                          </TableCell>
                          <TableCell><span className="line-clamp-1 font-medium">{firstOrder.product_name || "-"}</span></TableCell>
                          <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{firstOrder.product_sku || "-"}</code></TableCell>
                          <TableCell className="text-center text-muted-foreground">-</TableCell>
                          <TableCell className="text-center text-muted-foreground">-</TableCell>
                          <TableCell className="text-muted-foreground">{firstOrder.store_name}</TableCell>
                          <TableCell className="text-muted-foreground">{firstOrder.country || "-"}</TableCell>
                          <TableCell className="text-muted-foreground">-</TableCell>
                          <TableCell className="text-center font-semibold">{group.totalQuantity}</TableCell>
                          <TableCell className="font-medium">{firstOrder.order_number}</TableCell>
                          <TableCell>
                            <div className="flex justify-center gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setSelectedOrder(firstOrder); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {/* 展开后的子行 */}
                        {isExpanded && group.orders.map((item) => {
                          const inboundItem = inboundByLpn[item.lpn];
                          const hasPhotos = inboundItem?.product_photo || inboundItem?.package_photo;
                          const displayGrade = item.grade || inboundItem?.grade;
                          
                          return (
                            <TableRow key={item.id} className="bg-muted/20 hover:bg-muted/30 border-l-2 border-l-primary/50">
                              <TableCell>
                                <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                              </TableCell>
                              <TableCell>
                                <div className="pl-8 text-muted-foreground text-xs">└</div>
                              </TableCell>
                              <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">{item.lpn}</code></TableCell>
                              <TableCell><span className="line-clamp-1 text-sm">{item.product_name || "-"}</span></TableCell>
                              <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.product_sku || "-"}</code></TableCell>
                              <TableCell className="text-center">
                                <button
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors"
                                  onClick={() => setGradeEditOrder(item)}
                                >
                                  {displayGrade ? <GradeBadge grade={displayGrade as "A" | "B" | "C"} /> : <span className="text-muted-foreground text-xs">未评级</span>}
                                  <Pencil className="h-3 w-3 text-muted-foreground" />
                                </button>
                              </TableCell>
                              <TableCell className="text-center">
                                {hasPhotos ? (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-primary"
                                    onClick={() => setPhotoViewOrder(item)}
                                  >
                                    <Camera className="h-3.5 w-3.5" />
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">{item.store_name}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{item.country || "-"}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{item.return_reason || "-"}</TableCell>
                              <TableCell className="text-center text-sm">{item.return_quantity}</TableCell>
                              <TableCell className="text-sm">{item.order_number}</TableCell>
                              <TableCell>
                                <div className="flex justify-center gap-1">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedOrder(item)}>
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                  
                  {/* 单个LPN订单 */}
                  {singleOrders.map((item) => {
                    const inboundItem = inboundByLpn[item.lpn];
                    const hasPhotos = inboundItem?.product_photo || inboundItem?.package_photo;
                    const displayGrade = item.grade || inboundItem?.grade;
                    
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                            {item.internal_order_no || "-"}
                          </code>
                        </TableCell>
                        <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">{item.lpn}</code></TableCell>
                        <TableCell><span className="line-clamp-1">{item.product_name || "-"}</span></TableCell>
                        <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.product_sku || "-"}</code></TableCell>
                        <TableCell className="text-center">
                          <button
                            className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors"
                            onClick={() => setGradeEditOrder(item)}
                          >
                            {displayGrade ? <GradeBadge grade={displayGrade as "A" | "B" | "C"} /> : <span className="text-muted-foreground text-xs">未评级</span>}
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          {hasPhotos ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-primary"
                              onClick={() => setPhotoViewOrder(item)}
                            >
                              <Camera className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
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
                    );
                  })}
                </>
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>

      {/* 分页控件 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>共 {totalCount} 条记录</span>
          <div className="flex items-center gap-2">
            <span>每页</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span>条</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            第 {currentPage} / {totalPages} 页
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 订单详情 */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>订单详情</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4 text-sm">
              <div><p className="text-muted-foreground">内部订单号</p><p className="font-mono font-medium text-primary">{selectedOrder.internal_order_no || "-"}</p></div>
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

      {/* 等级修改弹窗 */}
      <GradeEditDialog
        open={!!gradeEditOrder}
        onOpenChange={() => setGradeEditOrder(null)}
        lpn={gradeEditOrder?.lpn || ""}
        currentGrade={gradeEditOrder?.grade || null}
        onSave={handleGradeSave}
        isLoading={updateOrderMutation.isPending}
      />

      {/* 照片查看弹窗 */}
      <PhotoViewDialog
        open={!!photoViewOrder}
        onOpenChange={() => setPhotoViewOrder(null)}
        title={`产品照片 - ${photoViewOrder?.lpn || ""}`}
        photos={getPhotoList(photoInboundItem)}
      />
    </div>
  );
}