import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Carrier {
  id: string;
  name: string;
  created_at: string;
}

export const useCarriers = () => {
  return useQuery({
    queryKey: ["carriers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carriers")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Carrier[];
    },
  });
};

export const useCreateCarrier = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("carriers")
        .insert({ name })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
      toast.success("承运商添加成功");
    },
    onError: (error) => {
      toast.error("添加失败: " + error.message);
    },
  });
};

export const useDeleteCarrier = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("carriers")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
      toast.success("承运商删除成功");
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });
};
