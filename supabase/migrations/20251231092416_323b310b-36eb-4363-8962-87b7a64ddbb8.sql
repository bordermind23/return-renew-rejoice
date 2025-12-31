-- 创建订单状态枚举
CREATE TYPE public.order_status AS ENUM ('未到货', '到货', '出库');

-- 为 orders 表添加状态列
ALTER TABLE public.orders 
ADD COLUMN status public.order_status NOT NULL DEFAULT '未到货';

-- 根据现有数据设置初始状态
-- 如果已有 inbound_at 记录，说明已到货
UPDATE public.orders 
SET status = '到货' 
WHERE inbound_at IS NOT NULL;

-- 如果已有 removed_at 记录，说明已出库
UPDATE public.orders 
SET status = '出库' 
WHERE removed_at IS NOT NULL;