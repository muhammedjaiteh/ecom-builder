import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { slugify } from '@/lib/slugify';
import { resolveStorefrontPath, type StorefrontWebsiteFacts } from '@/lib/storefrontUrl';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/storefronts?ids=<uuid,uuid,…> — batch "best public URL" resolver
// for the marketplace feed (Pillar 2).
//
// The feed's boutique links hard-coded /shop/{slug}, silently bypassing the
// premium AI storefronts sellers pay for. This route resolves each shop's
// best link with resolveStorefrontPath (lib/storefrontUrl — REUSED VERBATIM;
// it already mirrors the /site serve predicate exactly, including the
// WebsiteConfigSchema.safeParse gate):
//   https://{custom_domain} → /site/{canonicalSlug} → /shop/{rawSlug} → null
//
// Service-role by DESIGN (not necessity): shop_websites RLS state must never
// decide whether a paying seller's link upgrades. Two plain .in() reads —
// never FK embeds (PGRST201 precedent). Returns {paths} ONLY — never config,
// never domain state — because the response is publicly cacheable:
// Cache-Control public, s-maxage=300, stale-while-revalidate=600 (a publish
// or domain activation propagates to the feed within 5 minutes).
//
// ≤60 deduped UUIDs per call: bounds the URL length and the .in() reads. The
// feed slices its request to the cap; anything above it is a caller bug and
// gets an honest 400.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 15;

const MAX_IDS = 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CACHE_HEADER = 'public, s-maxage=300, stale-while-revalidate=600';

export async function GET(req: Request) {
  try {
    const raw = new URL(req.url).searchParams.get('ids') ?? '';
    const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];

    if (ids.length === 0) {
      return NextResponse.json({ paths: {} }, { headers: { 'Cache-Control': CACHE_HEADER } });
    }
    if (ids.length > MAX_IDS) {
      return NextResponse.json({ error: `At most ${MAX_IDS} shop ids per request.` }, { status: 400 });
    }
    if (!ids.every((id) => UUID_RE.test(id))) {
      return NextResponse.json({ error: 'ids must be comma-separated UUIDs.' }, { status: 400 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [shopsRes, websitesRes] = await Promise.all([
      admin.from('shops').select('id, shop_slug').in('id', ids),
      admin
        .from('shop_websites')
        .select('shop_id, status, config, custom_domain, domain_status')
        .in('shop_id', ids),
    ]);

    if (shopsRes.error) {
      console.error('[storefronts] shops read failed:', shopsRes.error);
      return NextResponse.json({ error: 'Could not resolve storefront links.' }, { status: 500 });
    }
    // Website read failure degrades, never fails: the resolver falls back to
    // the /shop tier for every shop (mintStorefrontLink's exact posture).
    if (websitesRes.error) {
      console.error('[storefronts] shop_websites read failed — serving /shop fallbacks:', websitesRes.error);
    }

    const websiteByShop = new Map<string, StorefrontWebsiteFacts>();
    for (const row of websitesRes.data ?? []) {
      if (row?.shop_id) websiteByShop.set(row.shop_id as string, row as StorefrontWebsiteFacts);
    }

    const paths: Record<string, string> = {};
    for (const shop of shopsRes.data ?? []) {
      const path = resolveStorefrontPath({
        rawSlug: shop.shop_slug as string | null,
        canonicalSlug: slugify(shop.shop_slug as string | null) || null,
        website: websiteByShop.get(shop.id as string) ?? null,
      });
      if (path) paths[shop.id as string] = path;
    }

    return NextResponse.json({ paths }, { headers: { 'Cache-Control': CACHE_HEADER } });
  } catch (error) {
    console.error('[storefronts] fatal:', error);
    return NextResponse.json({ error: 'Could not resolve storefront links.' }, { status: 500 });
  }
}
