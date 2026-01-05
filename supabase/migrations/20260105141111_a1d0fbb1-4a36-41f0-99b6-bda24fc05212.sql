-- Fix: Restrict cases table access to admins only for full access, users can read their own cases

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can read cases" ON public.cases;

-- Create restricted policies for cases SELECT
-- Admins can read all cases
CREATE POLICY "Admins can read all cases" ON public.cases
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Users can read cases they created
CREATE POLICY "Users can read own cases" ON public.cases
FOR SELECT USING (auth.uid()::text = created_by);