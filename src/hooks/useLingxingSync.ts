import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface SyncResult {
  success: number;
  failed: number;
  errors: string[];
}

interface SyncResponse {
  success: boolean;
  message?: string;
  error?: string;
  results?: {
    removalShipments?: SyncResult;
    returnOrders?: SyncResult;
  };
}

export function useLingxingSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string>("");
  const queryClient = useQueryClient();

  const sync = async (
    syncType: "all" | "removals" | "orders" = "all",
    startDate?: string,
    endDate?: string
  ): Promise<SyncResponse | null> => {
    setIsSyncing(true);
    setSyncProgress("正在连接领星ERP...");

    try {
      const { data, error } = await supabase.functions.invoke("sync-lingxing", {
        body: {
          syncType,
          startDate,
          endDate,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      const response = data as SyncResponse;

      if (!response.success) {
        throw new Error(response.error || "同步失败");
      }

      // Show success message with details
      const results = response.results;
      let message = "同步完成！";
      
      if (results?.removalShipments) {
        message += ` 移除货件: ${results.removalShipments.success}条成功`;
        if (results.removalShipments.failed > 0) {
          message += `, ${results.removalShipments.failed}条失败`;
        }
      }
      
      if (results?.returnOrders) {
        message += ` 退货订单: ${results.returnOrders.success}条成功`;
        if (results.returnOrders.failed > 0) {
          message += `, ${results.returnOrders.failed}条失败`;
        }
      }

      toast.success(message);

      // Invalidate queries to refresh data
      if (syncType === "all" || syncType === "removals") {
        queryClient.invalidateQueries({ queryKey: ["removal_shipments"] });
      }
      if (syncType === "all" || syncType === "orders") {
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "同步失败";
      toast.error(`同步失败: ${errorMessage}`);
      return null;
    } finally {
      setIsSyncing(false);
      setSyncProgress("");
    }
  };

  const syncRemovals = (startDate?: string, endDate?: string) => 
    sync("removals", startDate, endDate);

  const syncOrders = (startDate?: string, endDate?: string) => 
    sync("orders", startDate, endDate);

  const syncAll = (startDate?: string, endDate?: string) => 
    sync("all", startDate, endDate);

  return {
    isSyncing,
    syncProgress,
    syncRemovals,
    syncOrders,
    syncAll,
  };
}
