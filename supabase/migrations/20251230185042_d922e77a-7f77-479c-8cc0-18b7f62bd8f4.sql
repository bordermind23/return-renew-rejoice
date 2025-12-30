-- 创建产品表
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建产品配件表
CREATE TABLE public.product_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_parts ENABLE ROW LEVEL SECURITY;

-- 产品表 RLS 策略
CREATE POLICY "Allow public read access" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.products FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.products FOR DELETE USING (true);

-- 产品配件表 RLS 策略
CREATE POLICY "Allow public read access" ON public.product_parts FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.product_parts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.product_parts FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.product_parts FOR DELETE USING (true);

-- 移除 inventory_items 的 new_stock 列
ALTER TABLE public.inventory_items DROP COLUMN IF EXISTS new_stock;

-- 添加 updated_at 触发器
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();