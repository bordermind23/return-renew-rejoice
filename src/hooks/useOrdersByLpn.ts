import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Order } from "@/hooks/useOrders";

export const fetchOrdersByLpn = async (lpn: string) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("lpn", lpn)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Order[];
};

export const useOrdersByLpn = (lpn: string | null) => {
  return useQuery({
    queryKey: ["orders", "by-lpn", lpn],
    enabled: !!lpn,
    queryFn: () => fetchOrdersByLpn(lpn as string),
  });
};
