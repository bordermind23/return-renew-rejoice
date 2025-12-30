-- Create function to auto-add products from orders
CREATE OR REPLACE FUNCTION public.sync_product_from_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only process if product_sku is not null and not empty
  IF NEW.product_sku IS NOT NULL AND NEW.product_sku != '' THEN
    -- Check if product already exists
    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = NEW.product_sku) THEN
      -- Insert new product
      INSERT INTO products (sku, name, category)
      VALUES (
        NEW.product_sku,
        COALESCE(NEW.product_name, NEW.product_sku),
        NULL
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
CREATE TRIGGER sync_product_on_order_insert
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION sync_product_from_order();

-- Also sync existing orders' products that are not in products table
INSERT INTO products (sku, name)
SELECT DISTINCT product_sku, COALESCE(product_name, product_sku)
FROM orders
WHERE product_sku IS NOT NULL 
  AND product_sku != ''
  AND product_sku NOT IN (SELECT sku FROM products);