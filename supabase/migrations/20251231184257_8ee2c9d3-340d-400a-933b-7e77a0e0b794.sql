-- 修改 removal_shipments 表，允许 product_sku 和 product_name 为空
ALTER TABLE public.removal_shipments 
  ALTER COLUMN product_sku DROP NOT NULL,
  ALTER COLUMN product_name DROP NOT NULL;