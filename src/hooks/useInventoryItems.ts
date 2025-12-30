import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InventoryItem {
  id: string;
  sku: string;
  product_name: string;
  product_category: string | null;
  warehouse: string;
  total_stock: number;
  new_stock: number;
  grade_a_stock: number;
  grade_b_stock: number;
  grade_c_stock: number;
  product_image: string | null;
  created_at: string;
  updated_at: string;
}

export type InventoryItemInsert = Omit<InventoryItem, "id" | "created_at" | "updated_at" | "product_image"> & { product_image?: string | null };
export type InventoryItemUpdate = Partial<InventoryItemInsert>;

export const useInventoryItems = () => {
  return useQuery({
    queryKey: ["inventory_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as InventoryItem[];
    },
  });
};

export const useCreateInventoryItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: InventoryItemInsert) => {
      const { data, error } = await supabase
        .from("inventory_items")
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      toast.success("库存创建成功");
    },
    onError: (error) => {
      toast.error("创建失败: " + error.message);
    },
  });
};

export const useUpdateInventoryItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & InventoryItemUpdate) => {
      const { data, error } = await supabase
        .from("inventory_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      toast.success("库存更新成功");
    },
    onError: (error) => {
      toast.error("更新失败: " + error.message);
    },
  });
};

export const useDeleteInventoryItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("inventory_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      toast.success("库存删除成功");
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });
};

// 入库时更新库存数量
export const useUpdateInventoryStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sku,
      product_name,
      grade,
      quantity = 1,
    }: {
      sku: string;
      product_name: string;
      grade: "A" | "B" | "C" | "new";
      quantity?: number;
    }) => {
      // 先查询是否已存在该 SKU 的库存记录
      const { data: existing, error: queryError } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("sku", sku)
        .maybeSingle();

      if (queryError) throw queryError;

      if (existing) {
        // 更新现有库存
        const updates: Record<string, number> = {
          total_stock: existing.total_stock + quantity,
        };

        // 根据 grade 更新对应的库存字段
        switch (grade) {
          case "new":
            updates.new_stock = existing.new_stock + quantity;
            break;
          case "A":
            updates.grade_a_stock = existing.grade_a_stock + quantity;
            break;
          case "B":
            updates.grade_b_stock = existing.grade_b_stock + quantity;
            break;
          case "C":
            updates.grade_c_stock = existing.grade_c_stock + quantity;
            break;
        }

        const { data, error } = await supabase
          .from("inventory_items")
          .update(updates)
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // 创建新的库存记录
        const { data, error } = await supabase
          .from("inventory_items")
          .insert({
            sku,
            product_name,
            total_stock: quantity,
            new_stock: grade === "new" ? quantity : 0,
            grade_a_stock: grade === "A" ? quantity : 0,
            grade_b_stock: grade === "B" ? quantity : 0,
            grade_c_stock: grade === "C" ? quantity : 0,
            warehouse: "华东仓",
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
    },
    onError: (error) => {
      console.error("库存更新失败:", error.message);
    },
  });
};
