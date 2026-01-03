import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Package, CheckCircle, Camera, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { NativePhotoCapture, getPhotoSteps } from "@/components/NativePhotoCapture";
import { TranslatedText } from "@/components/TranslatedText";
import { useRemovalShipments, useUpdateRemovalShipment, type RemovalShipment } from "@/hooks/useRemovalShipments";
import { useCreateInboundItem, useInboundItems } from "@/hooks/useInboundItems";
import { useUpdateInventoryStock } from "@/hooks/useInventoryItems";
import { useProducts, useProductParts } from "@/hooks/useProducts";
import { fetchOrdersByLpn } from "@/hooks/useOrdersByLpn";
import { type Order, useUpdateOrder } from "@/hooks/useOrders";
import { useAuth } from "@/hooks/useAuth";
import { useSound } from "@/hooks/useSound";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function InboundProcess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const lpn = searchParams.get("lpn") || "";
  const trackingNumber = searchParams.get("tracking") || "";
  const shippingLabelPhotoUrl = searchParams.get("labelPhoto") || "";
  const { playSuccess, playError } = useSound();

  const [matchedShipment, setMatchedShipment] = useState<RemovalShipment | null>(null);
  const [matchedOrders, setMatchedOrders] = useState<Order[]>([]);
  const [selectedMissingParts, setSelectedMissingParts] = useState<string[]>([]);
  const [hasProductDamage, setHasProductDamage] = useState(false);
  const [notes, setNotes] = useState("");
  const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const { data: shipments } = useRemovalShipments();
  const { data: inboundItems } = useInboundItems();
  const { data: products } = useProducts();
  const createMutation = useCreateInboundItem();
  const updateShipmentMutation = useUpdateRemovalShipment();
  const updateInventoryMutation = useUpdateInventoryStock();
  const updateOrderMutation = useUpdateOrder();

  // 使用退货订单的SKU来匹配产品
  const orderSku = matchedOrders.length > 0 && matchedOrders[0].product_sku
    ? matchedOrders[0].product_sku
    : matchedShipment?.product_sku;
  const matchedProduct = orderSku
    ? products?.find(p => p.sku === orderSku)
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
    if (!matchedShipment) {
      playError();
      toast.error("货件信息丢失");
      return;
    }

    // 如果有配件缺失或产品损坏，必须拍照
    const needsPhoto = selectedMissingParts.length > 0 || hasProductDamage;
    if (needsPhoto && Object.keys(capturedPhotos).length === 0) {
      playError();
      toast.error("配件缺失或产品损坏时必须拍照");
      return;
    }

    // 优先使用退货订单的 SKU 和产品名称（更准确）
    const finalSku = matchedOrders.length > 0 && matchedOrders[0].product_sku 
      ? matchedOrders[0].product_sku 
      : matchedShipment.product_sku;
    const finalProductName = matchedOrders.length > 0 && matchedOrders[0].product_name 
      ? matchedOrders[0].product_name 
      : matchedShipment.product_name;
    const returnQty = matchedOrders.length > 0 ? (matchedOrders[0].return_quantity || 1) : 1;

    createMutation.mutate(
      {
        lpn: lpn,
        removal_order_id: matchedShipment.order_id,
        product_sku: finalSku,
        product_name: finalProductName,
        return_reason: null,
        grade: "A" as "A" | "B" | "C" | "new", // 默认A级
        missing_parts: selectedMissingParts.length > 0 ? selectedMissingParts : null,
        processed_at: new Date().toISOString(),
        processed_by: user?.email || "未知用户",
        tracking_number: matchedShipment.tracking_number,
        shipment_id: matchedShipment.id,
        shipping_label_photo: shippingLabelPhotoUrl || null, // 保存物流面单照片
        lpn_label_photo: capturedPhotos.lpn_label_photo || null,
        packaging_photo_1: capturedPhotos.packaging_photo_1 || null,
        packaging_photo_2: capturedPhotos.packaging_photo_2 || null,
        packaging_photo_3: capturedPhotos.packaging_photo_3 || null,
        packaging_photo_4: capturedPhotos.packaging_photo_4 || null,
        packaging_photo_5: capturedPhotos.packaging_photo_5 || null,
        packaging_photo_6: capturedPhotos.packaging_photo_6 || null,
        accessories_photo: capturedPhotos.accessories_photo || null,
        detail_photo: capturedPhotos.detail_photo || null,
        damage_photo_1: capturedPhotos.damage_photo_1 || null,
        damage_photo_2: capturedPhotos.damage_photo_2 || null,
        damage_photo_3: capturedPhotos.damage_photo_3 || null,
        package_accessories_photo: capturedPhotos.package_accessories_photo || null,
      },
      {
        onSuccess: () => {
          // 播放成功音效
          playSuccess();

          // 更新对应订单的入库时间（触发器会自动更新状态为"到货"）
          if (matchedOrders.length > 0) {
            for (const order of matchedOrders) {
              updateOrderMutation.mutate({
                id: order.id,
                inbound_at: new Date().toISOString(),
              }, { onSuccess: () => {}, onError: () => {} }); // 静默处理
            }
          }

          const totalInbounded = getInboundedCount(matchedShipment.tracking_number) + 1;
          
          // 更新移除货件的物流面单照片（如果有照片且货件还没有照片）
          if (shippingLabelPhotoUrl && !matchedShipment.shipping_label_photo) {
            // 更新所有同一跟踪号的货件记录
            const shipmentsToUpdate = shipments?.filter(
              s => s.tracking_number === matchedShipment.tracking_number && !s.shipping_label_photo
            ) || [];
            
            shipmentsToUpdate.forEach(shipment => {
              updateShipmentMutation.mutate({
                id: shipment.id,
                shipping_label_photo: shippingLabelPhotoUrl,
              }, { onSuccess: () => {}, onError: () => {} }); // 静默处理
            });
          }
          
          if (totalInbounded >= matchedShipment.quantity) {
            updateShipmentMutation.mutate({
              id: matchedShipment.id,
              status: "入库"
            });
            toast.success(`所有 ${matchedShipment.quantity} 件货物已全部入库！`);
          } else {
            toast.success(`入库成功！还剩 ${matchedShipment.quantity - totalInbounded} 件待入库`);
          }
          
          // 始终返回入库扫描页面并保留物流号，让用户继续扫描下一个LPN
          navigate(`/inbound?tracking=${encodeURIComponent(matchedShipment.tracking_number)}`, { replace: true });
        },
        onError: () => {
          playError();
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4 pt-[calc(env(safe-area-inset-top,0px)+16px)]">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!matchedShipment) {
    return (
      <div className="min-h-screen bg-background p-4 text-center pt-[calc(env(safe-area-inset-top,0px)+60px)]">
        <p className="text-muted-foreground">未找到匹配的货件信息</p>
        <Button onClick={() => navigate("/inbound")} className="mt-4">
          返回
        </Button>
      </div>
    );
  }

  // 获取订单信息
  const order = matchedOrders.length > 0 ? matchedOrders[0] : null;

  return (
    <div className="min-h-screen bg-background pb-[calc(env(safe-area-inset-bottom,0px)+100px)]">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-40 bg-background border-b pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/inbound?tracking=${encodeURIComponent(trackingNumber)}`, { replace: true })}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary shrink-0" />
              <h1 className="font-semibold truncate">产品入库处理 - {lpn}</h1>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-160px)]">
        <div className="p-4 space-y-4">
          {/* 退货订单信息 */}
          {order && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-blue-900 dark:text-blue-100">
                  退货订单信息
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">产品名称</p>
                    <p className="font-medium">{order.product_name || matchedShipment.product_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">退货原因</p>
                    <p className="font-medium">{order.return_reason || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">买家备注</p>
                    <p className="font-medium"><TranslatedText text={order.buyer_note} /></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 产品信息卡片 */}
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

          {/* 缺少配件 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">缺少配件 (可多选)</Label>
            {productParts && productParts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {productParts.map((part) => (
                  <div
                    key={part.id}
                    onClick={() => toggleMissingPart(part.name)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 cursor-pointer transition-all",
                      selectedMissingParts.includes(part.name)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className={cn(
                      "h-4 w-4 rounded-full border-2 flex items-center justify-center",
                      selectedMissingParts.includes(part.name)
                        ? "border-primary"
                        : "border-muted-foreground"
                    )}>
                      {selectedMissingParts.includes(part.name) && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <span className="text-sm">{part.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
                暂无配件信息
              </p>
            )}
          </div>

          {/* 产品状态 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">产品状态</Label>
            <div
              onClick={() => setHasProductDamage(!hasProductDamage)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                hasProductDamage
                  ? "border-destructive bg-destructive/10"
                  : "border-border hover:border-destructive/50"
              )}
            >
              <div className={cn(
                "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                hasProductDamage
                  ? "border-destructive"
                  : "border-muted-foreground"
              )}>
                {hasProductDamage && (
                  <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
                )}
              </div>
              <span className={cn(
                "text-sm",
                hasProductDamage && "text-destructive font-medium"
              )}>产品损坏</span>
            </div>
          </div>

          {/* 产品拍照 */}
          <div className="space-y-2">
            {/* 根据状态计算需要的拍照步骤 */}
            {(() => {
              const photoSteps = getPhotoSteps(hasProductDamage, selectedMissingParts.length > 0);
              const requiredCount = photoSteps.length;
              const currentCount = Object.keys(capturedPhotos).length;
              
              let hintText = "";
              if (hasProductDamage && selectedMissingParts.length > 0) {
                hintText = "产品破损+配件缺失，需拍摄完整照片";
              } else if (hasProductDamage) {
                hintText = "产品破损，需拍摄破损详情";
              } else if (selectedMissingParts.length > 0) {
                hintText = "配件缺失，需拍摄包装配件同框";
              } else {
                hintText = "正常情况仅需1张";
              }
              
              return (
                <Label className="text-sm font-medium">
                  产品拍照 ({currentCount}/{requiredCount})
                  <span className={cn(
                    "text-xs ml-2",
                    (hasProductDamage || selectedMissingParts.length > 0) ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {hintText}
                  </span>
                </Label>
              );
            })()}
            <Button
              type="button"
              variant="outline"
              className="w-full h-24 border-2 border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5"
              onClick={() => setIsPhotoCaptureOpen(true)}
            >
              <div className="text-center">
                <Camera className="mx-auto h-7 w-7 text-muted-foreground" />
                <span className="mt-2 block text-sm text-muted-foreground">
                  {Object.keys(capturedPhotos).length > 0 
                    ? `已拍摄 ${Object.keys(capturedPhotos).length} 张，点击继续` 
                    : "点击开始拍照"}
                </span>
              </div>
            </Button>
            {Object.keys(capturedPhotos).length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {Object.entries(capturedPhotos).map(([key, url]) => (
                  <div key={key} className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-primary/30">
                    <img src={url} alt={key} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 备注 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">备注</Label>
            <Textarea
              placeholder="输入其他备注信息..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px] resize-none"
            />
          </div>
        </div>
      </ScrollArea>

      {/* 底部按钮 */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-4 pb-[calc(env(safe-area-inset-bottom,12px)+12px)]">
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => navigate(`/inbound?tracking=${encodeURIComponent(trackingNumber)}`, { replace: true })} 
            className="flex-1 h-12"
          >
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

      {/* 原生拍照 - 根据状态选择不同的拍照步骤 */}
      {isPhotoCaptureOpen && (
        <NativePhotoCapture
          lpn={lpn}
          steps={getPhotoSteps(hasProductDamage, selectedMissingParts.length > 0)}
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
