import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RemovalShipment {
  id: string;
  order_id: string;
  note: string | null;
  carrier: string;
  tracking_number: string;
  product_sku: string;
  product_name: string;
  product_image: string | null;
  fnsku: string;
  quantity: number;
  status: "shipping" | "arrived" | "inbound" | "shelved";
  created_at: string;
  updated_at: string;
}

export type RemovalShipmentInsert = Omit<RemovalShipment, "id" | "created_at" | "updated_at" | "product_image"> & { product_image?: string | null };
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
      toast.error("创建失败: " + error.message);
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
      toast.error("更新失败: " + error.message);
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
      toast.error("删除失败: " + error.message);
    },
  });
};
