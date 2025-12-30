import { useState } from "react";
import { Plus, Search, Filter } from "lucide-react";
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
import { mockRemovalShipments, type RemovalShipment } from "@/data/mockData";
import { toast } from "sonner";

export default function Removals() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredData = mockRemovalShipments.filter((item) => {
    const matchesSearch =
      item.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      key: "orderId",
      header: "移除订单号",
      render: (item: RemovalShipment) => (
        <span className="font-medium text-primary">{item.orderId}</span>
      ),
    },
    { key: "productSku", header: "产品SKU" },
    { key: "productName", header: "产品名称" },
    { key: "fnsku", header: "FNSKU" },
    {
      key: "quantity",
      header: "退件数量",
      render: (item: RemovalShipment) => (
        <span className="font-semibold">{item.quantity}</span>
      ),
    },
    { key: "carrier", header: "物流承运商" },
    { key: "trackingNumber", header: "物流跟踪号" },
    {
      key: "status",
      header: "状态",
      render: (item: RemovalShipment) => <StatusBadge status={item.status} />,
    },
    { key: "createdAt", header: "创建日期" },
    {
      key: "actions",
      header: "操作",
      render: (item: RemovalShipment) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            toast.success(`开始处理货件 ${item.orderId}`);
          }}
        >
          入库处理
        </Button>
      ),
    },
  ];

  const handleCreateRemoval = () => {
    setIsDialogOpen(false);
    toast.success("移除货件创建成功");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="移除货件列表"
        description="管理所有退货和移除货件"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary">
                <Plus className="mr-2 h-4 w-4" />
                创建退货入库
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>创建新的移除货件</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="orderId">移除订单号</Label>
                    <Input id="orderId" placeholder="输入订单号" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carrier">物流承运商</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="选择承运商" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sf">顺丰速运</SelectItem>
                        <SelectItem value="jd">京东物流</SelectItem>
                        <SelectItem value="yt">圆通快递</SelectItem>
                        <SelectItem value="zt">中通快递</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tracking">物流跟踪号</Label>
                    <Input id="tracking" placeholder="输入跟踪号" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">退件数量</Label>
                    <Input id="quantity" type="number" placeholder="数量" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">产品SKU</Label>
                    <Input id="sku" placeholder="输入SKU" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fnsku">FNSKU</Label>
                    <Input id="fnsku" placeholder="输入FNSKU" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">备注</Label>
                  <Input id="note" placeholder="输入备注信息" />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateRemoval}>创建</Button>
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
    </div>
  );
}
