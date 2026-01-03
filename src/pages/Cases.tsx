import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Eye, Ban, MessageSquare, ExternalLink, Filter, Euro, Settings, Camera, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { CaseStatusBadge } from "@/components/ui/case-status-badge";
import { CaseTypeBadge } from "@/components/ui/case-type-badge";
import {
  useCases,
  useCreateCase,
  useUpdateCase,
  useDeleteCase,
  useCaseNotes,
  useCreateCaseNote,
  caseTypeLabels,
  caseStatusLabels,
  type Case,
  type CaseType,
  type CaseStatus,
} from "@/hooks/useCases";
import { useCaseTypes } from "@/hooks/useCaseTypes";
import CaseTypeManager from "@/components/CaseTypeManager";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { format } from "date-fns";

const caseStatuses: CaseStatus[] = ['pending', 'submitted', 'in_progress', 'approved', 'rejected', 'closed', 'voided'];

export default function Cases() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const { data: cases, isLoading } = useCases();
  const { data: caseTypes } = useCaseTypes();
  const { data: notes } = useCaseNotes(selectedCase?.id || null);
  
  // 查询关联的入库记录（根据LPN或tracking_number）
  const { data: relatedInboundItem } = useQuery({
    queryKey: ["related-inbound-item", selectedCase?.lpn, selectedCase?.tracking_number],
    enabled: !!(selectedCase?.lpn || selectedCase?.tracking_number),
    queryFn: async () => {
      let query = supabase.from("inbound_items").select("*");
      
      if (selectedCase?.lpn) {
        query = query.ilike("lpn", selectedCase.lpn);
      } else if (selectedCase?.tracking_number) {
        query = query.eq("tracking_number", selectedCase.tracking_number);
      }
      
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useCreateCase();
  const updateMutation = useUpdateCase();
  const deleteMutation = useDeleteCase();
  const createNoteMutation = useCreateCaseNote();
  const { t } = useLanguage();

  // 构建类型标签映射
  const typeLabels = caseTypes?.reduce((acc, ct) => {
    acc[ct.code] = ct.label;
    return acc;
  }, {} as Record<string, string>) || caseTypeLabels;

  // 获取状态翻译
  const getStatusLabel = (status: CaseStatus) => t.cases.statuses[status] || caseStatusLabels[status];

  const [formData, setFormData] = useState({
    case_type: 'lpn_missing' as CaseType,
    title: '',
    description: '',
    lpn: '',
    tracking_number: '',
    removal_order_id: '',
    expected_sku: '',
    actual_sku: '',
    damage_description: '',
    amazon_case_id: '',
    amazon_case_url: '',
    claim_amount: '',
    currency: 'EUR',
  });

  const resetForm = () => {
    setFormData({
      case_type: 'lpn_missing',
      title: '',
      description: '',
      lpn: '',
      tracking_number: '',
      removal_order_id: '',
      expected_sku: '',
      actual_sku: '',
      damage_description: '',
      amazon_case_id: '',
      amazon_case_url: '',
      claim_amount: '',
      currency: 'EUR',
    });
  };

  const handleCreate = () => {
    if (!formData.title.trim()) {
      toast.error("请输入CASE标题");
      return;
    }

    createMutation.mutate({
      case_type: formData.case_type,
      status: 'pending',
      title: formData.title,
      description: formData.description || null,
      lpn: formData.lpn || null,
      tracking_number: formData.tracking_number || null,
      removal_order_id: formData.removal_order_id || null,
      expected_sku: formData.expected_sku || null,
      actual_sku: formData.actual_sku || null,
      damage_description: formData.damage_description || null,
      amazon_case_id: formData.amazon_case_id || null,
      amazon_case_url: formData.amazon_case_url || null,
      claim_amount: formData.claim_amount ? parseFloat(formData.claim_amount) : null,
      currency: formData.currency,
      order_id: null,
      missing_items: null,
      approved_amount: null,
      submitted_at: null,
      resolved_at: null,
      created_by: '操作员',
    }, {
      onSuccess: () => {
        setIsCreateOpen(false);
        resetForm();
      },
    });
  };

  const handleStatusChange = (caseId: string, newStatus: CaseStatus) => {
    const updates: any = { status: newStatus };
    if (newStatus === 'submitted' && !selectedCase?.submitted_at) {
      updates.submitted_at = new Date().toISOString();
    }
    if (['approved', 'rejected', 'closed'].includes(newStatus) && !selectedCase?.resolved_at) {
      updates.resolved_at = new Date().toISOString();
    }
    updateMutation.mutate({ id: caseId, ...updates });
  };

  const handleAddNote = () => {
    if (!noteContent.trim() || !selectedCase) return;
    createNoteMutation.mutate({
      case_id: selectedCase.id,
      content: noteContent,
      note_type: 'note',
      created_by: '操作员',
    }, {
      onSuccess: () => setNoteContent(''),
    });
  };

  const handleVoid = () => {
    if (deleteId) {
      updateMutation.mutate({ id: deleteId, status: 'voided' }, {
        onSuccess: () => {
          setDeleteId(null);
          toast.success("CASE已作废");
        },
      });
    }
  };

  // 过滤数据
  const filteredCases = (cases || []).filter(c => {
    const matchesSearch = !searchTerm || 
      c.case_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.lpn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.amazon_case_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || c.case_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // 统计数据
  const stats = {
    total: cases?.length || 0,
    pending: cases?.filter(c => c.status === 'pending').length || 0,
    inProgress: cases?.filter(c => ['submitted', 'in_progress'].includes(c.status)).length || 0,
    approved: cases?.filter(c => c.status === 'approved').length || 0,
    totalClaimed: cases?.reduce((sum, c) => sum + (c.claim_amount || 0), 0) || 0,
    totalApproved: cases?.reduce((sum, c) => sum + (c.approved_amount || 0), 0) || 0,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      <PageHeader
        title={t.cases.title}
        description={t.cases.description}
      />

      <Tabs defaultValue="cases" className="space-y-6">
        <TabsList>
          <TabsTrigger value="cases">{t.cases.caseList}</TabsTrigger>
          <TabsTrigger value="types" className="gap-2">
            <Settings className="h-4 w-4" />
            {t.cases.typeManagement}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="space-y-6">
          {/* 新建按钮 */}
          <div className="flex justify-end">
            <Button onClick={() => setIsCreateOpen(true)} className="gradient-primary">
              <Plus className="mr-2 h-4 w-4" />
              {t.cases.createCase}
            </Button>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">{t.cases.totalCases}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-sm text-muted-foreground">{t.cases.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            <p className="text-sm text-muted-foreground">{t.cases.inProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">€{stats.totalApproved.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground">{t.cases.approvedAmount}</p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`${t.common.search} ${t.cases.caseNumber}, ${t.common.title}, LPN...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder={t.common.type} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.common.all} {t.common.type}</SelectItem>
            {caseTypes?.map((type) => (
              <SelectItem key={type.code} value={type.code}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder={t.common.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.common.all} {t.common.status}</SelectItem>
            {caseStatuses.map((status) => (
              <SelectItem key={status} value={status}>{getStatusLabel(status)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 数据表格 */}
      <Card>
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold min-w-[120px]">{t.cases.caseNumber}</TableHead>
                <TableHead className="font-semibold min-w-[100px]">{t.common.type}</TableHead>
                <TableHead className="font-semibold min-w-[80px]">{t.common.status}</TableHead>
                <TableHead className="font-semibold min-w-[200px]">{t.common.title}</TableHead>
                <TableHead className="font-semibold min-w-[100px]">{t.cases.lpn}</TableHead>
                <TableHead className="font-semibold min-w-[120px]">{t.cases.amazonCaseId}</TableHead>
                <TableHead className="font-semibold min-w-[100px] text-right">{t.cases.claimAmount}</TableHead>
                <TableHead className="font-semibold min-w-[100px] text-right">{t.cases.approvedAmount}</TableHead>
                <TableHead className="font-semibold min-w-[120px]">{t.common.createdAt}</TableHead>
                <TableHead className="font-semibold min-w-[100px] text-center">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                    {t.cases.noCases}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCases.map((item) => (
                  <TableRow 
                    key={item.id} 
                    className={item.status === 'voided' ? "opacity-50 bg-muted/20" : "hover:bg-muted/30"}
                  >
                    <TableCell>
                      <code className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        item.status === 'voided' ? 'bg-muted text-muted-foreground line-through' : 'bg-primary/10 text-primary'
                      }`}>
                        {item.case_number}
                      </code>
                    </TableCell>
                    <TableCell><CaseTypeBadge type={item.case_type} /></TableCell>
                    <TableCell><CaseStatusBadge status={item.status} /></TableCell>
                    <TableCell><span className={`line-clamp-1 ${item.status === 'voided' ? 'line-through text-muted-foreground' : ''}`}>{item.title}</span></TableCell>
                    <TableCell>
                      {item.lpn ? (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.lpn}</code>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {item.amazon_case_id ? (
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.amazon_case_id}</code>
                          {item.amazon_case_url && (
                            <a href={item.amazon_case_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3 text-primary" />
                            </a>
                          )}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.claim_amount ? `${item.currency} ${item.claim_amount.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.approved_amount ? (
                        <span className="text-green-600 font-medium">
                          {item.currency} {item.approved_amount.toFixed(2)}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(item.created_at), 'yyyy/MM/dd HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedCase(item)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {item.status !== 'voided' && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-muted-foreground hover:text-foreground" 
                            onClick={() => setDeleteId(item.id)}
                            title="作废此CASE"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>
        </TabsContent>

        <TabsContent value="types">
          <CaseTypeManager />
        </TabsContent>
      </Tabs>

      {/* 创建CASE对话框 */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建CASE</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CASE类型 *</Label>
                <Select value={formData.case_type} onValueChange={(v) => setFormData({ ...formData, case_type: v as CaseType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {caseTypes?.map((type) => (
                      <SelectItem key={type.code} value={type.code}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>货币</Label>
                <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>标题 *</Label>
              <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="简要描述问题" />
            </div>
            <div className="space-y-2">
              <Label>问题描述</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="详细描述问题情况..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>LPN</Label>
                <Input value={formData.lpn} onChange={(e) => setFormData({ ...formData, lpn: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>跟踪号</Label>
                <Input value={formData.tracking_number} onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>移除订单号</Label>
                <Input value={formData.removal_order_id} onChange={(e) => setFormData({ ...formData, removal_order_id: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>索赔金额</Label>
                <Input type="number" step="0.01" value={formData.claim_amount} onChange={(e) => setFormData({ ...formData, claim_amount: e.target.value })} />
              </div>
            </div>
            {formData.case_type === 'sku_mismatch' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>预期SKU</Label>
                  <Input value={formData.expected_sku} onChange={(e) => setFormData({ ...formData, expected_sku: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>实际SKU</Label>
                  <Input value={formData.actual_sku} onChange={(e) => setFormData({ ...formData, actual_sku: e.target.value })} />
                </div>
              </div>
            )}
            {formData.case_type === 'product_damaged' && (
              <div className="space-y-2">
                <Label>损坏描述</Label>
                <Textarea value={formData.damage_description} onChange={(e) => setFormData({ ...formData, damage_description: e.target.value })} placeholder="描述产品损坏情况..." />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>亚马逊CASE ID</Label>
                <Input value={formData.amazon_case_id} onChange={(e) => setFormData({ ...formData, amazon_case_id: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>亚马逊CASE链接</Label>
                <Input value={formData.amazon_case_url} onChange={(e) => setFormData({ ...formData, amazon_case_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>取消</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>创建</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 查看/编辑CASE对话框 */}
      <Dialog open={!!selectedCase} onOpenChange={(open) => !open && setSelectedCase(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <code className="text-sm bg-primary/10 text-primary px-2 py-1 rounded">{selectedCase?.case_number}</code>
              <CaseTypeBadge type={selectedCase?.case_type || 'other'} />
              <CaseStatusBadge status={selectedCase?.status || 'pending'} />
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 py-4">
              {/* 基本信息 */}
              <div>
                <h3 className="font-semibold mb-3">基本信息</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">标题：</span>{selectedCase?.title}</div>
                  <div><span className="text-muted-foreground">LPN：</span>{selectedCase?.lpn || '-'}</div>
                  <div><span className="text-muted-foreground">跟踪号：</span>{selectedCase?.tracking_number || '-'}</div>
                  <div><span className="text-muted-foreground">移除订单号：</span>{selectedCase?.removal_order_id || '-'}</div>
                  {selectedCase?.description && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">描述：</span>
                      <p className="mt-1">{selectedCase.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 索赔信息 */}
              <div className="p-4 rounded-lg bg-muted/30">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Euro className="h-4 w-4" />
                  索赔信息
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">索赔金额：</span>
                    <span className="font-medium">
                      {selectedCase?.claim_amount ? `${selectedCase.currency} ${selectedCase.claim_amount.toFixed(2)}` : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">批准金额：</span>
                    <span className="font-medium text-green-600">
                      {selectedCase?.approved_amount ? `${selectedCase.currency} ${selectedCase.approved_amount.toFixed(2)}` : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">亚马逊CASE ID：</span>
                    {selectedCase?.amazon_case_id || '-'}
                  </div>
                  <div>
                    {selectedCase?.amazon_case_url && (
                      <a href={selectedCase.amazon_case_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        查看亚马逊CASE <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* 状态更新 */}
              <div>
                <h3 className="font-semibold mb-3">更新状态</h3>
                <div className="flex flex-wrap gap-2">
                  {caseStatuses.map((status) => (
                    <Button
                      key={status}
                      variant={selectedCase?.status === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => selectedCase && handleStatusChange(selectedCase.id, status)}
                      disabled={updateMutation.isPending}
                    >
                      {caseStatusLabels[status]}
                    </Button>
                  ))}
                </div>
                {selectedCase?.status === 'approved' && (
                  <div className="mt-4 flex items-center gap-2">
                    <Label>批准金额：</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-32"
                      placeholder="0.00"
                      onBlur={(e) => {
                        if (selectedCase && e.target.value) {
                          updateMutation.mutate({ id: selectedCase.id, approved_amount: parseFloat(e.target.value) });
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              {/* 关联入库发现 */}
              {relatedInboundItem && (
                <div className="p-4 rounded-lg bg-amber-50/50 border border-amber-200">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-800">
                    <Package className="h-4 w-4" />
                    关联入库发现
                  </h3>
                  <div className="space-y-4">
                    {/* 基本信息 */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">LPN：</span>{relatedInboundItem.lpn}</div>
                      <div><span className="text-muted-foreground">SKU：</span>{relatedInboundItem.product_sku}</div>
                      <div className="col-span-2"><span className="text-muted-foreground">产品：</span>{relatedInboundItem.product_name}</div>
                    </div>

                    {/* 缺失配件 */}
                    {relatedInboundItem.missing_parts && relatedInboundItem.missing_parts.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-amber-700 mb-2">缺失配件：</p>
                        <div className="flex flex-wrap gap-1">
                          {relatedInboundItem.missing_parts.map((part: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                              {part}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 损坏照片 */}
                    {(relatedInboundItem.damage_photo_1 || relatedInboundItem.damage_photo_2 || relatedInboundItem.damage_photo_3) && (
                      <div>
                        <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                          <Camera className="h-4 w-4" />
                          产品损坏照片：
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {[relatedInboundItem.damage_photo_1, relatedInboundItem.damage_photo_2, relatedInboundItem.damage_photo_3]
                            .filter(Boolean)
                            .map((photo: string, idx: number) => (
                              <div
                                key={idx}
                                className="aspect-square rounded-lg overflow-hidden border border-red-200 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setLightboxImage(photo)}
                              >
                                <img src={photo} alt={`损坏照片 ${idx + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* 其他相关照片 */}
                    {(relatedInboundItem.accessories_photo || relatedInboundItem.package_accessories_photo) && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">相关照片：</p>
                        <div className="grid grid-cols-4 gap-2">
                          {relatedInboundItem.accessories_photo && (
                            <div
                              className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setLightboxImage(relatedInboundItem.accessories_photo)}
                            >
                              <img src={relatedInboundItem.accessories_photo} alt="配件展示" className="w-full h-full object-cover" />
                            </div>
                          )}
                          {relatedInboundItem.package_accessories_photo && (
                            <div
                              className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setLightboxImage(relatedInboundItem.package_accessories_photo)}
                            >
                              <img src={relatedInboundItem.package_accessories_photo} alt="包装配件同框" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 跟进记录 */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  跟进记录
                </h3>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="添加跟进记录..."
                      rows={2}
                      className="flex-1"
                    />
                    <Button onClick={handleAddNote} disabled={!noteContent.trim() || createNoteMutation.isPending}>
                      添加
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {notes?.map((note) => (
                      <div key={note.id} className="p-3 rounded-lg bg-muted/30 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{note.created_by}</span>
                          <span className="text-muted-foreground text-xs">
                            {format(new Date(note.created_at), 'yyyy/MM/dd HH:mm')}
                          </span>
                        </div>
                        <p>{note.content}</p>
                      </div>
                    ))}
                    {(!notes || notes.length === 0) && (
                      <p className="text-muted-foreground text-sm text-center py-4">暂无跟进记录</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* 作废确认 */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认作废</AlertDialogTitle>
            <AlertDialogDescription>确定要作废此CASE吗？作废后CASE将显示为灰色，无法恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid} className="bg-muted text-muted-foreground hover:bg-muted/80">
              作废
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
