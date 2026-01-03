import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Package, Search, Filter, Eye, FileText } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { useCreateCase, CaseType } from "@/hooks/useCases";
import { useAuth } from "@/hooks/useAuth";

interface InboundFinding {
  id: string;
  lpn: string;
  product_sku: string;
  product_name: string;
  tracking_number: string | null;
  removal_order_id: string;
  missing_parts: string[] | null;
  grade: string;
  processed_at: string;
  processed_by: string;
  // 破损照片
  damage_photo_1: string | null;
  damage_photo_2: string | null;
  damage_photo_3: string | null;
  // 其他照片
  lpn_label_photo: string | null;
  packaging_photo_1: string | null;
  packaging_photo_2: string | null;
  packaging_photo_3: string | null;
  packaging_photo_4: string | null;
  packaging_photo_5: string | null;
  packaging_photo_6: string | null;
  accessories_photo: string | null;
  package_accessories_photo: string | null;
}

type FindingType = "all" | "missing_parts" | "damaged" | "both";

export default function OrderFindings() {
  const [search, setSearch] = useState("");
  const [findingType, setFindingType] = useState<FindingType>("all");
  const [selectedItem, setSelectedItem] = useState<InboundFinding | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [createCaseItem, setCreateCaseItem] = useState<InboundFinding | null>(null);

  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const createCase = useCreateCase();

  // 查询有配件缺失或产品损坏的入库记录
  const { data: findings = [], isLoading } = useQuery({
    queryKey: ["order-findings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_items")
        .select("*")
        .or("missing_parts.neq.{},damage_photo_1.neq.null")
        .order("processed_at", { ascending: false });

      if (error) throw error;
      return data as InboundFinding[];
    },
  });

  // 查询已创建CASE的LPN列表
  const { data: existingCaseLpns = [] } = useQuery({
    queryKey: ["case-lpns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("lpn")
        .not("lpn", "is", null)
        .neq("status", "voided");

      if (error) throw error;
      return data.map((c) => c.lpn?.toLowerCase()).filter(Boolean) as string[];
    },
  });

  // 检查是否已创建CASE
  const hasCaseCreated = (lpn: string) => {
    return existingCaseLpns.includes(lpn.toLowerCase());
  };

  // 判断是否有配件缺失
  const hasMissingParts = (item: InboundFinding) => {
    return item.missing_parts && item.missing_parts.length > 0;
  };

  // 判断是否有产品损坏
  const hasDamage = (item: InboundFinding) => {
    return !!(item.damage_photo_1 || item.damage_photo_2 || item.damage_photo_3);
  };

  // 过滤数据
  const filteredFindings = findings.filter((item) => {
    // 搜索过滤
    const matchesSearch =
      !search ||
      item.lpn.toLowerCase().includes(search.toLowerCase()) ||
      item.product_sku.toLowerCase().includes(search.toLowerCase()) ||
      item.product_name.toLowerCase().includes(search.toLowerCase()) ||
      item.removal_order_id.toLowerCase().includes(search.toLowerCase());

    // 类型过滤
    let matchesType = true;
    if (findingType === "missing_parts") {
      matchesType = hasMissingParts(item) && !hasDamage(item);
    } else if (findingType === "damaged") {
      matchesType = hasDamage(item) && !hasMissingParts(item);
    } else if (findingType === "both") {
      matchesType = hasMissingParts(item) && hasDamage(item);
    }

    return matchesSearch && matchesType;
  });

  // 统计数据
  const stats = {
    total: findings.length,
    missingPartsOnly: findings.filter((i) => hasMissingParts(i) && !hasDamage(i)).length,
    damagedOnly: findings.filter((i) => hasDamage(i) && !hasMissingParts(i)).length,
    both: findings.filter((i) => hasMissingParts(i) && hasDamage(i)).length,
  };

  // 获取问题类型标签
  const getIssueTypeBadges = (item: InboundFinding) => {
    const badges = [];
    if (hasMissingParts(item)) {
      badges.push(
        <Badge key="missing" variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          配件缺失
        </Badge>
      );
    }
    if (hasDamage(item)) {
      badges.push(
        <Badge key="damaged" variant="outline" className="bg-red-50 text-red-700 border-red-200">
          产品损坏
        </Badge>
      );
    }
    return badges;
  };

  // 获取破损照片列表
  const getDamagePhotos = (item: InboundFinding) => {
    return [item.damage_photo_1, item.damage_photo_2, item.damage_photo_3].filter(Boolean) as string[];
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold">退货订单发现</h1>
          <p className="text-muted-foreground">配件缺失和产品损坏的订单列表</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setFindingType("all")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">全部问题</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-amber-500 transition-colors" onClick={() => setFindingType("missing_parts")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">仅配件缺失</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.missingPartsOnly}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-red-500 transition-colors" onClick={() => setFindingType("damaged")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">仅产品损坏</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.damagedOnly}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-purple-500 transition-colors" onClick={() => setFindingType("both")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-600">两者兼有</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.both}</div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索 LPN、SKU、产品名称、移除订单号..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={findingType} onValueChange={(v) => setFindingType(v as FindingType)}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="问题类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部问题</SelectItem>
            <SelectItem value="missing_parts">仅配件缺失</SelectItem>
            <SelectItem value="damaged">仅产品损坏</SelectItem>
            <SelectItem value="both">两者兼有</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 列表 */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredFindings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mb-4" />
              <p>暂无符合条件的记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>LPN</TableHead>
                    <TableHead>产品信息</TableHead>
                    <TableHead>问题类型</TableHead>
                    <TableHead>缺失配件</TableHead>
                    <TableHead>入库时间</TableHead>
                    <TableHead>操作人</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFindings.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.lpn}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-sm text-muted-foreground">{item.product_sku}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">{getIssueTypeBadges(item)}</div>
                      </TableCell>
                      <TableCell>
                        {hasMissingParts(item) ? (
                          <div className="text-sm">
                            {item.missing_parts?.join(", ")}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(item.processed_at), "yyyy-MM-dd HH:mm")}
                      </TableCell>
                      <TableCell>{item.processed_by}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedItem(item)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            查看
                          </Button>
                          {hasCaseCreated(item.lpn) ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              已创建CASE
                            </Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCreateCaseItem(item)}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              创建CASE
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 详情弹窗 */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              问题详情 - {selectedItem?.lpn}
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6 pr-4">
                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">产品名称</div>
                    <div className="font-medium">{selectedItem.product_name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">SKU</div>
                    <div className="font-mono">{selectedItem.product_sku}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">移除订单号</div>
                    <div className="font-mono">{selectedItem.removal_order_id}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">运单号</div>
                    <div className="font-mono">{selectedItem.tracking_number || "-"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">入库等级</div>
                    <Badge variant="outline">{selectedItem.grade}</Badge>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">问题类型</div>
                    <div className="flex gap-1 mt-1">{getIssueTypeBadges(selectedItem)}</div>
                  </div>
                </div>

                {/* 缺失配件 */}
                {hasMissingParts(selectedItem) && (
                  <div>
                    <div className="text-sm font-medium mb-2">缺失配件列表</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.missing_parts?.map((part, idx) => (
                        <Badge key={idx} variant="secondary">
                          {part}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* 破损照片 */}
                {hasDamage(selectedItem) && (
                  <div>
                    <div className="text-sm font-medium mb-2">产品破损照片</div>
                    <div className="grid grid-cols-3 gap-3">
                      {getDamagePhotos(selectedItem).map((photo, idx) => (
                        <div
                          key={idx}
                          className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setLightboxImage(photo)}
                        >
                          <img
                            src={photo}
                            alt={`破损照片 ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 其他相关照片 */}
                <div>
                  <div className="text-sm font-medium mb-2">相关照片</div>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedItem.lpn_label_photo && (
                      <div
                        className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setLightboxImage(selectedItem.lpn_label_photo!)}
                      >
                        <img
                          src={selectedItem.lpn_label_photo}
                          alt="LPN标签"
                          className="w-full h-full object-cover"
                        />
                        <div className="text-xs text-center mt-1 text-muted-foreground">LPN标签</div>
                      </div>
                    )}
                    {[
                      selectedItem.packaging_photo_1,
                      selectedItem.packaging_photo_2,
                      selectedItem.packaging_photo_3,
                      selectedItem.packaging_photo_4,
                      selectedItem.packaging_photo_5,
                      selectedItem.packaging_photo_6,
                    ]
                      .filter(Boolean)
                      .map((photo, idx) => (
                        <div
                          key={idx}
                          className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setLightboxImage(photo!)}
                        >
                          <img
                            src={photo!}
                            alt={`包装图 ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    {selectedItem.accessories_photo && (
                      <div
                        className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setLightboxImage(selectedItem.accessories_photo!)}
                      >
                        <img
                          src={selectedItem.accessories_photo}
                          alt="配件展示"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {selectedItem.package_accessories_photo && (
                      <div
                        className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setLightboxImage(selectedItem.package_accessories_photo!)}
                      >
                        <img
                          src={selectedItem.package_accessories_photo}
                          alt="包装配件同框"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* 创建CASE确认弹窗 */}
      <Dialog open={!!createCaseItem} onOpenChange={(open) => !open && setCreateCaseItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              创建CASE
            </DialogTitle>
          </DialogHeader>
          {createCaseItem && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                将为以下问题创建CASE并跳转到CASE管理页面：
              </p>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">LPN</span>
                  <span className="font-mono">{createCaseItem.lpn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">产品</span>
                  <span className="font-medium">{createCaseItem.product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">问题类型</span>
                  <div className="flex gap-1">
                    {hasMissingParts(createCaseItem) && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                        配件缺失
                      </Badge>
                    )}
                    {hasDamage(createCaseItem) && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                        产品损坏
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateCaseItem(null)}>
                  取消
                </Button>
                <Button
                  onClick={async () => {
                    // 根据问题类型决定CASE类型
                    let caseType: CaseType = "other";
                    if (hasMissingParts(createCaseItem) && hasDamage(createCaseItem)) {
                      caseType = "product_damaged"; // 优先用损坏类型
                    } else if (hasDamage(createCaseItem)) {
                      caseType = "product_damaged";
                    } else if (hasMissingParts(createCaseItem)) {
                      caseType = "accessory_missing";
                    }

                    // 构建描述
                    const descriptionParts = [];
                    if (hasMissingParts(createCaseItem)) {
                      descriptionParts.push(`缺失配件: ${createCaseItem.missing_parts?.join(", ")}`);
                    }
                    if (hasDamage(createCaseItem)) {
                      descriptionParts.push("产品有损坏照片");
                    }

                    await createCase.mutateAsync({
                      case_type: caseType,
                      status: "pending",
                      order_id: null,
                      lpn: createCaseItem.lpn,
                      tracking_number: createCaseItem.tracking_number,
                      removal_order_id: createCaseItem.removal_order_id,
                      title: `${createCaseItem.product_name} - ${hasDamage(createCaseItem) ? "产品损坏" : "配件缺失"}`,
                      description: descriptionParts.join("\n"),
                      expected_sku: createCaseItem.product_sku,
                      actual_sku: null,
                      missing_items: createCaseItem.missing_parts,
                      damage_description: hasDamage(createCaseItem) ? "请查看入库时拍摄的损坏照片" : null,
                      amazon_case_id: null,
                      amazon_case_url: null,
                      claim_amount: null,
                      approved_amount: null,
                      currency: "EUR",
                      submitted_at: null,
                      resolved_at: null,
                      created_by: user?.email || "未知用户",
                    });

                    // 刷新已创建CASE的LPN列表
                    queryClient.invalidateQueries({ queryKey: ["case-lpns"] });
                    setCreateCaseItem(null);
                    navigate("/cases");
                  }}
                  disabled={createCase.isPending}
                >
                  {createCase.isPending ? "创建中..." : "确认创建"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 图片灯箱 */}
      {lightboxImage && (
        <ImageLightbox
          images={[lightboxImage]}
          initialIndex={0}
          open={!!lightboxImage}
          onOpenChange={(open) => !open && setLightboxImage(null)}
        />
      )}
    </div>
  );
}
