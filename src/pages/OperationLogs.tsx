import { useState } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  History,
  Shield,
  User,
  Package,
  ClipboardList,
  Wrench,
  FileWarning,
  RefreshCw,
  Filter,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useOperationLogs,
  ACTION_LABELS,
  ENTITY_LABELS,
  type EntityType,
  type ActionType,
} from "@/hooks/useOperationLogs";
import { useCurrentUserRole } from "@/hooks/useUserManagement";
import { cn } from "@/lib/utils";

const ENTITY_ICONS: Record<string, typeof User> = {
  user: User,
  role: Shield,
  permission: Shield,
  inbound_item: Package,
  inventory: Package,
  order: ClipboardList,
  product: Package,
  case: FileWarning,
  refurbishment: Wrench,
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  login: "bg-purple-100 text-purple-700",
  logout: "bg-gray-100 text-gray-700",
  permission_change: "bg-yellow-100 text-yellow-700",
  role_change: "bg-orange-100 text-orange-700",
  inbound: "bg-teal-100 text-teal-700",
  refurbish: "bg-cyan-100 text-cyan-700",
  export: "bg-indigo-100 text-indigo-700",
  import: "bg-pink-100 text-pink-700",
};

export default function OperationLogs() {
  const { data: currentUserRole } = useCurrentUserRole();
  const [entityFilter, setEntityFilter] = useState<EntityType | "all">("all");
  const [actionFilter, setActionFilter] = useState<ActionType | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: logs = [], isLoading, refetch, isRefetching } = useOperationLogs({
    limit: 200,
    entityType: entityFilter === "all" ? undefined : entityFilter,
    action: actionFilter === "all" ? undefined : (actionFilter as ActionType),
  });

  const isAdmin = currentUserRole === "admin";

  // Filter logs by search term
  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      log.user_email?.toLowerCase().includes(searchLower) ||
      log.entity_id?.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.details)?.toLowerCase().includes(searchLower)
    );
  });

  if (!isAdmin) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="操作日志" description="查看系统操作记录" />
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">权限不足</h3>
              <p className="mt-2 text-muted-foreground">
                只有管理员可以查看操作日志
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
        title="操作日志"
        description="查看系统用户的操作记录和权限变更历史"
        actions={
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
            刷新
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总操作数</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              {isLoading ? <Skeleton className="h-8 w-12" /> : logs.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>权限变更</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Shield className="h-5 w-5 text-yellow-500" />
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                logs.filter((l) => l.action === "permission_change" || l.action === "role_change").length
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>用户操作</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                logs.filter((l) => l.entity_type === "user").length
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>删除操作</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-red-500" />
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                logs.filter((l) => l.action === "delete").length
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索用户、实体ID或详情..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            <Select
              value={entityFilter}
              onValueChange={(v) => setEntityFilter(v as EntityType | "all")}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="实体类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={actionFilter}
              onValueChange={(v) => setActionFilter(v as ActionType | "all")}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="操作类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部操作</SelectItem>
                {Object.entries(ACTION_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(entityFilter !== "all" || actionFilter !== "all" || searchTerm) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEntityFilter("all");
                  setActionFilter("all");
                  setSearchTerm("");
                }}
              >
                清除筛选
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            操作记录
          </CardTitle>
          <CardDescription>
            显示最近 {filteredLogs.length} 条操作记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>操作</TableHead>
                    <TableHead>实体类型</TableHead>
                    <TableHead>实体ID</TableHead>
                    <TableHead>详情</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        暂无操作记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => {
                      const EntityIcon = ENTITY_ICONS[log.entity_type] || History;
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), "MM-dd HH:mm:ss", { locale: zhCN })}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{log.user_email || "未知"}</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn(ACTION_COLORS[log.action] || "bg-gray-100")}
                            >
                              {ACTION_LABELS[log.action] || log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <EntityIcon className="h-4 w-4 text-muted-foreground" />
                              <span>{ENTITY_LABELS[log.entity_type] || log.entity_type}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-mono text-muted-foreground">
                              {log.entity_id ? log.entity_id.slice(0, 8) + "..." : "-"}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            {log.details ? (
                              <span className="text-xs text-muted-foreground truncate block">
                                {JSON.stringify(log.details).slice(0, 50)}
                                {JSON.stringify(log.details).length > 50 && "..."}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
