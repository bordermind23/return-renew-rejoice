import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Package, CheckCircle, Camera, ArrowLeft, AlertTriangle } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  const [showSkuMismatchDialog, setShowSkuMismatchDialog] = useState(false);
  const [selectedFinalSku, setSelectedFinalSku] = useState<string>("");
  const [confirmedSku, setConfirmedSku] = useState<string | null>(null);

  const { data: shipments } = useRemovalShipments();
  const { data: inboundItems } = useInboundItems();
  const { data: products } = useProducts();
  const createMutation = useCreateInboundItem();
  const updateShipmentMutation = useUpdateRemovalShipment();
  const updateInventoryMutation = useUpdateInventoryStock();

  // 统一SKU比较：忽略大小写/首尾空格
  const normalizeSku = (sku: string) => sku.trim().toLowerCase();

  // 检查SKU是否匹配
  const skuMismatch = useMemo(() => {
    if (!matchedShipment) return null;

    const shipmentSkuRaw = matchedShipment.product_sku || "";
    const shipmentSku = normalizeSku(shipmentSkuRaw);

    const orderSkusRaw = matchedOrders
      .map((o) => o.product_sku || "")
      .map((s) => s.trim())
      .filter(Boolean);

    // 订单里可能有重复SKU
    const uniqueOrderSkusRaw = Array.from(new Set(orderSkusRaw));

    // 候选SKU：货件SKU + 订单SKU
    const candidateSkusRaw = Array.from(new Set([shipmentSkuRaw.trim(), ...uniqueOrderSkusRaw].filter(Boolean)));
    const candidateSkusNormalized = candidateSkusRaw.map(normalizeSku);

    // 如果候选SKU（规范化后）有2个及以上，判定为不匹配
    const normalizedSet = new Set(candidateSkusNormalized);
    if (normalizedSet.size >= 2) {
      return {
        shipmentSku: shipmentSkuRaw.trim(),
        orderSkus: uniqueOrderSkusRaw,
        candidateSkus: candidateSkusRaw,
      };
    }

    // 如果订单SKU为空，无法对比
    if (uniqueOrderSkusRaw.length === 0) {
      return {
        shipmentSku: shipmentSkuRaw.trim(),
        orderSkus: [],
        candidateSkus: candidateSkusRaw,
        orderSkuMissing: true as const,
      };
    }

    // 其余情况视为匹配
    return null;
  }, [matchedShipment, matchedOrders]);

  // 获取最终确认的SKU对应的产品
  const finalSku = confirmedSku || matchedShipment?.product_sku;
  const matchedProduct = finalSku
    ? products?.find((p) => normalizeSku(p.sku) === normalizeSku(finalSku))
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

  // 检测到SKU不匹配/订单SKU缺失时自动弹出对话框（只要还没确认过）
  useEffect(() => {
    if (skuMismatch && !confirmedSku) {
      setSelectedFinalSku(skuMismatch.shipmentSku);
      setShowSkuMismatchDialog(true);
    }
  }, [skuMismatch, confirmedSku]);

  const handleConfirmSku = () => {
    setConfirmedSku(selectedFinalSku);
    setShowSkuMismatchDialog(false);
    toast.success(`已确认使用SKU: ${selectedFinalSku}`);
  };

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

    // 使用确认后的SKU或默认的货件SKU
    const inboundSku = confirmedSku || matchedShipment.product_sku;
    const inboundProduct = products?.find(p => p.sku === inboundSku);
    const inboundProductName = inboundProduct?.name || matchedShipment.product_name;

    createMutation.mutate(
      {
        lpn: lpn,
        removal_order_id: matchedShipment.order_id,
        product_sku: inboundSku,
        product_name: inboundProductName,
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
            sku: inboundSku,
            product_name: inboundProductName,
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
                    {order.internal_order_no && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">内部订单号</p>
                        <p className="font-mono font-semibold text-primary">{order.internal_order_no}</p>
                      </div>
                    )}
                    <div><p className="text-xs text-muted-foreground">LPN编号</p><p className="font-mono font-medium">{order.lpn}</p></div>
                    <div><p className="text-xs text-muted-foreground">产品名称</p><p className="font-medium">{order.product_name || "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">退货原因</p><p className="font-medium">{order.return_reason || "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">买家备注</p><p className="font-medium">{order.buyer_note || "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">店铺</p><p className="font-medium">{order.store_name}</p></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* SKU不匹配/订单SKU缺失提示 */}
          {skuMismatch && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      {("orderSkuMissing" in skuMismatch && skuMismatch.orderSkuMissing)
                        ? "订单SKU缺失，需确认入库SKU"
                        : "SKU不匹配警告"}
                    </p>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      {("orderSkuMissing" in skuMismatch && skuMismatch.orderSkuMissing)
                        ? "退货订单中没有SKU，系统无法自动对比，请确认最终入库SKU。"
                        : "移除货件SKU与退货订单SKU不一致，请确认最终入库SKU。"}
                    </p>
                    <div className="text-sm space-y-1">
                      <p>
                        <span className="text-muted-foreground">货件SKU:</span>{" "}
                        <span className="font-mono font-medium">{skuMismatch.shipmentSku || "-"}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">订单SKU:</span>{" "}
                        <span className="font-mono font-medium">
                          {skuMismatch.orderSkus.length > 0 ? skuMismatch.orderSkus.join(", ") : "-"}
                        </span>
                      </p>
                    </div>
                    {confirmedSku && (
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">
                        ✓ 已确认使用: {confirmedSku}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setShowSkuMismatchDialog(true)}
                    >
                      {confirmedSku ? "重新选择" : "选择正确SKU"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 产品信息 - 带图片 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                入库产品信息
                {confirmedSku && confirmedSku !== matchedShipment.product_sku && (
                  <Badge variant="secondary" className="text-xs">已更正SKU</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {/* 产品图片 */}
                <div className="flex-shrink-0">
                  {matchedProduct?.image ? (
                    <img
                      src={matchedProduct.image}
                      alt={matchedProduct.name}
                      className="h-20 w-20 rounded-lg object-cover border"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                {/* 产品详情 */}
                <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">产品名称</p>
                    <p className="font-medium">{matchedProduct?.name || matchedShipment.product_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">产品SKU</p>
                    <p className="font-mono font-medium text-primary">{finalSku || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">分类</p>
                    <p className="font-medium">{matchedProduct?.category || "-"}</p>
                  </div>
                  {!matchedProduct && skuMismatch && skuMismatch.candidateSkus.length > 1 && (
                    <div className="col-span-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => setShowSkuMismatchDialog(true)}>
                        选择SKU以显示正确产品信息
                      </Button>
                    </div>
                  )}
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

      {/* SKU不匹配选择对话框 */}
      <AlertDialog open={showSkuMismatchDialog} onOpenChange={setShowSkuMismatchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              SKU不匹配
            </AlertDialogTitle>
            <AlertDialogDescription>
              移除货件的产品SKU与退货订单的产品SKU不一致，请选择正确的入库SKU：
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <RadioGroup value={selectedFinalSku} onValueChange={setSelectedFinalSku}>
              {/* 货件SKU选项 */}
              <div className="flex items-start space-x-3 rounded-lg border p-3 mb-2">
                <RadioGroupItem value={skuMismatch?.shipmentSku || matchedShipment?.product_sku || ""} id="shipment-sku" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="shipment-sku" className="font-medium cursor-pointer">
                    使用移除货件SKU
                  </Label>
                  <p className="text-sm font-mono text-muted-foreground mt-1">
                    {skuMismatch?.shipmentSku || matchedShipment?.product_sku}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {matchedShipment?.product_name}
                  </p>
                </div>
              </div>

              {/* 订单SKU选项 */}
              {(skuMismatch?.orderSkus || []).map((sku) => {
                const product = products?.find((p) => normalizeSku(p.sku) === normalizeSku(sku));
                return (
                  <div key={sku} className="flex items-start space-x-3 rounded-lg border p-3 mb-2">
                    <RadioGroupItem value={sku} id={`order-sku-${sku}`} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={`order-sku-${sku}`} className="font-medium cursor-pointer">
                        使用退货订单SKU
                      </Label>
                      <p className="text-sm font-mono text-muted-foreground mt-1">
                        {sku}
                      </p>
                      {product && (
                        <p className="text-xs text-muted-foreground">
                          {product.name}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSku} disabled={!selectedFinalSku}>
              确认选择
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
