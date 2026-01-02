-- 创建函数：删除入库记录时自动减少库存
CREATE OR REPLACE FUNCTION public.reduce_inventory_on_inbound_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 只有已翻新的记录才会影响库存
    IF OLD.refurbishment_grade IS NOT NULL THEN
        -- 根据翻新等级减少对应库存
        IF OLD.refurbishment_grade = 'A' THEN
            UPDATE inventory_items 
            SET grade_a_stock = GREATEST(0, grade_a_stock - 1),
                total_stock = GREATEST(0, total_stock - 1)
            WHERE sku = OLD.product_sku;
        ELSIF OLD.refurbishment_grade = 'B' THEN
            UPDATE inventory_items 
            SET grade_b_stock = GREATEST(0, grade_b_stock - 1),
                total_stock = GREATEST(0, total_stock - 1)
            WHERE sku = OLD.product_sku;
        ELSIF OLD.refurbishment_grade = 'C' THEN
            UPDATE inventory_items 
            SET grade_c_stock = GREATEST(0, grade_c_stock - 1),
                total_stock = GREATEST(0, total_stock - 1)
            WHERE sku = OLD.product_sku;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$;

-- 创建触发器：删除入库记录时触发
DROP TRIGGER IF EXISTS trigger_reduce_inventory_on_inbound_delete ON inbound_items;
CREATE TRIGGER trigger_reduce_inventory_on_inbound_delete
BEFORE DELETE ON inbound_items
FOR EACH ROW
EXECUTE FUNCTION reduce_inventory_on_inbound_delete();

-- 创建函数：翻新完成时自动增加库存
CREATE OR REPLACE FUNCTION public.increase_inventory_on_refurbishment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 当翻新等级从NULL变为非NULL时，增加库存
    IF OLD.refurbishment_grade IS NULL AND NEW.refurbishment_grade IS NOT NULL THEN
        -- 检查库存记录是否存在
        IF NOT EXISTS (SELECT 1 FROM inventory_items WHERE sku = NEW.product_sku) THEN
            -- 创建新的库存记录
            INSERT INTO inventory_items (sku, product_name, grade_a_stock, grade_b_stock, grade_c_stock, total_stock)
            VALUES (NEW.product_sku, NEW.product_name, 0, 0, 0, 0);
        END IF;
        
        -- 根据翻新等级增加对应库存
        IF NEW.refurbishment_grade = 'A' THEN
            UPDATE inventory_items 
            SET grade_a_stock = grade_a_stock + 1,
                total_stock = total_stock + 1
            WHERE sku = NEW.product_sku;
        ELSIF NEW.refurbishment_grade = 'B' THEN
            UPDATE inventory_items 
            SET grade_b_stock = grade_b_stock + 1,
                total_stock = total_stock + 1
            WHERE sku = NEW.product_sku;
        ELSIF NEW.refurbishment_grade = 'C' THEN
            UPDATE inventory_items 
            SET grade_c_stock = grade_c_stock + 1,
                total_stock = total_stock + 1
            WHERE sku = NEW.product_sku;
        END IF;
    -- 当翻新等级变更时，调整库存
    ELSIF OLD.refurbishment_grade IS NOT NULL AND NEW.refurbishment_grade IS NOT NULL AND OLD.refurbishment_grade != NEW.refurbishment_grade THEN
        -- 减少旧等级库存
        IF OLD.refurbishment_grade = 'A' THEN
            UPDATE inventory_items SET grade_a_stock = GREATEST(0, grade_a_stock - 1) WHERE sku = NEW.product_sku;
        ELSIF OLD.refurbishment_grade = 'B' THEN
            UPDATE inventory_items SET grade_b_stock = GREATEST(0, grade_b_stock - 1) WHERE sku = NEW.product_sku;
        ELSIF OLD.refurbishment_grade = 'C' THEN
            UPDATE inventory_items SET grade_c_stock = GREATEST(0, grade_c_stock - 1) WHERE sku = NEW.product_sku;
        END IF;
        
        -- 增加新等级库存
        IF NEW.refurbishment_grade = 'A' THEN
            UPDATE inventory_items SET grade_a_stock = grade_a_stock + 1 WHERE sku = NEW.product_sku;
        ELSIF NEW.refurbishment_grade = 'B' THEN
            UPDATE inventory_items SET grade_b_stock = grade_b_stock + 1 WHERE sku = NEW.product_sku;
        ELSIF NEW.refurbishment_grade = 'C' THEN
            UPDATE inventory_items SET grade_c_stock = grade_c_stock + 1 WHERE sku = NEW.product_sku;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 创建触发器：翻新完成时触发
DROP TRIGGER IF EXISTS trigger_increase_inventory_on_refurbishment ON inbound_items;
CREATE TRIGGER trigger_increase_inventory_on_refurbishment
AFTER UPDATE ON inbound_items
FOR EACH ROW
EXECUTE FUNCTION increase_inventory_on_refurbishment();