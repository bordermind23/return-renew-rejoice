import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Package, CheckCircle, Camera, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GradeBadge } from "@/components/ui/grade-badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { NativePhotoCapture } from "@/components/NativePhotoCapture";
import { useRemovalShipments, useUpdateRemovalShipment, type RemovalShipment } from "@/hooks/useRemovalShipments";
import { useCreateInboundItem, useInboundItems } from "@/hooks/useInboundItems";
import { useUpdateInventoryStock } from "@/hooks/useInventoryItems";
import { useProducts, useProductParts } from "@/hooks/useProducts";
import { fetchOrdersByLpn } from "@/hooks/useOrdersByLpn";
import { type Order } from "@/hooks/useOrders";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function InboundProcess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lpn = searchParams.get("lpn") || "";
  const trackingNumber = searchParams.get("tracking") || "";

  const [matchedShipment, setMatchedShipment] = useState<RemovalShipment | null>(null);
  const [matchedOrders, setMatchedOrders] = useState<Order[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedMissingParts, setSelectedMissingParts] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const { data: shipments } = useRemovalShipments();
  const { data: inboundItems } = useInboundItems();
  const { data: products } = useProducts();
  const createMutation = useCreateInboundItem();
  const updateShipmentMutation = useUpdateRemovalShipment();
  const updateInventoryMutation = useUpdateInventoryStock();

  const matchedProduct = matchedShipment 
    ? products?.find(p => p.sku === matchedShipment.product_sku)
    : null;
  const { data: productParts } = useProductParts(matchedProduct?.id || null);

  // 初始化数据
  useEffect(() => {
    const init = async () => {
      if (!lpn || !trackingNumber || !shipments) return;

      // 查找货件
      const shipment = shipments.find(
        s => s.tracking_number.toLowerCase() === trackingNumber.toLowerCase()
      );
      if (shipment) {
        setMatchedShipment(shipment);
      }

      // 查找订单
      try {
        const orders = await fetchOrdersByLpn(lpn);
        setMatchedOrders(orders);
      } catch (error) {
        console.error("获取订单失败:", error);
      }

      setIsLoading(false);
    };

    if (shipments) {
      init();
    }
  }, [lpn, trackingNumber, shipments]);

  const getInboundedCount = (trackingNumber: string) => {
    return (inboundItems || []).filter(item => item.tracking_number === trackingNumber).length;
  };

  const toggleMissingPart = (partName: string) => {
    setSelectedMissingParts((prev) =>
      prev.includes(partName)
        ? prev.filter((name) => name !== partName)
        : [...prev, partName]
    );
  };

  const handleProcessComplete = () => {
    if (!selectedGrade) {
      toast.error("请选择产品级别");
      return;
    }

    if (!matchedShipment) {
      toast.error("货件信息丢失");
      return;
    }

    createMutation.mutate(
      {
        lpn: lpn,
        removal_order_id: matchedShipment.order_id,
        product_sku: matchedShipment.product_sku,
        product_name: matchedShipment.product_name,
        return_reason: returnReason || null,
        grade: selectedGrade as "A" | "B" | "C" | "new",
        missing_parts: selectedMissingParts.length > 0 ? selectedMissingParts : null,
        processed_at: new Date().toISOString(),
        processed_by: "操作员",
        tracking_number: matchedShipment.tracking_number,
        shipment_id: matchedShipment.id,
        lpn_label_photo: capturedPhotos.lpn_label_photo || null,
        packaging_photo_1: capturedPhotos.packaging_photo_1 || null,
        packaging_photo_2: capturedPhotos.packaging_photo_2 || null,
        packaging_photo_3: capturedPhotos.packaging_photo_3 || null,
        packaging_photo_4: capturedPhotos.packaging_photo_4 || null,
        packaging_photo_5: capturedPhotos.packaging_photo_5 || null,
        packaging_photo_6: capturedPhotos.packaging_photo_6 || null,
        accessories_photo: capturedPhotos.accessories_photo || null,
        detail_photo: capturedPhotos.detail_photo || null,
      },
      {
        onSuccess: () => {
          updateInventoryMutation.mutate({
            sku: matchedShipment.product_sku,
            product_name: matchedShipment.product_name,
            grade: selectedGrade as "A" | "B" | "C",
            quantity: 1,
          });

          const totalInbounded = getInboundedCount(matchedShipment.tracking_number) + 1;
          
          if (totalInbounded >= matchedShipment.quantity) {
            updateShipmentMutation.mutate({
              id: matchedShipment.id,
              status: "inbound"
            });
            toast.success(`所有 ${matchedShipment.quantity} 件货物已全部入库！`);
            // 全部入库完成，返回入库页面首页
            navigate("/inbound");
          } else {
            toast.success(`入库成功！还剩 ${matchedShipment.quantity - totalInbounded} 件待入库`);
            // 还有剩余，返回入库页面并保留物流号
            navigate(`/inbound?tracking=${encodeURIComponent(matchedShipment.tracking_number)}`);
          }
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!matchedShipment) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">未找到匹配的货件信息</p>
        <Button onClick={() => navigate("/inbound")} className="mt-4">
          返回
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-[calc(env(safe-area-inset-bottom,0px)+80px)]">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-40 bg-background border-b pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/inbound?tracking=${encodeURIComponent(trackingNumber)}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">产品入库处理</h1>
            <p className="text-sm text-muted-foreground truncate">LPN: {lpn}</p>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="p-4 space-y-4">
          {/* 退货订单信息 */}
          {matchedOrders.length > 0 && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  退货订单信息
                  {matchedOrders.length > 1 && (
                    <Badge variant="secondary">{matchedOrders.length}条</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {matchedOrders.map((order, index) => (
                  <div key={order.id} className={cn("grid grid-cols-2 gap-2 text-sm", index > 0 && "pt-3 border-t border-blue-200")}>
                    <div><p className="text-xs text-muted-foreground">产品名称</p><p className="font-medium">{order.product_name || "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">退货原因</p><p className="font-medium">{order.return_reason || "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">买家备注</p><p className="font-medium">{order.buyer_note || "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">店铺</p><p className="font-medium">{order.store_name}</p></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 产品信息 */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">产品名称</p>
                  <p className="font-medium">{matchedShipment.product_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">产品SKU</p>
                  <p className="font-medium">{matchedShipment.product_sku}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 退货理由 */}
          <div className="space-y-2">
            <Label className="text-sm">退货理由</Label>
            <Input
              placeholder="输入退货理由（可选）"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
            />
          </div>

          {/* 拍照上传 */}
          <div className="space-y-2">
            <Label className="text-sm">产品拍照 ({Object.keys(capturedPhotos).length}/9)</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full h-20 border-2 border-dashed"
              onClick={() => setIsPhotoCaptureOpen(true)}
            >
              <div className="text-center">
                <Camera className="mx-auto h-6 w-6 text-muted-foreground" />
                <span className="mt-1 block text-sm text-muted-foreground">
                  {Object.keys(capturedPhotos).length > 0 
                    ? `已拍摄 ${Object.keys(capturedPhotos).length} 张，点击继续` 
                    : "点击开始拍照"}
                </span>
              </div>
            </Button>
            {Object.keys(capturedPhotos).length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {Object.entries(capturedPhotos).map(([key, url]) => (
                  <div key={key} className="flex-shrink-0 w-14 h-14 rounded overflow-hidden border">
                    <img src={url} alt={key} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 级别选择 */}
          <div className="space-y-2">
            <Label className="text-sm">设定产品级别 *</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { grade: "A", label: "轻微使用痕迹", color: "info" },
                { grade: "B", label: "明显使用痕迹", color: "warning" },
                { grade: "C", label: "功能外观问题", color: "destructive" },
              ].map(({ grade, label, color }) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setSelectedGrade(grade)}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                    selectedGrade === grade
                      ? `border-${color} bg-${color}/10 ring-2 ring-${color}/30`
                      : `border-muted hover:border-${color}/50`
                  )}
                >
                  <GradeBadge grade={grade as "A" | "B" | "C"} />
                  <span className="mt-1 text-xs text-muted-foreground text-center">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 缺少配件 */}
          <div className="space-y-2">
            <Label className="text-sm">缺少配件 (可多选)</Label>
            {productParts && productParts.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {productParts.map((part) => (
                  <div
                    key={part.id}
                    className="flex items-center space-x-2 rounded-lg border p-2"
                  >
                    <Checkbox
                      id={part.id}
                      checked={selectedMissingParts.includes(part.name)}
                      onCheckedChange={() => toggleMissingPart(part.name)}
                    />
                    <label htmlFor={part.id} className="text-sm cursor-pointer flex-1">
                      {part.name}
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
                暂无配件信息
              </p>
            )}
          </div>

          {/* 备注 */}
          <div className="space-y-2">
            <Label className="text-sm">备注</Label>
            <Textarea
              placeholder="输入其他备注信息..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>
      </ScrollArea>

      {/* 底部按钮 */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 pb-[calc(env(safe-area-inset-bottom,12px)+12px)]">
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(`/inbound?tracking=${encodeURIComponent(trackingNumber)}`)} className="flex-1 h-12">
            取消
          </Button>
          <Button
            onClick={handleProcessComplete}
            className="flex-1 h-12 gradient-primary"
            disabled={createMutation.isPending}
          >
            <CheckCircle className="mr-2 h-5 w-5" />
            完成入库
          </Button>
        </div>
      </div>

      {/* 原生拍照 */}
      {isPhotoCaptureOpen && (
        <NativePhotoCapture
          lpn={lpn}
          onComplete={(photos) => {
            setCapturedPhotos(photos);
            setIsPhotoCaptureOpen(false);
          }}
          onCancel={() => setIsPhotoCaptureOpen(false)}
        />
      )}
    </div>
  );
}
