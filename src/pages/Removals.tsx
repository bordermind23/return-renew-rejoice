import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { Plus, Search, Filter, Trash2, Edit, Eye, Upload, Download, FileSpreadsheet, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Loader2, Package, Copy, LayoutGrid, List, Check, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  useRemovalShipments,
  useCreateRemovalShipment,
  useUpdateRemovalShipment,
  useDeleteRemovalShipment,
  useBulkCreateRemovalShipments,
  useBulkDeleteRemovalShipments,
  useBulkUpdateRemovalShipments,
  type RemovalShipment,
  type RemovalShipmentInsert,
  type RemovalShipmentUpdate,
} from "@/hooks/useRemovalShipments";
import { useInboundItems } from "@/hooks/useInboundItems";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

export default function Removals() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false); // 查看模式
  const [viewingItem, setViewingItem] = useState<RemovalShipment | null>(null);
  const [editingItem, setEditingItem] = useState<RemovalShipment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditData, setBulkEditData] = useState<RemovalShipmentUpdate>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<"grouped" | "list">("list");
  const [duplicateFilter, setDuplicateFilter] = useState<"all" | "duplicate" | "unconfirmed">("all");
  const [inboundStatusFilter, setInboundStatusFilter] = useState<"all" | "no_inbound" | "partial" | "complete">("all");
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    isImporting: false,
    total: 0,
    processed: 0,
    errors: [],
    showResult: false,
    successCount: 0,
  });

  // Form state
  const [formData, setFormData] = useState({
    order_id: "",
    carrier: "",
    tracking_number: "",
    quantity: 1,
    product_sku: "",
    product_name: "",
    fnsku: "",
    note: "",
    store_name: "",
    country: "",
    ship_date: "",
    msku: "",
    product_type: "",
  });

  const { data: shipments, isLoading } = useRemovalShipments();
  const { data: inboundItems } = useInboundItems();
  const createMutation = useCreateRemovalShipment();
  const updateMutation = useUpdateRemovalShipment();
  const deleteMutation = useDeleteRemovalShipment();
  const bulkCreateMutation = useBulkCreateRemovalShipments();
  const bulkDeleteMutation = useBulkDeleteRemovalShipments();
  const bulkUpdateMutation = useBulkUpdateRemovalShipments();

  // 计算每个跟踪号的到货数量
  const arrivedCountByTracking = useMemo(() => {
    const counts: Record<string, number> = {};
    (inboundItems || []).forEach((item) => {
      if (item.tracking_number) {
        counts[item.tracking_number] = (counts[item.tracking_number] || 0) + 1;
      }
    });
    return counts;
  }, [inboundItems]);

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

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(selectedIds, {
      onSuccess: () => {
        setIsBulkDeleteOpen(false);
        setSelectedIds([]);
      }
    });
  };

  const handleBulkEdit = () => {
    const updates: RemovalShipmentUpdate = {};
    if (bulkEditData.status) updates.status = bulkEditData.status;
    if (bulkEditData.store_name) updates.store_name = bulkEditData.store_name;
    if (bulkEditData.country) updates.country = bulkEditData.country;
    if (bulkEditData.carrier) updates.carrier = bulkEditData.carrier;

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

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 检测重复数据的函数 - 基于关键字段判断
  const getDuplicateKey = useCallback((item: RemovalShipment) => {
    return `${item.order_id}|${item.tracking_number}|${item.fnsku}|${item.quantity}|${item.product_sku || ''}|${item.product_name || ''}`;
  }, []);

  // 找出所有重复的记录
  const duplicateInfo = useMemo(() => {
    const keyCount: Record<string, string[]> = {};
    (shipments || []).forEach((item) => {
      const key = getDuplicateKey(item);
      if (!keyCount[key]) {
        keyCount[key] = [];
      }
      keyCount[key].push(item.id);
    });
    
    // 只有超过1个的才算重复
    const duplicateIds = new Set<string>();
    Object.values(keyCount).forEach((ids) => {
      if (ids.length > 1) {
        ids.forEach(id => duplicateIds.add(id));
      }
    });
    
    return duplicateIds;
  }, [shipments, getDuplicateKey]);

  // 确认重复是正常的
  const handleConfirmDuplicate = useCallback((id: string) => {
    updateMutation.mutate({ id, duplicate_confirmed: true });
  }, [updateMutation]);

  const filteredData = useMemo(() => {
    return (shipments || []).filter((item) => {
      const matchesSearch =
        item.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.product_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.tracking_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.store_name || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      const isDuplicate = duplicateInfo.has(item.id);
      const matchesDuplicate = 
        duplicateFilter === "all" || 
        (duplicateFilter === "duplicate" && isDuplicate) ||
        (duplicateFilter === "unconfirmed" && isDuplicate && !item.duplicate_confirmed);

      // 入库状态筛选
      const arrivedCount = arrivedCountByTracking[item.tracking_number] || 0;
      const isNoInbound = arrivedCount === 0;
      const isPartial = arrivedCount > 0 && arrivedCount < item.quantity;
      const isComplete = arrivedCount >= item.quantity;
      
      const matchesInboundStatus = 
        inboundStatusFilter === "all" ||
        (inboundStatusFilter === "no_inbound" && isNoInbound) ||
        (inboundStatusFilter === "partial" && isPartial) ||
        (inboundStatusFilter === "complete" && isComplete);

      return matchesSearch && matchesStatus && matchesDuplicate && matchesInboundStatus;
    });
  }, [shipments, searchTerm, statusFilter, duplicateFilter, duplicateInfo, inboundStatusFilter, arrivedCountByTracking]);

  // 分页计算
  const totalCount = filteredData.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);
  
  const paginatedData = useMemo(() => {
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, startIndex, endIndex]);

  // 重置页码当筛选条件变化时
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, duplicateFilter, inboundStatusFilter]);

  // 按移除订单号 + 跟踪号分组
  interface OrderTrackingGroup {
    orderId: string;
    trackingNumber: string;
    groupKey: string;
    items: RemovalShipment[];
    totalQuantity: number;
    statuses: string[];
    carrier: string;
    storeName: string | null;
    country: string | null;
  }

  const groupedByOrderTracking = useMemo(() => {
    const groups: Record<string, OrderTrackingGroup> = {};
    
    // 分组视图使用分页后的数据
    const dataToGroup = viewMode === "grouped" ? paginatedData : filteredData;
    
    dataToGroup.forEach((item) => {
      // 使用 order_id + tracking_number 作为组合键
      const key = `${item.order_id}|||${item.tracking_number}`;
      if (!groups[key]) {
        groups[key] = {
          orderId: item.order_id,
          trackingNumber: item.tracking_number,
          groupKey: key,
          items: [],
          totalQuantity: 0,
          statuses: [],
          carrier: item.carrier,
          storeName: item.store_name,
          country: item.country,
        };
      }
      groups[key].items.push(item);
      groups[key].totalQuantity += item.quantity;
      if (!groups[key].statuses.includes(item.status)) {
        groups[key].statuses.push(item.status);
      }
    });

    return Object.values(groups).sort((a, b) => {
      // 按最新创建时间排序
      const aDate = Math.max(...a.items.map(i => new Date(i.created_at).getTime()));
      const bDate = Math.max(...b.items.map(i => new Date(i.created_at).getTime()));
      return bDate - aDate;
    });
  }, [filteredData, paginatedData, viewMode]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  const toggleSelectGroup = (group: OrderTrackingGroup) => {
    const groupIds = group.items.map(i => i.id);
    const allSelected = groupIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !groupIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...groupIds])]);
    }
  };

  const resetForm = () => {
    setFormData({
      order_id: "",
      carrier: "",
      tracking_number: "",
      quantity: 1,
      product_sku: "",
      product_name: "",
      fnsku: "",
      note: "",
      store_name: "",
      country: "",
      ship_date: "",
      msku: "",
      product_type: "",
    });
    setEditingItem(null);
  };

  // 查看详情（只读）
  const handleView = (item: RemovalShipment) => {
    setViewingItem(item);
    setIsViewMode(true);
  };

  const handleEdit = (item: RemovalShipment) => {
    setEditingItem(item);
    setFormData({
      order_id: item.order_id,
      carrier: item.carrier,
      tracking_number: item.tracking_number,
      quantity: item.quantity,
      product_sku: item.product_sku,
      product_name: item.product_name,
      fnsku: item.fnsku,
      note: item.note || "",
      store_name: item.store_name || "",
      country: item.country || "",
      ship_date: item.ship_date || "",
      msku: item.msku || "",
      product_type: item.product_type || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const submitData = {
      ...formData,
      store_name: formData.store_name || null,
      country: formData.country || null,
      ship_date: formData.ship_date || null,
      msku: formData.msku || null,
      product_type: formData.product_type || null,
    };

    if (editingItem) {
      updateMutation.mutate(
        {
          id: editingItem.id,
          ...submitData,
          status: editingItem.status,
        },
        {
          onSuccess: () => {
            setIsDialogOpen(false);
            resetForm();
          },
        }
      );
    } else {
      createMutation.mutate(
        {
          ...submitData,
          status: "shipping",
        } as RemovalShipmentInsert,
        {
          onSuccess: () => {
            setIsDialogOpen(false);
            resetForm();
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  // 模板字段定义
  const templateHeaders = [
    "移除订单号", "店铺", "国家", "产品SKU", "MSKU", "产品名称", "商品类型",
    "FNSKU", "退件数量", "物流承运商", "物流跟踪号", "发货日期", "状态", "备注"
  ];

  // 下载 Excel 模板
  const handleDownloadTemplate = () => {
    const templateData = [
      templateHeaders,
      ["RM-001", "店铺A", "美国", "SKU-001", "MSKU-001", "示例产品", "电子产品", "FNSKU-001", "10", "顺丰速运", "SF123456789", "2024-01-15", "shipping", "这是备注"],
      ["RM-002", "店铺B", "德国", "SKU-002", "MSKU-002", "示例产品2", "服装", "FNSKU-002", "5", "德邦快递", "DB987654321", "2024-01-16", "shipping", ""],
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws["!cols"] = templateHeaders.map((_, i) => ({ wch: i === 5 ? 20 : 15 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "移除货件模板");

    XLSX.writeFile(wb, "移除货件导入模板.xlsx");
    toast.success("模板下载成功");
  };

  // 导出 Excel
  const handleExportExcel = () => {
    if (!shipments || shipments.length === 0) {
      toast.error("没有数据可导出");
      return;
    }

    const data = [
      templateHeaders,
      ...shipments.map(item => [
        item.order_id,
        item.store_name || "",
        item.country || "",
        item.product_sku,
        item.msku || "",
        item.product_name,
        item.product_type || "",
        item.fnsku,
        item.quantity,
        item.carrier,
        item.tracking_number,
        item.ship_date || "",
        item.status,
        item.note || "",
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = templateHeaders.map((_, i) => ({ wch: i === 5 ? 20 : 15 }));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "移除货件");

    XLSX.writeFile(wb, `移除货件_${new Date().toLocaleDateString("zh-CN")}.xlsx`);
    toast.success("导出成功");
  };

  // 验证行数据
  const validateRow = (row: string[], rowIndex: number): { valid: boolean; error?: string; data?: RemovalShipmentInsert } => {
    const errors: string[] = [];
    
    // Required field validation
    const orderId = row[0]?.trim();
    if (!orderId) {
      errors.push("移除订单号不能为空");
    } else if (orderId.length > 255) {
      errors.push("移除订单号不能超过255个字符");
    }
    
    const fnsku = row[7]?.trim();
    if (!fnsku) {
      errors.push("FNSKU不能为空");
    } else if (fnsku.length > 255) {
      errors.push("FNSKU不能超过255个字符");
    }
    
    const carrier = row[9]?.trim();
    if (!carrier) {
      errors.push("物流承运商不能为空");
    } else if (carrier.length > 255) {
      errors.push("物流承运商不能超过255个字符");
    }
    
    const trackingNumber = row[10]?.trim();
    if (!trackingNumber) {
      errors.push("物流跟踪号不能为空");
    } else if (trackingNumber.length > 255) {
      errors.push("物流跟踪号不能超过255个字符");
    }

    // Quantity validation
    const quantity = parseInt(String(row[8])) || 0;
    if (quantity <= 0) {
      errors.push("退件数量必须大于0");
    } else if (quantity > 10000) {
      errors.push("退件数量不能超过10000");
    }

    // Status validation
    const validStatuses = ["shipping", "arrived", "inbound", "shelved"];
    const status = String(row[12] || "shipping").toLowerCase();
    if (!validStatuses.includes(status)) {
      errors.push(`状态值无效，应为: ${validStatuses.join(", ")}`);
    }
    
    // Optional field length validation
    const productName = row[5]?.trim();
    if (productName && productName.length > 500) {
      errors.push("产品名称不能超过500个字符");
    }
    
    const note = row[13]?.trim();
    if (note && note.length > 1000) {
      errors.push("备注不能超过1000个字符");
    }

    if (errors.length > 0) {
      return { valid: false, error: `第${rowIndex}行：${errors.join("; ")}` };
    }

    // Sanitize string helper
    const sanitize = (str: string | undefined, maxLen: number): string | null => {
      if (!str) return null;
      return str.trim().replace(/[<>]/g, '').slice(0, maxLen);
    };

    return {
      valid: true,
      data: {
        order_id: sanitize(row[0], 255)!,
        store_name: sanitize(row[1], 255),
        country: sanitize(row[2], 100),
        product_sku: sanitize(row[3], 255),
        msku: sanitize(row[4], 255),
        product_name: sanitize(row[5], 500),
        product_type: sanitize(row[6], 255),
        fnsku: sanitize(row[7], 255)!,
        quantity: Math.min(10000, Math.max(1, parseInt(String(row[8])) || 1)),
        carrier: sanitize(row[9], 255)!,
        tracking_number: sanitize(row[10], 255)!,
        ship_date: row[11] ? String(row[11]).trim() : null,
        status: status as "shipping" | "arrived" | "inbound" | "shelved",
        note: sanitize(row[13], 1000),
      }
    };
  };

  // 导入 Excel/CSV
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportProgress({
      isImporting: true,
      total: 0,
      processed: 0,
      errors: [],
      showResult: false,
      successCount: 0,
    });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          setImportProgress(prev => ({
            ...prev,
            isImporting: false,
            showResult: true,
            errors: [{ row: 0, message: "文件格式错误或没有数据" }]
          }));
          return;
        }

        const dataRows = jsonData.slice(1).filter(row => row.length > 0 && row.some(cell => cell));
        
        // Check row count limit to prevent abuse
        const MAX_IMPORT_ROWS = 10000;
        if (dataRows.length > MAX_IMPORT_ROWS) {
          setImportProgress(prev => ({
            ...prev,
            isImporting: false,
            showResult: true,
            errors: [{ row: 0, message: `导入文件过大，最多支持${MAX_IMPORT_ROWS}行数据` }]
          }));
          return;
        }
        
        const total = dataRows.length;
        const importErrors: ImportError[] = [];
        const validShipments: RemovalShipmentInsert[] = [];

        setImportProgress(prev => ({ ...prev, total }));

        dataRows.forEach((row, index) => {
          const rowNumber = index + 2; // Excel行号从2开始（1是表头）
          const result = validateRow(row, rowNumber);
          
          if (result.valid && result.data) {
            validShipments.push(result.data);
          } else {
            importErrors.push({ row: rowNumber, message: result.error || "未知错误" });
          }
        });

        setImportProgress(prev => ({
          ...prev,
          processed: total,
          errors: importErrors,
        }));

        if (validShipments.length === 0) {
          setImportProgress(prev => ({
            ...prev,
            isImporting: false,
            showResult: true,
          }));
          return;
        }

        bulkCreateMutation.mutate(validShipments, {
          onSuccess: () => {
            setImportProgress(prev => ({
              ...prev,
              isImporting: false,
              showResult: true,
              successCount: validShipments.length,
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
        setImportProgress(prev => ({
          ...prev,
          isImporting: false,
          showResult: true,
          errors: [{ row: 0, message: "解析文件失败，请检查文件格式" }]
        }));
      }
    };
    reader.readAsArrayBuffer(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
        title="移除货件列表"
        description="管理所有退货和移除货件"
        actions={
          <div className="flex gap-2 flex-wrap justify-end">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              className="hidden"
            />
            
            {/* 批量导入下拉菜单 */}
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
                  下载导入模板
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  选择文件导入
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" className="h-9" onClick={handleExportExcel}>
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">批量导出</span>
            </Button>
            
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button className="gradient-primary h-9" size="sm">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">创建退货入库</span>
                  <span className="sm:hidden">新建</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? "编辑移除货件" : "创建新的移除货件"}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="orderId">移除订单号 *</Label>
                      <Input
                        id="orderId"
                        placeholder="输入订单号"
                        value={formData.order_id}
                        onChange={(e) =>
                          setFormData({ ...formData, order_id: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="storeName">店铺</Label>
                      <Input
                        id="storeName"
                        placeholder="输入店铺名称"
                        value={formData.store_name}
                        onChange={(e) =>
                          setFormData({ ...formData, store_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">国家</Label>
                      <Input
                        id="country"
                        placeholder="输入国家"
                        value={formData.country}
                        onChange={(e) =>
                          setFormData({ ...formData, country: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sku">产品SKU *</Label>
                      <Input
                        id="sku"
                        placeholder="输入SKU"
                        value={formData.product_sku}
                        onChange={(e) =>
                          setFormData({ ...formData, product_sku: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="msku">MSKU</Label>
                      <Input
                        id="msku"
                        placeholder="输入MSKU"
                        value={formData.msku}
                        onChange={(e) =>
                          setFormData({ ...formData, msku: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fnsku">FNSKU *</Label>
                      <Input
                        id="fnsku"
                        placeholder="输入FNSKU"
                        value={formData.fnsku}
                        onChange={(e) =>
                          setFormData({ ...formData, fnsku: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="productName">产品名称 *</Label>
                      <Input
                        id="productName"
                        placeholder="输入产品名称"
                        value={formData.product_name}
                        onChange={(e) =>
                          setFormData({ ...formData, product_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="productType">商品类型</Label>
                      <Input
                        id="productType"
                        placeholder="输入商品类型"
                        value={formData.product_type}
                        onChange={(e) =>
                          setFormData({ ...formData, product_type: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">退件数量 *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        placeholder="数量"
                        value={formData.quantity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            quantity: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shipDate">发货日期</Label>
                      <Input
                        id="shipDate"
                        type="date"
                        value={formData.ship_date}
                        onChange={(e) =>
                          setFormData({ ...formData, ship_date: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tracking">物流跟踪号 *</Label>
                      <Input
                        id="tracking"
                        placeholder="输入跟踪号"
                        value={formData.tracking_number}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            tracking_number: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carrier">物流承运商 *</Label>
                    <Input
                      id="carrier"
                      placeholder="输入承运商名称"
                      value={formData.carrier}
                      onChange={(e) =>
                        setFormData({ ...formData, carrier: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="note">备注</Label>
                    <Input
                      id="note"
                      placeholder="输入备注信息"
                      value={formData.note}
                      onChange={(e) =>
                        setFormData({ ...formData, note: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingItem ? "保存" : "创建"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* 导入进度和结果 */}
      {(importProgress.isImporting || importProgress.showResult) && (
        <Card>
          <CardContent className="pt-6">
            {importProgress.isImporting ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="font-medium">正在导入数据...</span>
                </div>
                <Progress value={importProgress.total > 0 ? (importProgress.processed / importProgress.total) * 100 : 0} />
                <p className="text-sm text-muted-foreground">
                  已处理 {importProgress.processed} / {importProgress.total} 行
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {importProgress.errors.length === 0 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    )}
                    <span className="font-medium">
                      导入完成：成功 {importProgress.successCount} 条
                      {importProgress.errors.length > 0 && `，失败 ${importProgress.errors.length} 条`}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setImportProgress(prev => ({ ...prev, showResult: false }))}
                  >
                    关闭
                  </Button>
                </div>
                
                {importProgress.errors.length > 0 && (
                  <div className="rounded-lg border bg-destructive/5 p-4">
                    <p className="font-medium text-destructive mb-2">错误详情：</p>
                    <ScrollArea className="h-32">
                      <div className="space-y-1">
                        {importProgress.errors.map((error, index) => (
                          <p key={index} className="text-sm text-muted-foreground">
                            {error.row > 0 ? `第 ${error.row} 行：` : ""}{error.message}
                          </p>
                        ))}
                      </div>
                    </ScrollArea>
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

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索订单号、产品名称、跟踪号或店铺..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="状态筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="shipping">发货中</SelectItem>
            <SelectItem value="arrived">到货</SelectItem>
            <SelectItem value="inbound">入库</SelectItem>
            <SelectItem value="shelved">上架</SelectItem>
          </SelectContent>
        </Select>
        {/* 重复筛选 */}
        <Select value={duplicateFilter} onValueChange={(v) => setDuplicateFilter(v as any)}>
          <SelectTrigger className="w-full sm:w-40">
            <Copy className="mr-2 h-4 w-4" />
            <SelectValue placeholder="重复筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部记录</SelectItem>
            <SelectItem value="duplicate">仅重复</SelectItem>
            <SelectItem value="unconfirmed">未确认重复</SelectItem>
          </SelectContent>
        </Select>
        {/* 入库状态筛选 */}
        <Select value={inboundStatusFilter} onValueChange={(v) => setInboundStatusFilter(v as any)}>
          <SelectTrigger className="w-full sm:w-40">
            <Package className="mr-2 h-4 w-4" />
            <SelectValue placeholder="入库状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部入库状态</SelectItem>
            <SelectItem value="no_inbound">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                未入库
              </span>
            </SelectItem>
            <SelectItem value="partial">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                部分入库
              </span>
            </SelectItem>
            <SelectItem value="complete">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                已完成
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        {/* 视图切换 */}
        <div className="flex items-center border rounded-lg p-1 bg-muted/30">
          <Button
            variant={viewMode === "grouped" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 px-3"
            onClick={() => setViewMode("grouped")}
          >
            <LayoutGrid className="h-4 w-4 mr-1.5" />
            分组
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 px-3"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4 mr-1.5" />
            列表
          </Button>
        </div>
      </div>

      {/* 数据表格 */}
      <Card className="overflow-hidden">
        <ScrollArea className="w-full">
          <div className="transition-all duration-300 ease-out">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-10">
                  <Checkbox checked={selectedIds.length === filteredData.length && filteredData.length > 0} onCheckedChange={toggleSelectAll} />
                </TableHead>
                {viewMode === "grouped" && <TableHead className="w-10"></TableHead>}
                <TableHead className="font-semibold min-w-[140px]">移除订单号</TableHead>
                <TableHead className="font-semibold min-w-[160px]">跟踪号</TableHead>
                <TableHead className="font-semibold min-w-[100px]">承运商</TableHead>
                
                <TableHead className="font-semibold min-w-[120px]">产品SKU</TableHead>
                <TableHead className="font-semibold min-w-[150px]">产品名称</TableHead>
                <TableHead className="font-semibold min-w-[100px] text-center">申报/到货</TableHead>
                <TableHead className="font-semibold min-w-[100px]">发货日期</TableHead>
                <TableHead className="font-semibold min-w-[100px]">状态</TableHead>
                
                <TableHead className="font-semibold min-w-[100px] text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viewMode === "list" ? (
                // 列表视图 - 不分组显示
                paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      暂无移除货件记录
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((item) => {
                    const isDuplicate = duplicateInfo.has(item.id);
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-primary text-sm">{item.order_id}</span>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.tracking_number}</code>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.carrier}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.product_sku || "-"}</code>
                        </TableCell>
                        <TableCell>
                          <span className="line-clamp-1" title={item.product_name || undefined}>{item.product_name || "-"}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help inline-flex items-center gap-0.5">
                                  <span className="font-semibold">{item.quantity}</span>
                                  <span className="text-muted-foreground">/</span>
                                  <span className={`font-semibold ${(arrivedCountByTracking[item.tracking_number] || 0) >= item.quantity ? 'text-green-600' : 'text-amber-600'}`}>
                                    {arrivedCountByTracking[item.tracking_number] || 0}
                                  </span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <div className="text-xs space-y-1">
                                  <p><span className="text-muted-foreground">申报数量：</span>{item.quantity}</p>
                                  <p><span className="text-muted-foreground">到货数量：</span>{arrivedCountByTracking[item.tracking_number] || 0}</p>
                                  {(arrivedCountByTracking[item.tracking_number] || 0) < item.quantity && (
                                    <p className="text-amber-600">
                                      差异：缺少 {item.quantity - (arrivedCountByTracking[item.tracking_number] || 0)} 件
                                    </p>
                                  )}
                                  {(arrivedCountByTracking[item.tracking_number] || 0) > item.quantity && (
                                    <p className="text-blue-600">
                                      差异：多出 {(arrivedCountByTracking[item.tracking_number] || 0) - item.quantity} 件
                                    </p>
                                  )}
                                  {(arrivedCountByTracking[item.tracking_number] || 0) === item.quantity && (
                                    <p className="text-green-600">已全部到货</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {item.ship_date || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={item.status} />
                            {/* 入库状态指示器 */}
                            {item.status !== 'shipping' && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span className={`h-2 w-2 rounded-full ${
                                      (arrivedCountByTracking[item.tracking_number] || 0) === 0 
                                        ? 'bg-red-500' 
                                        : (arrivedCountByTracking[item.tracking_number] || 0) < item.quantity 
                                          ? 'bg-amber-500' 
                                          : 'bg-green-500'
                                    }`} />
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <span className="text-xs">
                                      {(arrivedCountByTracking[item.tracking_number] || 0) === 0 
                                        ? '未入库' 
                                        : (arrivedCountByTracking[item.tracking_number] || 0) < item.quantity 
                                          ? '部分入库' 
                                          : '已完成入库'}
                                    </span>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            {isDuplicate && !item.duplicate_confirmed && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                                onClick={() => handleConfirmDuplicate(item.id)}
                              >
                                确认重复
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleView(item)}
                              title="查看详情"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )
              ) : (
                // 分组视图
                groupedByOrderTracking.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      暂无移除货件记录
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedByOrderTracking.map((group) => {
                    // 如果只有一个产品，直接显示为普通行
                    if (group.items.length === 1) {
                      const item = group.items[0];
                      const isDuplicate = duplicateInfo.has(item.id);
                      return (
                        <TableRow key={item.id} className="hover:bg-muted/30">
                          <TableCell>
                            <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell>
                            <span className="font-medium text-primary text-sm">{item.order_id}</span>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.tracking_number}</code>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{item.carrier}</TableCell>
                          
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.product_sku || "-"}</code>
                          </TableCell>
                          <TableCell>
                            <span className="line-clamp-1" title={item.product_name || undefined}>{item.product_name || "-"}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help inline-flex items-center gap-0.5">
                                    <span className="font-semibold">{item.quantity}</span>
                                    <span className="text-muted-foreground">/</span>
                                    <span className={`font-semibold ${(arrivedCountByTracking[item.tracking_number] || 0) >= item.quantity ? 'text-green-600' : 'text-amber-600'}`}>
                                      {arrivedCountByTracking[item.tracking_number] || 0}
                                    </span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="text-xs space-y-1">
                                    <p><span className="text-muted-foreground">申报数量：</span>{item.quantity}</p>
                                    <p><span className="text-muted-foreground">到货数量：</span>{arrivedCountByTracking[item.tracking_number] || 0}</p>
                                    {(arrivedCountByTracking[item.tracking_number] || 0) < item.quantity && (
                                      <p className="text-amber-600">
                                        差异：缺少 {item.quantity - (arrivedCountByTracking[item.tracking_number] || 0)} 件
                                      </p>
                                    )}
                                    {(arrivedCountByTracking[item.tracking_number] || 0) > item.quantity && (
                                      <p className="text-blue-600">
                                        差异：多出 {(arrivedCountByTracking[item.tracking_number] || 0) - item.quantity} 件
                                      </p>
                                    )}
                                    {(arrivedCountByTracking[item.tracking_number] || 0) === item.quantity && (
                                      <p className="text-green-600">已全部到货</p>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {item.ship_date || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={item.status} />
                              {item.status !== 'shipping' && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <span className={`h-2 w-2 rounded-full ${
                                        (arrivedCountByTracking[item.tracking_number] || 0) === 0 
                                          ? 'bg-red-500' 
                                          : (arrivedCountByTracking[item.tracking_number] || 0) < item.quantity 
                                            ? 'bg-amber-500' 
                                            : 'bg-green-500'
                                      }`} />
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <span className="text-xs">
                                        {(arrivedCountByTracking[item.tracking_number] || 0) === 0 
                                          ? '未入库' 
                                          : (arrivedCountByTracking[item.tracking_number] || 0) < item.quantity 
                                            ? '部分入库' 
                                            : '已完成入库'}
                                      </span>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center gap-1">
                              {isDuplicate && !item.duplicate_confirmed && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                                  onClick={() => handleConfirmDuplicate(item.id)}
                                >
                                  确认重复
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleView(item)}
                                title="查看详情"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    // 多个产品时显示分组
                    const isExpanded = expandedGroups.has(group.groupKey);
                    const groupIds = group.items.map(i => i.id);
                    const allSelected = groupIds.every(id => selectedIds.includes(id));
                    const someSelected = groupIds.some(id => selectedIds.includes(id)) && !allSelected;
                    
                    return (
                      <Collapsible key={group.groupKey} open={isExpanded} asChild>
                        <>
                          {/* 分组头部行 */}
                          <TableRow className="bg-muted/30 hover:bg-muted/50 cursor-pointer">
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox 
                                checked={allSelected} 
                                // @ts-ignore - indeterminate is valid HTML
                                ref={(el) => el && (el.indeterminate = someSelected)}
                                onCheckedChange={() => toggleSelectGroup(group)} 
                              />
                            </TableCell>
                            <CollapsibleTrigger asChild>
                              <TableCell onClick={() => toggleGroup(group.groupKey)}>
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                            </CollapsibleTrigger>
                            <CollapsibleTrigger asChild>
                              <TableCell onClick={() => toggleGroup(group.groupKey)}>
                                <span className="font-medium text-primary text-sm">{group.orderId}</span>
                              </TableCell>
                            </CollapsibleTrigger>
                            <CollapsibleTrigger asChild>
                              <TableCell onClick={() => toggleGroup(group.groupKey)}>
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{group.trackingNumber}</code>
                              </TableCell>
                            </CollapsibleTrigger>
                            <CollapsibleTrigger asChild>
                              <TableCell onClick={() => toggleGroup(group.groupKey)} className="text-muted-foreground">
                                {group.carrier}
                              </TableCell>
                            </CollapsibleTrigger>
                            <CollapsibleTrigger asChild>
                              <TableCell onClick={() => toggleGroup(group.groupKey)} colSpan={2}>
                                <div className="flex items-center gap-1">
                                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">{group.items.length} 种产品</span>
                                </div>
                              </TableCell>
                            </CollapsibleTrigger>
                            <CollapsibleTrigger asChild>
                              <TableCell onClick={() => toggleGroup(group.groupKey)} className="text-center">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help inline-flex items-center gap-0.5">
                                        <span className="font-semibold text-primary">{group.totalQuantity}</span>
                                        <span className="text-muted-foreground">/</span>
                                        <span className={`font-semibold ${(arrivedCountByTracking[group.trackingNumber] || 0) >= group.totalQuantity ? 'text-green-600' : 'text-amber-600'}`}>
                                          {arrivedCountByTracking[group.trackingNumber] || 0}
                                        </span>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <div className="text-xs space-y-1">
                                        <p><span className="text-muted-foreground">申报数量：</span>{group.totalQuantity}</p>
                                        <p><span className="text-muted-foreground">到货数量：</span>{arrivedCountByTracking[group.trackingNumber] || 0}</p>
                                        {(arrivedCountByTracking[group.trackingNumber] || 0) < group.totalQuantity && (
                                          <p className="text-amber-600">
                                            差异：缺少 {group.totalQuantity - (arrivedCountByTracking[group.trackingNumber] || 0)} 件
                                          </p>
                                        )}
                                        {(arrivedCountByTracking[group.trackingNumber] || 0) > group.totalQuantity && (
                                          <p className="text-blue-600">
                                            差异：多出 {(arrivedCountByTracking[group.trackingNumber] || 0) - group.totalQuantity} 件
                                          </p>
                                        )}
                                        {(arrivedCountByTracking[group.trackingNumber] || 0) === group.totalQuantity && (
                                          <p className="text-green-600">已全部到货</p>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                            </CollapsibleTrigger>
                            <CollapsibleTrigger asChild>
                              <TableCell onClick={() => toggleGroup(group.groupKey)}>
                                <div className="flex flex-wrap gap-1">
                                  {group.statuses.map((status, idx) => (
                                    <StatusBadge key={idx} status={status as "shipping" | "arrived" | "inbound" | "shelved"} />
                                  ))}
                                </div>
                              </TableCell>
                            </CollapsibleTrigger>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleGroup(group.groupKey)}
                              >
                                {isExpanded ? "收起" : "展开"}
                              </Button>
                            </TableCell>
                          </TableRow>
                          
                          {/* 展开的子项 */}
                          <CollapsibleContent asChild>
                            <>
                              {group.items.map((item) => {
                                const isDuplicate = duplicateInfo.has(item.id);
                                return (
                                  <TableRow key={item.id} className="hover:bg-muted/20 bg-background">
                                    <TableCell>
                                      <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                                    </TableCell>
                                    <TableCell></TableCell>
                                    <TableCell>
                                      <span className="text-sm text-muted-foreground pl-4">└</span>
                                    </TableCell>
                                    <TableCell>
                                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.tracking_number}</code>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                      {item.carrier}
                                    </TableCell>
                                    <TableCell>
                                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.product_sku || "-"}</code>
                                    </TableCell>
                                    <TableCell>
                                      <span className="line-clamp-1 text-sm" title={item.product_name || undefined}>{item.product_name || "-"}</span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="cursor-help inline-flex items-center gap-0.5">
                                              <span className="font-semibold">{item.quantity}</span>
                                              <span className="text-muted-foreground">/</span>
                                              <span className={`font-semibold ${(arrivedCountByTracking[item.tracking_number] || 0) >= item.quantity ? 'text-green-600' : 'text-amber-600'}`}>
                                                {arrivedCountByTracking[item.tracking_number] || 0}
                                              </span>
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-xs">
                                            <div className="text-xs space-y-1">
                                              <p><span className="text-muted-foreground">申报数量：</span>{item.quantity}</p>
                                              <p><span className="text-muted-foreground">到货数量：</span>{arrivedCountByTracking[item.tracking_number] || 0}</p>
                                              {(arrivedCountByTracking[item.tracking_number] || 0) < item.quantity && (
                                                <p className="text-amber-600">
                                                  差异：缺少 {item.quantity - (arrivedCountByTracking[item.tracking_number] || 0)} 件
                                                </p>
                                              )}
                                              {(arrivedCountByTracking[item.tracking_number] || 0) > item.quantity && (
                                                <p className="text-blue-600">
                                                  差异：多出 {(arrivedCountByTracking[item.tracking_number] || 0) - item.quantity} 件
                                                </p>
                                              )}
                                              {(arrivedCountByTracking[item.tracking_number] || 0) === item.quantity && (
                                                <p className="text-green-600">已全部到货</p>
                                              )}
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                      {item.ship_date || "-"}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <StatusBadge status={item.status} />
                                        {item.status !== 'shipping' && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger>
                                                <span className={`h-2 w-2 rounded-full ${
                                                  (arrivedCountByTracking[item.tracking_number] || 0) === 0 
                                                    ? 'bg-red-500' 
                                                    : (arrivedCountByTracking[item.tracking_number] || 0) < item.quantity 
                                                      ? 'bg-amber-500' 
                                                      : 'bg-green-500'
                                                }`} />
                                              </TooltipTrigger>
                                              <TooltipContent side="top">
                                                <span className="text-xs">
                                                  {(arrivedCountByTracking[item.tracking_number] || 0) === 0 
                                                    ? '未入库' 
                                                    : (arrivedCountByTracking[item.tracking_number] || 0) < item.quantity 
                                                      ? '部分入库' 
                                                      : '已完成入库'}
                                                </span>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex justify-center gap-1">
                                        {isDuplicate && !item.duplicate_confirmed && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                                            onClick={() => handleConfirmDuplicate(item.id)}
                                          >
                                            确认重复
                                          </Button>
                                        )}
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7"
                                          onClick={() => handleView(item)}
                                          title="查看详情"
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 text-destructive hover:text-destructive"
                                          onClick={() => setDeleteId(item.id)}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })
                )
              )}
            </TableBody>
          </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>

      {/* 分页控制 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            显示 {totalCount > 0 ? startIndex + 1 : 0}-{endIndex} 条，共 {totalCount} 条
          </span>
          <span className="text-muted-foreground">每页</span>
          <Select value={pageSize.toString()} onValueChange={(value) => { setPageSize(Number(value)); setCurrentPage(1); }}>
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
          {duplicateInfo.size > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <Copy className="h-3 w-3" />
              {duplicateInfo.size} 条可能重复
            </span>
          )}
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <span className="text-xs">«</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <span className="text-xs">‹</span>
            </Button>
            
            {/* 页码按钮 */}
            {(() => {
              const pages: (number | string)[] = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                if (currentPage <= 4) {
                  pages.push(1, 2, 3, 4, 5, '...', totalPages);
                } else if (currentPage >= totalPages - 3) {
                  pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                } else {
                  pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
                }
              }
              return pages.map((page, idx) => (
                typeof page === 'number' ? (
                  <Button
                    key={idx}
                    variant={currentPage === page ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(page)}
                  >
                    <span className="text-xs">{page}</span>
                  </Button>
                ) : (
                  <span key={idx} className="px-1 text-muted-foreground">...</span>
                )
              ));
            })()}
            
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <span className="text-xs">›</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <span className="text-xs">»</span>
            </Button>
          </div>
        )}
      </div>

      {/* 批量编辑对话框 */}
      <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量编辑 ({selectedIds.length} 条记录)</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={bulkEditData.status || ""} onValueChange={(value) => setBulkEditData({ ...bulkEditData, status: value as any || undefined })}>
                <SelectTrigger><SelectValue placeholder="留空则不更新" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shipping">发货中</SelectItem>
                  <SelectItem value="arrived">到货</SelectItem>
                  <SelectItem value="inbound">入库</SelectItem>
                  <SelectItem value="shelved">上架</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>店铺</Label>
              <Input value={bulkEditData.store_name || ""} onChange={(e) => setBulkEditData({ ...bulkEditData, store_name: e.target.value || undefined })} placeholder="留空则不更新" />
            </div>
            <div className="space-y-2">
              <Label>国家</Label>
              <Input value={bulkEditData.country || ""} onChange={(e) => setBulkEditData({ ...bulkEditData, country: e.target.value || undefined })} placeholder="留空则不更新" />
            </div>
            <div className="space-y-2">
              <Label>承运商</Label>
              <Input value={bulkEditData.carrier || ""} onChange={(e) => setBulkEditData({ ...bulkEditData, carrier: e.target.value || undefined })} placeholder="留空则不更新" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setIsBulkEditOpen(false); setBulkEditData({}); }}>取消</Button>
            <Button onClick={handleBulkEdit} disabled={bulkUpdateMutation.isPending}>确认更新</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 查看详情对话框（只读） */}
      <Dialog open={isViewMode} onOpenChange={(open) => { if (!open) { setIsViewMode(false); setViewingItem(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              货件详情
            </DialogTitle>
          </DialogHeader>
          {viewingItem && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">移除订单号</Label>
                  <p className="font-medium">{viewingItem.order_id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">跟踪号</Label>
                  <p className="font-medium">{viewingItem.tracking_number}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">承运商</Label>
                  <p className="font-medium">{viewingItem.carrier}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">发货日期</Label>
                  <p className="font-medium">{viewingItem.ship_date || "-"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">店铺</Label>
                  <p className="font-medium">{viewingItem.store_name || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">国家</Label>
                  <p className="font-medium">{viewingItem.country || "-"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">产品SKU</Label>
                  <p className="font-medium">{viewingItem.product_sku || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">MSKU</Label>
                  <p className="font-medium">{viewingItem.msku || "-"}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">产品名称</Label>
                <p className="font-medium">{viewingItem.product_name || "-"}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">FNSKU</Label>
                  <p className="font-medium">{viewingItem.fnsku}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">数量</Label>
                  <p className="font-medium">{viewingItem.quantity}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">状态</Label>
                  <div className="mt-0.5"><StatusBadge status={viewingItem.status} /></div>
                </div>
              </div>
              {viewingItem.note && (
                <div>
                  <Label className="text-muted-foreground text-xs">备注</Label>
                  <p className="font-medium">{viewingItem.note}</p>
                </div>
              )}
              
              {/* 物流面单照片 */}
              {viewingItem.shipping_label_photo && (
                <div className="pt-2 border-t">
                  <Label className="text-muted-foreground text-xs mb-2 block">物流面单照片</Label>
                  <div className="relative group">
                    <img 
                      src={viewingItem.shipping_label_photo} 
                      alt="物流面单" 
                      className="w-full max-h-64 object-contain rounded-lg border bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(viewingItem.shipping_label_photo!, '_blank')}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-black/50 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                        <Image className="h-4 w-4" />
                        点击查看大图
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="text-xs text-muted-foreground pt-2 border-t">
                创建时间: {new Date(viewingItem.created_at).toLocaleString("zh-CN")}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => { setIsViewMode(false); setViewingItem(null); }}>关闭</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销，确定要删除此货件吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
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
            <AlertDialogDescription>确定要删除选中的 {selectedIds.length} 条货件吗？此操作无法撤销。</AlertDialogDescription>
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
