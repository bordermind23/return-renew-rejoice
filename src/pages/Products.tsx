import { useState, useRef } from "react";
import { Search, Plus, Trash2, Edit, Package, Puzzle, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useProductParts,
  useCreateProductPart,
  useDeleteProductPart,
  type Product,
  type ProductPart,
} from "@/hooks/useProducts";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isPartsDialogOpen, setIsPartsDialogOpen] = useState(false);
  const [newPartName, setNewPartName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    category: "",
    image: "",
  });

  const { data: products, isLoading } = useProducts();
  const { data: parts } = useProductParts(selectedProductId);
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();
  const createPartMutation = useCreateProductPart();
  const deletePartMutation = useDeleteProductPart();

  const filteredData = (products || []).filter((item) => {
    const matchesSearch =
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const columns = [
    {
      key: "image",
      header: "图片",
      render: (item: Product) => (
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden cursor-pointer">
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
          </HoverCardTrigger>
          {item.image && (
            <HoverCardContent className="w-64 p-2" side="right">
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-auto rounded-lg"
              />
            </HoverCardContent>
          )}
        </HoverCard>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      render: (item: Product) => (
        <span className="font-mono font-medium text-primary">{item.sku}</span>
      ),
    },
    { key: "name", header: "产品名称" },
    {
      key: "category",
      header: "分类",
      render: (item: Product) => (
        <Badge variant="secondary">{item.category || "未分类"}</Badge>
      ),
    },
    {
      key: "actions",
      header: "操作",
      render: (item: Product) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedProductId(item.id);
              setIsPartsDialogOpen(true);
            }}
            title="管理配件"
          >
            <Puzzle className="h-4 w-4" />
          </Button>
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

  const handleEdit = (item: Product) => {
    setEditingProduct(item);
    setFormData({
      sku: item.sku,
      name: item.name,
      category: item.category || "",
      image: item.image || "",
    });
    setImagePreview(item.image || null);
    setIsDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片大小不能超过5MB");
      return;
    }

    setIsUploading(true);
    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      setFormData({ ...formData, image: urlData.publicUrl });
      setImagePreview(urlData.publicUrl);
      toast.success("图片上传成功");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("图片上传失败");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, image: "" });
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!formData.sku || !formData.name) {
      toast.error("请填写SKU和产品名称");
      return;
    }

    try {
      if (editingProduct) {
        await updateMutation.mutateAsync({
          id: editingProduct.id,
          ...formData,
        });
        toast.success("产品更新成功");
      } else {
        await createMutation.mutateAsync(formData);
        toast.success("产品创建成功");
      }
      resetForm();
    } catch (error) {
      toast.error("操作失败，请重试");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast.success("产品删除成功");
      setDeleteId(null);
    } catch (error) {
      toast.error("删除失败，请重试");
    }
  };

  const handleAddPart = async () => {
    if (!newPartName.trim() || !selectedProductId) return;
    try {
      await createPartMutation.mutateAsync({
        name: newPartName.trim(),
        product_id: selectedProductId,
      });
      toast.success("配件添加成功");
      setNewPartName("");
    } catch (error) {
      toast.error("添加配件失败");
    }
  };

  const handleDeletePart = async (partId: string) => {
    if (!selectedProductId) return;
    try {
      await deletePartMutation.mutateAsync({ id: partId, productId: selectedProductId });
      toast.success("配件删除成功");
    } catch (error) {
      toast.error("删除配件失败");
    }
  };

  const resetForm = () => {
    setFormData({ sku: "", name: "", category: "", image: "" });
    setEditingProduct(null);
    setIsDialogOpen(false);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const selectedProduct = products?.find((p) => p.id === selectedProductId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="产品管理"
        description="管理产品信息和配件"
        actions={
        <Button onClick={() => {
          setEditingProduct(null);
          setFormData({ sku: "", name: "", category: "", image: "" });
          setIsDialogOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          添加产品
        </Button>
        }
      />

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索SKU或产品名称..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <DataTable columns={columns} data={filteredData} />
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "编辑产品" : "添加产品"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) =>
                  setFormData({ ...formData, sku: e.target.value })
                }
                placeholder="输入产品SKU"
                disabled={!!editingProduct}
                className={editingProduct ? "bg-muted cursor-not-allowed" : ""}
              />
              {editingProduct && (
                <p className="text-xs text-muted-foreground">SKU创建后不可修改</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">产品名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="输入产品名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">分类</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                placeholder="输入产品分类"
              />
            </div>
            <div className="space-y-2">
              <Label>产品图片</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              {imagePreview ? (
                <HoverCard openDelay={200} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border cursor-pointer group">
                      <img
                        src={imagePreview}
                        alt="产品图片预览"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-64 p-2" side="right">
                    <img
                      src={imagePreview}
                      alt="产品图片预览"
                      className="w-full h-auto rounded-lg"
                    />
                  </HoverCardContent>
                </HoverCard>
              ) : (
                <label
                  htmlFor="image-upload"
                  className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors"
                >
                  {isUploading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">上传图片</span>
                    </>
                  )}
                </label>
              )}
              <p className="text-xs text-muted-foreground">支持 JPG、PNG 格式，最大 5MB</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={resetForm}>
              取消
            </Button>
            <Button onClick={handleSubmit}>
              {editingProduct ? "更新" : "创建"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Parts Management Dialog */}
      <Dialog open={isPartsDialogOpen} onOpenChange={setIsPartsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              管理配件 - {selectedProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newPartName}
                onChange={(e) => setNewPartName(e.target.value)}
                placeholder="输入配件名称"
                onKeyDown={(e) => e.key === "Enter" && handleAddPart()}
              />
              <Button onClick={handleAddPart}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {parts?.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  暂无配件
                </p>
              ) : (
                parts?.map((part) => (
                  <div
                    key={part.id}
                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                  >
                    <span>{part.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleDeletePart(part.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销，确定要删除这个产品吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
