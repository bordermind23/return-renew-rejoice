-- Rename warehouse_quantity to warehouse_location
ALTER TABLE public.orders RENAME COLUMN warehouse_quantity TO warehouse_location;

-- Change the column type from integer to text
ALTER TABLE public.orders ALTER COLUMN warehouse_location TYPE text USING warehouse_location::text;