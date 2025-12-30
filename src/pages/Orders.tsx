import { useState } from "react";
import { Search, Filter, Eye } from "lucide-react";
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
} from "@/components/ui/dialog";
import { mockOrders, type OrderItem } from "@/data/mockData";

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

  const filteredData = mockOrders.filter((item) => {
    const matchesSearch =
      item.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.lpn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.storeName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStore =
      storeFilter === "all" || item.storeName === storeFilter;

    return matchesSearch && matchesStore;
  });

  const stores = [...new Set(mockOrders.map((o) => o.storeName))];

  const columns = [
    {
      key: "lpn",
      header: "LPN号",
      render: (item: OrderItem) => (
        <span className="font-mono font-medium text-primary">{item.lpn}</span>
      ),
    },
    { key: "removalOrderId", header: "移除货件号" },
    {
      key: "orderNumber",
      header: "移除订单号",
      render: (item: OrderItem) => (
        <span className="font-medium">{item.orderNumber}</span>
      ),
    },
    { key: "storeName", header: "店铺名称" },
    { key: "station", header: "站点" },
    { key: "removedAt", header: "移除时间" },
    { key: "inboundAt", header: "入库时间" },
    {
      key: "actions",
      header: "操作",
      render: (item: OrderItem) => (
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
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="订单列表"
        description="查看所有退货订单详情"
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
                  <p className="font-medium">{selectedOrder.orderNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">移除货件号</p>
                  <p className="font-medium">{selectedOrder.removalOrderId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">店铺</p>
                  <p className="font-medium">{selectedOrder.storeName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">站点</p>
                  <p className="font-medium">{selectedOrder.station}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">移除时间</p>
                  <p className="font-medium">{selectedOrder.removedAt}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">入库时间</p>
                  <p className="font-medium">{selectedOrder.inboundAt}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
