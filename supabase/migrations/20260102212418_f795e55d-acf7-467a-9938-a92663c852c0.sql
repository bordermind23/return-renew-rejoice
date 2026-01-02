-- 创建触发器函数：入库时更新移除货件状态为"入库"
CREATE OR REPLACE FUNCTION public.update_shipment_status_on_inbound_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 根据 tracking_number 更新对应的移除货件状态为"入库"
  IF NEW.tracking_number IS NOT NULL AND NEW.tracking_number != '' THEN
    UPDATE removal_shipments 
    SET status = '入库'
    WHERE tracking_number = NEW.tracking_number AND status = '未到货';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 创建触发器函数：删除入库记录时恢复移除货件状态为"未到货"
CREATE OR REPLACE FUNCTION public.update_shipment_status_on_inbound_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 检查是否还有其他相同 tracking_number 的入库记录
  IF OLD.tracking_number IS NOT NULL AND OLD.tracking_number != '' THEN
    IF NOT EXISTS (
      SELECT 1 FROM inbound_items 
      WHERE tracking_number = OLD.tracking_number AND id != OLD.id
    ) THEN
      -- 如果没有其他记录，恢复状态为"未到货"
      UPDATE removal_shipments 
      SET status = '未到货'
      WHERE tracking_number = OLD.tracking_number AND status = '入库';
    END IF;
  END IF;
  
  RETURN OLD;
END;
$function$;

-- 创建触发器函数：入库时更新订单状态为"入库"
CREATE OR REPLACE FUNCTION public.update_order_status_on_inbound_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 根据 LPN 更新对应的订单状态为"入库"
  UPDATE orders 
  SET status = '入库', inbound_at = COALESCE(inbound_at, NOW())
  WHERE LOWER(lpn) = LOWER(NEW.lpn) AND status = '未到货';
  
  RETURN NEW;
END;
$function$;

-- 创建触发器函数：删除入库记录时恢复订单状态为"未到货"
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
    -- 如果没有其他记录，恢复状态为"未到货"
    UPDATE orders 
    SET status = '未到货', inbound_at = NULL
    WHERE LOWER(lpn) = LOWER(OLD.lpn) AND status = '入库';
  END IF;
  
  RETURN OLD;
END;
$function$;

-- 创建触发器函数：翻新完成时更新订单状态为"出库"
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
    WHERE LOWER(lpn) = LOWER(NEW.lpn) AND status = '入库';
  -- 当翻新等级从非NULL变为NULL时（清除翻新），恢复状态为"入库"
  ELSIF OLD.refurbishment_grade IS NOT NULL AND NEW.refurbishment_grade IS NULL THEN
    UPDATE orders 
    SET status = '入库', removed_at = NULL, grade = NULL
    WHERE LOWER(lpn) = LOWER(NEW.lpn) AND status = '出库';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 创建触发器：入库记录插入时更新移除货件状态
DROP TRIGGER IF EXISTS trigger_update_shipment_on_inbound_insert ON inbound_items;
CREATE TRIGGER trigger_update_shipment_on_inbound_insert
  AFTER INSERT ON inbound_items
  FOR EACH ROW
  EXECUTE FUNCTION update_shipment_status_on_inbound_insert();

-- 创建触发器：入库记录删除时恢复移除货件状态
DROP TRIGGER IF EXISTS trigger_update_shipment_on_inbound_delete ON inbound_items;
CREATE TRIGGER trigger_update_shipment_on_inbound_delete
  BEFORE DELETE ON inbound_items
  FOR EACH ROW
  EXECUTE FUNCTION update_shipment_status_on_inbound_delete();

-- 创建触发器：入库记录插入时更新订单状态
DROP TRIGGER IF EXISTS trigger_update_order_on_inbound_insert ON inbound_items;
CREATE TRIGGER trigger_update_order_on_inbound_insert
  AFTER INSERT ON inbound_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_on_inbound_insert();

-- 创建触发器：入库记录删除时恢复订单状态
DROP TRIGGER IF EXISTS trigger_update_order_on_inbound_delete ON inbound_items;
CREATE TRIGGER trigger_update_order_on_inbound_delete
  BEFORE DELETE ON inbound_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_on_inbound_delete();

-- 创建触发器：翻新时更新订单状态
DROP TRIGGER IF EXISTS trigger_update_order_on_refurbishment ON inbound_items;
CREATE TRIGGER trigger_update_order_on_refurbishment
  AFTER UPDATE ON inbound_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_on_refurbishment();