-- ═══════════════════════════════════════════════════════════════════════════
-- SANNDIKAA REVIEWS LAUNCH PACK — verified-purchase review columns, buyer_id
-- NULL-ability, the phone-hash dedupe index, the product feed index, and the
-- versioned public-read policy.
--
-- Run this in the Supabase SQL Editor BEFORE deploying the frictionless
-- review release (app/api/reviews + app/api/reviews/media). The reviews
-- table itself is OUT-OF-REPO (it exists live with its own RLS); this pack
-- is strictly ADDITIVE and follows the provisioning-pack idiom
-- (sql/provisioning.sql): every statement is guarded (IF NOT EXISTS /
-- DO-block existence + name checks), NOTICEs report every action, and
-- re-running is always safe — a clean re-run that changes nothing proves
-- idempotence.
--
-- PEPPER NOTE (founder runbook): reviewer_phone_hash is
-- HMAC-SHA256(canonical 7-digit phone key) with pepper
-- REVIEW_PHONE_PEPPER ?? SUPABASE_SERVICE_ROLE_KEY (app-side, never in SQL).
-- Setting the optional REVIEW_PHONE_PEPPER env decouples review dedupe from
-- service-key rotation. ROTATING EITHER SECRET RESETS DEDUPE: old hashes
-- can no longer match new submissions, so every buyer becomes able to post
-- one fresh review per product. Existing reviews are untouched either way.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 · Verified-purchase columns
--   verified_purchase   — true only when the service-role route matched the
--                         buyer's phone to a non-cancelled order (the app
--                         never trusts a client-sent flag).
--   reviewer_name       — the buyer's display name ("{name} · Verified
--                         Purchase" in ReviewList).
--   reviewer_phone_hash — HMAC-SHA256 of the canonical phone key. The RAW
--                         phone is never stored anywhere in this pipeline.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.reviews') IS NULL THEN
    RAISE NOTICE '[sanndikaa-reviews] reviews table not found — nothing to migrate. Create it first, then re-run.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS verified_purchase boolean DEFAULT false';
  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewer_name text';
  EXECUTE 'ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewer_phone_hash text';

  EXECUTE $cmt$COMMENT ON COLUMN public.reviews.verified_purchase IS
    'True only for reviews inserted by POST /api/reviews after a server-side phone-to-order match. Never client-writable (no INSERT/UPDATE policy grants it).'$cmt$;
  EXECUTE $cmt$COMMENT ON COLUMN public.reviews.reviewer_name IS
    'Buyer display name for phone-verified reviews (buyer_id is NULL for these rows).'$cmt$;
  EXECUTE $cmt$COMMENT ON COLUMN public.reviews.reviewer_phone_hash IS
    'HMAC-SHA256(canonical phone key) — pepper: REVIEW_PHONE_PEPPER ?? service key. Raw phone never stored. Rotating the pepper/key resets dedupe (see file header).'$cmt$;

  RAISE NOTICE '[sanndikaa-reviews] Verified-purchase columns ensured (verified_purchase, reviewer_name, reviewer_phone_hash).';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 · buyer_id DROP NOT NULL (only if currently NOT NULL)
-- Phone-verified buyers have no auth account, so their rows carry
-- buyer_id = NULL. The service role bypasses RLS but NOT a NOT NULL
-- constraint — this is the guard that makes the insert possible.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.reviews') IS NULL THEN
    RAISE NOTICE '[sanndikaa-reviews] reviews table not found — skipping buyer_id nullability.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviews'
      AND column_name = 'buyer_id' AND is_nullable = 'NO'
  ) THEN
    EXECUTE 'ALTER TABLE public.reviews ALTER COLUMN buyer_id DROP NOT NULL';
    RAISE NOTICE '[sanndikaa-reviews] reviews.buyer_id NOT NULL dropped — phone-verified rows may now carry NULL.';
  ELSE
    RAISE NOTICE '[sanndikaa-reviews] reviews.buyer_id already nullable — nothing to do.';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 · Indexes
--   3a. PARTIAL UNIQUE (product_id, reviewer_phone_hash) — THE dedupe rule:
--       one verified review per phone per product. Partial (hash NOT NULL)
--       so legacy/dashboard rows (hash-less) never collide. The API maps the
--       23505 violation to an honest 409 "already reviewed".
--   3b. reviews_product_id_idx — the PDP list and the feed-ranking read both
--       filter on product_id.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.reviews') IS NULL THEN
    RAISE NOTICE '[sanndikaa-reviews] reviews table not found — skipping indexes.';
    RETURN;
  END IF;

  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS reviews_product_reviewer_phone_key
             ON public.reviews (product_id, reviewer_phone_hash)
             WHERE reviewer_phone_hash IS NOT NULL';
  EXECUTE 'CREATE INDEX IF NOT EXISTS reviews_product_id_idx
             ON public.reviews (product_id)';

  RAISE NOTICE '[sanndikaa-reviews] Indexes ensured (reviews_product_reviewer_phone_key partial-unique, reviews_product_id_idx).';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4 · Versioned public-read policy (name-checked)
-- The anon SELECT the PDP ReviewList and the homepage feed ranking depend on
-- is live-proven but OUT-OF-REPO — this section versions it under our name.
-- DELIBERATELY NO "ENABLE ROW LEVEL SECURITY" here: the live table's RLS
-- state (and its INSERT policies for the dashboard seller-mode path) is
-- out-of-repo, and force-enabling RLS with only a SELECT policy would sever
-- the dashboard's authenticated INSERT. If RLS is off, this policy is inert;
-- if RLS is on, it guarantees the read the app relies on.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.reviews') IS NULL THEN
    RAISE NOTICE '[sanndikaa-reviews] reviews table not found — skipping read policy.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviews'
      AND policyname = 'reviews_public_read'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "reviews_public_read"
      ON public.reviews
      FOR SELECT
      TO anon, authenticated
      USING (true)
    $pol$;
    RAISE NOTICE '[sanndikaa-reviews] Created policy reviews_public_read (anon+authenticated SELECT).';
  ELSE
    RAISE NOTICE '[sanndikaa-reviews] Policy reviews_public_read already exists — nothing to do.';
  END IF;
END;
$$;

commit;
