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
  // 照片字段
  lpn_label_photo: string | null;
  packaging_photo_1: string | null;
  packaging_photo_2: string | null;
  packaging_photo_3: string | null;
  packaging_photo_4: string | null;
  packaging_photo_5: string | null;
  packaging_photo_6: string | null;
  accessories_photo: string | null;
  detail_photo: string | null;
  // 翻新字段
  refurbished_at: string | null;
  refurbished_by: string | null;
  refurbishment_grade: string | null;
  refurbishment_photos: string[] | null;
  refurbishment_videos: string[] | null;
  refurbishment_notes: string | null;
}

export type InboundItemInsert = Omit<InboundItem, "id" | "created_at" | "package_photo" | "product_photo" | "lpn_label_photo" | "packaging_photo_1" | "packaging_photo_2" | "packaging_photo_3" | "packaging_photo_4" | "packaging_photo_5" | "packaging_photo_6" | "accessories_photo" | "detail_photo" | "refurbished_at" | "refurbished_by" | "refurbishment_grade" | "refurbishment_photos" | "refurbishment_videos" | "refurbishment_notes"> & { 
  package_photo?: string | null; 
  product_photo?: string | null;
  lpn_label_photo?: string | null;
  packaging_photo_1?: string | null;
  packaging_photo_2?: string | null;
  packaging_photo_3?: string | null;
  packaging_photo_4?: string | null;
  packaging_photo_5?: string | null;
  packaging_photo_6?: string | null;
  accessories_photo?: string | null;
  detail_photo?: string | null;
  refurbished_at?: string | null;
  refurbished_by?: string | null;
  refurbishment_grade?: string | null;
  refurbishment_photos?: string[] | null;
  refurbishment_videos?: string[] | null;
  refurbishment_notes?: string | null;
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
      // 先获取入库记录的 LPN
      const { data: inboundItem, error: fetchError } = await supabase
        .from("inbound_items")
        .select("lpn")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      const lpn = inboundItem?.lpn;

      // 删除入库记录
      const { error: deleteError } = await supabase
        .from("inbound_items")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      // 仅当该 LPN 已不存在任何入库记录时，才回退订单状态
      if (lpn) {
        const { count: remainingCount, error: remainingError } = await supabase
          .from("inbound_items")
          .select("*", { count: "exact", head: true })
          .eq("lpn", lpn);

        if (remainingError) throw remainingError;

        if ((remainingCount || 0) === 0) {
          const { error: updateError } = await supabase
            .from("orders")
            .update({
              inbound_at: null,
              status: "未到货" as const,
            })
            .eq("lpn", lpn);

          if (updateError) {
            console.error("更新订单状态失败:", updateError);
            // 不抛出错误，因为入库记录已经删除成功
          }
        }
      }

      return { lpn };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbound_items"] });
      queryClient.invalidateQueries({ queryKey: ["orders"], exact: false });
      toast.success("入库记录已删除");
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
