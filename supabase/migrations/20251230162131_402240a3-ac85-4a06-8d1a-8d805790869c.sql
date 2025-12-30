-- 创建移除货件表
CREATE TABLE public.removal_shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  note TEXT,
  carrier TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_image TEXT,
  fnsku TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'shipping' CHECK (status IN ('shipping', 'arrived', 'inbound', 'shelved')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建入库记录表
CREATE TABLE public.inbound_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lpn TEXT NOT NULL UNIQUE,
  removal_order_id TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  return_reason TEXT,
  grade TEXT NOT NULL DEFAULT 'A' CHECK (grade IN ('A', 'B', 'C', 'new')),
  package_photo TEXT,
  product_photo TEXT,
  missing_parts TEXT[],
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建库存表
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  product_category TEXT,
  warehouse TEXT NOT NULL DEFAULT '华东仓',
  total_stock INTEGER NOT NULL DEFAULT 0,
  new_stock INTEGER NOT NULL DEFAULT 0,
  grade_a_stock INTEGER NOT NULL DEFAULT 0,
  grade_b_stock INTEGER NOT NULL DEFAULT 0,
  grade_c_stock INTEGER NOT NULL DEFAULT 0,
  product_image TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建订单表
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lpn TEXT NOT NULL,
  removal_order_id TEXT NOT NULL,
  order_number TEXT NOT NULL UNIQUE,
  store_name TEXT NOT NULL,
  station TEXT NOT NULL,
  removed_at TIMESTAMP WITH TIME ZONE,
  inbound_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.removal_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 创建公开访问策略（暂时允许所有操作，后续可以添加用户认证）
CREATE POLICY "Allow public read access" ON public.removal_shipments FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.removal_shipments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.removal_shipments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.removal_shipments FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.inbound_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.inbound_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.inbound_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.inbound_items FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.inventory_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.inventory_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.inventory_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.inventory_items FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.orders FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.orders FOR DELETE USING (true);

-- 创建更新时间戳触发器函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 为相关表添加触发器
CREATE TRIGGER update_removal_shipments_updated_at
  BEFORE UPDATE ON public.removal_shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();