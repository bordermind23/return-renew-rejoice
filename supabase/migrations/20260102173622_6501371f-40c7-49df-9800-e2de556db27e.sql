-- 添加新的照片字段到 inbound_items 表
ALTER TABLE public.inbound_items 
ADD COLUMN IF NOT EXISTS damage_photo_1 TEXT,
ADD COLUMN IF NOT EXISTS damage_photo_2 TEXT,
ADD COLUMN IF NOT EXISTS damage_photo_3 TEXT,
ADD COLUMN IF NOT EXISTS package_accessories_photo TEXT;