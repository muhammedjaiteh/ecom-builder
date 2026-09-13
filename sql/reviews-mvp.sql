-- ═══════════════════════════════════════════════════════════════════════════
-- SANNDIKAA REVIEWS MVP PACK — device-recognised buyer reviews + seller
-- legacy import (reviews.shop_id, reviews.is_verified, RLS policy set).
--
-- Run in the Supabase SQL Editor. IDEMPOTENT and RE-RUNNABLE
-- (provisioning-pack idiom): every step is existence-guarded, reports via
-- NOTICE, and is strictly ADDITIVE — no renames, no drops of columns/data.
--
-- CONVERGES BOTH WORLDS:
--   • Fresh DB  → CREATE TABLE IF NOT EXISTS with the full column set.
--   • Live DB   → ADD COLUMN IF NOT EXISTS for shop_id / is_verified (and
--                 the reviews-launch columns, harmless if already present).
--
-- ACCESS MODEL (RLS enabled here — every app path is covered):
--   reviews_public_read     anon+authenticated SELECT (PDP list, feed ranking)
--   reviews_public_insert   anon+authenticated INSERT of a plain buyer review
--                           (device-recognised PDP form). Cannot forge the
--                           phone-verified badge or touch the dedupe hash.
--   reviews_seller_insert   authenticated INSERT for the seller's own shop /
--                           products (dashboard "Add Past Review").
--   reviews_seller_update   authenticated UPDATE, same ownership rule.
--   POST /api/reviews (service role) bypasses RLS — unchanged.
--
-- OWNERSHIP RULE: shops.id == the owner's auth.uid() (see
-- RLS_PRODUCTS_ORDERS_SHOPS.sql — `shop_id = auth.uid()`), so
-- reviews.shop_id = auth.uid() is the seller test; the products join covers
-- rows written without shop_id (legacy dashboard path, dual-column products).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 · Table (fresh DB) + additive columns (live DB)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id             uuid,
  buyer_id            uuid,
  rating              integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment             text NOT NULL,
  reviewer_name       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  is_verified         boolean NOT NULL DEFAULT true,
  -- reviews-launch / media columns the app already reads:
  is_external         boolean DEFAULT false,
  external_author     text,
  media_urls          text[] DEFAULT '{}',
  verified_purchase   boolean DEFAULT false,
  reviewer_phone_hash text
);

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS shop_id uuid';
  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT true';
  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewer_name text';
  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_external boolean DEFAULT false';
  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS external_author text';
  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS media_urls text[] DEFAULT ''{}''';
  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS verified_purchase boolean DEFAULT false';
  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewer_phone_hash text';

  -- Seller legacy imports and device-recognised buyers have no auth account.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviews'
      AND column_name = 'buyer_id' AND is_nullable = 'NO'
  ) THEN
    EXECUTE 'ALTER TABLE public.reviews ALTER COLUMN buyer_id DROP NOT NULL';
    RAISE NOTICE '[sanndikaa-reviews-mvp] reviews.buyer_id NOT NULL dropped.';
  END IF;

  EXECUTE $cmt$COMMENT ON COLUMN public.reviews.shop_id IS
    'Owning shop (shops.id == owner auth.uid()). Set by the device-recognised PDP form and the dashboard legacy import; NULL on older rows.'$cmt$;
  EXECUTE $cmt$COMMENT ON COLUMN public.reviews.is_verified IS
    'Shown as a "Verified" mark on the PDP. TRUE by default: device-recognised buyers and seller-imported legacy feedback are both treated as verified.'$cmt$;

  EXECUTE 'CREATE INDEX IF NOT EXISTS reviews_product_id_idx ON public.reviews (product_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS reviews_shop_id_idx ON public.reviews (shop_id)';

  RAISE NOTICE '[sanndikaa-reviews-mvp] Columns + indexes ensured (shop_id, is_verified, reviewer_name, launch/media columns).';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 · Average-rating RPC the PDP header reads (fresh-DB safety net)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_average_rating(p_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0) FROM public.reviews WHERE product_id = p_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_average_rating(uuid) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 · RLS + policies (DROP IF EXISTS + CREATE — safe to re-run)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_public_read" ON public.reviews;
CREATE POLICY "reviews_public_read"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (true);

-- Public INSERT: a plain buyer review. The phone-verified badge and the
-- dedupe hash are service-role-only (POST /api/reviews) — never client-writable.
DROP POLICY IF EXISTS "reviews_public_insert" ON public.reviews;
CREATE POLICY "reviews_public_insert"
  ON public.reviews FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    rating BETWEEN 1 AND 5
    AND length(btrim(comment)) BETWEEN 1 AND 2000
    AND COALESCE(length(reviewer_name), 0) <= 80
    AND verified_purchase IS NOT TRUE
    AND reviewer_phone_hash IS NULL
  );

-- Seller INSERT/UPDATE: own shop (shops.id == auth.uid()) or own product.
DROP POLICY IF EXISTS "reviews_seller_insert" ON public.reviews;
CREATE POLICY "reviews_seller_insert"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = reviews.product_id
        AND (p.user_id = auth.uid() OR p.shop_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "reviews_seller_update" ON public.reviews;
CREATE POLICY "reviews_seller_update"
  ON public.reviews FOR UPDATE
  TO authenticated
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
  );

DO $$ BEGIN
  RAISE NOTICE '[sanndikaa-reviews-mvp] RLS enabled; policies reviews_public_read / reviews_public_insert / reviews_seller_insert / reviews_seller_update in place.';
END $$;

commit;
