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

export const useOrdersPaginated = (page: number, pageSize: number = 50, searchTerm?: string, storeFilter?: string) => {
  return useQuery({
    queryKey: ["orders", "paginated", page, pageSize, searchTerm, storeFilter],
    queryFn: async () => {
      // 构建基础查询
      let countQuery = supabase.from("orders").select("*", { count: "exact", head: true });
      let dataQuery = supabase.from("orders").select("*");

      // 应用搜索过滤
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
      const { data, error } = await supabase
        .from("orders")
        .insert(order)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("订单创建成功");
    },
    onError: (error) => {
      toast.error("创建失败: " + error.message);
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
