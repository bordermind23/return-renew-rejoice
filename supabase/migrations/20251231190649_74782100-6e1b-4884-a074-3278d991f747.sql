-- Add duplicate_confirmed column to track confirmed duplicates
ALTER TABLE public.removal_shipments 
ADD COLUMN duplicate_confirmed boolean NOT NULL DEFAULT false;