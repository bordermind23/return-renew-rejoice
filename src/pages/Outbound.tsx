import { useState } from "react";
import { Plus, Search, PackageOpen, Truck, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Scanner } from "@/components/Scanner";
import { useOrders } from "@/hooks/useOrders";
import { useInboundItems } from "@/hooks/useInboundItems";

interface ScannedProduct {
  lpn: string;
  productName: string;
  grade: string;
}

export default function Outbound() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([]);
  const [destination, setDestination] = useState("");
  const [carrier, setCarrier] = useState("");

  const { data: orders } = useOrders();
  const { data: inboundItems } = useInboundItems();

  // 验证 LPN 是否存在于退货订单列表
  const validateLpnExists = (lpn: string): boolean => {
    const orderWithLpn = orders?.find(o => o.lpn === lpn);
    return !!orderWithLpn;
  };

  // 获取已入库产品信息
  const getInboundProductInfo = (lpn: string) => {
    return inboundItems?.find(item => item.lpn === lpn);
  };

  const handleCreateOutbound = () => {
    if (scannedProducts.length === 0) {
      toast.error("请至少添加一个产品");
      return;
    }
    if (!destination) {
      toast.error("请选择出库目的地");
      return;
    }
    if (!carrier) {
      toast.error("请选择物流承运商");
      return;
    }
    
    setIsDialogOpen(false);
    toast.success(`出库单创建成功，包含 ${scannedProducts.length} 件产品`);
    // Reset form
    setScannedProducts([]);
    setDestination("");
    setCarrier("");
    setScanCode("");
  };

  const handleScan = (lpnValue?: string) => {
    const lpn = (lpnValue || scanCode).trim();
    
    if (!lpn) {
      toast.error("请输入LPN号");
      return;
    }

    // 检查LPN是否存在于退货订单列表
    if (!validateLpnExists(lpn)) {
      toast.error(`LPN号 "${lpn}" 不存在于退货订单列表中`);
      setScanCode("");
      return;
    }

    // 检查是否已添加
    if (scannedProducts.some(p => p.lpn === lpn)) {
      toast.error("该LPN已添加到出库单");
      setScanCode("");
      return;
    }

    // 获取产品信息
    const productInfo = getInboundProductInfo(lpn);
    
    setScannedProducts(prev => [
      ...prev,
      {
        lpn,
        productName: productInfo?.product_name || "未知产品",
        grade: productInfo?.grade || "-",
      }
    ]);
    
    toast.success(`产品 ${lpn} 已添加到出库单`);
    setScanCode("");
  };

  const handleRemoveProduct = (lpn: string) => {
    setScannedProducts(prev => prev.filter(p => p.lpn !== lpn));
  };

  const handleCameraScan = (code: string) => {
    handleScan(code);
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
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setScannedProducts([]);
              setDestination("");
              setCarrier("");
              setScanCode("");
            }
          }}>
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
                    <Label htmlFor="destination">出库目的地 *</Label>
                    <Select value={destination} onValueChange={setDestination}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择目的地" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="品牌旗舰店">品牌旗舰店</SelectItem>
                        <SelectItem value="电子专营店">电子专营店</SelectItem>
                        <SelectItem value="清仓处理">清仓处理</SelectItem>
                        <SelectItem value="其他">其他</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carrier">物流承运商 *</Label>
                    <Input
                      placeholder="输入承运商名称"
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                    />
                  </div>
                </div>

                {/* Scan to add products */}
                <div className="space-y-2">
                  <Label>扫描添加产品</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="扫描或输入LPN号添加产品..."
                      value={scanCode}
                      onChange={(e) => setScanCode(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleScan()}
                    />
                    <Button variant="secondary" onClick={() => handleScan()}>
                      <ScanLine className="mr-2 h-4 w-4" />
                      添加
                    </Button>
                    <Scanner onScan={handleCameraScan} buttonLabel="摄像头" />
                  </div>
                </div>

                {/* Added products list */}
                {scannedProducts.length > 0 ? (
                  <div className="space-y-2">
                    <Label>已添加产品 ({scannedProducts.length} 件)</Label>
                    <div className="max-h-48 overflow-y-auto rounded-lg border p-3 space-y-2">
                      {scannedProducts.map((product) => (
                        <div
                          key={product.lpn}
                          className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                        >
                          <div className="flex items-center gap-3">
                            <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                              {product.lpn}
                            </code>
                            <span className="text-sm">{product.productName}</span>
                            <Badge variant="secondary" className="text-xs">
                              {product.grade}级
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveProduct(product.lpn)}
                          >
                            移除
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-dashed border-muted p-8 text-center">
                    <PackageOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      扫描LPN号添加要出库的产品
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      LPN必须存在于退货订单列表中
                    </p>
                  </div>
                )}
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