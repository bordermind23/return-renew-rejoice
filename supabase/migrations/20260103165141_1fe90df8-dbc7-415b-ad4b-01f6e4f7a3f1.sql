-- 清除"未到货"和"到货"状态订单的等级（只有翻新后才有等级）
UPDATE orders 
SET grade = NULL 
WHERE status IN ('未到货', '到货') AND grade IS NOT NULL;