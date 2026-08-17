import { NextResponse, after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeTenantHost, upsertTenantMapping } from '@/lib/globalConfig';
import { slugifyWithFallback } from '@/lib/slugify';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/domains/resolve?host= — PUBLIC tenant resolution (no auth: this
// endpoint powers routing itself; proxy.ts calls it when Global Config misses).
//
//   hostname → shop_websites where lower(custom_domain)=lower(host)
//              AND domain_status='active' → the shop's canonical slug
//
// Returns { slug } (CDN-cached: s-maxage=60, stale-while-revalidate=300) or a
// classified 404. On every hit it backfills Global Config via after() —
// self-healing: any mapping the 'active' flip failed to write repairs itself
// on first traffic, and the write never delays the response (the middleware
// waits at most 5s for this route).
//
// Rate-safety: the only input is a hostname, gated by normalizeTenantHost
// (shape-validated, ≤253 chars, lowercase [a-z0-9.-] only), so no ilike/URL
// metacharacters can reach the query, and CDN caching absorbs repeats.
// ─────────────────────────────────────────────────────────────────────────────

const HIT_CACHE = 'public, s-maxage=60, stale-while-revalidate=300';
// Short negative cache: damps request storms for unknown hosts without making
// a just-activated domain wait long for its first successful resolution.
const MISS_CACHE = 'public, s-maxage=15';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function GET(req: Request) {
  try {
    const host = normalizeTenantHost(new URL(req.url).searchParams.get('host'));
    if (!host) {
      return NextResponse.json(
        { error: 'Provide a valid hostname via ?host=.', code: 'invalid_host' },
        { status: 400 }
      );
    }

    const admin = getAdmin();

    // Service-role read: shop_websites RLS is provisioned out-of-repo (see
    // app/site/[slug]/siteData.ts), so anon reads can silently return zero
    // rows. Exposure is bounded by construction — active custom domains are
    // public routing facts. `host` is shape-validated above, so .ilike is an
    // exact case-insensitive equality (no metacharacters can survive).
    const { data: siteRow, error: siteError } = await admin
      .from('shop_websites')
      .select('shop_id')
      .ilike('custom_domain', host)
      .eq('domain_status', 'active')
      .limit(1)
      .maybeSingle();

    if (siteError) {
      console.error(`[domains/resolve] website read failed for ${host}:`, siteError);
      return NextResponse.json({ error: 'Resolution failed.', code: 'db_error' }, { status: 500 });
    }
    if (!siteRow) {
      return NextResponse.json(
        { error: 'No active storefront is connected to this domain.', code: 'not_found' },
        { status: 404, headers: { 'Cache-Control': MISS_CACHE } }
      );
    }

    const { data: shop, error: shopError } = await admin
      .from('shops')
      .select('id, shop_slug, shop_name')
      .eq('id', siteRow.shop_id)
      .maybeSingle();

    if (shopError) {
      console.error(`[domains/resolve] shop read failed for ${host}:`, shopError);
      return NextResponse.json({ error: 'Resolution failed.', code: 'db_error' }, { status: 500 });
    }
    if (!shop) {
      return NextResponse.json(
        { error: 'No active storefront is connected to this domain.', code: 'not_found' },
        { status: 404, headers: { 'Cache-Control': MISS_CACHE } }
      );
    }

    // Canonical, Law-2-safe slug — the exact form the /site router resolves
    // (legacy raw values are slugified here and matched by findShopBySlug's
    // verified fallback, so the rewrite target never 404s).
    const slug = slugifyWithFallback(shop.shop_slug || shop.shop_name, shop.id);

    // Self-healing Global Config backfill — after the response is flushed, so
    // the middleware's 5s resolve budget is never spent on a write.
    after(async () => {
      const result = await upsertTenantMapping(host, slug);
      if (!result.ok && result.code !== 'not_configured') {
        console.error(`[domains/resolve] Global Config backfill failed for ${host}: ${result.code} ${result.message}`);
      }
    });

    return NextResponse.json({ slug }, { headers: { 'Cache-Control': HIT_CACHE } });
  } catch (error) {
    console.error('[domains/resolve] fatal:', error);
    return NextResponse.json({ error: 'Resolution failed.', code: 'internal' }, { status: 500 });
  }
}
