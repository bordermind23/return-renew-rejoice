import { cn } from "@/lib/utils";
import { Search, X, Filter } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";
import { Badge } from "./badge";

interface FilterCardProps {
  children?: React.ReactNode;
  className?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onClear?: () => void;
  hasActiveFilters?: boolean;
  resultCount?: number;
  totalCount?: number;
  showSearch?: boolean;
}

export function FilterCard({
  children,
  className,
  searchValue,
  onSearchChange,
  searchPlaceholder = "搜索...",
  onClear,
  hasActiveFilters = false,
  resultCount,
  totalCount,
  showSearch = true,
}: FilterCardProps) {
  return (
    <div className={cn(
      "rounded-xl border bg-card/50 backdrop-blur-sm p-4 shadow-sm",
      className
    )}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-1">
          {showSearch && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="pl-9 bg-background/50"
              />
            </div>
          )}
          {children}
          {hasActiveFilters && onClear && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClear}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-4 w-4 mr-1" />
              清除筛选
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          {hasActiveFilters && resultCount !== undefined && (
            <Badge variant="secondary" className="font-normal">
              <Filter className="h-3 w-3 mr-1" />
              筛选结果: {resultCount} 条
            </Badge>
          )}
          {totalCount !== undefined && (
            <span className="text-sm text-muted-foreground">
              共 {totalCount} 条记录
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
