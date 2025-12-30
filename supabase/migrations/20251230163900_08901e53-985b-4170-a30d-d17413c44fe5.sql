-- 创建承运商表
CREATE TABLE public.carriers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;

-- 创建公开访问策略
CREATE POLICY "Allow public read access" ON public.carriers FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.carriers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access" ON public.carriers FOR DELETE USING (true);

-- 插入默认承运商
INSERT INTO public.carriers (name) VALUES 
  ('顺丰速运'),
  ('京东物流'),
  ('德邦快递'),
  ('中通快递'),
  ('韵达快递'),
  ('圆通速递'),
  ('申通快递');