-- ═══════════════════════════════════════════════════════════════════════════
-- SANNDIKAA COMPARE-AT PRICING PACK — products.compare_at_price
--
-- Run this in the Supabase SQL Editor. IDEMPOTENT and RE-RUNNABLE
-- (provisioning-pack style): every step is existence-guarded and reports
-- via NOTICE. Re-running is always safe.
--
-- WHAT IT ADDS (additive only — no renames, no drops, no data rewrites):
--   products.compare_at_price   nullable "was" price for a targeted sale.
--                               NULL = no sale (the default for every row).
--                               Type MIRRORS the live products.price column
--                               (numeric / double precision / …) so
--                               PostgREST serialises both identically.
--   CHECK products_compare_at_price_nonnegative — never below zero.
--
-- RENDER RULE (lib/pricing.ts saleOf): the mall + boutique surfaces show a
-- strikethrough, a Sale badge, and "Save N%" ONLY when
-- compare_at_price > price. products.price remains the ONLY charged price
-- (cart, checkout, WhatsApp order flows never read compare_at_price).
--
-- APP SAFETY: every read path degrades gracefully until this runs
-- (lib/productColumns.ts retries without the column on 42703), so deploy
-- order does not matter. Sellers set the value on /dashboard/edit/[id].
-- ═══════════════════════════════════════════════════════════════════════════

begin;

DO $$
DECLARE
  v_price_type text;
BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RAISE NOTICE '[sanndikaa-compare-at] public.products not found — nothing to do.';
    RETURN;
  END IF;

  -- Mirror the live price column's type (precision/scale preserved when set).
  SELECT CASE
           WHEN data_type = 'numeric' AND numeric_precision IS NOT NULL
             THEN format('numeric(%s,%s)', numeric_precision, COALESCE(numeric_scale, 0))
           ELSE data_type
         END
    INTO v_price_type
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'price';
  v_price_type := COALESCE(v_price_type, 'numeric');

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'compare_at_price'
  ) THEN
    RAISE NOTICE '[sanndikaa-compare-at] products.compare_at_price already present — column step skipped.';
  ELSE
    EXECUTE format('ALTER TABLE public.products ADD COLUMN compare_at_price %s', v_price_type);
    RAISE NOTICE '[sanndikaa-compare-at] products.compare_at_price added (type %).', v_price_type;
  END IF;

  EXECUTE $cmt$COMMENT ON COLUMN public.products.compare_at_price IS
    'Optional "was" price for a targeted sale. NULL = no sale. Mall + boutique surfaces render strikethrough/Sale/Save N% ONLY when compare_at_price > price (lib/pricing.ts saleOf). The charged price is ALWAYS products.price.'$cmt$;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.products'::regclass AND conname = 'products_compare_at_price_nonnegative'
  ) THEN
    RAISE NOTICE '[sanndikaa-compare-at] CHECK products_compare_at_price_nonnegative already present.';
  ELSE
    -- The new column is all-NULL, so validating existing rows is instant.
    EXECUTE 'ALTER TABLE public.products
               ADD CONSTRAINT products_compare_at_price_nonnegative
               CHECK (compare_at_price IS NULL OR compare_at_price >= 0)';
    RAISE NOTICE '[sanndikaa-compare-at] CHECK products_compare_at_price_nonnegative added.';
  END IF;
END;
$$;

-- PostgREST schema cache: Supabase reloads on DDL, but this makes the column
-- selectable the instant the transaction commits (no stale-cache window).
NOTIFY pgrst, 'reload schema';

commit;
