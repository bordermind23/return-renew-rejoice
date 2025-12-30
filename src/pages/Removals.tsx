import { useState } from "react";
import { Plus, Search, Filter, Trash2, Edit } from "lucide-react";
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
  type RemovalShipment,
} from "@/hooks/useRemovalShipments";
import { useCarriers } from "@/hooks/useCarriers";
import { Skeleton } from "@/components/ui/skeleton";

export default function Removals() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RemovalShipment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
  });

  const { data: shipments, isLoading } = useRemovalShipments();
  const { data: carriers } = useCarriers();
  const createMutation = useCreateRemovalShipment();
  const updateMutation = useUpdateRemovalShipment();
  const deleteMutation = useDeleteRemovalShipment();

  const filteredData = (shipments || []).filter((item) => {
    const matchesSearch =
      item.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tracking_number.toLowerCase().includes(searchTerm.toLowerCase());

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
    { key: "product_sku", header: "产品SKU" },
    { key: "product_name", header: "产品名称" },
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
      key: "status",
      header: "状态",
      render: (item: RemovalShipment) => <StatusBadge status={item.status} />,
    },
    {
      key: "created_at",
      header: "创建日期",
      render: (item: RemovalShipment) =>
        new Date(item.created_at).toLocaleDateString("zh-CN"),
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
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingItem) {
      updateMutation.mutate(
        {
          id: editingItem.id,
          ...formData,
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
          ...formData,
          status: "shipping",
        },
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
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? "编辑移除货件" : "创建新的移除货件"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
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
                    <Label htmlFor="carrier">物流承运商</Label>
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
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                </div>
                <div className="grid grid-cols-2 gap-4">
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
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索订单号、产品名称或跟踪号..."
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
