-- Add multiple photo fields to inbound_items table
ALTER TABLE public.inbound_items
ADD COLUMN IF NOT EXISTS lpn_label_photo text,
ADD COLUMN IF NOT EXISTS packaging_photo_1 text,
ADD COLUMN IF NOT EXISTS packaging_photo_2 text,
ADD COLUMN IF NOT EXISTS packaging_photo_3 text,
ADD COLUMN IF NOT EXISTS packaging_photo_4 text,
ADD COLUMN IF NOT EXISTS packaging_photo_5 text,
ADD COLUMN IF NOT EXISTS packaging_photo_6 text,
ADD COLUMN IF NOT EXISTS accessories_photo text,
ADD COLUMN IF NOT EXISTS detail_photo text;