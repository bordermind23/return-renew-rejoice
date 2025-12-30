import { useState } from "react";
import { Search, Filter, Eye, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
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
} from "@/hooks/useOrders";
import { Skeleton } from "@/components/ui/skeleton";

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
        title="订单列表"
        description="查看所有退货订单详情"
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
                创建订单
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新订单</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="lpn">LPN号</Label>
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
                  <Label htmlFor="removal_order_id">移除货件号</Label>
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
                  <Label htmlFor="order_number">订单号</Label>
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
                  <Label htmlFor="store_name">店铺名称</Label>
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
                  <Label htmlFor="station">站点</Label>
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
        }
      />

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
