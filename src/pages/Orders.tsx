import React, { useState, useRef, useMemo } from "react";
import { Eye, Plus, Trash2, Upload, Download, FileSpreadsheet, ChevronDown, AlertCircle, CheckCircle2, Loader2, Edit, ChevronUp, Package, Wrench, X, ChevronLeft, ChevronRight, RefreshCw, Settings2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { GradeBadge } from "@/components/ui/grade-badge";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { GradeEditDialog } from "@/components/GradeEditDialog";
import { ImageLightbox } from "@/components/ui/image-lightbox";

import { OrderFilters } from "@/components/orders/OrderFilters";
import { OrderStatsCards } from "@/components/orders/OrderStatsCards";
import { OrderPagination } from "@/components/orders/OrderPagination";
import { OrderTableRow } from "@/components/orders/OrderTableRow";
import { QuickFilters, type QuickFilterPreset } from "@/components/orders/QuickFilters";
import { BulkStatusDialog } from "@/components/orders/BulkStatusDialog";
import { BulkGradeDialog } from "@/components/orders/BulkGradeDialog";
import {
  useOrdersPaginated,
  useOrderStores,
  useOrderStats,
  useCreateOrder,
  useUpdateOrder,
  useDeleteOrder,
  useBulkDeleteOrders,
  useBulkUpdateOrders,
  useBulkCreateOrders,
  useSyncPendingRecords,
  type Order,
  type OrderInsert,
  type OrderUpdate,
} from "@/hooks/useOrders";
import { useInboundItems } from "@/hooks/useInboundItems";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
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

const templateHeaders = [
  "LPN编号", "产品名称", "买家备注", "退货原因", "库存属性", "店铺", "国家",
  "产品SKU", "订单号", "MSKU", "ASIN", "FNSKU", "退货数量", "发货仓库编号",
  "退货时间", "订购时间"
];

const formatFileSize = (bytes: number | null): string => {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function Orders() {
  const { can } = usePermissions();
  const canManageOrders = can.manageOrders;
  const canDeleteData = can.deleteData;
  
  // 图片大小状态
  const [photoSizes, setPhotoSizes] = useState<Record<string, number | null>>({});

  // 获取图片大小
  const fetchPhotoSize = async (url: string) => {
    if (photoSizes[url] !== undefined) return;
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const size = response.headers.get('content-length');
      setPhotoSizes(prev => ({ ...prev, [url]: size ? parseInt(size) : null }));
    } catch {
      setPhotoSizes(prev => ({ ...prev, [url]: null }));
    }
  };
  // 筛选状态
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [statusFilters, setStatusFilters] = useState<("未到货" | "到货" | "出库")[]>([]);
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // 对话框状态
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isBulkStatusOpen, setIsBulkStatusOpen] = useState(false);
  const [isBulkGradeOpen, setIsBulkGradeOpen] = useState(false);
  const [gradeEditOrder, setGradeEditOrder] = useState<Order | null>(null);
  
  // 图片查看器状态
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  
  // 快速筛选
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);
  
  // 选择状态
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // 批量编辑数据
  const [bulkEditData, setBulkEditData] = useState<OrderUpdate>({});
  
  // 导入相关
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

  // 表单数据
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

  // 数据查询
  const { data: paginatedData, isLoading } = useOrdersPaginated(currentPage, pageSize, { 
    searchTerm: debouncedSearch, 
    storeFilter, 
    statusFilters, 
    gradeFilter 
  });
  const { data: stores = [] } = useOrderStores();
  const { data: orderStats } = useOrderStats();
  const { data: inboundItems } = useInboundItems();
  
  // Mutations
  const createMutation = useCreateOrder();
  const updateOrderMutation = useUpdateOrder();
  const deleteMutation = useDeleteOrder();
  const bulkDeleteMutation = useBulkDeleteOrders();
  const bulkUpdateMutation = useBulkUpdateOrders();
  const bulkCreateMutation = useBulkCreateOrders();
  const syncPendingMutation = useSyncPendingRecords();

  // 派生数据
  const orders = paginatedData?.data || [];
  const totalCount = paginatedData?.totalCount || 0;
  const totalPages = paginatedData?.totalPages || 1;

  // LPN 到入库记录的映射
  const inboundByLpn = useMemo(() => {
    return (inboundItems || []).reduce((acc, item) => {
      acc[item.lpn] = item;
      return acc;
    }, {} as Record<string, typeof inboundItems[0]>);
  }, [inboundItems]);

  // 统计数据 - 使用从数据库获取的全量统计
  const stats = useMemo(() => {
    return {
      total: orderStats?.total || 0,
      pending: orderStats?.pending || 0,
      arrived: orderStats?.arrived || 0,
      shipped: orderStats?.shipped || 0,
    };
  }, [orderStats]);

  // 按内部订单号分组
  const { groupedOrders, singleOrders } = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    orders.forEach(order => {
      const key = order.internal_order_no || `no-group-${order.id}`;
      if (!groups[key]) groups[key] = [];
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

  const hasGroups = groupedOrders.length > 0;
  const hasActiveFilters = !!(debouncedSearch || storeFilter !== "all" || statusFilters.length > 0 || gradeFilter !== "all");

  // 事件处理
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(1);
    }, 300);
  };

  const handleStoreFilterChange = (value: string) => {
    setStoreFilter(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (status: "未到货" | "到货" | "出库") => {
    setStatusFilters(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
    setCurrentPage(1);
  };

  const handleGradeFilterChange = (value: string) => {
    setGradeFilter(value);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setStoreFilter("all");
    setStatusFilters([]);
    setGradeFilter("all");
    setActiveQuickFilter(null);
    setCurrentPage(1);
  };

  // 统计卡片点击筛选
  const handleStatsCardClick = (status: "未到货" | "到货" | "出库" | null) => {
    if (status === null) {
      clearAllFilters();
    } else {
      setStatusFilters([status]);
      setActiveQuickFilter(null);
      setCurrentPage(1);
    }
  };

  // 快速筛选预设
  const handleQuickFilterChange = (preset: QuickFilterPreset | null) => {
    if (preset === null) {
      setActiveQuickFilter(null);
      setStatusFilters([]);
      setGradeFilter("all");
    } else {
      setActiveQuickFilter(preset.id);
      if (preset.filter.statusFilters) {
        setStatusFilters(preset.filter.statusFilters);
      } else {
        setStatusFilters([]);
      }
      if (preset.filter.gradeFilter) {
        setGradeFilter(preset.filter.gradeFilter);
      } else {
        setGradeFilter("all");
      }
    }
    setCurrentPage(1);
  };

  // 打开图片查看器
  const openLightbox = (images: string[], index = 0) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // 批量更新状态
  const handleBulkStatusUpdate = (status: "未到货" | "到货" | "出库") => {
    const now = new Date().toISOString();
    const updates: OrderUpdate = { status };
    
    if (status === "到货") {
      updates.inbound_at = now;
    } else if (status === "出库") {
      updates.removed_at = now;
    }
    
    bulkUpdateMutation.mutate({ ids: selectedIds, updates }, {
      onSuccess: () => {
        toast.success(`已更新 ${selectedIds.length} 条订单状态`);
        setIsBulkStatusOpen(false);
        setSelectedIds([]);
      }
    });
  };

  // 批量更新等级
  const handleBulkGradeUpdate = (grade: "A" | "B" | "C") => {
    bulkUpdateMutation.mutate({ ids: selectedIds, updates: { grade } }, {
      onSuccess: () => {
        toast.success(`已更新 ${selectedIds.length} 条订单等级`);
        setIsBulkGradeOpen(false);
        setSelectedIds([]);
      }
    });
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const toggleAllGroups = () => {
    if (expandedGroups.size === groupedOrders.length) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(groupedOrders.map(g => g.internalOrderNo || g.orders[0].id)));
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === orders.length) setSelectedIds([]);
    else setSelectedIds(orders.map(item => item.id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
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

  const handleSubmit = async () => {
    if (!formData.lpn || !formData.order_number || !formData.store_name) {
      toast.error("请填写所有必填字段");
      return;
    }

    // 检查LPN是否已存在
    const { data: existingOrders } = await supabase
      .from("orders")
      .select("*")
      .ilike("lpn", formData.lpn.trim());
    
    const existingOrder = existingOrders?.[0];
    
    if (existingOrder) {
      // 检查是否是待同步订单（可以更新）
      const isPending = existingOrder.status === "待同步" || 
                        existingOrder.order_number === "待同步" || 
                        existingOrder.removal_order_id === "无入库信息";
      
      if (isPending) {
        // 更新待同步订单
        updateOrderMutation.mutate(
          {
            id: existingOrder.id,
            ...formData,
            status: "到货" as const,
          },
          {
            onSuccess: () => {
              toast.success("待同步订单已更新");
              setIsDialogOpen(false);
              resetForm();
            },
          }
        );
        return;
      } else {
        toast.error(`LPN号 "${formData.lpn}" 已存在，不能重复添加`);
        return;
      }
    }

    createMutation.mutate(
      { ...formData, removed_at: new Date().toISOString() },
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

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(selectedIds, {
      onSuccess: () => {
        setIsBulkDeleteOpen(false);
        setSelectedIds([]);
      }
    });
  };

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

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      templateHeaders,
      ["LPN123456", "示例产品", "请小心处理", "商品有缺陷", "可售", "示例店铺", "美国", "SKU-001", "ORDER-001", "MSKU-001", "B08XXX", "FNSKU-001", "1", "0", "2024-01-15", "2024-01-10"]
    ]);
    ws["!cols"] = templateHeaders.map(() => ({ wch: 15 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "退货订单模板");
    XLSX.writeFile(wb, "退货订单导入模板.xlsx");
    toast.success("模板下载成功");
  };

  const validateRow = (row: string[], rowIndex: number): { valid: boolean; error?: string } => {
    // Basic required field checks
    const lpn = row[0]?.trim();
    const storeName = row[5]?.trim();
    const orderNumber = row[8]?.trim();
    
    if (!lpn) return { valid: false, error: `第${rowIndex}行：LPN编号不能为空` };
    if (!storeName) return { valid: false, error: `第${rowIndex}行：店铺不能为空` };
    if (!orderNumber) return { valid: false, error: `第${rowIndex}行：订单号不能为空` };
    
    // Length validation
    if (lpn.length > 255) return { valid: false, error: `第${rowIndex}行：LPN编号不能超过255个字符` };
    if (storeName.length > 255) return { valid: false, error: `第${rowIndex}行：店铺名称不能超过255个字符` };
    if (orderNumber.length > 255) return { valid: false, error: `第${rowIndex}行：订单号不能超过255个字符` };
    
    // Validate optional field lengths
    const productName = row[1]?.trim();
    if (productName && productName.length > 500) return { valid: false, error: `第${rowIndex}行：产品名称不能超过500个字符` };
    
    const buyerNote = row[2]?.trim();
    if (buyerNote && buyerNote.length > 1000) return { valid: false, error: `第${rowIndex}行：买家备注不能超过1000个字符` };
    
    // Validate quantity
    const quantityStr = row[12]?.trim();
    if (quantityStr) {
      const quantity = parseInt(quantityStr);
      if (isNaN(quantity) || quantity < 1 || quantity > 10000) {
        return { valid: false, error: `第${rowIndex}行：退货数量必须是1-10000之间的整数` };
      }
    }
    
    return { valid: true };
  };

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
          
          // Check row count limit to prevent abuse
          const MAX_IMPORT_ROWS = 10000;
          if (dataRows.length > MAX_IMPORT_ROWS) {
            toast.error(`导入文件过大，最多支持${MAX_IMPORT_ROWS}行数据`);
            setImportProgress(prev => ({ ...prev, isImporting: false }));
            return;
          }
          
          setImportProgress(prev => ({ ...prev, total: dataRows.length }));

          const errors: ImportError[] = [];
          const validItems: OrderInsert[] = [];
          const updateItems: { id: string; lpn: string; data: OrderUpdate }[] = [];
          
          // 从数据库获取所有订单（需要检查待同步和重复）
          const { data: allOrdersData } = await supabase
            .from("orders")
            .select("*");
          
          // 构建待同步订单映射：LPN -> order（status为"待同步"或order_number为"待同步"）
          const pendingOrdersMap = new Map<string, Order>();
          // 已存在的非待同步订单：LPN -> 订单数据（用于校验参数一致性）
          const existingOrdersMap = new Map<string, Order>();
          
          (allOrdersData || []).forEach(o => {
            const lpnLower = o.lpn.toLowerCase();
            // 判断是否是待同步订单（通过status或order_number判断）
            const isPending = o.status === "待同步" || o.order_number === "待同步" || o.removal_order_id === "无入库信息";
            if (isPending) {
              pendingOrdersMap.set(lpnLower, o as Order);
            } else {
              existingOrdersMap.set(lpnLower, o as Order);
            }
          });
          
          // 本次导入中已处理的LPN -> 行数据（用于校验参数一致性）
          const importedLpnDataMap = new Map<string, { row: string[]; rowIndex: number }>();

          // 校验两行数据是否参数一致的辅助函数
          const areRowsConsistent = (row1: string[], row2: string[]): boolean => {
            // 比较除LPN外的所有字段
            for (let j = 1; j < Math.max(row1.length, row2.length); j++) {
              const val1 = (row1[j] || '').toString().trim();
              const val2 = (row2[j] || '').toString().trim();
              if (val1 !== val2) return false;
            }
            return true;
          };

          // 校验导入行与已存在订单是否参数一致
          const isConsistentWithExisting = (row: string[], existing: Order): boolean => {
            const productName = row[1] ? String(row[1]).trim() : null;
            const buyerNote = row[2] ? String(row[2]).trim() : null;
            const returnReason = row[3] ? String(row[3]).trim() : null;
            const inventoryAttribute = row[4] ? String(row[4]).trim() : null;
            const storeName = String(row[5]).trim();
            const country = row[6] ? String(row[6]).trim() : null;
            const productSku = row[7] ? String(row[7]).trim() : null;
            const orderNumber = String(row[8]).trim();
            const msku = row[9] ? String(row[9]).trim() : null;
            const asin = row[10] ? String(row[10]).trim() : null;
            const fnsku = row[11] ? String(row[11]).trim() : null;
            const returnQuantity = parseInt(String(row[12])) || 1;
            const warehouseLocation = row[13] ? String(row[13]).trim() : null;

            return (
              (productName || null) === (existing.product_name || null) &&
              (buyerNote || null) === (existing.buyer_note || null) &&
              (returnReason || null) === (existing.return_reason || null) &&
              (inventoryAttribute || null) === (existing.inventory_attribute || null) &&
              storeName === existing.store_name &&
              (country || null) === (existing.country || null) &&
              (productSku || null) === (existing.product_sku || null) &&
              orderNumber === existing.order_number &&
              (msku || null) === (existing.msku || null) &&
              (asin || null) === (existing.asin || null) &&
              (fnsku || null) === (existing.fnsku || null) &&
              returnQuantity === (existing.return_quantity || 1) &&
              (warehouseLocation || null) === (existing.warehouse_location || null)
            );
          };

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const rowIndex = i + 2;
            const validation = validateRow(row, rowIndex);
            if (!validation.valid) {
              errors.push({ row: rowIndex, message: validation.error! });
              continue;
            }

            const lpn = String(row[0]).trim();
            const lpnLower = lpn.toLowerCase();
            const orderNumber = String(row[8]).trim();
            
            // 检查是否有"待同步"状态的订单需要更新
            const pendingOrder = pendingOrdersMap.get(lpnLower);
            if (pendingOrder) {
              // 更新待同步订单的产品信息和状态
              updateItems.push({
                id: pendingOrder.id,
                lpn: lpn,
                data: {
                  product_name: row[1] ? String(row[1]).trim() : null,
                  buyer_note: row[2] ? String(row[2]).trim() : null,
                  return_reason: row[3] ? String(row[3]).trim() : null,
                  inventory_attribute: row[4] ? String(row[4]).trim() : null,
                  store_name: String(row[5]).trim(),
                  country: row[6] ? String(row[6]).trim() : null,
                  product_sku: row[7] ? String(row[7]).trim() : null,
                  order_number: orderNumber,
                  msku: row[9] ? String(row[9]).trim() : null,
                  asin: row[10] ? String(row[10]).trim() : null,
                  fnsku: row[11] ? String(row[11]).trim() : null,
                  return_quantity: parseInt(String(row[12])) || 1,
                  warehouse_location: row[13] ? String(row[13]).trim() : null,
                  return_time: row[14] ? String(row[14]).trim() : null,
                  order_time: row[15] ? String(row[15]).trim() : null,
                  removal_order_id: orderNumber,
                  station: String(row[5]).trim(), // 使用店铺名作为站点
                  status: "到货" as const, // 同步后状态改为到货
                }
              });
              // 从待处理映射中移除，避免重复更新
              pendingOrdersMap.delete(lpnLower);
              // 标记为已处理
              importedLpnDataMap.set(lpnLower, { row, rowIndex });
              continue;
            }

            // 检查该LPN是否已存在于数据库中
            const existingOrder = existingOrdersMap.get(lpnLower);
            if (existingOrder) {
              // 允许重复LPN，但必须参数不一致才能导入
              if (isConsistentWithExisting(row, existingOrder)) {
                errors.push({ row: rowIndex, message: `第${rowIndex}行：LPN号 "${lpn}" 已存在于系统中，且参数完全一致，无需重复导入` });
                continue;
              }
              // 参数不一致则允许导入
            }

            // 检查该LPN是否已在本次导入中处理过
            const existingImport = importedLpnDataMap.get(lpnLower);
            if (existingImport) {
              // 允许重复LPN，但必须参数不一致才能导入
              if (areRowsConsistent(row, existingImport.row)) {
                errors.push({ row: rowIndex, message: `第${rowIndex}行：LPN号 "${lpn}" 在导入文件中重复，且与第${existingImport.rowIndex}行参数完全一致，无需重复导入` });
                continue;
              }
              // 参数不一致则允许导入
            }

            // 标记该LPN为已处理
            importedLpnDataMap.set(lpnLower, { row, rowIndex });

            validItems.push({
              lpn,
              product_name: row[1] ? String(row[1]).trim() : null,
              buyer_note: row[2] ? String(row[2]).trim() : null,
              return_reason: row[3] ? String(row[3]).trim() : null,
              inventory_attribute: row[4] ? String(row[4]).trim() : null,
              store_name: String(row[5]).trim(),
              country: row[6] ? String(row[6]).trim() : null,
              product_sku: row[7] ? String(row[7]).trim() : null,
              order_number: orderNumber,
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

          if (validItems.length === 0 && updateItems.length === 0) {
            setImportProgress(prev => ({ ...prev, isImporting: false, showResult: true }));
            return;
          }

          // 先处理更新操作（同步"无入库信息"的临时订单）
          let updatedCount = 0;
          for (const item of updateItems) {
            try {
              const { error } = await supabase
                .from("orders")
                .update(item.data)
                .eq("id", item.id);
              
              if (!error) {
                updatedCount++;
                
                // 同时更新对应的入库记录（按LPN匹配）
                await supabase
                  .from("inbound_items")
                  .update({
                    product_sku: item.data.product_sku || "待同步",
                    product_name: item.data.product_name || "待同步",
                    removal_order_id: item.data.order_number || "无入库信息",
                    return_reason: item.data.return_reason,
                  })
                  .eq("product_sku", "待同步")
                  .ilike("lpn", item.lpn);
              }
            } catch (err) {
              console.error("更新订单失败:", err);
            }
          }

          if (updatedCount > 0) {
            toast.success(`已同步更新 ${updatedCount} 条待同步订单`);
          }

          // 再处理新建操作
          if (validItems.length === 0) {
            setImportProgress(prev => ({ 
              ...prev, 
              isImporting: false, 
              showResult: true,
              successCount: updatedCount,
            }));
            return;
          }

          bulkCreateMutation.mutate(validItems, {
            onSuccess: (data) => {
              setImportProgress(prev => ({
                ...prev,
                isImporting: false,
                showResult: true,
                successCount: data.length + updatedCount,
              }));
              
              // 自动同步"待同步"的入库记录
              syncPendingMutation.mutate(data as Order[]);
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="退货订单"
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

      {/* 统计卡片 - 可点击筛选 */}
      <OrderStatsCards 
        stats={stats} 
        activeFilter={statusFilters.length === 1 ? statusFilters[0] : null}
        onFilterClick={handleStatsCardClick}
      />

      {/* 快速筛选预设 */}
      <QuickFilters 
        activePreset={activeQuickFilter} 
        onPresetChange={handleQuickFilterChange}
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
        <Card className="bg-primary/5 border-primary/20 sticky top-0 z-10">
          <CardContent className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span className="text-sm font-medium">
              已选择 {selectedIds.length} 条记录
              {bulkUpdateMutation.isPending && (
                <span className="ml-2 text-muted-foreground">
                  <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                  处理中...
                </span>
              )}
            </span>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsBulkStatusOpen(true)}
                disabled={bulkUpdateMutation.isPending || bulkDeleteMutation.isPending}
              >
                <RefreshCw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">批量改状态</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsBulkGradeOpen(true)}
                disabled={bulkUpdateMutation.isPending || bulkDeleteMutation.isPending}
              >
                <Settings2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">批量改等级</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsBulkEditOpen(true)}
                disabled={bulkUpdateMutation.isPending || bulkDeleteMutation.isPending}
              >
                <Edit className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">批量编辑</span>
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setIsBulkDeleteOpen(true)}
                disabled={bulkUpdateMutation.isPending || bulkDeleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">批量删除</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>取消</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 筛选区域 */}
      <OrderFilters
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        statusFilters={statusFilters}
        onStatusFilterChange={handleStatusFilterChange}
        gradeFilter={gradeFilter}
        onGradeFilterChange={handleGradeFilterChange}
        storeFilter={storeFilter}
        onStoreFilterChange={handleStoreFilterChange}
        stores={stores}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearAllFilters}
      />

      {/* 表格 */}
      <Card className="overflow-hidden">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[36px]">
                  <Checkbox
                    checked={orders.length > 0 && selectedIds.length === orders.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[140px]">
                  <div className="flex items-center gap-1">
                    内部订单号
                    {hasGroups && (
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={toggleAllGroups}>
                        {expandedGroups.size === groupedOrders.length ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-center w-[70px]">状态</TableHead>
                <TableHead className="w-[120px]">LPN</TableHead>
                <TableHead className="w-[200px]">产品名称</TableHead>
                <TableHead className="w-[100px]">SKU</TableHead>
                <TableHead className="w-[70px]">等级</TableHead>
                <TableHead className="text-center w-[50px]">数量</TableHead>
                <TableHead className="w-[120px]">订单号</TableHead>
                <TableHead className="text-center w-[70px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {/* 分组订单 */}
                  {groupedOrders.map((group) => {
                    const groupKey = group.internalOrderNo || group.orders[0].id;
                    const isExpanded = expandedGroups.has(groupKey);
                    const firstOrder = group.orders[0];

                    return (
                      <React.Fragment key={groupKey}>
                        {/* 组头 */}
                        <TableRow
                          className="bg-primary/5 hover:bg-primary/10 cursor-pointer font-medium"
                          onClick={() => toggleGroup(groupKey)}
                        >
                          <TableCell>
                            <Checkbox
                              checked={group.orders.every(o => selectedIds.includes(o.id))}
                              onCheckedChange={() => {
                                const allSelected = group.orders.every(o => selectedIds.includes(o.id));
                                if (allSelected) {
                                  setSelectedIds(prev => prev.filter(id => !group.orders.some(o => o.id === id)));
                                } else {
                                  setSelectedIds(prev => [...new Set([...prev, ...group.orders.map(o => o.id)])]);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-primary" />}
                              <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                                {group.internalOrderNo}
                              </code>
                              <span className="text-xs text-muted-foreground">({group.orders.length}个LPN)</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-muted-foreground text-xs">展开查看</span>
                          </TableCell>
                          <TableCell><span className="text-muted-foreground text-xs">展开查看</span></TableCell>
                          <TableCell><span className="line-clamp-1 font-medium">{firstOrder.product_name || "-"}</span></TableCell>
                          <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{firstOrder.product_sku || "-"}</code></TableCell>
                          <TableCell className="text-center text-muted-foreground">-</TableCell>
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
                          const displayGrade = item.grade || inboundItem?.refurbishment_grade;

                          return (
                            <OrderTableRow
                              key={item.id}
                              order={item}
                              isSelected={selectedIds.includes(item.id) as boolean}
                              onSelect={() => toggleSelect(item.id)}
                              onView={() => setSelectedOrder(item)}
                              onDelete={() => setDeleteId(item.id)}
                              onEditGrade={() => setGradeEditOrder(item)}
                              displayGrade={displayGrade}
                              hasInboundItem={!!inboundItem?.refurbishment_grade}
                              isGroupChild
                            />
                          );
                        })}
                      </React.Fragment>
                    );
                  })}

                  {/* 单个LPN订单 */}
                  {singleOrders.map((item) => {
                    const inboundItem = inboundByLpn[item.lpn];
                    const displayGrade = item.grade || inboundItem?.refurbishment_grade;

                    return (
                      <OrderTableRow
                        key={item.id}
                        order={item}
                        isSelected={selectedIds.includes(item.id)}
                        onSelect={() => toggleSelect(item.id)}
                        onView={() => setSelectedOrder(item)}
                        onDelete={() => setDeleteId(item.id)}
                        onEditGrade={() => setGradeEditOrder(item)}
                        displayGrade={displayGrade}
                        hasInboundItem={!!inboundItem?.refurbishment_grade}
                      />
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
      <OrderPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
      />

      {/* 订单详情对话框 */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>订单信息</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <Tabs defaultValue="order" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="order">订单详情</TabsTrigger>
                <TabsTrigger value="inbound">入库信息</TabsTrigger>
                <TabsTrigger value="refurbishment">翻新信息</TabsTrigger>
              </TabsList>
              
              {/* 订单详情标签 */}
              <TabsContent value="order" className="flex-1 overflow-y-auto mt-4">
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
              </TabsContent>
              
              {/* 入库信息标签 */}
              <TabsContent value="inbound" className="flex-1 overflow-y-auto mt-4">
                {(() => {
                  const inboundItem = inboundByLpn[selectedOrder.lpn];
                  if (!inboundItem) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Package className="h-12 w-12 mb-4 opacity-50" />
                        <p>暂无入库信息</p>
                      </div>
                    );
                  }
                  
                  // 收集所有入库照片
                  const inboundPhotos: { url: string; label: string }[] = [];
                  if (inboundItem.lpn_label_photo) inboundPhotos.push({ url: inboundItem.lpn_label_photo, label: "LPN标签" });
                  if (inboundItem.packaging_photo_1) inboundPhotos.push({ url: inboundItem.packaging_photo_1, label: "包装照片1" });
                  if (inboundItem.packaging_photo_2) inboundPhotos.push({ url: inboundItem.packaging_photo_2, label: "包装照片2" });
                  if (inboundItem.packaging_photo_3) inboundPhotos.push({ url: inboundItem.packaging_photo_3, label: "包装照片3" });
                  if (inboundItem.packaging_photo_4) inboundPhotos.push({ url: inboundItem.packaging_photo_4, label: "包装照片4" });
                  if (inboundItem.packaging_photo_5) inboundPhotos.push({ url: inboundItem.packaging_photo_5, label: "包装照片5" });
                  if (inboundItem.packaging_photo_6) inboundPhotos.push({ url: inboundItem.packaging_photo_6, label: "包装照片6" });
                  if (inboundItem.accessories_photo) inboundPhotos.push({ url: inboundItem.accessories_photo, label: "配件照片" });
                  if (inboundItem.detail_photo) inboundPhotos.push({ url: inboundItem.detail_photo, label: "细节照片" });
                  if (inboundItem.product_photo) inboundPhotos.push({ url: inboundItem.product_photo, label: "产品照片" });
                  if (inboundItem.package_photo) inboundPhotos.push({ url: inboundItem.package_photo, label: "包装照片" });
                  
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4 text-sm">
                        <div><p className="text-muted-foreground">LPN编号</p><p className="font-mono font-medium">{inboundItem.lpn}</p></div>
                        <div><p className="text-muted-foreground">产品名称</p><p className="font-medium">{inboundItem.product_name}</p></div>
                        <div><p className="text-muted-foreground">产品SKU</p><p className="font-medium">{inboundItem.product_sku}</p></div>
                        <div><p className="text-muted-foreground">移除订单号</p><p className="font-medium">{inboundItem.removal_order_id}</p></div>
                        <div><p className="text-muted-foreground">快递单号</p><p className="font-medium">{inboundItem.tracking_number || "-"}</p></div>
                        <div><p className="text-muted-foreground">退货原因</p><p className="font-medium">{inboundItem.return_reason || "-"}</p></div>
                        <div><p className="text-muted-foreground">入库时间</p><p className="font-medium">{inboundItem.processed_at ? new Date(inboundItem.processed_at).toLocaleString("zh-CN") : "-"}</p></div>
                        <div><p className="text-muted-foreground">操作人员</p><p className="font-medium">{inboundItem.processed_by}</p></div>
                      </div>
                      
                      {/* 入库照片 */}
                      {inboundPhotos.length > 0 && (
                        <div className="space-y-3 border-t pt-4">
                          <p className="text-sm font-medium">入库照片</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {inboundPhotos.map((photo, idx) => {
                              // 获取图片大小
                              if (photoSizes[photo.url] === undefined) {
                                fetchPhotoSize(photo.url);
                              }
                              const size = photoSizes[photo.url];
                              
                              return (
                                <div key={idx} className="space-y-1.5 group">
                                  <div 
                                    className="relative aspect-square rounded-lg border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                    onClick={() => openLightbox(inboundPhotos.map(p => p.url), idx)}
                                  >
                                    <img 
                                      src={photo.url} 
                                      alt={photo.label} 
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                                    />
                                    {/* 文件大小标签 */}
                                    {size !== undefined && size !== null && (
                                      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                                        {formatFileSize(size)}
                                      </div>
                                    )}
                                    {/* 放大提示 */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                      <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground text-center truncate">{photo.label}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </TabsContent>
              
              {/* 翻新信息标签 */}
              <TabsContent value="refurbishment" className="flex-1 overflow-y-auto mt-4">
                {(() => {
                  const inboundItem = inboundByLpn[selectedOrder.lpn];
                  if (!inboundItem?.refurbished_at) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Wrench className="h-12 w-12 mb-4 opacity-50" />
                        <p>暂无翻新信息</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4 text-sm">
                        <div><p className="text-muted-foreground">翻新等级</p><p className="font-medium">{inboundItem.refurbishment_grade ? <GradeBadge grade={inboundItem.refurbishment_grade as "A" | "B" | "C"} /> : "-"}</p></div>
                        <div><p className="text-muted-foreground">翻新时间</p><p className="font-medium">{inboundItem.refurbished_at ? new Date(inboundItem.refurbished_at).toLocaleString("zh-CN") : "-"}</p></div>
                        <div><p className="text-muted-foreground">翻新人员</p><p className="font-medium">{inboundItem.refurbished_by || "-"}</p></div>
                        <div className="col-span-2"><p className="text-muted-foreground">翻新备注</p><p className="font-medium">{inboundItem.refurbishment_notes || "-"}</p></div>
                      </div>
                      
                      {/* 翻新照片 */}
                      {inboundItem.refurbishment_photos && inboundItem.refurbishment_photos.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">翻新照片</p>
                          <div className="grid grid-cols-4 gap-2">
                            {inboundItem.refurbishment_photos.map((photo, idx) => (
                              <div 
                                key={idx} 
                                className="relative group cursor-pointer"
                                onClick={() => openLightbox(inboundItem.refurbishment_photos!, idx)}
                              >
                                <img 
                                  src={photo} 
                                  alt={`翻新照片 ${idx + 1}`} 
                                  className="w-full h-20 object-cover rounded-lg border group-hover:ring-2 group-hover:ring-primary transition-all" 
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center rounded-lg">
                                  <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* 翻新视频 */}
                      {inboundItem.refurbishment_videos && inboundItem.refurbishment_videos.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">翻新视频</p>
                          <div className="grid grid-cols-2 gap-2">
                            {inboundItem.refurbishment_videos.map((video, idx) => (
                              <video key={idx} src={video} controls className="w-full h-32 rounded-lg border" />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </TabsContent>
            </Tabs>
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
            <Button variant="outline" onClick={() => { setIsBulkEditOpen(false); setBulkEditData({}); }} disabled={bulkUpdateMutation.isPending}>
              取消
            </Button>
            <Button onClick={handleBulkEdit} disabled={bulkUpdateMutation.isPending}>
              {bulkUpdateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认更新
            </Button>
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
            <AlertDialogCancel disabled={deleteMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量删除确认 */}
      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>您确定要删除选中的 {selectedIds.length} 条记录吗？此操作无法撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 等级编辑对话框 */}
      <GradeEditDialog
        open={!!gradeEditOrder}
        onOpenChange={() => setGradeEditOrder(null)}
        onSave={handleGradeSave}
        lpn={gradeEditOrder?.lpn || ""}
        currentGrade={gradeEditOrder?.grade || inboundByLpn[gradeEditOrder?.lpn || ""]?.grade || null}
      />

      {/* 批量状态更新对话框 */}
      <BulkStatusDialog
        open={isBulkStatusOpen}
        onOpenChange={setIsBulkStatusOpen}
        selectedCount={selectedIds.length}
        onConfirm={handleBulkStatusUpdate}
        isLoading={bulkUpdateMutation.isPending}
      />

      {/* 批量等级更新对话框 */}
      <BulkGradeDialog
        open={isBulkGradeOpen}
        onOpenChange={setIsBulkGradeOpen}
        selectedCount={selectedIds.length}
        onConfirm={handleBulkGradeUpdate}
        isLoading={bulkUpdateMutation.isPending}
      />

      {/* 图片查看器 */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </div>
  );
}
