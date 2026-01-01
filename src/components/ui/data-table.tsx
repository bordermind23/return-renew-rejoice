import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  stickyHeader?: boolean;
  compact?: boolean;
  striped?: boolean;
}

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  onRowClick,
  emptyMessage = "暂无数据",
  emptyIcon,
  stickyHeader = false,
  compact = false,
  striped = false,
}: DataTableProps<T>) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <div className={cn(stickyHeader && "max-h-[600px] overflow-auto")}>
        <Table>
          <TableHeader className={cn(stickyHeader && "sticky top-0 z-10")}>
            <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
              {columns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  className={cn(
                    "font-semibold text-foreground text-xs uppercase tracking-wider",
                    compact ? "py-2 px-3" : "py-3 px-4",
                    column.className
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-40"
                >
                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    {emptyIcon || <Package className="h-10 w-10 opacity-30" />}
                    <p className="text-sm">{emptyMessage}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => (
                <TableRow
                  key={item.id}
                  className={cn(
                    "transition-colors border-b last:border-b-0",
                    onRowClick && "cursor-pointer hover:bg-primary/5",
                    !onRowClick && "hover:bg-muted/30",
                    striped && index % 2 === 1 && "bg-muted/20"
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <TableCell 
                      key={String(column.key)} 
                      className={cn(
                        compact ? "py-2 px-3" : "py-3 px-4",
                        "text-sm",
                        column.className
                      )}
                    >
                      {column.render
                        ? column.render(item)
                        : String(item[column.key as keyof T] ?? "-")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
