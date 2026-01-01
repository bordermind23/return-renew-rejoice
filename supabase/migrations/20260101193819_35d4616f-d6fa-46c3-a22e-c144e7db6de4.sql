-- 添加 "待同步" 状态到 order_status 枚举
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS '待同步';