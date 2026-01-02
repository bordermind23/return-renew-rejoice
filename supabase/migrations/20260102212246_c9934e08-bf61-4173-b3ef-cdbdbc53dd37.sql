-- 先添加新的枚举值"入库"到现有枚举
ALTER TYPE order_status ADD VALUE IF NOT EXISTS '入库';