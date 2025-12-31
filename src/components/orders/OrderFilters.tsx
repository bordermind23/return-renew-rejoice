import { Search, Filter, X, RotateCcw } from "lucide-react";
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

interface OrderFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilters: ("未到货" | "到货" | "出库")[];
  onStatusFilterChange: (status: "未到货" | "到货" | "出库") => void;
  gradeFilter: string;
  onGradeFilterChange: (value: string) => void;
  storeFilter: string;
  onStoreFilterChange: (value: string) => void;
  stores: string[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function OrderFilters({
  searchTerm,
  onSearchChange,
  statusFilters,
  onStatusFilterChange,
  gradeFilter,
  onGradeFilterChange,
  storeFilter,
  onStoreFilterChange,
  stores,
  hasActiveFilters,
  onClearFilters,
}: OrderFiltersProps) {
  return (
    <div className="flex flex-col gap-3 p-4 bg-card rounded-xl border">
      <div className="flex flex-col lg:flex-row gap-3">
        {/* 搜索框 */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索订单号、LPN、产品名称..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-10 bg-background"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* 状态筛选 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 min-w-[100px] bg-background">
                <Filter className="mr-2 h-4 w-4" />
                状态
                {statusFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
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
            <SelectTrigger className="w-[100px] h-10 bg-background">
              <SelectValue placeholder="等级" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部等级</SelectItem>
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

          {/* 店铺筛选 */}
          <Select value={storeFilter} onValueChange={onStoreFilterChange}>
            <SelectTrigger className="w-[140px] h-10 bg-background">
              <SelectValue placeholder="店铺" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部店铺</SelectItem>
              {stores.map((store) => (
                <SelectItem key={store} value={store}>
                  {store}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 清除筛选 */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-10 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              重置
            </Button>
          )}
        </div>
      </div>

      {/* 已选筛选条件标签 */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">已选条件:</span>
          {statusFilters.map((status) => (
            <Badge
              key={status}
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-0.5 cursor-pointer hover:bg-secondary/80"
              onClick={() => onStatusFilterChange(status)}
            >
              <OrderStatusBadge status={status} />
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
          {gradeFilter !== "all" && (
            <Badge
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-0.5 cursor-pointer hover:bg-secondary/80"
              onClick={() => onGradeFilterChange("all")}
            >
              {gradeFilter === "ungraded" ? "未评级" : <GradeBadge grade={gradeFilter as "A" | "B" | "C"} />}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {storeFilter !== "all" && (
            <Badge
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-0.5 cursor-pointer hover:bg-secondary/80"
              onClick={() => onStoreFilterChange("all")}
            >
              {storeFilter}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
