-- 添加内部退货订单号字段
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS internal_order_no TEXT;

-- 创建索引以便快速查询
CREATE INDEX IF NOT EXISTS idx_orders_internal_order_no ON public.orders(internal_order_no);

-- 创建序列用于生成内部订单号
CREATE SEQUENCE IF NOT EXISTS internal_order_seq START 1;

-- 创建函数：自动为新订单生成内部订单号
CREATE OR REPLACE FUNCTION public.generate_internal_order_no()
RETURNS TRIGGER AS $$
DECLARE
  existing_order_no TEXT;
BEGIN
  -- 检查是否存在相同LPN的订单
  SELECT internal_order_no INTO existing_order_no
  FROM public.orders
  WHERE lpn = NEW.lpn AND internal_order_no IS NOT NULL
  LIMIT 1;
  
  IF existing_order_no IS NOT NULL THEN
    -- 使用已存在的内部订单号
    NEW.internal_order_no := existing_order_no;
  ELSE
    -- 生成新的内部订单号 (格式: RO-YYYYMMDD-XXXX)
    NEW.internal_order_no := 'RO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('internal_order_seq')::TEXT, 4, '0');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_generate_internal_order_no ON public.orders;
CREATE TRIGGER trigger_generate_internal_order_no
BEFORE INSERT ON public.orders
FOR EACH ROW
WHEN (NEW.internal_order_no IS NULL)
EXECUTE FUNCTION public.generate_internal_order_no();