import { useMemo } from "react";
import { useCurrentUserPermissions, type PermissionType } from "./useRolePermissions";
import { useCurrentUserRole } from "./useUserManagement";

/**
 * Hook to check if current user has a specific permission
 * Admin users always have all permissions
 */
export function useHasPermission(permission: PermissionType): boolean {
  const { data: permissions, isLoading: permissionsLoading } = useCurrentUserPermissions();
  const { data: userRole, isLoading: roleLoading } = useCurrentUserRole();

  return useMemo(() => {
    // While loading, deny access for safety
    if (permissionsLoading || roleLoading) return false;
    
    // Admin always has all permissions
    if (userRole === "admin") return true;
    
    // Check the specific permission
    return permissions?.[permission] ?? false;
  }, [permissions, userRole, permission, permissionsLoading, roleLoading]);
}

/**
 * Hook to check if current user has any of the specified permissions
 * Admin users always have all permissions
 */
export function useHasAnyPermission(permissionList: PermissionType[]): boolean {
  const { data: permissions, isLoading: permissionsLoading } = useCurrentUserPermissions();
  const { data: userRole, isLoading: roleLoading } = useCurrentUserRole();

  return useMemo(() => {
    if (permissionsLoading || roleLoading) return false;
    if (userRole === "admin") return true;
    
    return permissionList.some(p => permissions?.[p] ?? false);
  }, [permissions, userRole, permissionList, permissionsLoading, roleLoading]);
}

/**
 * Hook to check if current user has all of the specified permissions
 * Admin users always have all permissions
 */
export function useHasAllPermissions(permissionList: PermissionType[]): boolean {
  const { data: permissions, isLoading: permissionsLoading } = useCurrentUserPermissions();
  const { data: userRole, isLoading: roleLoading } = useCurrentUserRole();

  return useMemo(() => {
    if (permissionsLoading || roleLoading) return false;
    if (userRole === "admin") return true;
    
    return permissionList.every(p => permissions?.[p] ?? false);
  }, [permissions, userRole, permissionList, permissionsLoading, roleLoading]);
}

/**
 * Hook to get all permission states at once
 * Useful for components that need to check multiple permissions
 */
export function usePermissions() {
  const { data: permissions, isLoading: permissionsLoading } = useCurrentUserPermissions();
  const { data: userRole, isLoading: roleLoading } = useCurrentUserRole();
  
  const isAdmin = userRole === "admin";
  const isLoading = permissionsLoading || roleLoading;

  const can = useMemo(() => ({
    viewDashboard: isAdmin || (permissions?.view_dashboard ?? false),
    inboundScan: isAdmin || (permissions?.inbound_scan ?? false),
    refurbishment: isAdmin || (permissions?.refurbishment ?? false),
    viewInventory: isAdmin || (permissions?.view_inventory ?? false),
    manageProducts: isAdmin || (permissions?.manage_products ?? false),
    manageOrders: isAdmin || (permissions?.manage_orders ?? false),
    manageCases: isAdmin || (permissions?.manage_cases ?? false),
    deleteData: isAdmin || (permissions?.delete_data ?? false),
    manageUsers: isAdmin || (permissions?.manage_users ?? false),
    manageRoles: isAdmin || (permissions?.manage_roles ?? false),
  }), [permissions, isAdmin]);

  return {
    can,
    isAdmin,
    isLoading,
    userRole,
  };
}
