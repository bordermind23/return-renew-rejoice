import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { mapDatabaseError } from "@/lib/errorHandler";

export interface InboundItem {
  id: string;
  lpn: string;
  removal_order_id: string;
  product_sku: string;
  product_name: string;
  return_reason: string | null;
  grade: "A" | "B" | "C" | "new";
  package_photo: string | null;
  product_photo: string | null;
  missing_parts: string[] | null;
  processed_at: string;
  processed_by: string;
  created_at: string;
  tracking_number: string | null;
  shipment_id: string | null;
  // 照片字段
  lpn_label_photo: string | null;
  packaging_photo_1: string | null;
  packaging_photo_2: string | null;
  packaging_photo_3: string | null;
  packaging_photo_4: string | null;
  packaging_photo_5: string | null;
  packaging_photo_6: string | null;
  accessories_photo: string | null;
  detail_photo: string | null;
  // 破损/缺配件相关照片
  damage_photo_1: string | null;
  damage_photo_2: string | null;
  damage_photo_3: string | null;
  package_accessories_photo: string | null;
  // 翻新字段
  refurbished_at: string | null;
  refurbished_by: string | null;
  refurbishment_grade: string | null;
  refurbishment_photos: string[] | null;
  refurbishment_videos: string[] | null;
  refurbishment_notes: string | null;
  // 物流面单照片
  shipping_label_photo: string | null;
}

export type InboundItemInsert = Omit<InboundItem, "id" | "created_at" | "package_photo" | "product_photo" | "lpn_label_photo" | "packaging_photo_1" | "packaging_photo_2" | "packaging_photo_3" | "packaging_photo_4" | "packaging_photo_5" | "packaging_photo_6" | "accessories_photo" | "detail_photo" | "damage_photo_1" | "damage_photo_2" | "damage_photo_3" | "package_accessories_photo" | "refurbished_at" | "refurbished_by" | "refurbishment_grade" | "refurbishment_photos" | "refurbishment_videos" | "refurbishment_notes" | "shipping_label_photo"> & { 
  package_photo?: string | null; 
  product_photo?: string | null;
  lpn_label_photo?: string | null;
  packaging_photo_1?: string | null;
  packaging_photo_2?: string | null;
  packaging_photo_3?: string | null;
  packaging_photo_4?: string | null;
  packaging_photo_5?: string | null;
  packaging_photo_6?: string | null;
  accessories_photo?: string | null;
  detail_photo?: string | null;
  damage_photo_1?: string | null;
  damage_photo_2?: string | null;
  damage_photo_3?: string | null;
  package_accessories_photo?: string | null;
  refurbished_at?: string | null;
  refurbished_by?: string | null;
  refurbishment_grade?: string | null;
  refurbishment_photos?: string[] | null;
  refurbishment_videos?: string[] | null;
  refurbishment_notes?: string | null;
  shipping_label_photo?: string | null;
};
export type InboundItemUpdate = Partial<InboundItemInsert>;

export const useInboundItems = () => {
  return useQuery({
    queryKey: ["inbound_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_items")
        .select("*")
        .order("processed_at", { ascending: false });

      if (error) throw error;
      return data as InboundItem[];
    },
  });
};

export const useCreateInboundItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: InboundItemInsert) => {
      const { data, error } = await supabase
        .from("inbound_items")
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbound_items"] });
      toast.success("入库记录创建成功");
    },
    onError: (error) => {
      toast.error("创建失败: " + mapDatabaseError(error));
    },
  });
};

export const useUpdateInboundItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & InboundItemUpdate) => {
      const { data, error } = await supabase
        .from("inbound_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbound_items"] });
      toast.success("入库记录更新成功");
    },
    onError: (error) => {
      toast.error("更新失败: " + mapDatabaseError(error));
    },
  });
};

// 辅助函数：从URL中提取存储路径
const extractStoragePath = (url: string | null): string | null => {
  if (!url) return null;
  try {
    // URL格式: https://xxx.supabase.co/storage/v1/object/public/product-images/LPNXXX/filename.jpg
    const match = url.match(/\/product-images\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

// 辅助函数：从URL中提取shipping-labels存储路径
const extractShippingLabelPath = (url: string | null): string | null => {
  if (!url) return null;
  try {
    // URL格式: https://xxx.supabase.co/storage/v1/object/public/shipping-labels/xxx/filename.jpg
    const match = url.match(/\/shipping-labels\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

export const useDeleteInboundItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // 先获取入库记录的所有信息（包括照片URL）
      const { data: inboundItem, error: fetchError } = await supabase
        .from("inbound_items")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      const lpn = inboundItem?.lpn;
      const trackingNumber = inboundItem?.tracking_number;

      // 收集所有需要删除的存储文件路径
      const photoFields = [
        'package_photo', 'product_photo', 'lpn_label_photo',
        'packaging_photo_1', 'packaging_photo_2', 'packaging_photo_3',
        'packaging_photo_4', 'packaging_photo_5', 'packaging_photo_6',
        'accessories_photo', 'detail_photo', 'shipping_label_photo'
      ];
      
      const filesToDelete: string[] = [];
      
      // 从照片URL中提取路径
      for (const field of photoFields) {
        const path = extractStoragePath(inboundItem?.[field as keyof typeof inboundItem] as string | null);
        if (path) filesToDelete.push(path);
      }
      
      // 处理翻新照片数组
      if (inboundItem?.refurbishment_photos && Array.isArray(inboundItem.refurbishment_photos)) {
        for (const url of inboundItem.refurbishment_photos) {
          const path = extractStoragePath(url);
          if (path) filesToDelete.push(path);
        }
      }
      
      // 处理翻新视频数组
      if (inboundItem?.refurbishment_videos && Array.isArray(inboundItem.refurbishment_videos)) {
        for (const url of inboundItem.refurbishment_videos) {
          const path = extractStoragePath(url);
          if (path) filesToDelete.push(path);
        }
      }

      // 检查是否需要清除removal_shipments中的物流面单
      // 只有当该物流号下没有其他入库记录时才清除
      let shippingLabelFilesToDelete: string[] = [];
      if (trackingNumber) {
        const { data: otherInboundItems } = await supabase
          .from("inbound_items")
          .select("id")
          .eq("tracking_number", trackingNumber)
          .neq("id", id);
        
        // 如果没有其他入库记录使用该物流号，清除removal_shipments中的物流面单
        if (!otherInboundItems || otherInboundItems.length === 0) {
          // 获取该物流号的货件物流面单URL
          const { data: shipments } = await supabase
            .from("removal_shipments")
            .select("id, shipping_label_photo")
            .eq("tracking_number", trackingNumber);
          
          if (shipments && shipments.length > 0) {
            // 收集需要删除的物流面单文件路径
            for (const shipment of shipments) {
              const path = extractShippingLabelPath(shipment.shipping_label_photo);
              if (path) shippingLabelFilesToDelete.push(path);
            }
            
            // 清除removal_shipments中的shipping_label_photo字段
            await supabase
              .from("removal_shipments")
              .update({ shipping_label_photo: null })
              .eq("tracking_number", trackingNumber);
          }
        }
      }

      // 删除入库记录
      const { error: deleteError } = await supabase
        .from("inbound_items")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      // 删除product-images存储中的文件
      if (filesToDelete.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("product-images")
          .remove(filesToDelete);
        
        if (storageError) {
          console.error("删除存储文件失败:", storageError);
        } else {
          console.log(`成功删除 ${filesToDelete.length} 个存储文件`);
        }
      }

      // 删除shipping-labels存储中的物流面单文件
      if (shippingLabelFilesToDelete.length > 0) {
        // 去重，因为同一物流号的多个货件可能指向同一张图片
        const uniqueShippingLabelFiles = [...new Set(shippingLabelFilesToDelete)];
        const { error: shippingLabelStorageError } = await supabase.storage
          .from("shipping-labels")
          .remove(uniqueShippingLabelFiles);
        
        if (shippingLabelStorageError) {
          console.error("删除物流面单存储文件失败:", shippingLabelStorageError);
        } else {
          console.log(`成功删除 ${uniqueShippingLabelFiles.length} 个物流面单存储文件`);
        }
      }

      // 更新对应订单状态：将 inbound_at 设为 null，状态回退到 "未到货"
      if (lpn) {
        const { error: updateError } = await supabase
          .from("orders")
          .update({ 
            inbound_at: null,
            status: "未到货" as const
          })
          .eq("lpn", lpn);

        if (updateError) {
          console.error("更新订单状态失败:", updateError);
        }
      }

      return { lpn, deletedFiles: filesToDelete.length + shippingLabelFilesToDelete.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inbound_items"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["removal_shipments"] });
      const fileMsg = data.deletedFiles > 0 ? `，已清理 ${data.deletedFiles} 个存储文件` : '';
      toast.success(`入库记录已删除，订单状态已更新${fileMsg}`);
    },
    onError: (error) => {
      toast.error("删除失败: " + mapDatabaseError(error));
    },
  });
};

// 通过 LPN 获取入库记录（用于查看照片）
export const useInboundItemByLpn = (lpn: string | null) => {
  return useQuery({
    queryKey: ["inbound_items", "by_lpn", lpn],
    queryFn: async () => {
      if (!lpn) return null;
      const { data, error } = await supabase
        .from("inbound_items")
        .select("*")
        .eq("lpn", lpn)
        .maybeSingle();

      if (error) throw error;
      return data as InboundItem | null;
    },
    enabled: !!lpn,
  });
};

// 清除翻新信息（保留入库记录，只删除翻新相关字段）
export const useClearRefurbishment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // 先获取入库记录的翻新信息
      const { data: inboundItem, error: fetchError } = await supabase
        .from("inbound_items")
        .select("lpn, refurbishment_photos, refurbishment_videos")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      const lpn = inboundItem?.lpn;

      // 收集翻新相关的存储文件路径
      const filesToDelete: string[] = [];
      
      // 处理翻新照片数组
      if (inboundItem?.refurbishment_photos && Array.isArray(inboundItem.refurbishment_photos)) {
        for (const url of inboundItem.refurbishment_photos) {
          const path = extractStoragePath(url);
          if (path) filesToDelete.push(path);
        }
      }
      
      // 处理翻新视频数组
      if (inboundItem?.refurbishment_videos && Array.isArray(inboundItem.refurbishment_videos)) {
        for (const url of inboundItem.refurbishment_videos) {
          const path = extractStoragePath(url);
          if (path) filesToDelete.push(path);
        }
      }

      // 清除翻新相关字段
      const { error: updateError } = await supabase
        .from("inbound_items")
        .update({
          refurbished_at: null,
          refurbished_by: null,
          refurbishment_grade: null,
          refurbishment_photos: null,
          refurbishment_videos: null,
          refurbishment_notes: null,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // 删除存储中的翻新文件
      if (filesToDelete.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("product-images")
          .remove(filesToDelete);
        
        if (storageError) {
          console.error("删除翻新存储文件失败:", storageError);
        } else {
          console.log(`成功删除 ${filesToDelete.length} 个翻新存储文件`);
        }
      }

      return { lpn, deletedFiles: filesToDelete.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inbound_items"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      const fileMsg = data.deletedFiles > 0 ? `，已清理 ${data.deletedFiles} 个文件` : '';
      toast.success(`翻新记录已删除${fileMsg}`);
    },
    onError: (error) => {
      toast.error("删除翻新记录失败: " + mapDatabaseError(error));
    },
  });
};

// 批量清除翻新信息
export const useBulkClearRefurbishment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      let totalDeletedFiles = 0;

      for (const id of ids) {
        // 获取翻新信息
        const { data: inboundItem, error: fetchError } = await supabase
          .from("inbound_items")
          .select("refurbishment_photos, refurbishment_videos")
          .eq("id", id)
          .single();

        if (fetchError) continue;

        // 收集翻新相关的存储文件路径
        const filesToDelete: string[] = [];
        
        if (inboundItem?.refurbishment_photos && Array.isArray(inboundItem.refurbishment_photos)) {
          for (const url of inboundItem.refurbishment_photos) {
            const path = extractStoragePath(url);
            if (path) filesToDelete.push(path);
          }
        }
        
        if (inboundItem?.refurbishment_videos && Array.isArray(inboundItem.refurbishment_videos)) {
          for (const url of inboundItem.refurbishment_videos) {
            const path = extractStoragePath(url);
            if (path) filesToDelete.push(path);
          }
        }

        // 清除翻新相关字段
        await supabase
          .from("inbound_items")
          .update({
            refurbished_at: null,
            refurbished_by: null,
            refurbishment_grade: null,
            refurbishment_photos: null,
            refurbishment_videos: null,
            refurbishment_notes: null,
          })
          .eq("id", id);

        // 删除存储中的翻新文件
        if (filesToDelete.length > 0) {
          await supabase.storage
            .from("product-images")
            .remove(filesToDelete);
          totalDeletedFiles += filesToDelete.length;
        }
      }

      return { count: ids.length, deletedFiles: totalDeletedFiles };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inbound_items"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      const fileMsg = data.deletedFiles > 0 ? `，已清理 ${data.deletedFiles} 个文件` : '';
      toast.success(`已删除 ${data.count} 条翻新记录${fileMsg}`);
    },
    onError: (error) => {
      toast.error("批量删除失败: " + mapDatabaseError(error));
    },
  });
};
