import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OperationLog {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  user_email?: string;
}

export type EntityType = 
  | "user"
  | "role"
  | "permission"
  | "inbound_item"
  | "inventory"
  | "order"
  | "product"
  | "case"
  | "refurbishment";

export type ActionType =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "permission_change"
  | "role_change"
  | "inbound"
  | "refurbish"
  | "export"
  | "import";

export const ACTION_LABELS: Record<string, string> = {
  create: "创建",
  update: "更新",
  delete: "删除",
  login: "登录",
  logout: "退出",
  permission_change: "权限变更",
  role_change: "角色变更",
  inbound: "入库",
  refurbish: "翻新",
  export: "导出",
  import: "导入",
};

export const ENTITY_LABELS: Record<string, string> = {
  user: "用户",
  role: "角色",
  permission: "权限",
  inbound_item: "入库记录",
  inventory: "库存",
  order: "订单",
  product: "产品",
  case: "案例",
  refurbishment: "翻新记录",
};

interface UseOperationLogsOptions {
  limit?: number;
  entityType?: EntityType;
  action?: ActionType;
  userId?: string;
}

export function useOperationLogs(options: UseOperationLogsOptions = {}) {
  const { limit = 100, entityType, action, userId } = options;

  return useQuery({
    queryKey: ["operation-logs", { limit, entityType, action, userId }],
    queryFn: async (): Promise<OperationLog[]> => {
      let query = supabase
        .from("operation_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (entityType) {
        query = query.eq("entity_type", entityType);
      }
      if (action) {
        query = query.eq("action", action);
      }
      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get user emails for the logs
      const userIds = [...new Set((data || []).map((log) => log.user_id))];
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", userIds);

        const emailMap = new Map(
          (profiles || []).map((p) => [p.id, p.email])
        );

        return (data || []).map((log) => ({
          ...log,
          details: log.details as Record<string, unknown> | null,
          user_email: emailMap.get(log.user_id) || "未知用户",
        })) as OperationLog[];
      }

      return (data || []).map((log) => ({
        ...log,
        details: log.details as Record<string, unknown> | null,
      })) as OperationLog[];
    },
  });
}

export function useLogOperation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
      action,
      details,
    }: {
      entityType: EntityType;
      entityId?: string;
      action: ActionType | string;
      details?: Record<string, any>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("用户未登录");

      const { error } = await supabase.from("operation_logs").insert({
        user_id: user.id,
        entity_type: entityType,
        entity_id: entityId || null,
        action,
        details: details || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operation-logs"] });
    },
  });
}

// Helper function to log operation without hook context
export async function logOperation({
  entityType,
  entityId,
  action,
  details,
}: {
  entityType: EntityType;
  entityId?: string;
  action: ActionType | string;
  details?: Record<string, any>;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("operation_logs").insert({
      user_id: user.id,
      entity_type: entityType,
      entity_id: entityId || null,
      action,
      details: details || null,
    });
  } catch (error) {
    console.error("Failed to log operation:", error);
  }
}
