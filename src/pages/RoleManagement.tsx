import { useState } from "react";
import { Shield, Crown, Warehouse, Eye, Check, X, Settings2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsersWithRoles, useCurrentUserRole, type AppRole } from "@/hooks/useUserManagement";
import {
  useRolePermissions,
  useBatchUpdateRolePermissions,
  getPermissionsForRole,
  PERMISSION_LABELS,
  ALL_PERMISSIONS,
  type PermissionType,
} from "@/hooks/useRolePermissions";
import { cn } from "@/lib/utils";

interface RoleConfig {
  label: string;
  icon: typeof Crown;
  color: string;
  bgColor: string;
  description: string;
}

const ROLE_CONFIGS: Record<AppRole, RoleConfig> = {
  admin: {
    label: "管理员",
    icon: Crown,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    description: "拥有系统的全部权限，可以管理所有功能和用户",
  },
  warehouse_staff: {
    label: "仓库员工",
    icon: Warehouse,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    description: "负责日常仓库操作，可以进行入库、出库等操作",
  },
  viewer: {
    label: "访客",
    icon: Eye,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    description: "只有查看权限，无法进行任何修改操作",
  },
};

const ROLE_ORDER: AppRole[] = ["admin", "warehouse_staff", "viewer"];

function RoleBadge({ role }: { role: AppRole }) {
  const config = ROLE_CONFIGS[role];
  const Icon = config.icon;

  return (
    <Badge variant="secondary" className={cn("gap-1", config.color, config.bgColor)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export default function RoleManagement() {
  const { data: users, isLoading: usersLoading } = useUsersWithRoles();
  const { data: currentUserRole } = useCurrentUserRole();
  const { data: permissions = [], isLoading: permissionsLoading } = useRolePermissions();
  const batchUpdateMutation = useBatchUpdateRolePermissions();

  const [editingRole, setEditingRole] = useState<AppRole | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<Record<PermissionType, boolean>>({} as Record<PermissionType, boolean>);

  const isAdmin = currentUserRole === "admin";
  const isLoading = usersLoading || permissionsLoading;

  // 计算每个角色的用户数
  const roleCounts = ROLE_ORDER.reduce((acc, role) => {
    acc[role] = users?.filter((u) => u.role === role).length || 0;
    return acc;
  }, {} as Record<AppRole, number>);

  const handleEditPermissions = (role: AppRole) => {
    const rolePermissions = getPermissionsForRole(permissions, role);
    setEditingPermissions(rolePermissions);
    setEditingRole(role);
  };

  const handleTogglePermission = (permission: PermissionType) => {
    setEditingPermissions((prev) => ({
      ...prev,
      [permission]: !prev[permission],
    }));
  };

  const handleSavePermissions = () => {
    if (!editingRole) return;

    const permissionUpdates = ALL_PERMISSIONS.map((permission) => ({
      permission,
      allowed: editingPermissions[permission],
    }));

    batchUpdateMutation.mutate(
      { role: editingRole, permissions: permissionUpdates },
      {
        onSuccess: () => {
          setEditingRole(null);
        },
      }
    );
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="角色管理"
          description="管理系统角色和权限配置"
        />
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">权限不足</h3>
              <p className="mt-2 text-muted-foreground">
                只有管理员可以访问角色管理功能
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="角色管理"
        description="查看和管理系统角色权限配置"
      />

      {/* Role Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {ROLE_ORDER.map((role) => {
          const config = ROLE_CONFIGS[role];
          const Icon = config.icon;
          return (
            <Card key={role}>
              <CardHeader className="pb-2">
                <CardDescription>{config.label}</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Icon className={cn("h-5 w-5", config.color)} />
                  {isLoading ? (
                    <Skeleton className="h-8 w-12" />
                  ) : (
                    <span>{roleCounts[role]} 人</span>
                  )}
                </CardTitle>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            角色列表
          </CardTitle>
          <CardDescription>
            系统角色及其权限配置，点击配置按钮可以调整权限
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>角色</TableHead>
                <TableHead>描述</TableHead>
                <TableHead className="text-center">用户数</TableHead>
                <TableHead className="text-center">权限数</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROLE_ORDER.map((role) => {
                const config = ROLE_CONFIGS[role];
                const rolePermissions = getPermissionsForRole(permissions, role);
                const allowedCount = Object.values(rolePermissions).filter(Boolean).length;
                return (
                  <TableRow key={role}>
                    <TableCell>
                      <RoleBadge role={role} />
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[300px]">
                      {config.description}
                    </TableCell>
                    <TableCell className="text-center">
                      {isLoading ? (
                        <Skeleton className="h-6 w-8 mx-auto" />
                      ) : (
                        <Badge variant="outline">{roleCounts[role]}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {permissionsLoading ? (
                        <Skeleton className="h-6 w-12 mx-auto" />
                      ) : (
                        <Badge variant="secondary">
                          {allowedCount} / {ALL_PERMISSIONS.length}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPermissions(role)}
                      >
                        <Settings2 className="h-4 w-4 mr-1" />
                        配置权限
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Permissions Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>权限矩阵</CardTitle>
          <CardDescription>
            各角色的详细权限对比
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">权限项</TableHead>
                  {ROLE_ORDER.map((role) => {
                    const config = ROLE_CONFIGS[role];
                    const Icon = config.icon;
                    return (
                      <TableHead key={role} className="text-center min-w-[100px]">
                        <div className="flex items-center justify-center gap-1">
                          <Icon className={cn("h-4 w-4", config.color)} />
                          <span>{config.label}</span>
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ALL_PERMISSIONS.map((permission) => (
                  <TableRow key={permission}>
                    <TableCell className="font-medium">
                      {PERMISSION_LABELS[permission]}
                    </TableCell>
                    {ROLE_ORDER.map((role) => {
                      const rolePermissions = getPermissionsForRole(permissions, role);
                      const allowed = rolePermissions[permission];
                      return (
                        <TableCell key={role} className="text-center">
                          {permissionsLoading ? (
                            <Skeleton className="h-5 w-5 mx-auto rounded-full" />
                          ) : allowed ? (
                            <Check className="h-5 w-5 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-red-400 mx-auto" />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Role Details */}
      <div className="grid gap-4 md:grid-cols-3">
        {ROLE_ORDER.map((role) => {
          const config = ROLE_CONFIGS[role];
          const Icon = config.icon;
          const rolePermissions = getPermissionsForRole(permissions, role);
          const allowedPermissions = ALL_PERMISSIONS.filter((p) => rolePermissions[p]);
          return (
            <Card key={role}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("p-2 rounded-lg", config.bgColor)}>
                      <Icon className={cn("h-5 w-5", config.color)} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{config.label}</CardTitle>
                      <CardDescription className="text-xs">
                        {roleCounts[role]} 位用户
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditPermissions(role)}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {config.description}
                </p>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">
                    已开启权限 ({allowedPermissions.length}/{ALL_PERMISSIONS.length})：
                  </h4>
                  {permissionsLoading ? (
                    <div className="space-y-1">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-4 w-24" />
                      ))}
                    </div>
                  ) : (
                    <ul className="text-sm space-y-1">
                      {allowedPermissions.slice(0, 5).map((permission) => (
                        <li
                          key={permission}
                          className="flex items-center gap-2 text-muted-foreground"
                        >
                          <Check className="h-3 w-3 text-green-600" />
                          {PERMISSION_LABELS[permission]}
                        </li>
                      ))}
                      {allowedPermissions.length > 5 && (
                        <li className="text-muted-foreground text-xs">
                          +{allowedPermissions.length - 5} 项更多权限
                        </li>
                      )}
                      {allowedPermissions.length === 0 && (
                        <li className="text-muted-foreground text-xs">无任何权限</li>
                      )}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Permissions Dialog */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              配置权限 - {editingRole && ROLE_CONFIGS[editingRole].label}
            </DialogTitle>
            <DialogDescription>
              开启或关闭该角色的各项权限
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[400px] overflow-y-auto">
            {ALL_PERMISSIONS.map((permission) => (
              <div
                key={permission}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">
                    {PERMISSION_LABELS[permission]}
                  </div>
                </div>
                <Switch
                  checked={editingPermissions[permission] || false}
                  onCheckedChange={() => handleTogglePermission(permission)}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)}>
              取消
            </Button>
            <Button
              onClick={handleSavePermissions}
              disabled={batchUpdateMutation.isPending}
            >
              {batchUpdateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存配置"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
