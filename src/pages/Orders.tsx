import { useState, useRef } from "react";
import { Search, Filter, Eye, Plus, Trash2, Upload, Download, FileSpreadsheet, ChevronDown, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
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
  useOrders,
  useCreateOrder,
  useDeleteOrder,
  type Order,
  type OrderInsert,
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

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importProgress, setImportProgress] = useState<ImportProgress>({
    isImporting: false,
    total: 0,
    processed: 0,
    errors: [],
    showResult: false,
    successCount: 0,
  });

  const [formData, setFormData] = useState({
    lpn: "",
    removal_order_id: "",
    order_number: "",
    store_name: "",
    station: "",
  });

  const { data: orders, isLoading } = useOrders();
  const createMutation = useCreateOrder();
  const deleteMutation = useDeleteOrder();

  const filteredData = (orders || []).filter((item) => {
    const matchesSearch =
      item.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.lpn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.store_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStore =
      storeFilter === "all" || item.store_name === storeFilter;

    return matchesSearch && matchesStore;
  });

  const stores = [...new Set((orders || []).map((o) => o.store_name))];

  const columns = [
    {
      key: "lpn",
      header: "LPN号",
      render: (item: Order) => (
        <span className="font-mono font-medium text-primary">{item.lpn}</span>
      ),
    },
    { key: "removal_order_id", header: "移除货件号" },
    {
      key: "order_number",
      header: "移除订单号",
      render: (item: Order) => (
        <span className="font-medium">{item.order_number}</span>
      ),
    },
    { key: "store_name", header: "店铺名称" },
    { key: "station", header: "站点" },
    {
      key: "removed_at",
      header: "移除时间",
      render: (item: Order) =>
        item.removed_at
          ? new Date(item.removed_at).toLocaleDateString("zh-CN")
          : "-",
    },
    {
      key: "inbound_at",
      header: "入库时间",
      render: (item: Order) =>
        item.inbound_at
          ? new Date(item.inbound_at).toLocaleDateString("zh-CN")
          : "-",
    },
    {
      key: "actions",
      header: "操作",
      render: (item: Order) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedOrder(item);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteId(item.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const resetForm = () => {
    setFormData({
      lpn: "",
      removal_order_id: "",
      order_number: "",
      store_name: "",
      station: "",
    });
  };

  const handleSubmit = () => {
    if (!formData.lpn || !formData.removal_order_id || !formData.order_number || !formData.store_name || !formData.station) {
      toast.error("请填写所有必填字段");
      return;
    }

    // Check for duplicate LPN
    const existingLpn = orders?.find(o => o.lpn === formData.lpn.trim());
    if (existingLpn) {
      toast.error(`LPN号 "${formData.lpn}" 已存在，不能重复添加`);
      return;
    }

    createMutation.mutate(
      {
        ...formData,
        removed_at: new Date().toISOString(),
        inbound_at: null,
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

  // Download template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "LPN号": "LPN123456",
        "移除货件号": "REMOVAL-001",
        "移除订单号": "ORDER-001",
        "店铺名称": "示例店铺",
        "站点": "FBA-US",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "退货订单模板");

    // Set column widths
    ws["!cols"] = [
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
      { wch: 15 },
      { wch: 12 },
    ];

    XLSX.writeFile(wb, "退货订单导入模板.xlsx");
    toast.success("模板下载成功");
  };

  // Validate row data
  const validateRow = (row: Record<string, string>, rowIndex: number): { valid: boolean; error?: string } => {
    const requiredFields = [
      { key: "LPN号", name: "LPN号" },
      { key: "移除货件号", name: "移除货件号" },
      { key: "移除订单号", name: "移除订单号" },
      { key: "店铺名称", name: "店铺名称" },
      { key: "站点", name: "站点" },
    ];

    for (const field of requiredFields) {
      if (!row[field.key] || String(row[field.key]).trim() === "") {
        return { valid: false, error: `第${rowIndex}行：${field.name}不能为空` };
      }
    }

    return { valid: true };
  };

  // Import file
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(fileExtension || "")) {
      toast.error("请上传 Excel 或 CSV 文件");
      return;
    }

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
          const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet);

          if (jsonData.length === 0) {
            toast.error("文件中没有数据");
            setImportProgress(prev => ({ ...prev, isImporting: false }));
            return;
          }

          setImportProgress(prev => ({ ...prev, total: jsonData.length }));

          const errors: ImportError[] = [];
          const validItems: OrderInsert[] = [];
          const existingLpns = new Set((orders || []).map(o => o.lpn));
          const importedLpns = new Set<string>();

          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            const rowIndex = i + 2; // Excel row number (1-indexed + header)

            // Validate row
            const validation = validateRow(row, rowIndex);
            if (!validation.valid) {
              errors.push({ row: rowIndex, message: validation.error! });
              continue;
            }

            const lpn = String(row["LPN号"]).trim();

            // Check for duplicate in existing data
            if (existingLpns.has(lpn)) {
              errors.push({ row: rowIndex, message: `第${rowIndex}行：LPN号 "${lpn}" 已存在于系统中` });
              continue;
            }

            // Check for duplicate in import data
            if (importedLpns.has(lpn)) {
              errors.push({ row: rowIndex, message: `第${rowIndex}行：LPN号 "${lpn}" 在导入文件中重复` });
              continue;
            }

            importedLpns.add(lpn);

            validItems.push({
              lpn,
              removal_order_id: String(row["移除货件号"]).trim(),
              order_number: String(row["移除订单号"]).trim(),
              store_name: String(row["店铺名称"]).trim(),
              station: String(row["站点"]).trim(),
              removed_at: new Date().toISOString(),
              inbound_at: null,
            });

            setImportProgress(prev => ({
              ...prev,
              processed: i + 1,
            }));
          }

          // Insert valid items one by one
          let successCount = 0;
          for (const item of validItems) {
            try {
              await new Promise<void>((resolve, reject) => {
                createMutation.mutate(item, {
                  onSuccess: () => {
                    successCount++;
                    resolve();
                  },
                  onError: (error) => {
                    reject(error);
                  },
                });
              });
            } catch (error) {
              errors.push({
                row: 0,
                message: `LPN "${item.lpn}" 导入失败: ${error instanceof Error ? error.message : "未知错误"}`,
              });
            }
          }

          setImportProgress({
            isImporting: false,
            total: jsonData.length,
            processed: jsonData.length,
            errors,
            showResult: true,
            successCount,
          });

          if (errors.length === 0) {
            toast.success(`成功导入 ${successCount} 条订单记录`);
          } else if (successCount > 0) {
            toast.warning(`导入完成：成功 ${successCount} 条，失败 ${errors.length} 条`);
          } else {
            toast.error(`导入失败：${errors.length} 条记录有错误`);
          }
        } catch (error) {
          toast.error("解析文件失败: " + (error instanceof Error ? error.message : "未知错误"));
          setImportProgress(prev => ({ ...prev, isImporting: false }));
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      toast.error("读取文件失败");
      setImportProgress(prev => ({ ...prev, isImporting: false }));
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!orders || orders.length === 0) {
      toast.error("没有数据可导出");
      return;
    }

    const exportData = orders.map((item) => ({
      "LPN号": item.lpn,
      "移除货件号": item.removal_order_id,
      "移除订单号": item.order_number,
      "店铺名称": item.store_name,
      "站点": item.station,
      "移除时间": item.removed_at ? new Date(item.removed_at).toLocaleString("zh-CN") : "",
      "入库时间": item.inbound_at ? new Date(item.inbound_at).toLocaleString("zh-CN") : "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
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
        description="查看所有退货订单详情"
        actions={
          <div className="flex gap-2">
            {/* Import dropdown */}
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

            {/* Export button */}
            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="mr-2 h-4 w-4" />
              批量导出
            </Button>

            {/* Create order dialog */}
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button className="gradient-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  创建订单
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>创建新订单</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="lpn">LPN号 *</Label>
                    <Input
                      id="lpn"
                      placeholder="输入LPN号"
                      value={formData.lpn}
                      onChange={(e) =>
                        setFormData({ ...formData, lpn: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="removal_order_id">移除货件号 *</Label>
                    <Input
                      id="removal_order_id"
                      placeholder="输入移除货件号"
                      value={formData.removal_order_id}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          removal_order_id: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="order_number">订单号 *</Label>
                    <Input
                      id="order_number"
                      placeholder="输入订单号"
                      value={formData.order_number}
                      onChange={(e) =>
                        setFormData({ ...formData, order_number: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="store_name">店铺名称 *</Label>
                    <Input
                      id="store_name"
                      placeholder="输入店铺名称"
                      value={formData.store_name}
                      onChange={(e) =>
                        setFormData({ ...formData, store_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="station">站点 *</Label>
                    <Select
                      value={formData.station}
                      onValueChange={(value) =>
                        setFormData({ ...formData, station: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择站点" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FBA-US">FBA-US</SelectItem>
                        <SelectItem value="FBA-EU">FBA-EU</SelectItem>
                        <SelectItem value="FBA-JP">FBA-JP</SelectItem>
                        <SelectItem value="FBA-AU">FBA-AU</SelectItem>
                      </SelectContent>
                    </Select>
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
                  <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                    创建
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Import progress and result */}
      {(importProgress.isImporting || importProgress.showResult) && (
        <Card>
          <CardContent className="pt-6">
            {importProgress.isImporting ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="font-medium">正在导入数据...</span>
                </div>
                <Progress 
                  value={(importProgress.processed / importProgress.total) * 100} 
                />
                <div className="text-sm text-muted-foreground">
                  已处理 {importProgress.processed} / {importProgress.total} 条
                </div>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setImportProgress(prev => ({ ...prev, showResult: false }))}
                  >
                    关闭
                  </Button>
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

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索订单号、LPN或店铺名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="店铺筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部店铺</SelectItem>
            {stores.map((store) => (
              <SelectItem key={store} value={store}>
                {store}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        emptyMessage="暂无订单记录"
      />

      <div className="text-sm text-muted-foreground">
        共 {filteredData.length} 条记录
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>订单详情</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">LPN号</p>
                  <p className="font-mono font-medium">{selectedOrder.lpn}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">订单号</p>
                  <p className="font-medium">{selectedOrder.order_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">移除货件号</p>
                  <p className="font-medium">{selectedOrder.removal_order_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">店铺</p>
                  <p className="font-medium">{selectedOrder.store_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">站点</p>
                  <p className="font-medium">{selectedOrder.station}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">移除时间</p>
                  <p className="font-medium">
                    {selectedOrder.removed_at
                      ? new Date(selectedOrder.removed_at).toLocaleString("zh-CN")
                      : "-"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">入库时间</p>
                  <p className="font-medium">
                    {selectedOrder.inbound_at
                      ? new Date(selectedOrder.inbound_at).toLocaleString("zh-CN")
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销，确定要删除此订单吗？
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
    </div>
  );
}