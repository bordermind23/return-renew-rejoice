-- Make the product-images storage bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'product-images';

-- Allow anyone to view product images (public read access)
CREATE POLICY "Anyone can view product images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');