import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CaseTypeItem {
  id: string;
  code: string;
  label: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

export const useCaseTypes = () => {
  return useQuery({
    queryKey: ["case_types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_types")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as CaseTypeItem[];
    },
  });
};

export const useCreateCaseType = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (typeData: { code: string; label: string; description?: string }) => {
      const { data, error } = await supabase
        .from("case_types")
        .insert({
          code: typeData.code,
          label: typeData.label,
          description: typeData.description || null,
          is_system: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CaseTypeItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case_types"] });
      toast.success("CASE类型创建成功");
    },
    onError: (error) => {
      if (error.message.includes("duplicate")) {
        toast.error("类型代码已存在");
      } else {
        toast.error("创建失败: " + error.message);
      }
    },
  });
};

export const useUpdateCaseType = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; label?: string; description?: string }) => {
      const { data, error } = await supabase
        .from("case_types")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as CaseTypeItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case_types"] });
      toast.success("CASE类型更新成功");
    },
    onError: (error) => {
      toast.error("更新失败: " + error.message);
    },
  });
};

export const useDeleteCaseType = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("case_types")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case_types"] });
      toast.success("CASE类型删除成功");
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });
};
