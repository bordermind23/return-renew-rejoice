import { useState, useRef } from "react";
import { Plus, Search, Filter, Trash2, Edit, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
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
  useRemovalShipments,
  useCreateRemovalShipment,
  useUpdateRemovalShipment,
  useDeleteRemovalShipment,
  useBulkCreateRemovalShipments,
  type RemovalShipment,
  type RemovalShipmentInsert,
} from "@/hooks/useRemovalShipments";
import { useCarriers } from "@/hooks/useCarriers";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Removals() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RemovalShipment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [customCarrier, setCustomCarrier] = useState("");
  const [useCustomCarrier, setUseCustomCarrier] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const { data: carriers } = useCarriers();
  const createMutation = useCreateRemovalShipment();
  const updateMutation = useUpdateRemovalShipment();
  const deleteMutation = useDeleteRemovalShipment();
  const bulkCreateMutation = useBulkCreateRemovalShipments();

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

  const columns = [
    {
      key: "order_id",
      header: "移除订单号",
      render: (item: RemovalShipment) => (
        <span className="font-medium text-primary">{item.order_id}</span>
      ),
    },
    { key: "store_name", header: "店铺", render: (item: RemovalShipment) => item.store_name || "-" },
    { key: "country", header: "国家", render: (item: RemovalShipment) => item.country || "-" },
    { key: "product_sku", header: "产品SKU" },
    { key: "msku", header: "MSKU", render: (item: RemovalShipment) => item.msku || "-" },
    { key: "product_name", header: "产品名称" },
    { key: "product_type", header: "商品类型", render: (item: RemovalShipment) => item.product_type || "-" },
    { key: "fnsku", header: "FNSKU" },
    {
      key: "quantity",
      header: "退件数量",
      render: (item: RemovalShipment) => (
        <span className="font-semibold">{item.quantity}</span>
      ),
    },
    { key: "carrier", header: "物流承运商" },
    { key: "tracking_number", header: "物流跟踪号" },
    {
      key: "ship_date",
      header: "发货日期",
      render: (item: RemovalShipment) =>
        item.ship_date ? new Date(item.ship_date).toLocaleDateString("zh-CN") : "-",
    },
    {
      key: "status",
      header: "状态",
      render: (item: RemovalShipment) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      header: "操作",
      render: (item: RemovalShipment) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(item);
            }}
          >
            <Edit className="h-4 w-4" />
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
    setCustomCarrier("");
    setUseCustomCarrier(false);
  };

  const handleEdit = (item: RemovalShipment) => {
    setEditingItem(item);
    const isKnownCarrier = carriers?.some(c => c.name === item.carrier);
    setUseCustomCarrier(!isKnownCarrier);
    setCustomCarrier(!isKnownCarrier ? item.carrier : "");
    setFormData({
      order_id: item.order_id,
      carrier: isKnownCarrier ? item.carrier : "",
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
    const finalCarrier = useCustomCarrier ? customCarrier : formData.carrier;
    const submitData = {
      ...formData,
      carrier: finalCarrier,
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

  // 导出CSV
  const handleExport = () => {
    if (!shipments || shipments.length === 0) {
      toast.error("没有数据可导出");
      return;
    }

    const headers = [
      "移除订单号", "店铺", "国家", "产品SKU", "MSKU", "产品名称", "商品类型",
      "FNSKU", "退件数量", "物流承运商", "物流跟踪号", "发货日期", "状态", "备注"
    ];

    const rows = shipments.map(item => [
      item.order_id,
      item.store_name || "",
      item.country || "",
      item.product_sku,
      item.msku || "",
      item.product_name,
      item.product_type || "",
      item.fnsku,
      item.quantity.toString(),
      item.carrier,
      item.tracking_number,
      item.ship_date || "",
      item.status,
      item.note || "",
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `移除货件_${new Date().toLocaleDateString("zh-CN")}.csv`;
    link.click();
    toast.success("导出成功");
  };

  // 导入CSV
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n").filter(line => line.trim());
        
        if (lines.length < 2) {
          toast.error("CSV文件格式错误或没有数据");
          return;
        }

        // 跳过标题行
        const dataLines = lines.slice(1);
        const shipments: RemovalShipmentInsert[] = [];

        for (const line of dataLines) {
          const cells = line.match(/("([^"]*(?:""[^"]*)*)"|[^,]*)/g) || [];
          const cleanCells = cells.map(cell => 
            cell.replace(/^"|"$/g, "").replace(/""/g, '"').trim()
          );

          if (cleanCells.length >= 10) {
            shipments.push({
              order_id: cleanCells[0] || `ORD-${Date.now()}`,
              store_name: cleanCells[1] || null,
              country: cleanCells[2] || null,
              product_sku: cleanCells[3] || "",
              msku: cleanCells[4] || null,
              product_name: cleanCells[5] || "",
              product_type: cleanCells[6] || null,
              fnsku: cleanCells[7] || "",
              quantity: parseInt(cleanCells[8]) || 1,
              carrier: cleanCells[9] || "",
              tracking_number: cleanCells[10] || "",
              ship_date: cleanCells[11] || null,
              status: (cleanCells[12] as "shipping" | "arrived" | "inbound" | "shelved") || "shipping",
              note: cleanCells[13] || null,
            });
          }
        }

        if (shipments.length === 0) {
          toast.error("未能解析任何有效数据");
          return;
        }

        bulkCreateMutation.mutate(shipments);
      } catch (error) {
        toast.error("解析CSV文件失败");
      }
    };
    reader.readAsText(file);
    
    // 清除input以允许重复选择同一文件
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
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleImport}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              批量导入
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              批量导出
            </Button>
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
                  创建退货入库
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? "编辑移除货件" : "创建新的移除货件"}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="orderId">移除订单号</Label>
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
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sku">产品SKU</Label>
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
                      <Label htmlFor="fnsku">FNSKU</Label>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="productName">产品名称</Label>
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
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">退件数量</Label>
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
                      <Label htmlFor="tracking">物流跟踪号</Label>
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="carrier">物流承运商</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setUseCustomCarrier(!useCustomCarrier)}
                      >
                        {useCustomCarrier ? "从列表选择" : "自定义输入"}
                      </Button>
                    </div>
                    {useCustomCarrier ? (
                      <Input
                        id="customCarrier"
                        placeholder="输入承运商名称"
                        value={customCarrier}
                        onChange={(e) => setCustomCarrier(e.target.value)}
                      />
                    ) : (
                      <Select
                        value={formData.carrier}
                        onValueChange={(value) =>
                          setFormData({ ...formData, carrier: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择承运商" />
                        </SelectTrigger>
                        <SelectContent>
                          {carriers?.map((carrier) => (
                            <SelectItem key={carrier.id} value={carrier.name}>
                              {carrier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
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

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        emptyMessage="暂无移除货件记录"
      />

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
    </div>
  );
}
