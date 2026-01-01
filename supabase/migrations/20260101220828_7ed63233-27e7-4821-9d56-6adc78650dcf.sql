-- Create storage bucket for shipping label photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('shipping-labels', 'shipping-labels', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for shipping label storage
CREATE POLICY "Authenticated users can upload shipping labels"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'shipping-labels' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can view shipping labels"
ON storage.objects
FOR SELECT
USING (bucket_id = 'shipping-labels' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update shipping labels"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'shipping-labels' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can delete shipping labels"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'shipping-labels' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Add shipping_label_photo column to removal_shipments if not exists
ALTER TABLE public.removal_shipments 
ADD COLUMN IF NOT EXISTS shipping_label_photo text;

-- Add shipping_label_photo column to inbound_items if not exists
ALTER TABLE public.inbound_items 
ADD COLUMN IF NOT EXISTS shipping_label_photo text;