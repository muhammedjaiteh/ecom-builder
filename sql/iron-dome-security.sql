-- ═══════════════════════════════════════════════════════════════════════════
-- SANNDIKAA · IRON DOME — SECURITY & RLS HARDENING PACK (2026-09-15)
--
-- Closes the three P0 findings of the security audit. Founder-run in the
-- Supabase SQL Editor. IDEMPOTENT and RE-RUNNABLE (provisioning-pack idiom):
-- every step is existence-guarded and NOTICE-reporting; no renames, no
-- column drops, no data rewrites. A clean re-run that changes nothing proves
-- idempotence.
--
-- P0-1  INVENTORY RPCs (decrement_stock / increment_stock) were EXECUTE-able
--       by anon + authenticated: any visitor could zero or inflate ANY shop's
--       stock by product id. → EXECUTE for service_role ONLY.
--         · /api/checkout (service role) ............ unchanged
--         · /api/orders/cancel (service role) ....... NEW home of the seller's
--           Cancel & Restock (was a browser-side authenticated RPC call in
--           components/orders/OrderActions.tsx).
--
-- P0-2  orders / customers / order_items accepted INSERT from anon +
--       authenticated WITH CHECK (true): anyone could write fake orders,
--       customers and line items into any shop. → NO client role may INSERT
--       (or DELETE); the only writer is /api/checkout (service role,
--       BYPASSRLS). The seller's owner-scoped UPDATE on orders
--       (shop_id = auth.uid()) is KEPT — Mark Paid / Undo depend on it and it
--       is already owner-locked. Grant-level REVOKEs back the policies.
--
-- P0-3  reviews accepted anon INSERT and DEFAULTED is_verified to TRUE: any
--       visitor could mint "Verified Buyer" rows for any product. →
--         · no anon/public write policy of any kind (public SELECT stays);
--         · is_verified / is_external / verified_purchase DEFAULT FALSE;
--         · seller policies forbid the phone-verified marks and require
--           is_external = true OR is_verified = false (an import must never
--           read as a platform checkout);
--         · a BEFORE trigger enforces the same laws for EVERY anon /
--           authenticated write, so future policy drift cannot reopen it;
--         · device-recognised buyer reviews move to POST /api/reviews/device
--           (service role, minted UNVERIFIED — the server cannot check a
--           localStorage fact).
--
-- DEPENDS ON: sql/reviews-mvp.sql columns — ensured here defensively so the
-- pack also runs standalone. App code keeps working before this pack runs.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 · Inventory RPCs → EXECUTE for service_role ONLY
-- Signatures are discovered from pg_proc so an argument rename in
-- INVENTORY_DEDUCTION_RPC.sql cannot silently miss. CREATE OR REPLACE keeps
-- a function's ACL, but DROP + CREATE resets it to Supabase defaults (anon +
-- authenticated EXECUTE) — re-run this pack after ever recreating the RPCs.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  fn  record;
  hit int := 0;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname ~ '^(decrement_stock|increment_stock|deduct_stock|reserve_stock|release_stock|rollback_stock|adjust_stock|restock_[a-z0-9_]+)$'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
    hit := hit + 1;
    RAISE NOTICE '[iron-dome] % → EXECUTE: service_role only', fn.sig;
  END LOOP;

  IF hit = 0 THEN
    RAISE NOTICE '[iron-dome] no inventory RPC found in public — apply INVENTORY_DEDUCTION_RPC.sql, then re-run this pack.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 · orders / customers / order_items — service_role is the ONLY writer
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders', 'customers', 'order_items'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE '[iron-dome] public.% not found — skipped.', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- 2a. Every INSERT policy, and every policy addressed to anon/public, goes
    --     (named or drift). RLS on + no INSERT policy = client inserts denied;
    --     service_role bypasses RLS. Owner policies are re-ensured in 2c.
    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND (cmd = 'INSERT' OR roles && ARRAY['anon', 'public']::name[])
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      RAISE NOTICE '[iron-dome] dropped policy "%" on public.%', p.policyname, t;
    END LOOP;

    -- 2b. Grant-level backstop beneath the policies:
    --     anon → nothing; authenticated → SELECT (+ UPDATE on orders only,
    --     owner-scoped by orders_owner_update); service_role → everything.
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon', t);
    EXECUTE format('REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    IF t = 'orders' THEN
      EXECUTE 'GRANT UPDATE ON TABLE public.orders TO authenticated';
    ELSE
      EXECUTE format('REVOKE UPDATE ON TABLE public.%I FROM authenticated', t);
    END IF;

    RAISE NOTICE '[iron-dome] public.%: anon = none · authenticated = SELECT% · service_role = ALL',
      t, CASE WHEN t = 'orders' THEN ' + UPDATE (owner-scoped)' ELSE '' END;
  END LOOP;
END $$;

-- 2c. Seller-scoped reads / update stay (created only when absent — the
--     names and bodies are those of sql/rls-orders-customers.sql).
DO $$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'orders_owner_read') THEN
      EXECUTE 'CREATE POLICY "orders_owner_read" ON public.orders FOR SELECT TO authenticated USING (shop_id = auth.uid())';
      RAISE NOTICE '[iron-dome] created orders_owner_read';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'orders_owner_update') THEN
      EXECUTE 'CREATE POLICY "orders_owner_update" ON public.orders FOR UPDATE TO authenticated USING (shop_id = auth.uid()) WITH CHECK (shop_id = auth.uid())';
      RAISE NOTICE '[iron-dome] created orders_owner_update';
    END IF;

    IF to_regclass('public.customers') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'customers_owner_read') THEN
      EXECUTE $pol$CREATE POLICY "customers_owner_read" ON public.customers FOR SELECT TO authenticated
        USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_id = customers.id AND o.shop_id = auth.uid()))$pol$;
      RAISE NOTICE '[iron-dome] created customers_owner_read';
    END IF;

    IF to_regclass('public.order_items') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'order_items' AND policyname = 'order_items_owner_read') THEN
      EXECUTE $pol$CREATE POLICY "order_items_owner_read" ON public.order_items FOR SELECT TO authenticated
        USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.shop_id = auth.uid()))$pol$;
      RAISE NOTICE '[iron-dome] created order_items_owner_read';
    END IF;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 · reviews — trust marks are minted by the server only
-- ─────────────────────────────────────────────────────────────────────────────

-- 3a. Columns this pack reasons about (additive; no-ops on a live DB) and the
--     FAIL-CLOSED defaults: a row that does not say how it was verified is
--     NOT verified. Existing rows keep their values.
DO $$
BEGIN
  IF to_regclass('public.reviews') IS NULL THEN
    RAISE NOTICE '[iron-dome] public.reviews not found — run sql/reviews-mvp.sql first; reviews section skipped.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS shop_id uuid';
  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false';
  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_external boolean DEFAULT false';
  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS verified_purchase boolean DEFAULT false';
  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewer_name text';
  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewer_phone_hash text';

  EXECUTE 'ALTER TABLE public.reviews ALTER COLUMN is_verified SET DEFAULT false';
  EXECUTE 'ALTER TABLE public.reviews ALTER COLUMN is_external SET DEFAULT false';
  EXECUTE 'ALTER TABLE public.reviews ALTER COLUMN verified_purchase SET DEFAULT false';

  EXECUTE $cmt$COMMENT ON COLUMN public.reviews.is_verified IS
    'Platform-verified mark. Minted ONLY by service-role routes (POST /api/reviews after a phone→order match). Client roles may set it TRUE only together with is_external = TRUE (a seller-vouched store import, rendered "Verified Store Import" — never "Verified Buyer"). Enforced by trigger reviews_enforce_trust_marks.'$cmt$;

  EXECUTE 'ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY';
  RAISE NOTICE '[iron-dome] reviews: columns ensured · is_verified / is_external / verified_purchase DEFAULT false · RLS on.';
END $$;

-- 3b. No anon/public write of any kind. Public SELECT stays (PDP list, feed).
DO $$
DECLARE p record;
BEGIN
  IF to_regclass('public.reviews') IS NULL THEN RETURN; END IF;

  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviews'
      AND cmd <> 'SELECT'
      AND roles && ARRAY['anon', 'public']::name[]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.reviews', p.policyname);
    RAISE NOTICE '[iron-dome] dropped anon-writable reviews policy "%"', p.policyname;
  END LOOP;
  -- By name too, in case drift narrowed its role list.
  EXECUTE 'DROP POLICY IF EXISTS "reviews_public_insert" ON public.reviews';

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reviews' AND policyname = 'reviews_public_read') THEN
    EXECUTE 'CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT TO anon, authenticated USING (true)';
    RAISE NOTICE '[iron-dome] created reviews_public_read';
  END IF;

  EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.reviews FROM PUBLIC, anon';
  EXECUTE 'GRANT SELECT ON TABLE public.reviews TO anon';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE public.reviews TO authenticated';
  EXECUTE 'GRANT ALL ON TABLE public.reviews TO service_role';
  RAISE NOTICE '[iron-dome] reviews grants: anon = SELECT · authenticated = SELECT/INSERT/UPDATE (policy-scoped) · service_role = ALL';
END $$;

-- 3c. Seller policies (own shop / own product). INSERT forbids the
--     phone-verified marks and applies the import law
--     (is_external = true OR is_verified = false). UPDATE is ownership-only
--     here — promotion of trust marks needs OLD, which the trigger in 3d sees.
DO $$
BEGIN
  IF to_regclass('public.reviews') IS NULL THEN RETURN; END IF;

  EXECUTE 'DROP POLICY IF EXISTS "reviews_seller_insert" ON public.reviews';
  EXECUTE $pol$
    CREATE POLICY "reviews_seller_insert"
      ON public.reviews FOR INSERT TO authenticated
      WITH CHECK (
        (
          shop_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = reviews.product_id
              AND (p.user_id = auth.uid() OR p.shop_id = auth.uid())
          )
        )
        AND rating BETWEEN 1 AND 5
        AND length(btrim(comment)) BETWEEN 1 AND 2000
        AND COALESCE(length(reviewer_name), 0) <= 80
        AND verified_purchase IS NOT TRUE
        AND reviewer_phone_hash IS NULL
        AND (is_external IS TRUE OR is_verified IS NOT TRUE)
      )$pol$;

  EXECUTE 'DROP POLICY IF EXISTS "reviews_seller_update" ON public.reviews';
  EXECUTE $pol$
    CREATE POLICY "reviews_seller_update"
      ON public.reviews FOR UPDATE TO authenticated
      USING (
        shop_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = reviews.product_id
            AND (p.user_id = auth.uid() OR p.shop_id = auth.uid())
        )
      )
      WITH CHECK (
        shop_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = reviews.product_id
            AND (p.user_id = auth.uid() OR p.shop_id = auth.uid())
        )
      )$pol$;

  RAISE NOTICE '[iron-dome] reviews policies: reviews_public_read (SELECT) · reviews_seller_insert · reviews_seller_update — no public write.';
END $$;

-- 3d. Trust-mark trigger: the law above, enforced for EVERY anon/authenticated
--     write regardless of policy drift. service_role (our API routes),
--     postgres and the SQL Editor pass untouched.
CREATE OR REPLACE FUNCTION public.reviews_enforce_trust_marks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  -- Phone-verified marks are minted by POST /api/reviews only. A client may
  -- carry an existing mark forward on UPDATE but never create or change it.
  IF NEW.verified_purchase IS TRUE
     AND (TG_OP = 'INSERT' OR OLD.verified_purchase IS NOT TRUE) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'reviews.verified_purchase is minted by the server (POST /api/reviews) only.';
  END IF;

  IF NEW.reviewer_phone_hash IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.reviewer_phone_hash IS DISTINCT FROM OLD.reviewer_phone_hash) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'reviews.reviewer_phone_hash is minted by the server only.';
  END IF;

  -- "Verified" WITHOUT "external" is the platform-checkout claim.
  IF NEW.is_verified IS TRUE AND NEW.is_external IS NOT TRUE
     AND (TG_OP = 'INSERT' OR NOT (OLD.is_verified IS TRUE AND OLD.is_external IS NOT TRUE)) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'A client-written review cannot claim a verified platform checkout: set is_external = true (store import) or is_verified = false.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reviews_enforce_trust_marks() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.reviews') IS NULL THEN RETURN; END IF;
  EXECUTE 'DROP TRIGGER IF EXISTS reviews_enforce_trust_marks ON public.reviews';
  EXECUTE 'CREATE TRIGGER reviews_enforce_trust_marks
             BEFORE INSERT OR UPDATE ON public.reviews
             FOR EACH ROW EXECUTE FUNCTION public.reviews_enforce_trust_marks()';
  RAISE NOTICE '[iron-dome] trigger reviews_enforce_trust_marks installed (BEFORE INSERT OR UPDATE).';
END $$;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY
--   1) Inventory RPC ACLs — expect ONLY the owner and service_role in proacl.
--   2) Policies — orders / customers / order_items: NO cmd = INSERT rows and no
--      anon roles; reviews: reviews_public_read (SELECT), reviews_seller_insert,
--      reviews_seller_update only.
--   3) The trust-mark trigger is present and enabled ('O').
-- ─────────────────────────────────────────────────────────────────────────────
SELECT p.oid::regprocedure AS fn, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('decrement_stock', 'increment_stock');

SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'customers', 'order_items', 'reviews')
ORDER BY tablename, policyname;

SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = to_regclass('public.reviews') AND NOT tgisinternal;
