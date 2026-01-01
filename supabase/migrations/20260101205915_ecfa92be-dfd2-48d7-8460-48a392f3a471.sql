-- 创建一个数据库函数来计算按唯一LPN的订单统计
CREATE OR REPLACE FUNCTION public.get_order_stats_by_unique_lpn()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total', (SELECT COUNT(DISTINCT lpn) FROM orders),
    'pending', (SELECT COUNT(DISTINCT lpn) FROM orders WHERE status = '未到货'),
    'arrived', (SELECT COUNT(DISTINCT lpn) FROM orders WHERE status = '到货'),
    'shipped', (SELECT COUNT(DISTINCT lpn) FROM orders WHERE status = '出库')
  )
$$;