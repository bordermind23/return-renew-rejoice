-- 删除旧的状态检查约束
ALTER TABLE removal_shipments DROP CONSTRAINT IF EXISTS removal_shipments_status_check;

-- 首先更新所有现有记录的状态为"未到货"
UPDATE removal_shipments 
SET status = '未到货' 
WHERE status NOT IN ('未到货', '入库');

-- 然后将有入库记录的货件状态更新为"入库"
UPDATE removal_shipments rs
SET status = '入库'
WHERE EXISTS (
  SELECT 1 FROM inbound_items ii 
  WHERE ii.tracking_number = rs.tracking_number
);

-- 最后添加新的状态检查约束
ALTER TABLE removal_shipments ADD CONSTRAINT removal_shipments_status_check 
CHECK (status IN ('未到货', '入库'));