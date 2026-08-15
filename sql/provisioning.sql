-- ═══════════════════════════════════════════════════════════════════════════
-- SANNDIKAA PROVISIONING PACK — signup trigger, slug canonicalization, audit
-- table, shop_websites read policies, orphan backfill, and shops realtime
-- publication enrollment (vault-door instant unlock).
--
-- Run this in the Supabase SQL Editor. The entire pack is IDEMPOTENT and
-- RE-RUNNABLE: every statement is guarded (CREATE OR REPLACE / IF NOT EXISTS /
-- DO-block existence checks). Re-running is always safe.
--
-- CRITICAL SAFETY DESIGN: the auth.users trigger swallows ALL errors with a
-- WARNING and returns NEW — a provisioning failure can never abort a signup.
-- If the shops row fails to mint, the app-side heal API
-- (POST /api/shops/ensure) repairs it on the next dashboard visit.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 · shops.requested_plan
-- The plan the seller chose on /pricing (starter | pro | advanced | flagship).
-- Previously this intent lived ONLY in the buyer's browser localStorage
-- ('sanndikaa_plan') — invisible to the admin activation workflow. The
-- register page now writes it into auth signUp metadata; the trigger, heal
-- API, and backfill all persist it here.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS requested_plan text;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 · Canonical slugifier — EXACT SQL mirror of lib/slugify.ts
-- (Law 2: safe URL slugs, lowercase + hyphenated, never empty).
--
--   lib/slugify.ts slugify():            lower → regexp [^a-z0-9]+ → '-' →
--                                        trim leading/trailing hyphens
--   lib/slugify.ts slugifyWithFallback(): empty result falls back to
--                                        'shop-' + first 8 chars of the
--                                        hyphen-stripped id ('boutique' if
--                                        even that is empty — unreachable for
--                                        a uuid, mirrored for strict parity)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.slugify_shop_name(p_value text, p_fallback_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      btrim(regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', '-', 'g'), '-'),
      ''
    ),
    'shop-' || coalesce(
      nullif(left(replace(lower(p_fallback_id::text), '-', ''), 8), ''),
      'boutique'
    )
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 · Shared provisioning core — used by BOTH the signup trigger and
-- the backfill so their behavior can never drift apart.
--
-- Metadata extraction (matches app/register/page.tsx signUp options.data):
--   shop_name         → shops.shop_name  (fallback: email local-part → 'My Boutique')
--   phone_number      → shops.phone
--   subscription_tier → shops.subscription_tier (coalesced to 'pending')
--   requested_plan    → shops.requested_plan
--   status            → 'active' (matches historical trigger-minted rows; the
--                       dashboard vault door gates on subscription_tier, not status)
--
-- Collision handling mirrors lib/slugify.ts repairShopSlug: on a taken slug,
-- append '-' + first 6 chars of the hyphen-stripped id (deterministic, no
-- randomness). Returns true when a row was actually inserted.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.provision_shop_row(p_user_id uuid, p_email text, p_meta jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_slug text;
  v_rows integer := 0;
BEGIN
  v_name := nullif(btrim(coalesce(p_meta->>'shop_name', '')), '');
  IF v_name IS NULL THEN
    v_name := coalesce(nullif(split_part(coalesce(p_email, ''), '@', 1), ''), 'My Boutique');
  END IF;

  v_slug := public.slugify_shop_name(v_name, p_user_id);
  IF EXISTS (SELECT 1 FROM public.shops WHERE shop_slug = v_slug AND id <> p_user_id) THEN
    v_slug := v_slug || '-' || left(replace(lower(p_user_id::text), '-', ''), 6);
  END IF;

  INSERT INTO public.shops (id, shop_name, shop_slug, phone, subscription_tier, requested_plan, status)
  VALUES (
    p_user_id,
    v_name,
    v_slug,
    nullif(btrim(coalesce(p_meta->>'phone_number', '')), ''),
    coalesce(nullif(btrim(coalesce(p_meta->>'subscription_tier', '')), ''), 'pending'),
    nullif(btrim(coalesce(p_meta->>'requested_plan', '')), ''),
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4 · Signup trigger — REPLACES the historical out-of-repo trigger
-- that minted un-slugified shop_slug values.
--
-- 4a. Drop every pre-existing user-defined INSERT trigger on auth.users
--     (except ours). This is the "replace" step: leaving the legacy trigger
--     alive alongside ours risks a unique-violation race that would abort
--     signups. Internal (FK/constraint) triggers are untouched. Each drop is
--     reported via NOTICE so you can see exactly what was removed.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND NOT tgisinternal
      AND (tgtype::int & 4) <> 0  -- fires on INSERT
      AND tgname <> 'on_auth_user_created_provision_shop'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', t.tgname);
    RAISE NOTICE '[sanndikaa-provisioning] Dropped legacy signup trigger: %', t.tgname;
  END LOOP;
END;
$$;

-- 4b. Trigger function. THE NON-NEGOTIABLE SAFETY RULE: the body is wrapped in
--     EXCEPTION WHEN OTHERS → RAISE WARNING → RETURN NEW. A throwing trigger
--     on auth.users would block ALL signups platform-wide; provisioning
--     failure must degrade to the heal API (POST /api/shops/ensure), never
--     break auth itself.

CREATE OR REPLACE FUNCTION public.handle_new_user_shop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    PERFORM public.provision_shop_row(NEW.id, NEW.email, NEW.raw_user_meta_data);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[sanndikaa-provisioning] shops row creation failed for user % — signup continues; the heal API will repair it. Error: %',
      NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- 4c. Install the trigger (drop-then-create = idempotent re-run).

DROP TRIGGER IF EXISTS on_auth_user_created_provision_shop ON auth.users;
CREATE TRIGGER on_auth_user_created_provision_shop
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_shop();

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5 · admin_actions audit table
-- Records every admin tier change / activation. RLS is ENABLED with ZERO
-- policies BY DESIGN: anon and authenticated roles get nothing; only the
-- service-role key (which bypasses RLS) can read or write. Service-role-only
-- by construction.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  target_shop_id uuid NOT NULL,
  action text NOT NULL,
  from_tier text,
  to_tier text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_actions_target_shop_created
  ON public.admin_actions (target_shop_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6 · shop_websites read policies
-- The table has RLS ENABLED with zero policies, so every anon/authenticated
-- read silently returns EMPTY (the service role bypasses RLS — which is why
-- all current app reads go through service-role clients). These two SELECT
-- policies end that silent-empty-read trap for future code:
--   · anyone can read PUBLISHED sites (public storefronts)
--   · owners can read their own row in any status (drafts)
-- NO insert/update/delete policies — writes remain service-role only.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.shop_websites') IS NULL THEN
    RAISE NOTICE '[sanndikaa-provisioning] shop_websites table not found — skipping its policies.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.shop_websites ENABLE ROW LEVEL SECURITY';

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'shop_websites'
      AND policyname = 'shop_websites_public_read_published'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "shop_websites_public_read_published"
      ON public.shop_websites
      FOR SELECT
      TO anon, authenticated
      USING (status = 'published')
    $pol$;
    RAISE NOTICE '[sanndikaa-provisioning] Created policy shop_websites_public_read_published.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'shop_websites'
      AND policyname = 'shop_websites_owner_read'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "shop_websites_owner_read"
      ON public.shop_websites
      FOR SELECT
      TO authenticated
      USING (auth.uid() = shop_id)
    $pol$;
    RAISE NOTICE '[sanndikaa-provisioning] Created policy shop_websites_owner_read.';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7 · ONE-SHOT ORPHAN BACKFILL
-- Heals every auth.users account that has NO shops row (victims of the legacy
-- trigger failing or being disabled). Uses the exact same provisioning core as
-- the trigger — identical metadata extraction, slugging, and collision
-- handling. Per-row exception guard: one bad account can never abort the rest.
-- Safe to re-run: already-provisioned accounts are skipped (LEFT JOIN + ON
-- CONFLICT DO NOTHING). The final NOTICE reports how many orphans were healed.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  u record;
  v_healed integer := 0;
  v_failed integer := 0;
BEGIN
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.shops s ON s.id = au.id
    WHERE s.id IS NULL
  LOOP
    BEGIN
      IF public.provision_shop_row(u.id, u.email, u.raw_user_meta_data) THEN
        v_healed := v_healed + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE WARNING '[sanndikaa-provisioning] Backfill failed for user %: %', u.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[sanndikaa-provisioning] Backfill complete: % orphaned account(s) healed, % failed.', v_healed, v_failed;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 8 · Realtime publication enrollment: public.shops
-- The dashboard vault door (components/dashboard/VaultDoor.tsx) subscribes to
-- postgres_changes UPDATE events on public.shops so the lock screen opens the
-- INSTANT an admin activates a seller's subscription_tier. Supabase only
-- broadcasts changes for tables enrolled in the supabase_realtime publication
-- — video_ads is already in it (Ad Studio notifiers), but shops was never
-- subscribed before this feature.
--
-- WITHOUT this section nothing breaks: the vault still unlocks via the
-- client's 15-second poll fallback. Realtime is the instant path; polling is
-- the guarantee. (Event delivery also respects RLS — the shops_public_read
-- SELECT policy from RLS_PRODUCTS_ORDERS_SHOPS.sql already satisfies it.)
--
-- Idempotent: pg_publication_tables is checked first; a NOTICE reports the
-- outcome either way, and re-running is always safe.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE '[sanndikaa-provisioning] supabase_realtime publication not found — skipped shops enrollment (vault unlock will rely on the 15s poll).';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'shops'
  ) THEN
    RAISE NOTICE '[sanndikaa-provisioning] public.shops already in supabase_realtime — nothing to do.';
  ELSE
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shops;
    RAISE NOTICE '[sanndikaa-provisioning] Added public.shops to supabase_realtime — vault unlock events now stream instantly.';
  END IF;
END;
$$;

commit;
