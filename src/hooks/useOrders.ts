import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type OrderStatus = '未到货' | '到货' | '出库';

export interface Order {
  id: string;
  lpn: string;
  removal_order_id: string;
  order_number: string;
  store_name: string;
  station: string;
  removed_at: string | null;
  inbound_at: string | null;
  created_at: string;
  // 新增字段
  product_name: string | null;
  buyer_note: string | null;
  return_reason: string | null;
  inventory_attribute: string | null;
  country: string | null;
  product_sku: string | null;
  msku: string | null;
  asin: string | null;
  fnsku: string | null;
  return_quantity: number;
  warehouse_location: string | null;
  return_time: string | null;
  order_time: string | null;
  grade: string | null;
  internal_order_no: string | null;
  status: OrderStatus;
}

// internal_order_no 由数据库触发器自动生成，status 由流程自动更新，所以在 Insert 类型中排除
export type OrderInsert = Omit<Order, "id" | "created_at" | "internal_order_no" | "status">;
export type OrderUpdate = Partial<Omit<OrderInsert, "status">>;

export const useOrders = () => {
  return useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Order[];
    },
  });
};

export interface OrderFilters {
  searchTerm?: string;
  storeFilter?: string;
  statusFilters?: OrderStatus[];
  gradeFilter?: string;
}

export const useOrdersPaginated = (page: number, pageSize: number = 50, filters: OrderFilters = {}) => {
  const { searchTerm, storeFilter, statusFilters, gradeFilter } = filters;
  
  return useQuery({
    queryKey: ["orders", "paginated", page, pageSize, searchTerm, storeFilter, statusFilters, gradeFilter],
    queryFn: async () => {
      // 构建基础查询
      let countQuery = supabase.from("orders").select("*", { count: "exact", head: true });
      let dataQuery = supabase.from("orders").select("*");

      // 应用搜索过滤（包含产品名称）
      if (searchTerm) {
        const search = `%${searchTerm}%`;
        countQuery = countQuery.or(`order_number.ilike.${search},lpn.ilike.${search},store_name.ilike.${search},product_name.ilike.${search},internal_order_no.ilike.${search}`);
        dataQuery = dataQuery.or(`order_number.ilike.${search},lpn.ilike.${search},store_name.ilike.${search},product_name.ilike.${search},internal_order_no.ilike.${search}`);
      }

      // 应用店铺过滤
      if (storeFilter && storeFilter !== "all") {
        countQuery = countQuery.eq("store_name", storeFilter);
        dataQuery = dataQuery.eq("store_name", storeFilter);
      }

      // 应用状态过滤（多选）
      if (statusFilters && statusFilters.length > 0) {
        countQuery = countQuery.in("status", statusFilters);
        dataQuery = dataQuery.in("status", statusFilters);
      }

      // 应用等级过滤
      if (gradeFilter && gradeFilter !== "all") {
        countQuery = countQuery.eq("grade", gradeFilter);
        dataQuery = dataQuery.eq("grade", gradeFilter);
      }

      // 获取总数
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      // 获取分页数据
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await dataQuery
        .order("internal_order_no", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        data: data as Order[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
        currentPage: page,
      };
    },
  });
};

// 获取订单状态统计（全量数据）
export const useOrderStats = () => {
  return useQuery({
    queryKey: ["orders", "stats"],
    queryFn: async () => {
      // 获取总数
      const { count: totalCount, error: totalError } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true });
      if (totalError) throw totalError;

      // 获取各状态数量
      const { count: pendingCount, error: pendingError } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "未到货");
      if (pendingError) throw pendingError;

      const { count: arrivedCount, error: arrivedError } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "到货");
      if (arrivedError) throw arrivedError;

      const { count: shippedCount, error: shippedError } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "出库");
      if (shippedError) throw shippedError;

      return {
        total: totalCount || 0,
        pending: pendingCount || 0,
        arrived: arrivedCount || 0,
        shipped: shippedCount || 0,
      };
    },
  });
};

// 获取所有店铺（用于过滤下拉框）
export const useOrderStores = () => {
  return useQuery({
    queryKey: ["orders", "stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("store_name")
        .order("store_name");

      if (error) throw error;
      const stores = [...new Set(data.map((d) => d.store_name))];
      return stores;
    },
  });
};

export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (order: OrderInsert) => {
      const normalizedOrder: OrderInsert = {
        ...order,
        lpn: order.lpn.trim(),
        order_number: order.order_number.trim(),
        store_name: order.store_name.trim(),
        station: order.station?.trim?.() || order.station,
        removal_order_id: order.removal_order_id?.trim?.() || order.removal_order_id,
      };

      // 如果已存在"无入库信息/待同步"的临时订单（order_number='待同步'），则更新该订单而不是新建
      const { data: pendingOrder, error: pendingError } = await supabase
        .from("orders")
        .select("id")
        .eq("lpn", normalizedOrder.lpn)
        .eq("order_number", "待同步")
        .maybeSingle();

      if (pendingError) throw pendingError;

      let data: any = null;

      if (pendingOrder?.id) {
        const { data: updated, error: updateError } = await supabase
          .from("orders")
          .update({
            ...normalizedOrder,
            // 用真实订单号覆盖临时订单号/标记
            order_number: normalizedOrder.order_number,
            removal_order_id: normalizedOrder.removal_order_id || normalizedOrder.order_number,
            station: normalizedOrder.station || "已同步",
          })
          .eq("id", pendingOrder.id)
          .select()
          .single();

        if (updateError) throw updateError;
        data = updated;
      } else {
        const res = await supabase.from("orders").insert(normalizedOrder).select().single();
        if (res.error) throw res.error;
        data = res.data;
      }
      
      // 检查是否有匹配的"待同步"入库记录需要同步
      if (data && normalizedOrder.lpn) {
        const { data: pendingInbound } = await supabase
          .from("inbound_items")
          .select("id, refurbishment_notes")
          .eq("product_sku", "待同步")
          .eq("lpn", normalizedOrder.lpn);

        if (pendingInbound && pendingInbound.length > 0) {
          for (const inboundItem of pendingInbound) {
            await supabase
              .from("inbound_items")
              .update({
                product_sku: normalizedOrder.product_sku || "待同步",
                product_name: normalizedOrder.product_name || "待同步",
                removal_order_id:
                  normalizedOrder.removal_order_id || normalizedOrder.order_number || "无入库信息",
                return_reason: normalizedOrder.return_reason,
                refurbishment_notes:
                  inboundItem.refurbishment_notes?.replace("[无入库信息翻新]", "[已同步]") || "[已同步]",
              })
              .eq("id", inboundItem.id);
          }
        }

        // 同时检查并更新"待同步"的订单记录（同LPN的临时订单）
        const { data: pendingOrders } = await supabase
          .from("orders")
          .select("id")
          .eq("removal_order_id", "无入库信息")
          .eq("lpn", normalizedOrder.lpn)
          .neq("id", data.id);

        if (pendingOrders && pendingOrders.length > 0) {
          for (const pendingOrder of pendingOrders) {
            await supabase
              .from("orders")
              .update({
                product_sku: normalizedOrder.product_sku,
                product_name: normalizedOrder.product_name,
                removal_order_id: normalizedOrder.removal_order_id || normalizedOrder.order_number,
                order_number: normalizedOrder.order_number,
                store_name: normalizedOrder.store_name,
                station: normalizedOrder.station || "已同步",
                country: normalizedOrder.country,
                return_reason: normalizedOrder.return_reason,
                msku: normalizedOrder.msku,
                asin: normalizedOrder.asin,
                fnsku: normalizedOrder.fnsku,
                buyer_note: normalizedOrder.buyer_note,
                inventory_attribute: normalizedOrder.inventory_attribute,
                return_quantity: normalizedOrder.return_quantity,
                warehouse_location: normalizedOrder.warehouse_location,
                return_time: normalizedOrder.return_time,
                order_time: normalizedOrder.order_time,
              })
              .eq("id", pendingOrder.id);
          }
        }
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["inbound_items"] });
      toast.success("订单创建成功");
    },
    onError: (error: any) => {
      const msg = String(error?.message || error);
      if (msg.includes("duplicate") || msg.includes("23505")) {
        toast.error("该LPN与订单号组合已存在");
        return;
      }
      toast.error("创建失败: " + msg);
    },
  });
};

export const useUpdateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & OrderUpdate) => {
      const { data, error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("订单更新成功");
    },
    onError: (error) => {
      toast.error("更新失败: " + error.message);
    },
  });
};

export const useDeleteOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("订单删除成功");
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });
};

export const useBulkDeleteOrders = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("orders")
        .delete()
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`成功删除 ${ids.length} 条订单`);
    },
    onError: (error) => {
      toast.error("批量删除失败: " + error.message);
    },
  });
};

export const useBulkUpdateOrders = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: OrderUpdate }) => {
      const { error } = await supabase
        .from("orders")
        .update(updates)
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: (_, { ids }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`成功更新 ${ids.length} 条订单`);
    },
    onError: (error) => {
      toast.error("批量更新失败: " + error.message);
    },
  });
};

export const useBulkCreateOrders = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orders: OrderInsert[]) => {
      const { data, error } = await supabase
        .from("orders")
        .insert(orders)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`成功导入 ${data.length} 条订单`);
    },
    onError: (error) => {
      toast.error("批量导入失败: " + error.message);
    },
  });
};

// 同步"待同步"的入库记录和订单
export const useSyncPendingRecords = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (importedOrders: Order[]) => {
      // 获取所有"待同步"的入库记录
      const { data: pendingInboundItems, error: fetchError } = await supabase
        .from("inbound_items")
        .select("*")
        .eq("product_sku", "待同步");

      if (fetchError) throw fetchError;
      if (!pendingInboundItems || pendingInboundItems.length === 0) {
        return { syncedInbound: 0, syncedOrders: 0 };
      }

      // 获取所有"待同步"的订单
      const { data: pendingOrders, error: orderFetchError } = await supabase
        .from("orders")
        .select("*")
        .eq("removal_order_id", "无入库信息");

      if (orderFetchError) throw orderFetchError;

      let syncedInbound = 0;
      let syncedOrders = 0;

      // 遍历待同步的入库记录，查找匹配的导入订单
      for (const inboundItem of pendingInboundItems) {
        // 在导入的订单中查找匹配的LPN
        const matchedOrder = importedOrders.find(
          o => o.lpn.toLowerCase() === inboundItem.lpn.toLowerCase()
        );

        if (matchedOrder) {
          // 更新入库记录的产品信息
          const { error: updateError } = await supabase
            .from("inbound_items")
            .update({
              product_sku: matchedOrder.product_sku || "待同步",
              product_name: matchedOrder.product_name || "待同步",
              removal_order_id: matchedOrder.removal_order_id || matchedOrder.order_number || "无入库信息",
              return_reason: matchedOrder.return_reason,
              refurbishment_notes: inboundItem.refurbishment_notes?.replace("[无入库信息翻新]", "[已同步]") || "[已同步]",
            })
            .eq("id", inboundItem.id);

          if (!updateError) {
            syncedInbound++;
          }

          // 查找并更新对应的"待同步"订单记录
          const matchingPendingOrder = pendingOrders?.find(
            o => o.lpn.toLowerCase() === inboundItem.lpn.toLowerCase()
          );

          if (matchingPendingOrder) {
            const { error: orderUpdateError } = await supabase
              .from("orders")
              .update({
                product_sku: matchedOrder.product_sku,
                product_name: matchedOrder.product_name,
                removal_order_id: matchedOrder.removal_order_id || matchedOrder.order_number,
                order_number: matchedOrder.order_number,
                store_name: matchedOrder.store_name,
                station: matchedOrder.station || "已同步",
                country: matchedOrder.country,
                return_reason: matchedOrder.return_reason,
                msku: matchedOrder.msku,
                asin: matchedOrder.asin,
                fnsku: matchedOrder.fnsku,
                buyer_note: matchedOrder.buyer_note,
                inventory_attribute: matchedOrder.inventory_attribute,
                return_quantity: matchedOrder.return_quantity,
                warehouse_location: matchedOrder.warehouse_location,
                return_time: matchedOrder.return_time,
                order_time: matchedOrder.order_time,
              })
              .eq("id", matchingPendingOrder.id);

            if (!orderUpdateError) {
              syncedOrders++;
            }
          }
        }
      }

      return { syncedInbound, syncedOrders };
    },
    onSuccess: ({ syncedInbound, syncedOrders }) => {
      queryClient.invalidateQueries({ queryKey: ["inbound_items"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (syncedInbound > 0 || syncedOrders > 0) {
        toast.success(`已同步 ${syncedInbound} 条入库记录，${syncedOrders} 条订单记录`);
      }
    },
    onError: (error) => {
      console.error("同步失败:", error);
    },
  });
};
