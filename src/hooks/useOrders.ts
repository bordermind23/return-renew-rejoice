import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type OrderStatus = '未到货' | '到货' | '出库' | '待同步';

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

// internal_order_no 由数据库触发器自动生成，所以在 Insert 类型中排除
export type OrderInsert = Omit<Order, "id" | "created_at" | "internal_order_no" | "status">;
// OrderUpdate 允许更新 status 字段（用于待同步订单同步）
export type OrderUpdate = Partial<Omit<Order, "id" | "created_at" | "internal_order_no">>;

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
      const { data, error } = await supabase
        .from("orders")
        .insert(order)
        .select()
        .single();

      if (error) throw error;
      
      // 检查是否有匹配的"待同步"入库记录需要同步
      if (data && order.lpn) {
        const { data: pendingInbound } = await supabase
          .from("inbound_items")
          .select("*")
          .eq("product_sku", "待同步")
          .ilike("lpn", order.lpn);

        if (pendingInbound && pendingInbound.length > 0) {
          for (const inboundItem of pendingInbound) {
            await supabase
              .from("inbound_items")
              .update({
                product_sku: order.product_sku || "待同步",
                product_name: order.product_name || "待同步",
                removal_order_id: order.removal_order_id || order.order_number || "无入库信息",
                return_reason: order.return_reason,
                refurbishment_notes: inboundItem.refurbishment_notes?.replace("[无入库信息翻新]", "[已同步]") || "[已同步]",
              })
              .eq("id", inboundItem.id);
          }
        }

        // 同时检查并更新"待同步"的订单记录
        const { data: pendingOrders } = await supabase
          .from("orders")
          .select("*")
          .eq("removal_order_id", "无入库信息")
          .ilike("lpn", order.lpn)
          .neq("id", data.id); // 排除刚创建的订单

        if (pendingOrders && pendingOrders.length > 0) {
          for (const pendingOrder of pendingOrders) {
            await supabase
              .from("orders")
              .update({
                product_sku: order.product_sku,
                product_name: order.product_name,
                removal_order_id: order.removal_order_id || order.order_number,
                order_number: order.order_number,
                store_name: order.store_name,
                station: order.station || "已同步",
                country: order.country,
                return_reason: order.return_reason,
                msku: order.msku,
                asin: order.asin,
                fnsku: order.fnsku,
                buyer_note: order.buyer_note,
                inventory_attribute: order.inventory_attribute,
                return_quantity: order.return_quantity,
                warehouse_location: order.warehouse_location,
                return_time: order.return_time,
                order_time: order.order_time,
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

// 辅助函数：从URL中提取存储路径
const extractStoragePath = (url: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/\/storage\/v1\/object\/public\/product-images\/(.+)/);
  return match ? match[1] : null;
};

// 辅助函数：删除入库记录关联的存储文件（数据库触发器会自动删除记录，这里只删文件）
const deleteStorageFilesForInboundItems = async (lpns: string[]) => {
  if (lpns.length === 0) return { deletedFiles: 0 };

  // 查询所有匹配LPN的入库记录（获取文件路径）
  const { data: inboundItems, error: fetchError } = await supabase
    .from("inbound_items")
    .select("*")
    .in("lpn", lpns);

  if (fetchError) throw fetchError;
  if (!inboundItems || inboundItems.length === 0) {
    return { deletedFiles: 0 };
  }

  // 收集所有需要删除的存储文件路径
  const filesToDelete: string[] = [];
  
  for (const item of inboundItems) {
    const photoFields = [
      item.package_photo,
      item.product_photo,
      item.lpn_label_photo,
      item.packaging_photo_1,
      item.packaging_photo_2,
      item.packaging_photo_3,
      item.packaging_photo_4,
      item.packaging_photo_5,
      item.packaging_photo_6,
      item.accessories_photo,
      item.detail_photo,
    ];

    for (const url of photoFields) {
      const path = extractStoragePath(url);
      if (path) filesToDelete.push(path);
    }

    // 处理翻新照片数组
    if (item.refurbishment_photos && Array.isArray(item.refurbishment_photos)) {
      for (const url of item.refurbishment_photos) {
        const path = extractStoragePath(url);
        if (path) filesToDelete.push(path);
      }
    }

    // 处理翻新视频数组
    if (item.refurbishment_videos && Array.isArray(item.refurbishment_videos)) {
      for (const url of item.refurbishment_videos) {
        const path = extractStoragePath(url);
        if (path) filesToDelete.push(path);
      }
    }
  }

  // 删除存储文件
  let deletedFiles = 0;
  if (filesToDelete.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("product-images")
      .remove(filesToDelete);
    
    if (!storageError) {
      deletedFiles = filesToDelete.length;
    }
  }

  return { deletedFiles, itemCount: inboundItems.length };
};

export const useDeleteOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // 先获取订单的LPN
      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("lpn")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // 先删除存储文件（数据库触发器会自动删除入库记录）
      const { deletedFiles, itemCount } = await deleteStorageFilesForInboundItems([order.lpn]);

      // 删除订单（触发器会自动级联删除入库记录）
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return { deletedItems: itemCount, deletedFiles };
    },
    onSuccess: ({ deletedItems, deletedFiles }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["inbound_items"] });
      if (deletedItems > 0) {
        toast.success(`订单删除成功，同时删除了 ${deletedItems} 条入库记录和 ${deletedFiles} 个存储文件`);
      } else {
        toast.success("订单删除成功");
      }
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
      // 先获取所有要删除订单的LPN
      const { data: orders, error: fetchError } = await supabase
        .from("orders")
        .select("lpn")
        .in("id", ids);

      if (fetchError) throw fetchError;

      const lpns = orders?.map(o => o.lpn) || [];

      // 先删除存储文件（数据库触发器会自动删除入库记录）
      const { deletedFiles, itemCount } = await deleteStorageFilesForInboundItems(lpns);

      // 删除订单（触发器会自动级联删除入库记录）
      const { error } = await supabase
        .from("orders")
        .delete()
        .in("id", ids);

      if (error) throw error;

      return { deletedOrders: ids.length, deletedItems: itemCount, deletedFiles };
    },
    onSuccess: ({ deletedOrders, deletedItems, deletedFiles }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["inbound_items"] });
      if (deletedItems > 0) {
        toast.success(`成功删除 ${deletedOrders} 条订单，同时删除了 ${deletedItems} 条入库记录和 ${deletedFiles} 个存储文件`);
      } else {
        toast.success(`成功删除 ${deletedOrders} 条订单`);
      }
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
      // 分批插入，每批500条，避免Supabase请求大小限制
      const BATCH_SIZE = 500;
      const allData: Order[] = [];
      
      for (let i = 0; i < orders.length; i += BATCH_SIZE) {
        const batch = orders.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase
          .from("orders")
          .insert(batch)
          .select();

        if (error) throw error;
        if (data) allData.push(...(data as Order[]));
      }
      
      return allData;
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
