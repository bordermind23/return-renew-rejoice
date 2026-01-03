import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logOperation } from "./useOperationLogs";

export type CaseType = 'lpn_missing' | 'sku_mismatch' | 'accessory_missing' | 'product_damaged' | 'other';
export type CaseStatus = 'pending' | 'submitted' | 'in_progress' | 'approved' | 'rejected' | 'closed' | 'voided';

export interface Case {
  id: string;
  case_number: string;
  case_type: CaseType;
  status: CaseStatus;
  order_id: string | null;
  lpn: string | null;
  tracking_number: string | null;
  removal_order_id: string | null;
  title: string;
  description: string | null;
  expected_sku: string | null;
  actual_sku: string | null;
  missing_items: string[] | null;
  damage_description: string | null;
  amazon_case_id: string | null;
  amazon_case_url: string | null;
  claim_amount: number | null;
  approved_amount: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  resolved_at: string | null;
  created_by: string;
}

export interface CaseNote {
  id: string;
  case_id: string;
  content: string;
  note_type: string;
  created_at: string;
  created_by: string;
}

export type CaseInsert = Omit<Case, 'id' | 'case_number' | 'created_at' | 'updated_at'>;
export type CaseUpdate = Partial<Omit<CaseInsert, 'created_by'>>;

export const caseTypeLabels: Record<CaseType, string> = {
  lpn_missing: 'LPN产品缺失',
  sku_mismatch: 'SKU不匹配',
  accessory_missing: '配件缺失',
  product_damaged: '产品损坏',
  other: '其他',
};

export const caseStatusLabels: Record<CaseStatus, string> = {
  pending: '待处理',
  submitted: '已提交',
  in_progress: '处理中',
  approved: '已通过',
  rejected: '已拒绝',
  closed: '已关闭',
  voided: '已作废',
};

export const useCases = () => {
  return useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Case[];
    },
  });
};

export const useCase = (id: string | null) => {
  return useQuery({
    queryKey: ["cases", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as Case | null;
    },
  });
};

export const useCaseNotes = (caseId: string | null) => {
  return useQuery({
    queryKey: ["case_notes", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_notes")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CaseNote[];
    },
  });
};

export const useCreateCase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (caseData: Omit<CaseInsert, 'case_number'>) => {
      const insertData = {
        case_type: caseData.case_type,
        status: caseData.status,
        order_id: caseData.order_id,
        lpn: caseData.lpn,
        tracking_number: caseData.tracking_number,
        removal_order_id: caseData.removal_order_id,
        title: caseData.title,
        description: caseData.description,
        expected_sku: caseData.expected_sku,
        actual_sku: caseData.actual_sku,
        missing_items: caseData.missing_items,
        damage_description: caseData.damage_description,
        amazon_case_id: caseData.amazon_case_id,
        amazon_case_url: caseData.amazon_case_url,
        claim_amount: caseData.claim_amount,
        approved_amount: caseData.approved_amount,
        currency: caseData.currency,
        submitted_at: caseData.submitted_at,
        resolved_at: caseData.resolved_at,
        created_by: caseData.created_by,
      };

      const { data, error } = await supabase
        .from("cases")
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return data as Case;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      logOperation({
        entityType: "case",
        entityId: data.id,
        action: "create",
        details: { caseNumber: data.case_number, caseType: data.case_type, title: data.title },
      });
      toast.success("CASE创建成功");
    },
    onError: (error) => {
      toast.error("创建失败: " + error.message);
    },
  });
};

export const useUpdateCase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & CaseUpdate) => {
      const { data, error } = await supabase
        .from("cases")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Case;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      logOperation({
        entityType: "case",
        entityId: data.id,
        action: "update",
        details: { caseNumber: data.case_number, status: data.status },
      });
      toast.success("CASE更新成功");
    },
    onError: (error) => {
      toast.error("更新失败: " + error.message);
    },
  });
};

export const useDeleteCase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cases")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      logOperation({
        entityType: "case",
        entityId: id,
        action: "delete",
      });
      toast.success("CASE删除成功");
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });
};

export const useCreateCaseNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (note: Omit<CaseNote, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from("case_notes")
        .insert(note as any)
        .select()
        .single();

      if (error) throw error;
      return data as CaseNote;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["case_notes", variables.case_id] });
      toast.success("备注添加成功");
    },
    onError: (error) => {
      toast.error("添加备注失败: " + error.message);
    },
  });
};
