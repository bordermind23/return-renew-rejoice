-- Add grade field to orders table
ALTER TABLE public.orders 
ADD COLUMN grade TEXT DEFAULT NULL;