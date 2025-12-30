-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'warehouse_staff', 'viewer');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is authenticated
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'authenticated'
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Drop old public policies and create authenticated policies for all tables

-- ORDERS table
DROP POLICY IF EXISTS "Allow public read access" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert access" ON public.orders;
DROP POLICY IF EXISTS "Allow public update access" ON public.orders;
DROP POLICY IF EXISTS "Allow public delete access" ON public.orders;

CREATE POLICY "Authenticated users can read orders" ON public.orders
FOR SELECT USING (public.is_authenticated());

CREATE POLICY "Authenticated users can insert orders" ON public.orders
FOR INSERT WITH CHECK (public.is_authenticated());

CREATE POLICY "Authenticated users can update orders" ON public.orders
FOR UPDATE USING (public.is_authenticated());

CREATE POLICY "Admins can delete orders" ON public.orders
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- INBOUND_ITEMS table
DROP POLICY IF EXISTS "Allow public read access" ON public.inbound_items;
DROP POLICY IF EXISTS "Allow public insert access" ON public.inbound_items;
DROP POLICY IF EXISTS "Allow public update access" ON public.inbound_items;
DROP POLICY IF EXISTS "Allow public delete access" ON public.inbound_items;

CREATE POLICY "Authenticated users can read inbound_items" ON public.inbound_items
FOR SELECT USING (public.is_authenticated());

CREATE POLICY "Authenticated users can insert inbound_items" ON public.inbound_items
FOR INSERT WITH CHECK (public.is_authenticated());

CREATE POLICY "Authenticated users can update inbound_items" ON public.inbound_items
FOR UPDATE USING (public.is_authenticated());

CREATE POLICY "Admins can delete inbound_items" ON public.inbound_items
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- INVENTORY_ITEMS table
DROP POLICY IF EXISTS "Allow public read access" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow public insert access" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow public update access" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow public delete access" ON public.inventory_items;

CREATE POLICY "Authenticated users can read inventory_items" ON public.inventory_items
FOR SELECT USING (public.is_authenticated());

CREATE POLICY "Authenticated users can insert inventory_items" ON public.inventory_items
FOR INSERT WITH CHECK (public.is_authenticated());

CREATE POLICY "Authenticated users can update inventory_items" ON public.inventory_items
FOR UPDATE USING (public.is_authenticated());

CREATE POLICY "Admins can delete inventory_items" ON public.inventory_items
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- PRODUCTS table
DROP POLICY IF EXISTS "Allow public read access" ON public.products;
DROP POLICY IF EXISTS "Allow public insert access" ON public.products;
DROP POLICY IF EXISTS "Allow public update access" ON public.products;
DROP POLICY IF EXISTS "Allow public delete access" ON public.products;

CREATE POLICY "Authenticated users can read products" ON public.products
FOR SELECT USING (public.is_authenticated());

CREATE POLICY "Authenticated users can insert products" ON public.products
FOR INSERT WITH CHECK (public.is_authenticated());

CREATE POLICY "Authenticated users can update products" ON public.products
FOR UPDATE USING (public.is_authenticated());

CREATE POLICY "Admins can delete products" ON public.products
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- PRODUCT_PARTS table
DROP POLICY IF EXISTS "Allow public read access" ON public.product_parts;
DROP POLICY IF EXISTS "Allow public insert access" ON public.product_parts;
DROP POLICY IF EXISTS "Allow public update access" ON public.product_parts;
DROP POLICY IF EXISTS "Allow public delete access" ON public.product_parts;

CREATE POLICY "Authenticated users can read product_parts" ON public.product_parts
FOR SELECT USING (public.is_authenticated());

CREATE POLICY "Authenticated users can insert product_parts" ON public.product_parts
FOR INSERT WITH CHECK (public.is_authenticated());

CREATE POLICY "Authenticated users can update product_parts" ON public.product_parts
FOR UPDATE USING (public.is_authenticated());

CREATE POLICY "Admins can delete product_parts" ON public.product_parts
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- PRODUCT_CATEGORIES table
DROP POLICY IF EXISTS "Allow public read access" ON public.product_categories;
DROP POLICY IF EXISTS "Allow public insert access" ON public.product_categories;
DROP POLICY IF EXISTS "Allow public delete access" ON public.product_categories;

CREATE POLICY "Authenticated users can read product_categories" ON public.product_categories
FOR SELECT USING (public.is_authenticated());

CREATE POLICY "Authenticated users can insert product_categories" ON public.product_categories
FOR INSERT WITH CHECK (public.is_authenticated());

CREATE POLICY "Admins can delete product_categories" ON public.product_categories
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- REMOVAL_SHIPMENTS table
DROP POLICY IF EXISTS "Allow public read access" ON public.removal_shipments;
DROP POLICY IF EXISTS "Allow public insert access" ON public.removal_shipments;
DROP POLICY IF EXISTS "Allow public update access" ON public.removal_shipments;
DROP POLICY IF EXISTS "Allow public delete access" ON public.removal_shipments;

CREATE POLICY "Authenticated users can read removal_shipments" ON public.removal_shipments
FOR SELECT USING (public.is_authenticated());

CREATE POLICY "Authenticated users can insert removal_shipments" ON public.removal_shipments
FOR INSERT WITH CHECK (public.is_authenticated());

CREATE POLICY "Authenticated users can update removal_shipments" ON public.removal_shipments
FOR UPDATE USING (public.is_authenticated());

CREATE POLICY "Admins can delete removal_shipments" ON public.removal_shipments
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- CARRIERS table
DROP POLICY IF EXISTS "Allow public read access" ON public.carriers;
DROP POLICY IF EXISTS "Allow public insert access" ON public.carriers;
DROP POLICY IF EXISTS "Allow public delete access" ON public.carriers;

CREATE POLICY "Authenticated users can read carriers" ON public.carriers
FOR SELECT USING (public.is_authenticated());

CREATE POLICY "Authenticated users can insert carriers" ON public.carriers
FOR INSERT WITH CHECK (public.is_authenticated());

CREATE POLICY "Admins can delete carriers" ON public.carriers
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- STORAGE: Update product-images bucket policies
DROP POLICY IF EXISTS "Allow public read access to product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload to product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update to product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete to product images" ON storage.objects;

-- Keep public read for product display, but restrict write
CREATE POLICY "Anyone can view product images" ON storage.objects
FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update product images" ON storage.objects
FOR UPDATE USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete product images" ON storage.objects
FOR DELETE USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');