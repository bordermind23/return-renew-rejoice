import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AppRole } from "./useUserManagement";
import { logOperation } from "./useOperationLogs";

export type PermissionType =
  | "view_dashboard"
  | "inbound_scan"
  | "refurbishment"
  | "view_inventory"
  | "manage_products"
  | "manage_orders"
  | "manage_cases"
  | "delete_data"
  | "manage_users"
  | "manage_roles";

export interface RolePermission {
  id: string;
  role: AppRole;
  permission: PermissionType;
  allowed: boolean;
  created_at: string;
  updated_at: string;
}

export const PERMISSION_LABELS: Record<PermissionType, string> = {
  view_dashboard: "查看仪表盘",
  inbound_scan: "入库扫码",
  refurbishment: "翻新处理",
  view_inventory: "查看库存",
  manage_products: "管理产品",
  manage_orders: "管理订单",
  manage_cases: "管理案例",
  delete_data: "删除数据",
  manage_users: "管理用户",
  manage_roles: "管理角色",
};

export const ALL_PERMISSIONS: PermissionType[] = [
  "view_dashboard",
  "inbound_scan",
  "refurbishment",
  "view_inventory",
  "manage_products",
  "manage_orders",
  "manage_cases",
  "delete_data",
  "manage_users",
  "manage_roles",
];

export function useRolePermissions() {
  return useQuery({
    queryKey: ["role-permissions"],
    queryFn: async (): Promise<RolePermission[]> => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .order("role")
        .order("permission");

      if (error) throw error;
      return (data || []) as RolePermission[];
    },
  });
}

export function useUpdateRolePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      role,
      permission,
      allowed,
    }: {
      role: AppRole;
      permission: PermissionType;
      allowed: boolean;
    }) => {
      // First check if permission record exists
      const { data: existing } = await supabase
        .from("role_permissions")
        .select("id")
        .eq("role", role)
        .eq("permission", permission)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("role_permissions")
          .update({ allowed })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("role_permissions")
          .insert({ role, permission, allowed });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["current-user-permissions"] });
      toast.success("权限已更新");
    },
    onError: (error) => {
      console.error("Failed to update permission:", error);
      toast.error("更新权限失败");
    },
  });
}

export function useBatchUpdateRolePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      role,
      permissions,
    }: {
      role: AppRole;
      permissions: { permission: PermissionType; allowed: boolean }[];
    }) => {
      for (const { permission, allowed } of permissions) {
        const { data: existing } = await supabase
          .from("role_permissions")
          .select("id")
          .eq("role", role)
          .eq("permission", permission)
          .single();

        if (existing) {
          const { error } = await supabase
            .from("role_permissions")
            .update({ allowed })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("role_permissions")
            .insert({ role, permission, allowed });
          if (error) throw error;
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["current-user-permissions"] });
      logOperation({
        entityType: "permission",
        action: "permission_change",
        details: { 
          role: variables.role, 
          permissions: variables.permissions.filter(p => p.allowed).map(p => p.permission),
        },
      });
      toast.success("权限配置已保存");
    },
    onError: (error) => {
      console.error("Failed to update permissions:", error);
      toast.error("保存权限配置失败");
    },
  });
}

// Hook to check current user's permissions
export function useCurrentUserPermissions() {
  return useQuery({
    queryKey: ["current-user-permissions"],
    queryFn: async (): Promise<Record<PermissionType, boolean>> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: false }), {} as Record<PermissionType, boolean>);
      }

      // Get user's role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!roleData) {
        return ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: false }), {} as Record<PermissionType, boolean>);
      }

      // Get permissions for this role
      const { data: permissions } = await supabase
        .from("role_permissions")
        .select("permission, allowed")
        .eq("role", roleData.role);

      const permissionMap = ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: false }), {} as Record<PermissionType, boolean>);
      
      permissions?.forEach((p) => {
        permissionMap[p.permission as PermissionType] = p.allowed;
      });

      return permissionMap;
    },
  });
}

// Helper function to get permissions for a specific role from the list
export function getPermissionsForRole(
  permissions: RolePermission[],
  role: AppRole
): Record<PermissionType, boolean> {
  const result = ALL_PERMISSIONS.reduce(
    (acc, p) => ({ ...acc, [p]: false }),
    {} as Record<PermissionType, boolean>
  );

  permissions
    .filter((p) => p.role === role)
    .forEach((p) => {
      result[p.permission] = p.allowed;
    });

  return result;
}
