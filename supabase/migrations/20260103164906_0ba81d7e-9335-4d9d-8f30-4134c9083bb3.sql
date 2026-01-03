-- 修复现有数据：将已有入库记录的订单状态更新为"入库"
UPDATE orders o
SET status = '入库', inbound_at = COALESCE(o.inbound_at, i.processed_at)
FROM inbound_items i
WHERE LOWER(o.lpn) = LOWER(i.lpn) AND o.status = '未到货';

-- 修复已翻新的订单状态为"出库"
UPDATE orders o
SET status = '出库', removed_at = COALESCE(o.removed_at, i.refurbished_at), grade = i.refurbishment_grade
FROM inbound_items i
WHERE LOWER(o.lpn) = LOWER(i.lpn) 
AND i.refurbishment_grade IS NOT NULL 
AND o.status = '入库';