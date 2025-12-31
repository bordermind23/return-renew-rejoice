-- 创建CASE类型枚举
CREATE TYPE public.case_type AS ENUM (
  'lpn_missing',        -- LPN产品缺失
  'sku_mismatch',       -- SKU不匹配
  'accessory_missing',  -- 配件缺失
  'product_damaged',    -- 产品损坏
  'other'               -- 其他
);

-- 创建CASE状态枚举
CREATE TYPE public.case_status AS ENUM (
  'pending',            -- 待处理
  'submitted',          -- 已提交
  'in_progress',        -- 处理中
  'approved',           -- 已通过
  'rejected',           -- 已拒绝
  'closed'              -- 已关闭
);

-- 创建CASE表
CREATE TABLE public.cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number TEXT NOT NULL UNIQUE,
  case_type public.case_type NOT NULL,
  status public.case_status NOT NULL DEFAULT 'pending',
  
  -- 关联信息
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  lpn TEXT,
  tracking_number TEXT,
  removal_order_id TEXT,
  
  -- 问题描述
  title TEXT NOT NULL,
  description TEXT,
  expected_sku TEXT,
  actual_sku TEXT,
  missing_items TEXT[],
  damage_description TEXT,
  
  -- 亚马逊CASE信息
  amazon_case_id TEXT,
  amazon_case_url TEXT,
  
  -- 索赔金额
  claim_amount DECIMAL(10,2),
  approved_amount DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- 创建者
  created_by TEXT NOT NULL
);

-- 创建CASE备注/跟进记录表
CREATE TABLE public.case_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'note',  -- note, status_change, amazon_response
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL
);

-- 启用RLS
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Authenticated users can read cases" 
ON public.cases FOR SELECT USING (is_authenticated());

CREATE POLICY "Authenticated users can insert cases" 
ON public.cases FOR INSERT WITH CHECK (is_authenticated());

CREATE POLICY "Authenticated users can update cases" 
ON public.cases FOR UPDATE USING (is_authenticated());

CREATE POLICY "Admins can delete cases" 
ON public.cases FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read case_notes" 
ON public.case_notes FOR SELECT USING (is_authenticated());

CREATE POLICY "Authenticated users can insert case_notes" 
ON public.case_notes FOR INSERT WITH CHECK (is_authenticated());

CREATE POLICY "Admins can delete case_notes" 
ON public.case_notes FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- 创建更新时间触发器
CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 创建序列用于生成CASE编号
CREATE SEQUENCE IF NOT EXISTS case_number_seq START 1;

-- 创建触发器函数：自动生成CASE编号
CREATE OR REPLACE FUNCTION public.generate_case_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.case_number := 'CASE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('case_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- 创建触发器
CREATE TRIGGER trigger_generate_case_number
  BEFORE INSERT ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_case_number();