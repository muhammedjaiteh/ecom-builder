-- ═══════════════════════════════════════════════════════════════════════════
-- SANNDIKAA CLOSED-LOOP WHATSAPP ANALYTICS PACK — order-status vocabulary,
-- historical total_amount backfill, and the dashboard read-path index.
--
-- Run this in the Supabase SQL Editor. The entire pack is IDEMPOTENT and
-- RE-RUNNABLE (provisioning-pack style: every statement is guarded by
-- to_regclass / information_schema / pg_constraint existence checks, and
-- every action is reported via NOTICE). Re-running is always safe.
--
-- ── STATUS VOCABULARY (zero-migration — no renames, ever) ───────────────────
--   'pending'   → order recorded, buyer handed to WhatsApp, payment unproven.
--                 Written by components/Cart.tsx at checkout. UNCHANGED.
--   'completed' → THE TERMINAL PAID STATE. Existing rows and both dashboard
--                 flows already mean "paid" by it (the seller's Mark-Paid
--                 button has always written 'completed'); the UI labels it
--                 'Paid'. No data migration needed or performed.
--   'cancelled' → THE TERMINAL FLAKE STATE (new). Written ONLY by the
--                 seller's Cancel & Restock flow, guarded app-side with
--                 UPDATE … WHERE status='pending' so a raced order can never
--                 be cancelled twice (and stock never re-credited twice).
--   Legacy 'new' / 'processing' / 'shipped' rows (pre-rebuild checkout)
--   remain valid and renderable; nothing here touches them.
--
-- ── COLUMN EVIDENCE (why there is NO "ADD COLUMN total_amount" here) ────────
--   orders.total_amount is PRESENT in the live schema by code evidence:
--   components/Cart.tsx inserts it on every order (total_amount:
--   shopData.total), and app/dashboard/page.tsx, app/dashboard/orders/
--   page.tsx, app/dashboard/analytics/page.tsx and app/dashboard/broadcast.tsx
--   all select and render it today. Adding it again would only mask drift —
--   Section 2 instead NOTICEs loudly if the column has vanished.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 · Extend any orders.status CHECK constraint to allow 'cancelled'.
--
-- The live column type is inspected via information_schema.columns and the
-- constraint set via pg_constraint (the only catalog that exposes the full
-- CHECK expression). Three outcomes, each NOTICEd:
--   a) a status CHECK exists and already allows 'cancelled'  → no-op.
--   b) a status CHECK exists without 'cancelled'             → the original
--      expression is preserved verbatim and OR-extended:
--        CHECK ((<original expression>) OR status = 'cancelled')
--      under the SAME constraint name — semantics widen, never narrow.
--   c) no status CHECK exists (plain text column)             → nothing to
--      alter; the vocabulary above is documentation-enforced.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  c record;
  v_expr text;
  v_found boolean := false;
BEGIN
  IF to_regclass('public.orders') IS NULL THEN
    RAISE NOTICE '[sanndikaa-analytics] public.orders not found — skipping status-constraint check.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'status'
  ) THEN
    RAISE NOTICE '[sanndikaa-analytics] orders.status column not found — the live schema has drifted from the app (Cart.tsx writes status on every order). Investigate before proceeding.';
    RETURN;
  END IF;

  FOR c IN
    SELECT con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    WHERE con.conrelid = 'public.orders'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    v_found := true;

    IF c.def ILIKE '%cancelled%' THEN
      RAISE NOTICE '[sanndikaa-analytics] Constraint % already allows ''cancelled'' — nothing to do.', c.conname;
      CONTINUE;
    END IF;

    -- Strip the outer CHECK ( … ) wrapper; keep the inner expression intact.
    v_expr := regexp_replace(c.def, '^CHECK\s*\((.*)\)$', '\1');

    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', c.conname);
    EXECUTE format(
      'ALTER TABLE public.orders ADD CONSTRAINT %I CHECK ((%s) OR status = %L)',
      c.conname, v_expr, 'cancelled'
    );
    RAISE NOTICE '[sanndikaa-analytics] Extended constraint % to allow ''cancelled'' (original expression preserved).', c.conname;
  END LOOP;

  IF NOT v_found THEN
    RAISE NOTICE '[sanndikaa-analytics] No CHECK constraint mentions orders.status — plain text column; the vocabulary is documentation-enforced (see file header). Nothing altered.';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 · Backfill historical orders.total_amount from order_items.
--
-- The current checkout (components/Cart.tsx) has always written total_amount
-- alongside the order row, but legacy rows (the pre-rebuild 'new' checkout)
-- can carry NULL. The heal: SUM(quantity × price_at_time) per order — the
-- exact figures the buyer saw at checkout, frozen in order_items — applied
-- ONLY where total_amount IS NULL, so a re-run heals zero rows and a live
-- value is never overwritten. Orders with no order_items rows stay NULL by
-- design (there is no honest number to invent for them); the dashboards
-- carry the same computed fallback client-side and render them truthfully.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_healed integer := 0;
BEGIN
  IF to_regclass('public.orders') IS NULL OR to_regclass('public.order_items') IS NULL THEN
    RAISE NOTICE '[sanndikaa-analytics] orders/order_items not found — skipping total_amount backfill.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_amount'
  ) THEN
    RAISE NOTICE '[sanndikaa-analytics] orders.total_amount column not found — LIVE-SCHEMA DRIFT: Cart.tsx inserts this column on every checkout, so its absence means checkout is already failing. Fix the schema first; this pack intentionally does not re-mint app-owned columns.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'price_at_time'
  ) THEN
    RAISE NOTICE '[sanndikaa-analytics] order_items.price_at_time column not found — cannot compute historical totals. Skipping backfill.';
    RETURN;
  END IF;

  UPDATE public.orders o
  SET total_amount = agg.computed_total
  FROM (
    SELECT oi.order_id, SUM(oi.quantity * oi.price_at_time) AS computed_total
    FROM public.order_items oi
    WHERE oi.quantity IS NOT NULL
      AND oi.price_at_time IS NOT NULL
    GROUP BY oi.order_id
  ) agg
  WHERE o.id = agg.order_id
    AND o.total_amount IS NULL;

  GET DIAGNOSTICS v_healed = ROW_COUNT;
  RAISE NOTICE '[sanndikaa-analytics] total_amount backfill: % historical order(s) healed from order_items (qty x price_at_time).', v_healed;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 · Dashboard read-path index.
-- Every seller surface reads WHERE shop_id = auth.uid() ORDER BY created_at
-- DESC (command center, /dashboard/orders, /dashboard/analytics, broadcast).
-- One composite index serves them all; IF NOT EXISTS keeps re-runs safe.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.orders') IS NULL THEN
    RAISE NOTICE '[sanndikaa-analytics] public.orders not found — skipping index.';
    RETURN;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_orders_shop_created
    ON public.orders (shop_id, created_at DESC);

  RAISE NOTICE '[sanndikaa-analytics] idx_orders_shop_created ensured (shop_id, created_at DESC).';
END;
$$;

commit;
