-- ============================================================
-- RLS PATCH: customers + order_items + shops (public read)
-- Run this in the Supabase SQL editor.
-- Without these policies, any browser holding the anon key
-- can SELECT * on customers/order_items and read all PII;
-- and shop pages return 0 rows if no SELECT policy exists.
-- ============================================================

-- CUSTOMERS --------------------------------------------------
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Shop owner can read their own customers
CREATE POLICY "shop_owner_reads_customers" ON customers
  FOR SELECT USING (
    shop_id IN (
      SELECT id FROM shops WHERE user_id = auth.uid()
    )
  );

-- Public insert so checkout flow (unauthenticated buyers) can
-- create a customer row; no SELECT/UPDATE/DELETE for anon.
CREATE POLICY "public_insert_customers" ON customers
  FOR INSERT WITH CHECK (true);

-- ORDER ITEMS ------------------------------------------------
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Shop owner can read items belonging to their orders
CREATE POLICY "shop_owner_reads_order_items" ON order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders
      WHERE shop_id IN (
        SELECT id FROM shops WHERE user_id = auth.uid()
      )
    )
  );

-- Public insert so the cart checkout flow can write items
CREATE POLICY "public_insert_order_items" ON order_items
  FOR INSERT WITH CHECK (true);

-- SHOPS (public read) ----------------------------------------
-- Shop profile pages (/shop/[slug]) are publicly visible.
-- Without this policy, RLS blocks the anon key from reading
-- any shop rows and the page returns PGRST116 / 0 rows.
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_reads_active_shops" ON shops
  FOR SELECT USING (true);

-- Only the authenticated shop owner can update their own row
CREATE POLICY "shop_owner_updates_own_shop" ON shops
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
