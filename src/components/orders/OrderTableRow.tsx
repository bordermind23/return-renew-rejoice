import { Eye, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import { GradeBadge } from "@/components/ui/grade-badge";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import type { Order } from "@/hooks/useOrders";
import { format } from "date-fns";

interface OrderTableRowProps {
  order: Order;
  isSelected: boolean;
  onSelect: () => void;
  onView: () => void;
  onDelete: () => void;
  onEditGrade: () => void;
  displayGrade?: string | null;
  hasInboundItem: boolean;
  isGroupChild?: boolean;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "-";
  try {
    return format(new Date(dateStr), "yyyy-MM-dd");
  } catch {
    return "-";
  }
};

export function OrderTableRow({
  order,
  isSelected,
  onSelect,
  onView,
  onDelete,
  onEditGrade,
  displayGrade,
  hasInboundItem,
  isGroupChild = false,
}: OrderTableRowProps) {
  return (
    <TableRow
      className={`
        transition-colors
        ${isGroupChild ? "bg-muted/20 hover:bg-muted/30 border-l-2 border-l-primary/50" : "hover:bg-muted/30"}
      `}
    >
      <TableCell className="w-[36px]">
        <Checkbox checked={isSelected} onCheckedChange={onSelect} />
      </TableCell>
      <TableCell>
        {isGroupChild ? (
          <div className="pl-6 text-muted-foreground text-xs">└</div>
        ) : (
          <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
            {order.internal_order_no || "-"}
          </code>
        )}
      </TableCell>
      <TableCell className="text-center">
        <OrderStatusBadge status={order.status} />
      </TableCell>
      <TableCell>
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">
          {order.lpn}
        </code>
      </TableCell>
      <TableCell>
        <span className="line-clamp-1 max-w-[200px]" title={order.product_name || undefined}>
          {order.product_name || "-"}
        </span>
      </TableCell>
      <TableCell>
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
          {order.product_sku || "-"}
        </code>
      </TableCell>
      <TableCell>
        {hasInboundItem ? (
          <button
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted transition-colors"
            onClick={onEditGrade}
          >
            {displayGrade ? (
              <GradeBadge grade={displayGrade as "A" | "B" | "C"} />
            ) : (
              <span className="text-muted-foreground text-xs">未评级</span>
            )}
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )}
      </TableCell>
      <TableCell className="text-center font-semibold tabular-nums">
        {order.return_quantity}
      </TableCell>
      <TableCell>
        <span className="font-medium">{order.order_number}</span>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(order.order_time)}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(order.return_time)}
      </TableCell>
      <TableCell>
        <div className="flex justify-center gap-0.5">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onView}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
