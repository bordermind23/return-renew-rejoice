-- 创建权限类型枚举
CREATE TYPE public.permission_type AS ENUM (
  'view_dashboard',
  'inbound_scan',
  'refurbishment',
  'view_inventory',
  'manage_products',
  'manage_orders',
  'manage_cases',
  'delete_data',
  'manage_users',
  'manage_roles'
);

-- 创建角色权限配置表
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role app_role NOT NULL,
  permission permission_type NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role, permission)
);

-- 启用行级安全
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
CREATE POLICY "Authenticated users can read role_permissions"
ON public.role_permissions
FOR SELECT
USING (is_authenticated());

CREATE POLICY "Admins can insert role_permissions"
ON public.role_permissions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update role_permissions"
ON public.role_permissions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete role_permissions"
ON public.role_permissions
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 创建更新时间触发器
CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 插入默认权限配置
-- 管理员权限（全部开启）
INSERT INTO public.role_permissions (role, permission, allowed) VALUES
  ('admin', 'view_dashboard', true),
  ('admin', 'inbound_scan', true),
  ('admin', 'refurbishment', true),
  ('admin', 'view_inventory', true),
  ('admin', 'manage_products', true),
  ('admin', 'manage_orders', true),
  ('admin', 'manage_cases', true),
  ('admin', 'delete_data', true),
  ('admin', 'manage_users', true),
  ('admin', 'manage_roles', true);

-- 仓库员工权限
INSERT INTO public.role_permissions (role, permission, allowed) VALUES
  ('warehouse_staff', 'view_dashboard', true),
  ('warehouse_staff', 'inbound_scan', true),
  ('warehouse_staff', 'refurbishment', true),
  ('warehouse_staff', 'view_inventory', true),
  ('warehouse_staff', 'manage_products', true),
  ('warehouse_staff', 'manage_orders', true),
  ('warehouse_staff', 'manage_cases', true),
  ('warehouse_staff', 'delete_data', false),
  ('warehouse_staff', 'manage_users', false),
  ('warehouse_staff', 'manage_roles', false);

-- 访客权限
INSERT INTO public.role_permissions (role, permission, allowed) VALUES
  ('viewer', 'view_dashboard', true),
  ('viewer', 'inbound_scan', false),
  ('viewer', 'refurbishment', false),
  ('viewer', 'view_inventory', true),
  ('viewer', 'manage_products', false),
  ('viewer', 'manage_orders', false),
  ('viewer', 'manage_cases', false),
  ('viewer', 'delete_data', false),
  ('viewer', 'manage_users', false),
  ('viewer', 'manage_roles', false);