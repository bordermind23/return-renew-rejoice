-- Create case_types table for custom case types
CREATE TABLE public.case_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.case_types ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can read case_types" 
ON public.case_types 
FOR SELECT 
USING (is_authenticated());

CREATE POLICY "Authenticated users can insert case_types" 
ON public.case_types 
FOR INSERT 
WITH CHECK (is_authenticated());

CREATE POLICY "Authenticated users can update case_types" 
ON public.case_types 
FOR UPDATE 
USING (is_authenticated());

CREATE POLICY "Admins can delete case_types" 
ON public.case_types 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default system case types
INSERT INTO public.case_types (code, label, description, is_system) VALUES
  ('lpn_missing', 'LPN产品缺失', '包裹中LPN产品缺失', true),
  ('sku_mismatch', 'SKU不匹配', '实际SKU与申报SKU不一致', true),
  ('accessory_missing', '配件缺失', 'LPN产品中配件缺失', true),
  ('product_damaged', '产品损坏', 'LPN产品存在损坏', true),
  ('other', '其他', '其他类型问题', true);