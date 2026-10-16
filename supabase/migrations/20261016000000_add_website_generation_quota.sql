alter table public.shop_websites
  add column if not exists brand_tokens jsonb,
  add column if not exists generations_used integer not null default 0,
  add column if not exists generations_limit integer not null default 2;

drop function if exists public.persist_matrix_website(uuid, text, jsonb, jsonb, text, text, timestamptz);

create or replace function public.persist_matrix_website(
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
  -- 1. Update theme_matrix on public.shops (NOT shop_websites)
  update public.shops
  set theme_matrix = p_matrix_theme
  where id = p_shop_id;

  -- 2. Upsert public.shop_websites and increment generations_used
  insert into public.shop_websites (
    shop_id,
    template_key,
    config,
    brand_tokens,
    niche_reasoning,
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
    generated_at      = excluded.generated_at,
    generations_used  = coalesce(public.shop_websites.generations_used, 0) + 1,
    generations_limit = coalesce(public.shop_websites.generations_limit, 2)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.persist_matrix_website(uuid, text, jsonb, jsonb, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.persist_matrix_website(uuid, text, jsonb, jsonb, text, text, timestamptz) to service_role;