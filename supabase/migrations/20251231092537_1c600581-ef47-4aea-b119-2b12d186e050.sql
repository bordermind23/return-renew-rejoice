-- 创建触发器函数：当 inbound_at 更新时自动将状态改为"到货"
CREATE OR REPLACE FUNCTION public.update_order_status_on_inbound()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 当 inbound_at 从 NULL 变为非 NULL 时，更新状态为"到货"
  IF OLD.inbound_at IS NULL AND NEW.inbound_at IS NOT NULL AND NEW.status = '未到货' THEN
    NEW.status := '到货';
  END IF;
  
  -- 当 removed_at 从 NULL 变为非 NULL 时，更新状态为"出库"
  IF OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL AND NEW.status = '到货' THEN
    NEW.status := '出库';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_order_status ON public.orders;
CREATE TRIGGER trigger_update_order_status
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_status_on_inbound();