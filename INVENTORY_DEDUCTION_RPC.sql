-- Inventory RPCs — atomic, honest stock movements for checkout.
-- Re-run this file in the Supabase SQL editor to replace the legacy version.
--
-- WHY THE REWRITE (three defects in the previous decrement_stock):
--   1. Silent clamp: GREATEST(0, stock - qty) let an oversold order zero the
--      stock and still RETURN TRUE — checkout could never surface an honest
--      "stock changed" failure. Now the UPDATE only fires when the remaining
--      stock covers the full quantity; otherwise it returns FALSE and the
--      checkout aborts BEFORE any order rows are written.
--   2. NULL poisoning: COALESCE(stock_quantity, 0) - qty turned untracked
--      inventory (NULL = seller does not track stock) into 0 — every product
--      without a stock figure went "Sold Out" after its first order. NULL now
--      passes through untouched and the order proceeds.
--   3. Broken handler: the EXCEPTION block referenced SQLERROR_TEXT, which is
--      not a PL/pgSQL identifier (the real one is SQLERRM) — the "safe"
--      logging path itself raised. Removed: a single guarded UPDATE has no
--      failure mode worth swallowing, and real errors should surface.
--
-- ATOMICITY: one conditional UPDATE. Postgres row-locks the product row for
-- the statement, so two concurrent checkouts can never both deduct the last
-- unit — the second UPDATE re-evaluates the WHERE clause after the lock is
-- released and returns FALSE.

CREATE OR REPLACE FUNCTION decrement_stock(
  product_id_param uuid,
  quantity_param integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF quantity_param IS NULL OR quantity_param <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE products
  SET stock_quantity = CASE
    WHEN stock_quantity IS NULL THEN NULL              -- untracked: no-op
    ELSE stock_quantity - quantity_param               -- tracked: full deduct
  END
  WHERE id = product_id_param
    AND (stock_quantity IS NULL OR stock_quantity >= quantity_param);

  -- TRUE  → deducted (or untracked-inventory no-op)
  -- FALSE → product missing OR insufficient stock — checkout must abort
  RETURN FOUND;
END;
$$;

-- Compensation partner: re-credits units when a checkout fails AFTER stock was
-- reserved (a later cart line rejected, or the order-row inserts failed).
-- Untracked (NULL) stock stays NULL — symmetric with decrement_stock.
CREATE OR REPLACE FUNCTION increment_stock(
  product_id_param uuid,
  quantity_param integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF quantity_param IS NULL OR quantity_param <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE products
  SET stock_quantity = CASE
    WHEN stock_quantity IS NULL THEN NULL
    ELSE stock_quantity + quantity_param
  END
  WHERE id = product_id_param;

  RETURN FOUND;
END;
$$;
