-- Create function to auto-assign role on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this is the first user (no existing roles)
  IF NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) THEN
    -- First user gets admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    -- Subsequent users get warehouse_staff role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'warehouse_staff');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to call the function when a new user signs up
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();