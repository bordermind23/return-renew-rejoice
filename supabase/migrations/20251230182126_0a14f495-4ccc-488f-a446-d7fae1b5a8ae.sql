-- 删除旧的单字段唯一约束
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_number_key;

-- 添加新的复合唯一约束（LPN + 订单号组合唯一）
ALTER TABLE public.orders ADD CONSTRAINT orders_lpn_order_number_key UNIQUE (lpn, order_number);