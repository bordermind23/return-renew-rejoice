import { useState, useRef } from "react";
import { Search, Plus, Trash2, Edit, Package, Puzzle, Upload, X, Tags, FolderPlus, ImageIcon } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useProductParts,
  useCreateProductPart,
  useUpdateProductPart,
  useDeleteProductPart,
  useProductCategories,
  useCreateProductCategory,
  useDeleteProductCategory,
  type Product,
  type ProductPart,
} from "@/hooks/useProducts";
import { usePermissions } from "@/hooks/usePermissions";
import { AccessDenied } from "@/components/PermissionGuard";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export default function Products() {
  const { can, isLoading: permissionsLoading } = usePermissions();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isPartsDialogOpen, setIsPartsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newPartName, setNewPartName] = useState("");
  const [newPartQuantity, setNewPartQuantity] = useState(1);
  const [newCategoryName, setNewCategoryName] = useState("");
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
  const { data: categories } = useProductCategories();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();
  const createPartMutation = useCreateProductPart();
  const updatePartMutation = useUpdateProductPart();
  const deletePartMutation = useDeleteProductPart();
  const createCategoryMutation = useCreateProductCategory();
  const deleteCategoryMutation = useDeleteProductCategory();

  // Permission checks
  const canManageProducts = can.manageProducts;
  const canDeleteData = can.deleteData;

  const toggleCategoryFilter = (categoryName: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryName)
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const filteredData = (products || []).filter((item) => {
    const matchesSearch =
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = 
      selectedCategories.length === 0 || 
      selectedCategories.includes(item.category || "未分类");
    
    return matchesSearch && matchesCategory;
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
          {canManageProducts && (
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
          )}
          {canDeleteData && (
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
          )}
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

    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片大小不能超过5MB");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (error) throw error;

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
        quantity: newPartQuantity,
      });
      toast.success("配件添加成功");
      setNewPartName("");
      setNewPartQuantity(1);
    } catch (error) {
      toast.error("添加配件失败");
    }
  };

  const handleUpdatePartQuantity = async (partId: string, quantity: number) => {
    if (!selectedProductId || quantity < 1) return;
    try {
      await updatePartMutation.mutateAsync({
        id: partId,
        productId: selectedProductId,
        quantity,
      });
    } catch (error) {
      toast.error("更新数量失败");
    }
  };

  const handlePartImageUpload = async (partId: string, file: File) => {
    if (!selectedProductId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片大小不能超过5MB");
      return;
    }

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `parts/${fileName}`;

      const { error } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      await updatePartMutation.mutateAsync({
        id: partId,
        productId: selectedProductId,
        image: urlData.publicUrl,
      });
      toast.success("配件图片上传成功");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("图片上传失败");
    }
  };

  const handleRemovePartImage = async (partId: string) => {
    if (!selectedProductId) return;
    try {
      await updatePartMutation.mutateAsync({
        id: partId,
        productId: selectedProductId,
        image: null,
      });
      toast.success("配件图片已移除");
    } catch (error) {
      toast.error("移除图片失败");
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

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await createCategoryMutation.mutateAsync(newCategoryName.trim());
      toast.success("分类添加成功");
      setNewCategoryName("");
    } catch (error) {
      toast.error("添加分类失败，可能分类名已存在");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategoryMutation.mutateAsync(id);
      toast.success("分类删除成功");
    } catch (error) {
      toast.error("删除分类失败");
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
          <div className="flex gap-2">
            {canManageProducts && (
              <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)}>
                <Tags className="mr-2 h-4 w-4" />
                分类管理
              </Button>
            )}
            {canManageProducts && (
              <Button onClick={() => {
                setEditingProduct(null);
                setFormData({ sku: "", name: "", category: "", image: "" });
                setImagePreview(null);
                setIsDialogOpen(true);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                添加产品
              </Button>
            )}
          </div>
        }
      />

      {/* Search and Category Filter */}
      <Card>
        <CardContent className="pt-6 space-y-4">
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
      {/* Category Filter - Dropdown Multi-select */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">分类筛选:</span>
            <Select
              value={selectedCategories.length === 0 ? "all" : "custom"}
              onValueChange={(value) => {
                if (value === "all") {
                  setSelectedCategories([]);
                }
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue>
                  {selectedCategories.length === 0 
                    ? "全部分类" 
                    : `已选 ${selectedCategories.length} 个分类`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <div className="p-2 space-y-1">
                  <div 
                    className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                    onClick={() => setSelectedCategories([])}
                  >
                    <div className={`h-4 w-4 border rounded flex items-center justify-center ${selectedCategories.length === 0 ? 'bg-primary border-primary' : 'border-input'}`}>
                      {selectedCategories.length === 0 && <span className="text-primary-foreground text-xs">✓</span>}
                    </div>
                    <span className="text-sm">全部</span>
                  </div>
                  {categories?.map((cat) => (
                    <div 
                      key={cat.id}
                      className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleCategoryFilter(cat.name);
                      }}
                    >
                      <div className={`h-4 w-4 border rounded flex items-center justify-center ${selectedCategories.includes(cat.name) ? 'bg-primary border-primary' : 'border-input'}`}>
                        {selectedCategories.includes(cat.name) && <span className="text-primary-foreground text-xs">✓</span>}
                      </div>
                      <span className="text-sm">{cat.name}</span>
                    </div>
                  ))}
                  <div 
                    className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleCategoryFilter("未分类");
                    }}
                  >
                    <div className={`h-4 w-4 border rounded flex items-center justify-center ${selectedCategories.includes("未分类") ? 'bg-primary border-primary' : 'border-input'}`}>
                      {selectedCategories.includes("未分类") && <span className="text-primary-foreground text-xs">✓</span>}
                    </div>
                    <span className="text-sm">未分类</span>
                  </div>
                </div>
              </SelectContent>
            </Select>
            {selectedCategories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedCategories.map((cat) => (
                  <Badge key={cat} variant="secondary" className="flex items-center gap-1">
                    {cat}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => toggleCategoryFilter(cat)}
                    />
                  </Badge>
                ))}
              </div>
            )}
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
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未分类</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Category Management Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分类管理</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="输入分类名称"
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
              />
              <Button onClick={handleAddCategory}>
                <FolderPlus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {categories?.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  暂无分类
                </p>
              ) : (
                categories?.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                  >
                    <span>{category.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleDeleteCategory(category.id)}
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

      {/* Parts Management Dialog */}
      <Dialog open={isPartsDialogOpen} onOpenChange={setIsPartsDialogOpen}>
        <DialogContent className="max-w-md">
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
                placeholder="配件名称"
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleAddPart()}
              />
              <Input
                type="number"
                value={newPartQuantity}
                onChange={(e) => setNewPartQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                placeholder="数量"
                className="w-20"
                min={1}
              />
              <Button onClick={handleAddPart}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {parts?.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  暂无配件
                </p>
              ) : (
                parts?.map((part) => (
                  <div
                    key={part.id}
                    className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                  >
                    {/* 配件图片 */}
                    <div className="relative group">
                      <div className="h-12 w-12 rounded-lg bg-background overflow-hidden flex items-center justify-center border">
                        {part.image ? (
                          <img
                            src={part.image}
                            alt={part.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                        <label className="cursor-pointer p-1">
                          <Upload className="h-4 w-4 text-white" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handlePartImageUpload(part.id, file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {part.image && (
                          <button
                            onClick={() => handleRemovePartImage(part.id)}
                            className="p-1 ml-1"
                          >
                            <X className="h-4 w-4 text-white" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* 配件名称 */}
                    <span className="flex-1 min-w-0 truncate">{part.name}</span>
                    {/* 数量和删除 */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm text-muted-foreground">数量:</span>
                      <Input
                        type="number"
                        value={part.quantity}
                        onChange={(e) => handleUpdatePartQuantity(part.id, parseInt(e.target.value) || 1)}
                        className="w-16 h-8 text-center"
                        min={1}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => handleDeletePart(part.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
