import { Search, Filter, X, RotateCcw, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { GradeBadge } from "@/components/ui/grade-badge";

export type SortField = "order_time" | "return_time" | "product_name" | "product_sku" | "status";
export type SortDirection = "asc" | "desc";

interface OrderFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilters: ("未到货" | "到货" | "出库")[];
  onStatusFilterChange: (status: "未到货" | "到货" | "出库") => void;
  gradeFilter: string;
  onGradeFilterChange: (value: string) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const sortOptions: { value: SortField; label: string }[] = [
  { value: "return_time", label: "退货日期" },
  { value: "order_time", label: "订购日期" },
  { value: "product_name", label: "产品名称" },
  { value: "product_sku", label: "SKU" },
  { value: "status", label: "状态" },
];

export function OrderFilters({
  searchTerm,
  onSearchChange,
  statusFilters,
  onStatusFilterChange,
  gradeFilter,
  onGradeFilterChange,
  sortField,
  sortDirection,
  onSortChange,
  hasActiveFilters,
  onClearFilters,
}: OrderFiltersProps) {
  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 bg-card rounded-xl border">
      <div className="flex flex-col gap-3">
        {/* 搜索框 - 移动端全宽 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索订单号、LPN、产品名称..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-9 sm:h-10 bg-background"
          />
        </div>

        {/* 筛选按钮组 - 移动端紧凑布局 */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {/* 状态筛选 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 sm:h-10 px-2 sm:px-3 bg-background">
                <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">状态</span>
                {statusFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-1 sm:ml-2 px-1 py-0 text-xs">
                    {statusFilters.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44 bg-popover">
              {(["未到货", "到货", "出库"] as const).map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={(e) => {
                    e.preventDefault();
                    onStatusFilterChange(status);
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={statusFilters.includes(status)}
                    className="pointer-events-none"
                  />
                  <OrderStatusBadge status={status} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 等级筛选 */}
          <Select value={gradeFilter} onValueChange={onGradeFilterChange}>
            <SelectTrigger className="w-[70px] sm:w-[100px] h-8 sm:h-10 text-xs sm:text-sm bg-background">
              <SelectValue placeholder="等级" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="A">
                <div className="flex items-center gap-2">
                  <GradeBadge grade="A" />
                </div>
              </SelectItem>
              <SelectItem value="B">
                <div className="flex items-center gap-2">
                  <GradeBadge grade="B" />
                </div>
              </SelectItem>
              <SelectItem value="C">
                <div className="flex items-center gap-2">
                  <GradeBadge grade="C" />
                </div>
              </SelectItem>
              <SelectItem value="ungraded">未评级</SelectItem>
            </SelectContent>
          </Select>

          {/* 排序选择 */}
          <Select value={sortField} onValueChange={(value) => onSortChange(value as SortField, sortDirection)}>
            <SelectTrigger className="w-[110px] sm:w-[140px] h-8 sm:h-10 text-xs sm:text-sm bg-background">
              <ArrowUpDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline"><SelectValue placeholder="排序" /></span>
              <span className="sm:hidden">排序</span>
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 排序方向 */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 sm:h-10 sm:w-10 bg-background"
            onClick={() => onSortChange(sortField, sortDirection === "desc" ? "asc" : "desc")}
            title={sortDirection === "desc" ? "降序" : "升序"}
          >
            {sortDirection === "desc" ? "↓" : "↑"}
          </Button>

          {/* 清除筛选 */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-8 sm:h-10 px-2 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline ml-1">重置</span>
            </Button>
          )}
        </div>
      </div>

      {/* 已选筛选条件标签 - 移动端简化 */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground hidden sm:inline">已选条件:</span>
          {statusFilters.map((status) => (
            <Badge
              key={status}
              variant="secondary"
              className="gap-0.5 sm:gap-1 pl-1.5 sm:pl-2 pr-0.5 sm:pr-1 py-0.5 cursor-pointer hover:bg-secondary/80 text-xs"
              onClick={() => onStatusFilterChange(status)}
            >
              <OrderStatusBadge status={status} />
              <X className="h-3 w-3 ml-0.5" />
            </Badge>
          ))}
          {gradeFilter !== "all" && (
            <Badge
              variant="secondary"
              className="gap-0.5 sm:gap-1 pl-1.5 sm:pl-2 pr-0.5 sm:pr-1 py-0.5 cursor-pointer hover:bg-secondary/80 text-xs"
              onClick={() => onGradeFilterChange("all")}
            >
              {gradeFilter === "ungraded" ? "未评级" : <GradeBadge grade={gradeFilter as "A" | "B" | "C"} />}
              <X className="h-3 w-3 ml-0.5" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
