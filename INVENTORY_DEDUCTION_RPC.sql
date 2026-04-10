-- Inventory Deduction RPC Function
-- This function decrements the stock_quantity for a product after an order is placed
-- Ensures stock never goes below 0

CREATE OR REPLACE FUNCTION decrement_stock(
  product_id_param uuid,
  quantity_param integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the product stock_quantity, ensuring it never goes below 0
  UPDATE products
  SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - quantity_param)
  WHERE id = product_id_param;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the order (inventory update is non-critical)
  RAISE WARNING 'Error decrementing stock for product %: %', product_id_param, SQLERROR_TEXT;
  RETURN FALSE;
END;
$$ ;
