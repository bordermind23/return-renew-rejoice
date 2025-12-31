-- 为 product_parts 表添加 image 字段
ALTER TABLE public.product_parts ADD COLUMN IF NOT EXISTS image text;