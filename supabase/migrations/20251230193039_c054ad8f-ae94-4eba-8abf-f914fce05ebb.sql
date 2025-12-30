-- Add quantity field to product_parts table
ALTER TABLE public.product_parts 
ADD COLUMN quantity integer NOT NULL DEFAULT 1;

-- Create product_categories table
CREATE TABLE public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on product_categories
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for product_categories
CREATE POLICY "Allow public read access" ON public.product_categories
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON public.product_categories
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete access" ON public.product_categories
  FOR DELETE USING (true);