import { useState, useMemo } from "react";
import { AlertTriangle, Package, FileWarning, Plus, ExternalLink, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useRemovalShipments, type RemovalShipment } from "@/hooks/useRemovalShipments";
import { useInboundItems } from "@/hooks/useInboundItems";
import { useCreateCase, caseTypeLabels, type CaseType } from "@/hooks/useCases";
import { cn } from "@/lib/utils";

interface DiscrepancyItem {
  shipment: RemovalShipment;
  discrepancyType: "quantity_less" | "quantity_more" | "sku_mismatch";
  declaredQuantity: number;
  actualQuantity: number;
  difference: number;
  description: string;
  hasCaseCreated?: boolean;
}

export default function InboundDiscrepancy() {
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<DiscrepancyItem | null>(null);
  const [caseForm, setCaseForm] = useState({
    caseType: "other" as CaseType,
    title: "",
    description: "",
    claimAmount: "",
  });

  const { data: shipments, isLoading: shipmentsLoading } = useRemovalShipments();
  const { data: inboundItems, isLoading: inboundLoading } = useInboundItems();
  const createCaseMutation = useCreateCase();

  // 计算差异包裹
  const discrepancies = useMemo(() => {
    if (!shipments || !inboundItems) return [];

    const result: DiscrepancyItem[] = [];
    
    // 按物流跟踪号分组shipments
    const shipmentsByTracking = shipments.reduce((acc, s) => {
      if (!acc[s.tracking_number]) {
        acc[s.tracking_number] = [];
      }
      acc[s.tracking_number].push(s);
      return acc;
    }, {} as Record<string, RemovalShipment[]>);

    // 检查每个跟踪号的差异
    Object.entries(shipmentsByTracking).forEach(([trackingNumber, trackingShipments]) => {
      // 只检查已入库的货件
      const hasInbound = trackingShipments.some(s => s.status === "inbound");
      if (!hasInbound) return;

      // 计算申报总数
      const declaredTotal = trackingShipments.reduce((sum, s) => sum + s.quantity, 0);
      
      // 计算实际入库数
      const actualInbound = inboundItems.filter(
        item => item.tracking_number === trackingNumber
      ).length;

      // 检查是否有差异备注（强制完成的情况）
      const hasForceComplete = trackingShipments.some(
        s => s.note && s.note.includes("强制完成入库")
      );

      // 数量差异
      if (actualInbound !== declaredTotal) {
        const difference = actualInbound - declaredTotal;
        const discrepancyType = difference < 0 ? "quantity_less" : "quantity_more";
        
        result.push({
          shipment: trackingShipments[0],
          discrepancyType,
          declaredQuantity: declaredTotal,
          actualQuantity: actualInbound,
          difference: Math.abs(difference),
          description: difference < 0 
            ? `实际入库 ${actualInbound} 件，少于申报 ${declaredTotal} 件，差 ${Math.abs(difference)} 件`
            : `实际入库 ${actualInbound} 件，多于申报 ${declaredTotal} 件，多 ${Math.abs(difference)} 件`,
        });
      }
    });

    // 按时间排序，最新的在前
    return result.sort((a, b) => 
      new Date(b.shipment.updated_at).getTime() - new Date(a.shipment.updated_at).getTime()
    );
  }, [shipments, inboundItems]);

  const handleOpenCreateCase = (discrepancy: DiscrepancyItem) => {
    setSelectedDiscrepancy(discrepancy);
    setCaseForm({
      caseType: discrepancy.discrepancyType === "quantity_less" ? "lpn_missing" : "other",
      title: `入库差异 - ${discrepancy.shipment.tracking_number}`,
      description: discrepancy.description,
      claimAmount: "",
    });
    setIsCreateCaseOpen(true);
  };

  const handleCreateCase = () => {
    if (!selectedDiscrepancy) return;

    createCaseMutation.mutate({
      case_type: caseForm.caseType,
      status: "pending",
      title: caseForm.title,
      description: caseForm.description,
      tracking_number: selectedDiscrepancy.shipment.tracking_number,
      removal_order_id: selectedDiscrepancy.shipment.order_id,
      claim_amount: caseForm.claimAmount ? parseFloat(caseForm.claimAmount) : null,
      currency: "USD",
      created_by: "操作员",
      order_id: null,
      lpn: null,
      expected_sku: selectedDiscrepancy.shipment.product_sku,
      actual_sku: null,
      missing_items: null,
      damage_description: null,
      amazon_case_id: null,
      amazon_case_url: null,
      approved_amount: null,
      submitted_at: null,
      resolved_at: null,
    }, {
      onSuccess: () => {
        setIsCreateCaseOpen(false);
        setSelectedDiscrepancy(null);
      }
    });
  };

  const getDiscrepancyBadge = (type: DiscrepancyItem["discrepancyType"]) => {
    switch (type) {
      case "quantity_less":
        return <Badge variant="destructive">数量不足</Badge>;
      case "quantity_more":
        return <Badge className="bg-amber-500 hover:bg-amber-600">数量超出</Badge>;
      case "sku_mismatch":
        return <Badge variant="secondary">SKU不匹配</Badge>;
    }
  };

  const isLoading = shipmentsLoading || inboundLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      <PageHeader
        title="差异包裹"
        description="查看入库过程中的差异情况，并创建CASE进行跟踪处理"
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总差异包裹
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{discrepancies.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              数量不足
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {discrepancies.filter(d => d.discrepancyType === "quantity_less").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              数量超出
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {discrepancies.filter(d => d.discrepancyType === "quantity_more").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 差异列表 */}
      {discrepancies.length === 0 ? (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold">暂无差异包裹</h3>
            <p className="text-muted-foreground mt-1">所有入库包裹数量均与申报一致</p>
          </div>
        </Card>
      ) : (
        <Card>
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold min-w-[140px]">物流跟踪号</TableHead>
                  <TableHead className="font-semibold min-w-[100px]">差异类型</TableHead>
                  <TableHead className="font-semibold min-w-[180px]">产品信息</TableHead>
                  <TableHead className="font-semibold min-w-[80px] text-center">申报数量</TableHead>
                  <TableHead className="font-semibold min-w-[80px] text-center">实际入库</TableHead>
                  <TableHead className="font-semibold min-w-[80px] text-center">差异</TableHead>
                  <TableHead className="font-semibold min-w-[120px]">更新时间</TableHead>
                  <TableHead className="font-semibold min-w-[100px] text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discrepancies.map((item, index) => (
                  <TableRow key={`${item.shipment.tracking_number}-${index}`} className="hover:bg-muted/20">
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">
                        {item.shipment.tracking_number}
                      </code>
                    </TableCell>
                    <TableCell>
                      {getDiscrepancyBadge(item.discrepancyType)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium truncate max-w-[180px]">
                          {item.shipment.product_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.shipment.product_sku}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {item.declaredQuantity}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {item.actualQuantity}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        "font-bold",
                        item.discrepancyType === "quantity_less" ? "text-destructive" : "text-amber-500"
                      )}>
                        {item.discrepancyType === "quantity_less" ? "-" : "+"}{item.difference}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(item.shipment.updated_at).toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenCreateCase(item)}
                        >
                          <FileWarning className="h-4 w-4 mr-1" />
                          创建CASE
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      )}

      {/* 创建CASE对话框 */}
      <Dialog open={isCreateCaseOpen} onOpenChange={setIsCreateCaseOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-primary" />
              创建差异CASE
            </DialogTitle>
          </DialogHeader>
          
          {selectedDiscrepancy && (
            <div className="space-y-4">
              {/* 差异信息 */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">物流跟踪号</span>
                  <code className="text-sm font-medium">{selectedDiscrepancy.shipment.tracking_number}</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">差异类型</span>
                  {getDiscrepancyBadge(selectedDiscrepancy.discrepancyType)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">差异数量</span>
                  <span className={cn(
                    "font-bold",
                    selectedDiscrepancy.discrepancyType === "quantity_less" ? "text-destructive" : "text-amber-500"
                  )}>
                    {selectedDiscrepancy.discrepancyType === "quantity_less" ? "-" : "+"}{selectedDiscrepancy.difference} 件
                  </span>
                </div>
              </div>

              {/* 表单 */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>CASE类型</Label>
                  <Select
                    value={caseForm.caseType}
                    onValueChange={(v) => setCaseForm(prev => ({ ...prev, caseType: v as CaseType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(caseTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>标题</Label>
                  <Input
                    value={caseForm.title}
                    onChange={(e) => setCaseForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>描述</Label>
                  <Textarea
                    value={caseForm.description}
                    onChange={(e) => setCaseForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>索赔金额 (USD)</Label>
                  <Input
                    type="number"
                    placeholder="可选"
                    value={caseForm.claimAmount}
                    onChange={(e) => setCaseForm(prev => ({ ...prev, claimAmount: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateCaseOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreateCase}
              disabled={createCaseMutation.isPending || !caseForm.title}
              className="gradient-primary"
            >
              <Plus className="h-4 w-4 mr-1" />
              创建CASE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
