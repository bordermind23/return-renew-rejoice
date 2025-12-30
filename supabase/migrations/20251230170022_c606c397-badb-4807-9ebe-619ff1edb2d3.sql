-- 为 inbound_items 表添加物流跟踪号关联字段
ALTER TABLE public.inbound_items
ADD COLUMN tracking_number TEXT,
ADD COLUMN shipment_id UUID;