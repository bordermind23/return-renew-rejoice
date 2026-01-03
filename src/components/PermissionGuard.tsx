import { ReactNode } from "react";
import { useHasPermission, useHasAnyPermission, useHasAllPermissions } from "@/hooks/usePermissions";
import type { PermissionType } from "@/hooks/useRolePermissions";
import { ShieldX } from "lucide-react";

interface PermissionGuardProps {
  /** Single permission to check */
  permission?: PermissionType;
  /** Multiple permissions - user needs ANY of these (OR logic) */
  anyOf?: PermissionType[];
  /** Multiple permissions - user needs ALL of these (AND logic) */
  allOf?: PermissionType[];
  /** Content to show when user has permission */
  children: ReactNode;
  /** 
   * Behavior when permission is denied
   * - "hide": Don't render anything (default)
   * - "disable": Render children with disabled state via render prop
   * - "message": Show a permission denied message
   */
  fallback?: "hide" | "disable" | "message";
  /** Custom fallback content */
  fallbackContent?: ReactNode;
}

export function PermissionGuard({
  permission,
  anyOf,
  allOf,
  children,
  fallback = "hide",
  fallbackContent,
}: PermissionGuardProps) {
  // Determine which check to use
  const hasSinglePermission = useHasPermission(permission || "view_dashboard");
  const hasAnyOfPermissions = useHasAnyPermission(anyOf || []);
  const hasAllOfPermissions = useHasAllPermissions(allOf || []);

  let hasPermission = false;

  if (permission) {
    hasPermission = hasSinglePermission;
  } else if (anyOf && anyOf.length > 0) {
    hasPermission = hasAnyOfPermissions;
  } else if (allOf && allOf.length > 0) {
    hasPermission = hasAllOfPermissions;
  } else {
    // No permission specified, allow access
    hasPermission = true;
  }

  if (hasPermission) {
    return <>{children}</>;
  }

  // Handle fallback behavior
  if (fallbackContent) {
    return <>{fallbackContent}</>;
  }

  switch (fallback) {
    case "hide":
      return null;
    case "message":
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <ShieldX className="h-4 w-4" />
          <span>无权限操作</span>
        </div>
      );
    case "disable":
      // For disable, we return null - the parent should handle the disabled state
      return null;
    default:
      return null;
  }
}

/**
 * A simpler wrapper that just hides content when permission is missing
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: PermissionType;
  children: ReactNode;
}) {
  const hasPermission = useHasPermission(permission);
  return hasPermission ? <>{children}</> : null;
}

/**
 * Access denied page component
 */
export function AccessDenied({ 
  message = "您没有权限访问此页面" 
}: { 
  message?: string 
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <ShieldX className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">访问被拒绝</h2>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
