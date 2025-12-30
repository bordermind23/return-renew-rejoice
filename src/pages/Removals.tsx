import { useState, useRef, useMemo } from "react";
import { Plus, Search, Filter, Trash2, Edit, Upload, Download, FileSpreadsheet, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
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
  const [editingItem, setEditingItem] = useState<RemovalShipment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditData, setBulkEditData] = useState<RemovalShipmentUpdate>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
  const createMutation = useCreateRemovalShipment();
  const updateMutation = useUpdateRemovalShipment();
  const deleteMutation = useDeleteRemovalShipment();
  const bulkCreateMutation = useBulkCreateRemovalShipments();
  const bulkDeleteMutation = useBulkDeleteRemovalShipments();
  const bulkUpdateMutation = useBulkUpdateRemovalShipments();

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

  const filteredData = (shipments || []).filter((item) => {
    const matchesSearch =
      item.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tracking_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.store_name || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // 按移除订单号分组
  interface OrderGroup {
    orderId: string;
    trackingNumber: string;
    carrier: string;
    items: RemovalShipment[];
    totalQuantity: number;
    statuses: string[];
    shipDate: string | null;
    storeName: string | null;
    country: string | null;
  }

  const groupedByOrderId = useMemo(() => {
    const groups: Record<string, OrderGroup> = {};
    
    filteredData.forEach((item) => {
      const key = item.order_id;
      if (!groups[key]) {
        groups[key] = {
          orderId: item.order_id,
          trackingNumber: item.tracking_number,
          carrier: item.carrier,
          items: [],
          totalQuantity: 0,
          statuses: [],
          shipDate: item.ship_date,
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
  }, [filteredData]);

  const toggleGroup = (orderId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleSelectGroup = (group: OrderGroup) => {
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
    
    if (!row[0]?.trim()) {
      errors.push("移除订单号不能为空");
    }
    if (!row[3]?.trim()) {
      errors.push("产品SKU不能为空");
    }
    if (!row[5]?.trim()) {
      errors.push("产品名称不能为空");
    }
    if (!row[7]?.trim()) {
      errors.push("FNSKU不能为空");
    }
    if (!row[9]?.trim()) {
      errors.push("物流承运商不能为空");
    }
    if (!row[10]?.trim()) {
      errors.push("物流跟踪号不能为空");
    }

    const quantity = parseInt(String(row[8])) || 0;
    if (quantity <= 0) {
      errors.push("退件数量必须大于0");
    }

    const validStatuses = ["shipping", "arrived", "inbound", "shelved"];
    const status = String(row[12] || "shipping").toLowerCase();
    if (!validStatuses.includes(status)) {
      errors.push(`状态值无效，应为: ${validStatuses.join(", ")}`);
    }

    if (errors.length > 0) {
      return { valid: false, error: errors.join("; ") };
    }

    return {
      valid: true,
      data: {
        order_id: String(row[0]).trim(),
        store_name: row[1] ? String(row[1]).trim() : null,
        country: row[2] ? String(row[2]).trim() : null,
        product_sku: String(row[3]).trim(),
        msku: row[4] ? String(row[4]).trim() : null,
        product_name: String(row[5]).trim(),
        product_type: row[6] ? String(row[6]).trim() : null,
        fnsku: String(row[7]).trim(),
        quantity: parseInt(String(row[8])) || 1,
        carrier: String(row[9]).trim(),
        tracking_number: String(row[10]).trim(),
        ship_date: row[11] ? String(row[11]).trim() : null,
        status: status as "shipping" | "arrived" | "inbound" | "shelved",
        note: row[13] ? String(row[13]).trim() : null,
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
      <div className="flex flex-col gap-4 sm:flex-row">
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
      </div>

      {/* 按移除订单号分组的数据表格 */}
      <Card>
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-10">
                  <Checkbox checked={selectedIds.length === filteredData.length && filteredData.length > 0} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead className="font-semibold min-w-[140px]">移除订单号</TableHead>
                <TableHead className="font-semibold min-w-[100px]">跟踪号</TableHead>
                <TableHead className="font-semibold min-w-[100px]">承运商</TableHead>
                <TableHead className="font-semibold min-w-[100px]">店铺</TableHead>
                <TableHead className="font-semibold min-w-[120px]">产品SKU</TableHead>
                <TableHead className="font-semibold min-w-[150px]">产品名称</TableHead>
                <TableHead className="font-semibold min-w-[80px] text-center">数量</TableHead>
                <TableHead className="font-semibold min-w-[100px]">状态</TableHead>
                <TableHead className="font-semibold min-w-[80px] text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedByOrderId.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                    暂无移除货件记录
                  </TableCell>
                </TableRow>
              ) : (
                groupedByOrderId.map((group) => {
                  // 如果只有一个产品，直接显示为普通行
                  if (group.items.length === 1) {
                    const item = group.items[0];
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
                        <TableCell className="text-muted-foreground">{item.store_name || "-"}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.product_sku}</code>
                        </TableCell>
                        <TableCell>
                          <span className="line-clamp-1" title={item.product_name}>{item.product_name}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold">{item.quantity}</span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={item.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleEdit(item)}
                            >
                              <Edit className="h-4 w-4" />
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
                  const isExpanded = expandedGroups.has(group.orderId);
                  const groupIds = group.items.map(i => i.id);
                  const allSelected = groupIds.every(id => selectedIds.includes(id));
                  const someSelected = groupIds.some(id => selectedIds.includes(id)) && !allSelected;
                  
                  return (
                    <Collapsible key={group.orderId} open={isExpanded} asChild>
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
                            <TableCell onClick={() => toggleGroup(group.orderId)}>
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                          </CollapsibleTrigger>
                          <CollapsibleTrigger asChild>
                            <TableCell onClick={() => toggleGroup(group.orderId)}>
                              <span className="font-medium text-primary text-sm">
                                {group.orderId}
                              </span>
                            </TableCell>
                          </CollapsibleTrigger>
                          <CollapsibleTrigger asChild>
                            <TableCell onClick={() => toggleGroup(group.orderId)}>
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{group.trackingNumber}</code>
                            </TableCell>
                          </CollapsibleTrigger>
                          <CollapsibleTrigger asChild>
                            <TableCell onClick={() => toggleGroup(group.orderId)} className="text-muted-foreground">
                              {group.carrier}
                            </TableCell>
                          </CollapsibleTrigger>
                          <CollapsibleTrigger asChild>
                            <TableCell onClick={() => toggleGroup(group.orderId)} className="text-muted-foreground">
                              {group.storeName || "-"}
                            </TableCell>
                          </CollapsibleTrigger>
                          <CollapsibleTrigger asChild>
                            <TableCell onClick={() => toggleGroup(group.orderId)} className="text-center" colSpan={2}>
                              <div className="flex items-center gap-1">
                                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">{group.items.length} 种产品</span>
                              </div>
                            </TableCell>
                          </CollapsibleTrigger>
                          <CollapsibleTrigger asChild>
                            <TableCell onClick={() => toggleGroup(group.orderId)} className="text-center">
                              <span className="font-semibold text-primary">{group.totalQuantity}</span>
                            </TableCell>
                          </CollapsibleTrigger>
                          <CollapsibleTrigger asChild>
                            <TableCell onClick={() => toggleGroup(group.orderId)}>
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
                              onClick={() => toggleGroup(group.orderId)}
                            >
                              {isExpanded ? "收起" : "展开"}
                            </Button>
                          </TableCell>
                        </TableRow>
                        
                        {/* 展开的子项 */}
                        <CollapsibleContent asChild>
                          <>
                            {group.items.map((item) => (
                              <TableRow key={item.id} className="hover:bg-muted/20 bg-background">
                                <TableCell>
                                  <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell colSpan={2}>
                                  <span className="text-sm text-muted-foreground pl-4">└</span>
                                  <span className="text-sm text-muted-foreground ml-2">{item.fnsku}</span>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {item.country || "-"}
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell>
                                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.product_sku}</code>
                                </TableCell>
                                <TableCell>
                                  <span className="line-clamp-1 text-sm" title={item.product_name}>{item.product_name}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="font-semibold">{item.quantity}</span>
                                </TableCell>
                                <TableCell>
                                  <StatusBadge status={item.status} />
                                </TableCell>
                                <TableCell>
                                  <div className="flex justify-center gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => handleEdit(item)}
                                    >
                                      <Edit className="h-3.5 w-3.5" />
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
                            ))}
                          </>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>

      {/* 数据统计 */}
      <div className="text-sm text-muted-foreground">
        共 {groupedByOrderId.length} 个订单（{filteredData.length} 条产品记录）
        {statusFilter !== "all" && ` (已筛选)`}
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
