-- 为 removal_shipments 表添加新字段
ALTER TABLE public.removal_shipments
ADD COLUMN store_name TEXT,
ADD COLUMN country TEXT,
ADD COLUMN ship_date DATE,
ADD COLUMN msku TEXT,
ADD COLUMN product_type TEXT;