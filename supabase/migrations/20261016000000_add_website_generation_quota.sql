-- ─────────────────────────────────────────────────────────────────────────────
-- Website Studio generation quota (2 included generations per shop, +2 per
-- Studio Token). generations_limit is raised by the Sanndikaa team when a
-- seller purchases a token; generations_used is incremented ATOMICALLY by
-- persist_matrix_website on every execute-step persist (insert or update).
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.shop_websites
  add column if not exists generations_used integer not null default 0,
  add column if not exists generations_limit integer not null default 2;

comment on column public.shop_websites.generations_used is
  'Website Studio generations consumed by this shop (incremented by persist_matrix_website).';
comment on column public.shop_websites.generations_limit is
  'Website Studio generation allowance: 2 included, +2 per purchased Studio Token.';

-- ─────────────────────────────────────────────────────────────────────────────
-- persist_matrix_website — SAME parameter signature as the shipped RPC
-- (p_shop_id, p_template_key, p_config, p_brand_tokens, p_niche_reasoning,
-- p_matrix_theme, p_generated_at). Replaced so the upsert also advances the
-- quota counter in the same statement:
--   · INSERT  → generations_used = 1 (the first generation is consumed)
--   · UPDATE  → generations_used = COALESCE(existing, 0) + 1,
--               generations_limit preserved (COALESCE(existing, 2)).
-- status is NOT touched on conflict: a regenerated published site stays
-- published and the generate-website route's cache bust serves the new config
-- on the very next request (as its revalidation block documents).
-- DROP + CREATE (rather than CREATE OR REPLACE alone) so a differing return
-- type on the shipped definition can never make this migration fail.
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.persist_matrix_website(uuid, text, jsonb, jsonb, text, text, timestamptz);

create function public.persist_matrix_website(
  p_shop_id uuid,
  p_template_key text,
  p_config jsonb,
  p_brand_tokens jsonb,
  p_niche_reasoning text,
  p_matrix_theme text,
  p_generated_at timestamptz
)
returns public.shop_websites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.shop_websites;
begin
  insert into public.shop_websites (
    shop_id,
    template_key,
    config,
    brand_tokens,
    niche_reasoning,
    matrix_theme,
    generated_at,
    status,
    generations_used,
    generations_limit
  )
  values (
    p_shop_id,
    p_template_key,
    p_config,
    p_brand_tokens,
    p_niche_reasoning,
    p_matrix_theme,
    coalesce(p_generated_at, now()),
    'draft',
    1,
    2
  )
  on conflict (shop_id) do update set
    template_key      = excluded.template_key,
    config            = excluded.config,
    brand_tokens      = excluded.brand_tokens,
    niche_reasoning   = excluded.niche_reasoning,
    matrix_theme      = excluded.matrix_theme,
    generated_at      = excluded.generated_at,
    generations_used  = coalesce(public.shop_websites.generations_used, 0) + 1,
    generations_limit = coalesce(public.shop_websites.generations_limit, 2)
  returning * into v_row;

  return v_row;
end;
$$;

-- Iron Dome: service-role only — the generate-website route is the sole
-- caller and it enforces auth, tier, and the quota gate in code.
revoke all on function public.persist_matrix_website(uuid, text, jsonb, jsonb, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.persist_matrix_website(uuid, text, jsonb, jsonb, text, text, timestamptz) to service_role;
