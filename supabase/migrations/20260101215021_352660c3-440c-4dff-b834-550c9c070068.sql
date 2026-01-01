-- Add role-based access control to the get_order_stats_by_unique_lpn function
-- This function now validates authentication and role before returning stats

CREATE OR REPLACE FUNCTION public.get_order_stats_by_unique_lpn()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is authenticated
  IF auth.role() != 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Return the stats
  RETURN json_build_object(
    'total', (SELECT COUNT(DISTINCT lpn) FROM orders),
    'pending', (SELECT COUNT(DISTINCT lpn) FROM orders WHERE status = '未到货'),
    'arrived', (SELECT COUNT(DISTINCT lpn) FROM orders WHERE status = '到货'),
    'shipped', (SELECT COUNT(DISTINCT lpn) FROM orders WHERE status = '出库')
  );
END;
$$;

-- Revoke execution from public and grant only to authenticated users
REVOKE EXECUTE ON FUNCTION public.get_order_stats_by_unique_lpn() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_stats_by_unique_lpn() TO authenticated;