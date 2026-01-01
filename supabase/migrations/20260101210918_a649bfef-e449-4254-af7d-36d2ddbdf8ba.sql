-- 1. 操作日志表
CREATE TABLE public.operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.operation_logs ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "Users can view their own logs"
ON public.operation_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all logs"
ON public.operation_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can insert logs"
ON public.operation_logs FOR INSERT
WITH CHECK (is_authenticated());

-- 2. 低库存预警配置表
CREATE TABLE public.inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  min_threshold INTEGER NOT NULL DEFAULT 10,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inventory_alerts"
ON public.inventory_alerts FOR SELECT
USING (is_authenticated());

CREATE POLICY "Authenticated users can insert inventory_alerts"
ON public.inventory_alerts FOR INSERT
WITH CHECK (is_authenticated());

CREATE POLICY "Authenticated users can update inventory_alerts"
ON public.inventory_alerts FOR UPDATE
USING (is_authenticated());

CREATE POLICY "Admins can delete inventory_alerts"
ON public.inventory_alerts FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 触发器更新 updated_at
CREATE TRIGGER update_inventory_alerts_updated_at
BEFORE UPDATE ON public.inventory_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3. CASE提醒表
CREATE TABLE public.case_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  remind_at TIMESTAMPTZ NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.case_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read case_reminders"
ON public.case_reminders FOR SELECT
USING (is_authenticated());

CREATE POLICY "Authenticated users can insert case_reminders"
ON public.case_reminders FOR INSERT
WITH CHECK (is_authenticated());

CREATE POLICY "Authenticated users can update case_reminders"
ON public.case_reminders FOR UPDATE
USING (is_authenticated());

CREATE POLICY "Admins can delete case_reminders"
ON public.case_reminders FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. 用户偏好设置表
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  sidebar_collapsed BOOLEAN NOT NULL DEFAULT false,
  theme TEXT NOT NULL DEFAULT 'light',
  default_filters JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences"
ON public.user_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
ON public.user_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
ON public.user_preferences FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences"
ON public.user_preferences FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. 为cases表添加附件字段
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS attachments TEXT[];