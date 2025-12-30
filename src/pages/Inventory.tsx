import { useState } from "react";
import { Search, Filter, Download, Plus, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { GradeBadge } from "@/components/ui/grade-badge";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
  useInventoryItems,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  type InventoryItem,
} from "@/hooks/useInventoryItems";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    sku: "",
    product_name: "",
    product_category: "",
    warehouse: "华东仓",
    total_stock: 0,
    grade_a_stock: 0,
    grade_b_stock: 0,
    grade_c_stock: 0,
  });

  const { data: inventory, isLoading } = useInventoryItems();
  const createMutation = useCreateInventoryItem();
  const updateMutation = useUpdateInventoryItem();
  const deleteMutation = useDeleteInventoryItem();

  const filteredData = (inventory || []).filter((item) => {
    const matchesSearch =
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesWarehouse =
      warehouseFilter === "all" || item.warehouse === warehouseFilter;

    return matchesSearch && matchesWarehouse;
  });

  const columns = [
    {
      key: "sku",
      header: "SKU",
      render: (item: InventoryItem) => (
        <span className="font-mono font-medium text-primary">{item.sku}</span>
      ),
    },
    { key: "product_name", header: "产品名称" },
    { key: "product_category", header: "产品分类" },
    { key: "warehouse", header: "仓库" },
    {
      key: "total_stock",
      header: "总库存",
      render: (item: InventoryItem) => (
        <span className="text-lg font-bold">{item.total_stock}</span>
      ),
    },
    {
      key: "grade_a_stock",
      header: "A级",
      render: (item: InventoryItem) => (
        <div className="flex items-center gap-2">
          <GradeBadge grade="A" />
          <span className="font-medium">{item.grade_a_stock}</span>
        </div>
      ),
    },
    {
      key: "grade_a_stock",
      header: "A级",
      render: (item: InventoryItem) => (
        <div className="flex items-center gap-2">
          <GradeBadge grade="A" />
          <span className="font-medium">{item.grade_a_stock}</span>
        </div>
      ),
    },
    {
      key: "grade_b_stock",
      header: "B级",
      render: (item: InventoryItem) => (
        <div className="flex items-center gap-2">
          <GradeBadge grade="B" />
          <span className="font-medium">{item.grade_b_stock}</span>
        </div>
      ),
    },
    {
      key: "grade_c_stock",
      header: "C级",
      render: (item: InventoryItem) => (
        <div className="flex items-center gap-2">
          <GradeBadge grade="C" />
          <span className="font-medium">{item.grade_c_stock}</span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "操作",
      render: (item: InventoryItem) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(item);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteId(item.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const resetForm = () => {
    setFormData({
      sku: "",
      product_name: "",
      product_category: "",
      warehouse: "华东仓",
      total_stock: 0,
      grade_a_stock: 0,
      grade_b_stock: 0,
      grade_c_stock: 0,
    });
    setEditingItem(null);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      sku: item.sku,
      product_name: item.product_name,
      product_category: item.product_category || "",
      warehouse: item.warehouse,
      total_stock: item.total_stock,
      grade_a_stock: item.grade_a_stock,
      grade_b_stock: item.grade_b_stock,
      grade_c_stock: item.grade_c_stock,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const totalStock =
      formData.grade_a_stock +
      formData.grade_b_stock +
      formData.grade_c_stock;

    if (editingItem) {
      updateMutation.mutate(
        {
          id: editingItem.id,
          ...formData,
          total_stock: totalStock,
        },
        {
          onSuccess: () => {
            setIsDialogOpen(false);
            resetForm();
          },
        }
      );
    } else {
      createMutation.mutate(
        {
          ...formData,
          total_stock: totalStock,
        },
        {
          onSuccess: () => {
            setIsDialogOpen(false);
            resetForm();
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  const handleExport = () => {
    toast.success("库存数据导出成功");
  };

  // Calculate totals
  const totals = filteredData.reduce(
    (acc, item) => ({
      total: acc.total + item.total_stock,
      gradeA: acc.gradeA + item.grade_a_stock,
      gradeB: acc.gradeB + item.grade_b_stock,
      gradeC: acc.gradeC + item.grade_c_stock,
    }),
    { total: 0, gradeA: 0, gradeB: 0, gradeC: 0 }
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="库存管理"
        description="查看和管理所有仓库库存"
        actions={
          <div className="flex gap-2">
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button className="gradient-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  添加库存
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? "编辑库存" : "添加新库存"}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU</Label>
                      <Input
                        id="sku"
                        placeholder="输入SKU"
                        value={formData.sku}
                        onChange={(e) =>
                          setFormData({ ...formData, sku: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="product_name">产品名称</Label>
                      <Input
                        id="product_name"
                        placeholder="输入产品名称"
                        value={formData.product_name}
                        onChange={(e) =>
                          setFormData({ ...formData, product_name: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="product_category">产品分类</Label>
                      <Input
                        id="product_category"
                        placeholder="输入产品分类"
                        value={formData.product_category}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            product_category: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="warehouse">仓库</Label>
                      <Select
                        value={formData.warehouse}
                        onValueChange={(value) =>
                          setFormData({ ...formData, warehouse: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择仓库" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="华东仓">华东仓</SelectItem>
                          <SelectItem value="华南仓">华南仓</SelectItem>
                          <SelectItem value="华北仓">华北仓</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="grade_a_stock">A级库存</Label>
                      <Input
                        id="grade_a_stock"
                        type="number"
                        value={formData.grade_a_stock}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            grade_a_stock: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                            ...formData,
                            grade_a_stock: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="grade_b_stock">B级库存</Label>
                      <Input
                        id="grade_b_stock"
                        type="number"
                        value={formData.grade_b_stock}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            grade_b_stock: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="grade_c_stock">C级库存</Label>
                      <Input
                        id="grade_c_stock"
                        type="number"
                        value={formData.grade_c_stock}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            grade_c_stock: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingItem ? "保存" : "创建"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              导出数据
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">总库存</p>
          <p className="mt-1 text-2xl font-bold">{totals.total}</p>
        </div>
        <div className="rounded-xl border bg-info/10 p-4 text-center">
          <p className="text-sm text-info">A级</p>
          <p className="mt-1 text-2xl font-bold text-info">{totals.gradeA}</p>
        </div>
        <div className="rounded-xl border bg-warning/10 p-4 text-center">
          <p className="text-sm text-warning">B级</p>
          <p className="mt-1 text-2xl font-bold text-warning">{totals.gradeB}</p>
        </div>
        <div className="rounded-xl border bg-destructive/10 p-4 text-center">
          <p className="text-sm text-destructive">C级</p>
          <p className="mt-1 text-2xl font-bold text-destructive">{totals.gradeC}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索SKU或产品名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="仓库筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部仓库</SelectItem>
            <SelectItem value="华东仓">华东仓</SelectItem>
            <SelectItem value="华南仓">华南仓</SelectItem>
            <SelectItem value="华北仓">华北仓</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        emptyMessage="暂无库存记录"
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销，确定要删除此库存记录吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
