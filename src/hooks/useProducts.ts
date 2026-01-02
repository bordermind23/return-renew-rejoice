import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { logOperation } from "./useOperationLogs";

export type Product = Tables<"products">;
export type ProductPart = Tables<"product_parts">;
export type ProductCategory = Tables<"product_categories">;

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useProductParts(productId: string | null) {
  return useQuery({
    queryKey: ["product_parts", productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from("product_parts")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ProductPart[];
    },
    enabled: !!productId,
  });
}

export function useProductCategories() {
  return useQuery({
    queryKey: ["product_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as ProductCategory[];
    },
  });
}

export function useCreateProductCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("product_categories")
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_categories"] });
    },
  });
}

export function useDeleteProductCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_categories"] });
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (product: TablesInsert<"products">) => {
      const { data, error } = await supabase
        .from("products")
        .insert(product)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      logOperation({
        entityType: "product",
        entityId: data.id,
        action: "create",
        details: { sku: data.sku, name: data.name },
      });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: TablesUpdate<"products"> & { id: string }) => {
      const { data, error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      logOperation({
        entityType: "product",
        entityId: data.id,
        action: "update",
        details: { sku: data.sku, name: data.name },
      });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      logOperation({
        entityType: "product",
        entityId: id,
        action: "delete",
      });
    },
  });
}

export function useCreateProductPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (part: TablesInsert<"product_parts">) => {
      const { data, error } = await supabase
        .from("product_parts")
        .insert(part)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["product_parts", variables.product_id] });
    },
  });
}

export function useUpdateProductPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, productId, quantity, image }: { id: string; productId: string; quantity?: number; image?: string | null }) => {
      const updates: { quantity?: number; image?: string | null } = {};
      if (quantity !== undefined) updates.quantity = quantity;
      if (image !== undefined) updates.image = image;
      
      const { data, error } = await supabase
        .from("product_parts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return { data, productId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["product_parts", result.productId] });
    },
  });
}

export function useDeleteProductPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
      const { error } = await supabase.from("product_parts").delete().eq("id", id);
      if (error) throw error;
      return productId;
    },
    onSuccess: (productId) => {
      queryClient.invalidateQueries({ queryKey: ["product_parts", productId] });
    },
  });
}
