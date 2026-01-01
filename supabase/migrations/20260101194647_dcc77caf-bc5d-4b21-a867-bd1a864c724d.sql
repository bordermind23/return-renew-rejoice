-- =====================================================
-- 数据完整性修复迁移脚本
-- 添加外键约束和级联删除规则
-- =====================================================

-- 1. 修复 case_notes -> cases 外键（添加级联删除）
-- 如果外键已存在，先删除再重建
DO $$
BEGIN
    -- 检查并删除旧约束
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'case_notes_case_id_fkey' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.case_notes DROP CONSTRAINT case_notes_case_id_fkey;
    END IF;
END $$;

-- 添加带级联删除的外键
ALTER TABLE public.case_notes
ADD CONSTRAINT case_notes_case_id_fkey
FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;

-- 2. 修复 cases -> orders 外键（添加级联置空）
-- 订单删除时，案例保留但 order_id 置空
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'cases_order_id_fkey' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.cases DROP CONSTRAINT cases_order_id_fkey;
    END IF;
END $$;

ALTER TABLE public.cases
ADD CONSTRAINT cases_order_id_fkey
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

-- 3. 修复 product_parts -> products 外键（添加级联删除）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'product_parts_product_id_fkey' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.product_parts DROP CONSTRAINT product_parts_product_id_fkey;
    END IF;
END $$;

ALTER TABLE public.product_parts
ADD CONSTRAINT product_parts_product_id_fkey
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- 4. 添加 user_roles -> auth.users 外键（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_roles_user_id_fkey' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.user_roles
        ADD CONSTRAINT user_roles_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. 创建触发器函数：删除订单时自动删除关联的入库记录
-- （因为 orders 和 inbound_items 通过 lpn 关联，无法用外键）
CREATE OR REPLACE FUNCTION public.cascade_delete_inbound_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 删除关联的入库记录（通过 LPN 匹配）
    DELETE FROM public.inbound_items 
    WHERE LOWER(lpn) = LOWER(OLD.lpn);
    
    RETURN OLD;
END;
$$;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_cascade_delete_inbound_items ON public.orders;

-- 创建触发器
CREATE TRIGGER trigger_cascade_delete_inbound_items
BEFORE DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.cascade_delete_inbound_items();

-- 6. 创建触发器函数：删除产品时自动清理库存记录
CREATE OR REPLACE FUNCTION public.cascade_delete_inventory_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 删除关联的库存记录（通过 SKU 匹配）
    DELETE FROM public.inventory_items 
    WHERE sku = OLD.sku;
    
    RETURN OLD;
END;
$$;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_cascade_delete_inventory_items ON public.products;

-- 创建触发器
CREATE TRIGGER trigger_cascade_delete_inventory_items
BEFORE DELETE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.cascade_delete_inventory_items();

-- 7. 添加注释说明关联关系
COMMENT ON CONSTRAINT case_notes_case_id_fkey ON public.case_notes IS '案例备注关联案例，级联删除';
COMMENT ON CONSTRAINT cases_order_id_fkey ON public.cases IS '案例关联订单，删除订单时置空';
COMMENT ON CONSTRAINT product_parts_product_id_fkey ON public.product_parts IS '产品配件关联产品，级联删除';
COMMENT ON TRIGGER trigger_cascade_delete_inbound_items ON public.orders IS '删除订单时自动删除关联的入库记录';
COMMENT ON TRIGGER trigger_cascade_delete_inventory_items ON public.products IS '删除产品时自动删除关联的库存记录';