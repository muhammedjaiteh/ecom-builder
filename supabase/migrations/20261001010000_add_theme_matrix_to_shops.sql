-- ─────────────────────────────────────────────────────────────────────────────
-- SANNDIKAA STOREFRONT MATRIX SELECTOR — shops.theme_matrix
--
-- Which storefront MATRIX a seller's public boutique renders through:
--
--   classic      the /shop/[slug] ClassicShopPage (theme_color + store_layout
--                still style it exactly as before) — the historical default
--   banjul-noir  the data-blind BanjulNoirStorefront luxury dark matrix
--                (components/generator/matrix) served by the /s/[slug] adapter
--
-- The merchant picks it in Dashboard → Online Store → Themes → "Storefront
-- Matrix"; lib/themeMatrix.ts is the single source of truth for the id list.
--
-- Additive and idempotent: ADD COLUMN IF NOT EXISTS, constraint guarded by a
-- catalog lookup, so re-running the file (or the founder pasting it into the
-- Supabase SQL editor after a CLI apply) is a no-op. NOT NULL DEFAULT 'classic'
-- backfills every existing row in the same statement — no seller's boutique
-- changes appearance when this ships.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS theme_matrix varchar(32) NOT NULL DEFAULT 'classic';

-- Closed vocabulary: a typo'd matrix id must fail at write time, never render
-- as a blank storefront. Extend the list here AND in lib/themeMatrix.ts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shops_theme_matrix_check'
      AND conrelid = 'public.shops'::regclass
  ) THEN
    ALTER TABLE public.shops
      ADD CONSTRAINT shops_theme_matrix_check
      CHECK (theme_matrix IN ('classic', 'banjul-noir'));
    RAISE NOTICE 'shops_theme_matrix_check added';
  ELSE
    RAISE NOTICE 'shops_theme_matrix_check already present — skipped';
  END IF;
END $$;

COMMENT ON COLUMN public.shops.theme_matrix IS
  'Storefront matrix id — ''classic'' (/shop ClassicShopPage) or ''banjul-noir'' (BanjulNoirStorefront via /s/[slug]). Source of truth: lib/themeMatrix.ts.';
