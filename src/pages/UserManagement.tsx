import { useState } from "react";
import { Shield, Users, UserCog, Crown, Warehouse, Eye } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useUsersWithRoles,
  useUpdateUserRole,
  useCurrentUserRole,
  type AppRole,
} from "@/hooks/useUserManagement";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const ROLE_CONFIG: Record<AppRole, { label: string; icon: typeof Crown; color: string }> = {
  admin: { label: "管理员", icon: Crown, color: "text-yellow-600 bg-yellow-100" },
  warehouse_staff: { label: "仓库员工", icon: Warehouse, color: "text-blue-600 bg-blue-100" },
  viewer: { label: "访客", icon: Eye, color: "text-gray-600 bg-gray-100" },
};

function RoleBadge({ role }: { role: AppRole | null }) {
  if (!role) {
    return <Badge variant="outline" className="text-muted-foreground">未分配</Badge>;
  }

  const config = ROLE_CONFIG[role];
  const Icon = config.icon;

  return (
    <Badge variant="secondary" className={cn("gap-1", config.color)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export default function UserManagement() {
  const { data: users, isLoading } = useUsersWithRoles();
  const { data: currentUserRole } = useCurrentUserRole();
  const { user: currentUser } = useAuth();
  const updateRoleMutation = useUpdateUserRole();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const isAdmin = currentUserRole === "admin";

  const handleRoleChange = (userId: string, roleId: string | null, newRole: AppRole) => {
    updateRoleMutation.mutate({ userId, roleId, newRole });
    setEditingUserId(null);
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="用户管理"
          description="管理系统用户和权限"
        />
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">权限不足</h3>
              <p className="mt-2 text-muted-foreground">
                只有管理员可以访问用户管理功能
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
        title="用户管理"
        description="查看和管理系统用户权限"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总用户数</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {isLoading ? <Skeleton className="h-8 w-12" /> : users?.length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>管理员</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                users?.filter((u) => u.role === "admin").length || 0
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>仓库员工</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-blue-500" />
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                users?.filter((u) => u.role === "warehouse_staff").length || 0
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            用户列表
          </CardTitle>
          <CardDescription>
            点击角色可以修改用户权限
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>邮箱</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      暂无用户数据
                    </TableCell>
                  </TableRow>
                ) : (
                  users?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.email}</span>
                          {user.id === currentUser?.id && (
                            <Badge variant="outline" className="text-xs">当前用户</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingUserId === user.id ? (
                          <Select
                            defaultValue={user.role || undefined}
                            onValueChange={(value) =>
                              handleRoleChange(user.id, user.role_id, value as AppRole)
                            }
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="选择角色" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <Crown className="h-4 w-4 text-yellow-500" />
                                  管理员
                                </div>
                              </SelectItem>
                              <SelectItem value="warehouse_staff">
                                <div className="flex items-center gap-2">
                                  <Warehouse className="h-4 w-4 text-blue-500" />
                                  仓库员工
                                </div>
                              </SelectItem>
                              <SelectItem value="viewer">
                                <div className="flex items-center gap-2">
                                  <Eye className="h-4 w-4 text-gray-500" />
                                  访客
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <RoleBadge role={user.role} />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString("zh-CN")}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingUserId === user.id ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingUserId(null)}
                          >
                            取消
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingUserId(user.id)}
                            disabled={user.id === currentUser?.id}
                          >
                            修改角色
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role descriptions */}
      <Card>
        <CardHeader>
          <CardTitle>角色说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                <span className="font-semibold">管理员</span>
              </div>
              <p className="text-sm text-muted-foreground">
                拥有所有权限，可以管理用户、删除数据、访问所有功能
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Warehouse className="h-5 w-5 text-blue-500" />
                <span className="font-semibold">仓库员工</span>
              </div>
              <p className="text-sm text-muted-foreground">
                可以进行入库、出库、库存管理等日常操作，不能删除数据
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-5 w-5 text-gray-500" />
                <span className="font-semibold">访客</span>
              </div>
              <p className="text-sm text-muted-foreground">
                只能查看数据，不能进行任何修改操作
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
