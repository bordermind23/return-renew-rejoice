import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InboundItem {
  id: string;
  lpn: string;
  removal_order_id: string;
  product_sku: string;
  product_name: string;
  return_reason: string | null;
  grade: "A" | "B" | "C" | "new";
  package_photo: string | null;
  product_photo: string | null;
  missing_parts: string[] | null;
  processed_at: string;
  processed_by: string;
  created_at: string;
  tracking_number: string | null;
  shipment_id: string | null;
}

export type InboundItemInsert = Omit<InboundItem, "id" | "created_at" | "package_photo" | "product_photo"> & { 
  package_photo?: string | null; 
  product_photo?: string | null;
};
export type InboundItemUpdate = Partial<InboundItemInsert>;

export const useInboundItems = () => {
  return useQuery({
    queryKey: ["inbound_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_items")
        .select("*")
        .order("processed_at", { ascending: false });

      if (error) throw error;
      return data as InboundItem[];
    },
  });
};

export const useCreateInboundItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: InboundItemInsert) => {
      const { data, error } = await supabase
        .from("inbound_items")
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbound_items"] });
      toast.success("入库记录创建成功");
    },
    onError: (error) => {
      toast.error("创建失败: " + error.message);
    },
  });
};

export const useUpdateInboundItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & InboundItemUpdate) => {
      const { data, error } = await supabase
        .from("inbound_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbound_items"] });
      toast.success("入库记录更新成功");
    },
    onError: (error) => {
      toast.error("更新失败: " + error.message);
    },
  });
};

export const useDeleteInboundItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("inbound_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbound_items"] });
      toast.success("入库记录删除成功");
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });
};

// 通过 LPN 获取入库记录（用于查看照片）
export const useInboundItemByLpn = (lpn: string | null) => {
  return useQuery({
    queryKey: ["inbound_items", "by_lpn", lpn],
    queryFn: async () => {
      if (!lpn) return null;
      const { data, error } = await supabase
        .from("inbound_items")
        .select("*")
        .eq("lpn", lpn)
        .maybeSingle();

      if (error) throw error;
      return data as InboundItem | null;
    },
    enabled: !!lpn,
  });
};
