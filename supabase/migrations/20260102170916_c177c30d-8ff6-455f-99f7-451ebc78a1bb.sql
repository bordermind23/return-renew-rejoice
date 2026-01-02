-- Make product-images bucket private
UPDATE storage.buckets SET public = false WHERE id = 'product-images';

-- Drop existing public access policy for product-images
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view product images" ON storage.objects;

-- Create new secure policy for product-images bucket (authenticated users only)
CREATE POLICY "Authenticated users can view product images" ON storage.objects
FOR SELECT USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');