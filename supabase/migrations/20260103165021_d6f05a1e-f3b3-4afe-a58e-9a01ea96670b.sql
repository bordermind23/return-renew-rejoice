-- 更新触发器函数：入库时状态改为"到货"而不是"入库"
CREATE OR REPLACE FUNCTION public.update_order_status_on_inbound_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 根据 LPN 更新对应的订单状态为"到货"
  UPDATE orders 
  SET status = '到货', inbound_at = COALESCE(inbound_at, NOW())
  WHERE LOWER(lpn) = LOWER(NEW.lpn) AND status = '未到货';
  
  RETURN NEW;
END;
$function$;

-- 更新触发器函数：翻新时从"到货"变为"出库"
CREATE OR REPLACE FUNCTION public.update_order_status_on_refurbishment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 当翻新等级从NULL变为非NULL时，更新订单状态为"出库"
  IF OLD.refurbishment_grade IS NULL AND NEW.refurbishment_grade IS NOT NULL THEN
    UPDATE orders 
    SET status = '出库', removed_at = COALESCE(removed_at, NOW()), grade = NEW.refurbishment_grade
    WHERE LOWER(lpn) = LOWER(NEW.lpn) AND status = '到货';
  -- 当翻新等级从非NULL变为NULL时（清除翻新），恢复状态为"到货"
  ELSIF OLD.refurbishment_grade IS NOT NULL AND NEW.refurbishment_grade IS NULL THEN
    UPDATE orders 
    SET status = '到货', removed_at = NULL, grade = NULL
    WHERE LOWER(lpn) = LOWER(NEW.lpn) AND status = '出库';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 更新触发器函数：删除入库记录时恢复状态
CREATE OR REPLACE FUNCTION public.update_order_status_on_inbound_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 检查是否还有其他相同 LPN 的入库记录
  IF NOT EXISTS (
    SELECT 1 FROM inbound_items 
    WHERE LOWER(lpn) = LOWER(OLD.lpn) AND id != OLD.id
  ) THEN
    -- 如果没有其他记录，恢复状态为"未到货"并清除等级
    UPDATE orders 
    SET status = '未到货', inbound_at = NULL, removed_at = NULL, grade = NULL
    WHERE LOWER(lpn) = LOWER(OLD.lpn);
  END IF;
  
  RETURN OLD;
END;
$function$;

-- 修复现有数据：将"入库"状态改为"到货"
UPDATE orders SET status = '到货' WHERE status = '入库';