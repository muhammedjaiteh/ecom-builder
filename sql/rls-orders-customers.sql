-- ============================================================================
-- SANNDIKAA · RLS RECURSION FIX — customers / orders / order_items
-- Fixes Postgres 42P17 "infinite recursion detected in policy for relation
-- customers" on every seller surface that reads orders with the embedded
-- customers(...) / order_items(...) join (lib/useOrders.ts, analytics,
-- BroadcastEngine). Founder-run, idempotent, transactional. Paste into the
-- Supabase SQL Editor and run once.
--
-- ROOT CAUSE
--   * The versioned customers policy (rls-customers-order-items.sql) assumed
--     customers.shop_id and shops.user_id. Neither column exists: checkout
--     inserts customers with only name/phone_number/location, and shops are
--     keyed by id = auth.uid(). That policy could never apply as written, so
--     the live customers policy was hand-authored in Studio (out-of-repo).
--   * That live policy resolves ownership THROUGH orders, while a live orders
--     policy resolves back THROUGH customers (buyer-side read or self-join).
--     Evaluating customers -> orders -> customers -> ... never terminates.
--
-- FIX
--   1. Drop EVERY policy on the three tables (names are unknown drift).
--   2. orders is anchored directly on shop_id = auth.uid() and references no
--      other relation, so any chain that reaches orders terminates there.
--   3. customers / order_items reach the seller with a single hop through
--      orders only. No policy references customers or order_items, so no cycle
--      is possible.
-- ============================================================================

BEGIN;

ALTER TABLE public.customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 1) Remove every existing policy on the three tables (drift included).
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('customers', 'orders', 'order_items')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    RAISE NOTICE '[sanndikaa-rls] dropped policy "%" on %.%', p.policyname, p.schemaname, p.tablename;
  END LOOP;
END $$;

-- 2) ORDERS — the anchor. Direct auth.uid() match, no subqueries.
CREATE POLICY "orders_owner_read"
  ON public.orders FOR SELECT TO authenticated
  USING (shop_id = auth.uid());

CREATE POLICY "orders_owner_update"
  ON public.orders FOR UPDATE TO authenticated
  USING (shop_id = auth.uid())
  WITH CHECK (shop_id = auth.uid());

-- Buyers place orders unauthenticated (legacy client checkout / stale PWA
-- bundles). /api/checkout writes with the service role and bypasses RLS.
CREATE POLICY "orders_public_insert"
  ON public.orders FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 3) CUSTOMERS — one hop through orders (which references nothing else).
CREATE POLICY "customers_owner_read"
  ON public.customers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.customer_id = customers.id
        AND o.shop_id = auth.uid()
    )
  );

CREATE POLICY "customers_public_insert"
  ON public.customers FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 4) ORDER_ITEMS — one hop through orders.
CREATE POLICY "order_items_owner_read"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.shop_id = auth.uid()
    )
  );

CREATE POLICY "order_items_public_insert"
  ON public.order_items FOR INSERT TO anon, authenticated
  WITH CHECK (true);

COMMIT;

-- 5) Verify: exactly 7 rows, none of the USING clauses mention customers.
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('customers', 'orders', 'order_items')
ORDER BY tablename, policyname;
