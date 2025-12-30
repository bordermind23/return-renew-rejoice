import { useState } from "react";
import { Plus, Search, PackageOpen, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";

export default function Outbound() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [scanCode, setScanCode] = useState("");

  const handleCreateOutbound = () => {
    setIsDialogOpen(false);
    toast.success("出库单创建成功");
  };

  const handleScan = () => {
    if (scanCode.trim()) {
      toast.success(`产品 ${scanCode} 已添加到出库单`);
      setScanCode("");
    }
  };

  // Sample outbound orders
  const outboundOrders = [
    {
      id: "OUT-2024-001",
      destination: "品牌旗舰店",
      itemCount: 15,
      status: "待发货",
      createdAt: "2024-01-20",
    },
    {
      id: "OUT-2024-002",
      destination: "电子专营店",
      itemCount: 8,
      status: "已发货",
      createdAt: "2024-01-19",
    },
    {
      id: "OUT-2024-003",
      destination: "清仓处理",
      itemCount: 25,
      status: "待发货",
      createdAt: "2024-01-18",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="出库管理"
        description="创建和管理出库订单"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary">
                <Plus className="mr-2 h-4 w-4" />
                创建出库单
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>创建出库单</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="destination">出库目的地</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="选择目的地" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="store1">品牌旗舰店</SelectItem>
                        <SelectItem value="store2">电子专营店</SelectItem>
                        <SelectItem value="clearance">清仓处理</SelectItem>
                        <SelectItem value="other">其他</SelectItem>
                      </SelectContent>
                    </Select>
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
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Scan to add products */}
                <div className="space-y-2">
                  <Label>扫描添加产品</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="扫描LPN号添加产品..."
                      value={scanCode}
                      onChange={(e) => setScanCode(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleScan()}
                    />
                    <Button variant="secondary" onClick={handleScan}>
                      添加
                    </Button>
                  </div>
                </div>

                {/* Added products list placeholder */}
                <div className="rounded-lg border-2 border-dashed border-muted p-8 text-center">
                  <PackageOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    扫描LPN号添加要出库的产品
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateOutbound}>创建出库单</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="搜索出库单号..." className="pl-10" />
      </div>

      {/* Outbound Orders Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {outboundOrders.map((order) => (
          <Card key={order.id} className="transition-all hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium">
                  {order.id}
                </CardTitle>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    order.status === "已发货"
                      ? "bg-success/10 text-success"
                      : "bg-warning/10 text-warning"
                  }`}
                >
                  {order.status}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span>{order.destination}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">商品数量</span>
                <span className="font-semibold">{order.itemCount} 件</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">创建日期</span>
                <span>{order.createdAt}</span>
              </div>
              <div className="pt-2">
                <Button variant="outline" className="w-full" size="sm">
                  查看详情
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
