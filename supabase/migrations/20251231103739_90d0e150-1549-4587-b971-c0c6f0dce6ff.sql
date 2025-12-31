-- Add refurbishment fields to inbound_items table
ALTER TABLE public.inbound_items
ADD COLUMN IF NOT EXISTS refurbished_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refurbished_by text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refurbishment_grade text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refurbishment_photos text[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refurbishment_videos text[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refurbishment_notes text DEFAULT NULL;

-- Create index for faster refurbishment queries
CREATE INDEX IF NOT EXISTS idx_inbound_items_refurbished_at ON public.inbound_items(refurbished_at);