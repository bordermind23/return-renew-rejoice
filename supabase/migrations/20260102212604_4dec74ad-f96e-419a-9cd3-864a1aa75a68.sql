-- 更新触发器函数：删除入库记录时也清除订单等级
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