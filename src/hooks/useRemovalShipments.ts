import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { mapDatabaseError } from "@/lib/errorHandler";

export interface RemovalShipment {
  id: string;
  order_id: string;
  note: string | null;
  carrier: string;
  tracking_number: string;
  product_sku: string | null;
  product_name: string | null;
  product_image: string | null;
  fnsku: string;
  quantity: number;
  status: "shipping" | "arrived" | "inbound" | "shelved";
  store_name: string | null;
  country: string | null;
  ship_date: string | null;
  msku: string | null;
  product_type: string | null;
  shipping_label_photo: string | null;
  created_at: string;
  updated_at: string;
  duplicate_confirmed: boolean;
}

export type RemovalShipmentInsert = Omit<RemovalShipment, "id" | "created_at" | "updated_at" | "product_image" | "duplicate_confirmed" | "shipping_label_photo"> & { product_image?: string | null; duplicate_confirmed?: boolean; shipping_label_photo?: string | null };
export type RemovalShipmentUpdate = Partial<RemovalShipmentInsert>;

export const useRemovalShipments = () => {
  return useQuery({
    queryKey: ["removal_shipments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("removal_shipments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as RemovalShipment[];
    },
  });
};

export const useCreateRemovalShipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shipment: RemovalShipmentInsert) => {
      const { data, error } = await supabase
        .from("removal_shipments")
        .insert(shipment)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["removal_shipments"] });
      toast.success("货件创建成功");
    },
    onError: (error) => {
      toast.error("创建失败: " + mapDatabaseError(error));
    },
  });
};

export const useBulkCreateRemovalShipments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shipments: RemovalShipmentInsert[]) => {
      const { data, error } = await supabase
        .from("removal_shipments")
        .insert(shipments)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["removal_shipments"] });
      toast.success(`成功导入 ${data.length} 条货件记录`);
    },
    onError: (error) => {
      toast.error("批量导入失败: " + mapDatabaseError(error));
    },
  });
};

export const useUpdateRemovalShipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & RemovalShipmentUpdate) => {
      const { data, error } = await supabase
        .from("removal_shipments")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["removal_shipments"] });
      toast.success("货件更新成功");
    },
    onError: (error) => {
      toast.error("更新失败: " + mapDatabaseError(error));
    },
  });
};

export const useDeleteRemovalShipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("removal_shipments")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["removal_shipments"] });
      toast.success("货件删除成功");
    },
    onError: (error) => {
      toast.error("删除失败: " + mapDatabaseError(error));
    },
  });
};

export const useBulkDeleteRemovalShipments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      // 分批删除，每批最多100条
      const batchSize = 100;
      const batches: string[][] = [];
      
      for (let i = 0; i < ids.length; i += batchSize) {
        batches.push(ids.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const { error } = await supabase
          .from("removal_shipments")
          .delete()
          .in("id", batch);

        if (error) throw error;
      }
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["removal_shipments"] });
      toast.success(`成功删除 ${ids.length} 条货件记录`);
    },
    onError: (error) => {
      toast.error("批量删除失败: " + mapDatabaseError(error));
    },
  });
};

export const useBulkUpdateRemovalShipments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: RemovalShipmentUpdate }) => {
      const { error } = await supabase
        .from("removal_shipments")
        .update(updates)
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: (_, { ids }) => {
      queryClient.invalidateQueries({ queryKey: ["removal_shipments"] });
      toast.success(`成功更新 ${ids.length} 条货件记录`);
    },
    onError: (error) => {
      toast.error("批量更新失败: " + mapDatabaseError(error));
    },
  });
};
