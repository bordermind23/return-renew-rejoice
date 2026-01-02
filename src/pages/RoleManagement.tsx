import { Shield, Crown, Warehouse, Eye, Users, Check, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

interface RoleConfig {
  label: string;
  icon: typeof Crown;
  color: string;
  bgColor: string;
  description: string;
  permissions: {
    name: string;
    allowed: boolean;
  }[];
}

const ROLE_CONFIGS: Record<AppRole, RoleConfig> = {
  admin: {
    label: "管理员",
    icon: Crown,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    description: "拥有系统的全部权限，可以管理所有功能和用户",
    permissions: [
      { name: "查看仪表盘", allowed: true },
      { name: "入库扫码", allowed: true },
      { name: "翻新处理", allowed: true },
      { name: "查看库存", allowed: true },
      { name: "管理产品", allowed: true },
      { name: "管理订单", allowed: true },
      { name: "管理案例", allowed: true },
      { name: "删除数据", allowed: true },
      { name: "管理用户", allowed: true },
      { name: "管理角色", allowed: true },
    ],
  },
  warehouse_staff: {
    label: "仓库员工",
    icon: Warehouse,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    description: "负责日常仓库操作，可以进行入库、出库等操作",
    permissions: [
      { name: "查看仪表盘", allowed: true },
      { name: "入库扫码", allowed: true },
      { name: "翻新处理", allowed: true },
      { name: "查看库存", allowed: true },
      { name: "管理产品", allowed: true },
      { name: "管理订单", allowed: true },
      { name: "管理案例", allowed: true },
      { name: "删除数据", allowed: false },
      { name: "管理用户", allowed: false },
      { name: "管理角色", allowed: false },
    ],
  },
  viewer: {
    label: "访客",
    icon: Eye,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    description: "只有查看权限，无法进行任何修改操作",
    permissions: [
      { name: "查看仪表盘", allowed: true },
      { name: "入库扫码", allowed: false },
      { name: "翻新处理", allowed: false },
      { name: "查看库存", allowed: true },
      { name: "管理产品", allowed: false },
      { name: "管理订单", allowed: false },
      { name: "管理案例", allowed: false },
      { name: "删除数据", allowed: false },
      { name: "管理用户", allowed: false },
      { name: "管理角色", allowed: false },
    ],
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
  const { data: users, isLoading } = useUsersWithRoles();
  const { data: currentUserRole } = useCurrentUserRole();

  const isAdmin = currentUserRole === "admin";

  // 计算每个角色的用户数
  const roleCounts = ROLE_ORDER.reduce((acc, role) => {
    acc[role] = users?.filter((u) => u.role === role).length || 0;
    return acc;
  }, {} as Record<AppRole, number>);

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
            系统内置角色及其权限配置
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>角色</TableHead>
                <TableHead>描述</TableHead>
                <TableHead className="text-center">用户数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROLE_ORDER.map((role) => {
                const config = ROLE_CONFIGS[role];
                return (
                  <TableRow key={role}>
                    <TableCell>
                      <RoleBadge role={role} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {config.description}
                    </TableCell>
                    <TableCell className="text-center">
                      {isLoading ? (
                        <Skeleton className="h-6 w-8 mx-auto" />
                      ) : (
                        <Badge variant="outline">{roleCounts[role]}</Badge>
                      )}
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
                {ROLE_CONFIGS.admin.permissions.map((permission, idx) => (
                  <TableRow key={permission.name}>
                    <TableCell className="font-medium">{permission.name}</TableCell>
                    {ROLE_ORDER.map((role) => {
                      const allowed = ROLE_CONFIGS[role].permissions[idx].allowed;
                      return (
                        <TableCell key={role} className="text-center">
                          {allowed ? (
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
          return (
            <Card key={role}>
              <CardHeader>
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
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {config.description}
                </p>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">主要权限：</h4>
                  <ul className="text-sm space-y-1">
                    {config.permissions
                      .filter((p) => p.allowed)
                      .slice(0, 5)
                      .map((permission) => (
                        <li key={permission.name} className="flex items-center gap-2 text-muted-foreground">
                          <Check className="h-3 w-3 text-green-600" />
                          {permission.name}
                        </li>
                      ))}
                    {config.permissions.filter((p) => p.allowed).length > 5 && (
                      <li className="text-muted-foreground text-xs">
                        +{config.permissions.filter((p) => p.allowed).length - 5} 项更多权限
                      </li>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
