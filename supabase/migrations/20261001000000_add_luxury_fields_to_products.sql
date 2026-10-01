-- ─────────────────────────────────────────────────────────────────────────────
-- SANNDIKAA LUXURY MERCHANDISING FIELDS — products.{kicker,extraction,details,eyebrow}
--
-- Feeds the data-blind BanjulNoirStorefront matrix (components/generator/matrix)
-- through the /s/[slug] adapter. Additive and idempotent: every statement is
-- IF NOT EXISTS so re-running the file (or the founder pasting it into the
-- Supabase SQL editor after a CLI apply) is a no-op.
--
--   kicker      short eyebrow over the title — form · size ("Attar · 12ml")
--   extraction  monospaced provenance line — origin · method · maceration
--   details     newline- or pipe-separated spec bullets rendered in the Buy Box
--   eyebrow     secondary eyebrow; the adapter falls back to it when kicker is NULL
--
-- All four are nullable text. NULL = "not merchandised yet": the adapter
-- degrades to category / empty strings, never to a broken storefront.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS kicker     text,
  ADD COLUMN IF NOT EXISTS extraction text,
  ADD COLUMN IF NOT EXISTS details    text,
  ADD COLUMN IF NOT EXISTS eyebrow    text;

COMMENT ON COLUMN public.products.kicker IS
  'Luxury storefront eyebrow — form · size (e.g. "Attar · 12ml"). Rendered above the product title.';
COMMENT ON COLUMN public.products.extraction IS
  'Provenance line — origin · method · maceration. Rendered monospaced in the Buy Box.';
COMMENT ON COLUMN public.products.details IS
  'Spec bullets, one per line (or pipe-separated). Split into StorefrontProduct.details by the /s/[slug] adapter.';
COMMENT ON COLUMN public.products.eyebrow IS
  'Secondary eyebrow. Adapter fallback for kicker when kicker is NULL.';
