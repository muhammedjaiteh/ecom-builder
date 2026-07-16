import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  WebsiteConfigSchema,
  type SiteProduct,
  type SiteShop,
  type TemplateKey,
  type WebsiteConfig,
} from '@/lib/siteTemplates';
import { slugify } from '@/lib/slugify';

// ─────────────────────────────────────────────────────────────────────────────
// Shared /site resolution — ONE cached loadSite consumed by every page of the
// omnichannel site router (home, /collections, /products/[id]) and their
// generateMetadata functions. cache() dedupes per request ONLY when all
// callers share this module-level instance, which is why this lives here
// instead of inside a page file.
// ─────────────────────────────────────────────────────────────────────────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Service-role client for the shop_websites reads ONLY. That table was
// provisioned outside this repo and its RLS policies are not versioned here
// (shops/products public-read policies ARE — see RLS_PRODUCTS_ORDERS_SHOPS.sql),
// so an anon/authed read of it can silently return zero rows and masquerade as
// "no website". Access control is enforced in code instead: published rows are
// public by definition of publishing, and draft rows are served only after the
// cookie-session user is network-verified (auth.getUser) AND matches the
// shop's owner id. This module is server-only (next/headers) — the key never
// ships to the client.
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// Cookie-bound client so the owner's session is visible in Server Components.
// setAll is a no-op: Server Components cannot write cookies, and this client
// only needs to read the session.
function getAuthedClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: async () => (await cookies()).getAll(),
        setAll: () => {},
      },
    }
  );
}

type SiteWebsite = { template_key: TemplateKey; config: unknown; status: string };

// Fulfillment columns feed the structured template footers; phone feeds the
// footer WhatsApp contact link and the on-site PDP checkout (all confirmed
// shops columns — /shop and /product surfaces already read them via anon).
const SHOP_COLUMNS = 'id, shop_name, shop_slug, logo_url, banner_url, bio, offers_delivery, offers_pickup, pickup_instructions, phone';

// Law 2 slug safety: decode the inbound param (Next delivers it URL-encoded),
// normalize it to the canonical lowercase-hyphenated form, and look up the
// shop. Legacy rows minted by the signup trigger may still store raw values
// ("Jambaba Boutique09") until a generate/publish write-repairs them — the
// fallback matches those case-insensitively with separators wildcarded, then
// VERIFIES the candidate slugifies to exactly the requested slug.
async function findShopBySlug(supabase: ReturnType<typeof getSupabase>, slug: string) {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // Malformed escape sequence — fall back to the raw param.
  }
  const cleanSlug = slugify(decoded);
  if (!cleanSlug) return null;

  const { data: exact } = await supabase
    .from('shops')
    .select(SHOP_COLUMNS)
    .eq('shop_slug', cleanSlug)
    .maybeSingle();
  if (exact) return exact;

  // Legacy candidates: match ANY stored value that slugifies to exactly
  // cleanSlug. The regex requires the row's alphanumeric runs to equal the
  // slug's tokens, in order, with only symbol runs between/around them — so
  // leading/trailing junk ("My Boutique ", "Boutique!") resolves too, and the
  // result set is bounded to true collisions rather than wildcard
  // over-matches that could push the real row past the limit. imatch (~*)
  // folds case both in the tokens and inside the negated classes. cleanSlug
  // is [a-z0-9-] only, so its tokens need no regex escaping.
  const pattern = `^[^a-z0-9]*${cleanSlug.split('-').join('[^a-z0-9]+')}[^a-z0-9]*$`;
  const { data: candidates } = await supabase
    .from('shops')
    .select(SHOP_COLUMNS)
    .filter('shop_slug', 'imatch', pattern)
    .order('id', { ascending: true })
    .limit(10);

  return candidates?.find((c) => slugify(c.shop_slug) === cleanSlug) ?? null;
}

// Per-redirect telemetry payload: which viewer the auth gate resolved. The
// gate only runs when a non-published row exists (published pages are public
// and must not pay a per-view auth round trip), so `checked` distinguishes
// "anonymous" from "never needed to check".
export type SiteViewer = {
  checked: boolean;
  userId: string | null;
  isOwner: boolean;
  hasAuthCookie: boolean;
  authNote: string | null;
};

// cache(): generateMetadata and the page body both resolve the site; without
// request-level deduplication every hit paid TWO full sets of DB round trips.
export const loadSite = cache(async (slug: string) => {
  const supabase = getSupabase();
  const shop = await findShopBySlug(supabase, slug);

  const viewer: SiteViewer = { checked: false, userId: null, isOwner: false, hasAuthCookie: false, authNote: null };

  if (!shop) return null;

  // Single website read via the service client (see getServiceClient). One
  // row per shop (shop_id is the upsert conflict key) — visibility is decided
  // in code below, never left to unversioned RLS.
  const { data: row, error: websiteError } = await getServiceClient()
    .from('shop_websites')
    .select('template_key, config, status')
    .eq('shop_id', shop.id)
    .maybeSingle();
  if (websiteError) {
    console.error(`[site-route] slug=${slug} shop_websites read failed: ${websiteError.message}`);
  }

  const stored = (row as SiteWebsite | null) ?? null;
  const storedStatus = stored?.status ?? 'none';

  // Strict public rule: anonymous traffic only ever sees published sites.
  let website: SiteWebsite | null = stored?.status === 'published' ? stored : null;
  let isOwnerPreview = false;

  // Owner draft fallback: a stored-but-unpublished row is served only when the
  // cookie session's NETWORK-VERIFIED user id equals the shop's owner id — on
  // the bare /site URL as well as the legacy ?preview=1 link (the query string
  // is no longer load-bearing). Anonymous visitors and non-owners keep the
  // published-only redirect in requireSite.
  if (!website && stored) {
    viewer.checked = true;
    const jar = await cookies();
    viewer.hasAuthCookie = jar.getAll().some((c) => c.name.includes('-auth-token'));
    const authed = getAuthedClient();
    const { data: { user }, error: authError } = await authed.auth.getUser();
    viewer.userId = user?.id ?? null;
    viewer.authNote = user ? null : (authError?.message ?? 'no-session');
    viewer.isOwner = user !== null && user.id === shop.id;
    if (viewer.isOwner) {
      website = stored;
      isOwnerPreview = true;
    }
  }

  if (!website) {
    return {
      shop: shop as SiteShop,
      website: null,
      storedStatus,
      products: [] as SiteProduct[],
      isOwnerPreview: false,
      viewer,
    };
  }

  // Mixed legacy schema: the app's insert path (app/api/products) writes only
  // products.user_id — which equals the shop's id, since shops are keyed on
  // the owner's auth id — while older rows may carry shop_id instead. Match
  // either column so app-added inventory always renders on the generated site.
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, description, image_url, ad_video_url, ad_hero_image_url, category, stock_quantity')
    .or(`shop_id.eq.${shop.id},user_id.eq.${shop.id}`)
    .order('created_at', { ascending: false })
    .limit(12);

  return {
    shop: shop as SiteShop,
    website,
    storedStatus,
    products: (products ?? []) as SiteProduct[],
    isOwnerPreview,
    viewer,
  };
});

// Permanent branch telemetry: any 307 from these routes must print exactly
// which branch fired and why. `user` is the network-verified session id,
// 'anon' when the gate ran and found none, or 'unchecked' when no gate was
// needed (public published serve / no row at all with published visibility
// already decided).
export function viewerLog(v: SiteViewer): string {
  const user = v.checked ? (v.userId ?? 'anon') : 'unchecked';
  const note = v.checked && v.authNote ? ` authNote="${v.authNote}" authCookie=${v.hasAuthCookie}` : '';
  return `user=${user} owner=${v.isOwner}${note}`;
}

export type SiteRoute = 'home' | 'collections' | `product:${string}`;

export type ResolvedSite = {
  shop: SiteShop;
  config: WebsiteConfig;
  products: SiteProduct[];
  storedStatus: string;
  isOwnerPreview: boolean;
  /** Owner viewing an unpublished site — pages render the draft badge. */
  isDraftPreview: boolean;
  viewer: SiteViewer;
};

/**
 * Resolve-or-redirect for page bodies (generateMetadata must use loadSite
 * directly and return fallbacks instead of redirecting). Exactly the home
 * page's historical branch logic, shared by every nested route with the
 * '[site-route]' telemetry pattern extended by the sub-route:
 *   - unknown slug            → redirect('/')          (back to the mall)
 *   - no visible website      → redirect('/shop/…')    (the classic boutique is
 *     the only correct fallback for a dead site link)
 *   - stored config invalid   → redirect('/shop/…')
 *   - otherwise               → serve (draft only for the verified owner)
 */
export async function requireSite(slug: string, route: SiteRoute): Promise<ResolvedSite> {
  const data = await loadSite(slug);

  if (!data) {
    console.log(`[site-route] slug=${slug} route=${route} shop=miss → redirect:/`);
    redirect('/');
  }
  // /shop decodes its param and matches the raw stored value, so legacy slugs
  // (with spaces) must be URL-encoded here to survive the round trip.
  if (!data.website) {
    console.log(`[site-route] slug=${slug} route=${route} shop=found website=${data.storedStatus} ${viewerLog(data.viewer)} → redirect:/shop`);
    redirect(`/shop/${encodeURIComponent(data.shop.shop_slug ?? slug)}`);
  }

  const parsed = WebsiteConfigSchema.safeParse(data.website.config);
  if (!parsed.success) {
    console.error(`[site/${slug}] Stored config failed validation:`, parsed.error.issues);
    console.log(`[site-route] slug=${slug} route=${route} shop=found website=${data.storedStatus} ${viewerLog(data.viewer)} config=invalid → redirect:/shop`);
    redirect(`/shop/${encodeURIComponent(data.shop.shop_slug ?? slug)}`);
  }

  console.log(`[site-route] slug=${slug} route=${route} shop=found website=${data.storedStatus} ${viewerLog(data.viewer)} → serve`);

  return {
    shop: data.shop,
    config: parsed.data,
    products: data.products,
    storedStatus: data.storedStatus,
    isOwnerPreview: data.isOwnerPreview,
    isDraftPreview: data.isOwnerPreview && data.website.status !== 'published',
    viewer: data.viewer,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full-catalog reads for /collections — honest server pagination.
// ─────────────────────────────────────────────────────────────────────────────

export const CATALOG_PAGE_SIZE = 24;

export type SiteCatalogPage = {
  products: SiteProduct[];
  total: number;
  /** The served page after clamping to [1, pageCount]. */
  page: number;
  pageCount: number;
  /** 1-based display range of the served slice (0/0 when the catalog is empty). */
  from: number;
  to: number;
};

// Count first, then a clamped range read: PostgREST rejects out-of-range
// offsets outright, so an over-large ?page must clamp BEFORE the range query
// rather than error. cache() keys on (shopId, page) — metadata + body share.
export const loadSiteCatalog = cache(async (shopId: string, requestedPage: number): Promise<SiteCatalogPage> => {
  const supabase = getSupabase();

  const { count, error: countError } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .or(`shop_id.eq.${shopId},user_id.eq.${shopId}`);
  if (countError) {
    console.error(`[site-route] catalog count failed for shop ${shopId}: ${countError.message}`);
  }

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), pageCount);

  if (total === 0) {
    return { products: [], total: 0, page: 1, pageCount: 1, from: 0, to: 0 };
  }

  const rangeFrom = (page - 1) * CATALOG_PAGE_SIZE;
  const rangeTo = Math.min(page * CATALOG_PAGE_SIZE, total) - 1;

  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, description, image_url, ad_video_url, ad_hero_image_url, category, stock_quantity')
    .or(`shop_id.eq.${shopId},user_id.eq.${shopId}`)
    .order('created_at', { ascending: false })
    .range(rangeFrom, rangeTo);
  if (error) {
    console.error(`[site-route] catalog read failed for shop ${shopId}: ${error.message}`);
  }

  const products = (data ?? []) as SiteProduct[];
  return {
    products,
    total,
    page,
    pageCount,
    from: products.length > 0 ? rangeFrom + 1 : 0,
    to: products.length > 0 ? rangeFrom + products.length : 0,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Single-product read for the on-site PDP.
// ─────────────────────────────────────────────────────────────────────────────

export type SitePdpProduct = SiteProduct & {
  image_urls: string[] | null;
  colors: string[] | null;
  sizes: string[] | null;
  user_id: string | null;
  shop_id: string | null;
};

/** Same id hygiene as the marketplace PDP — strip everything non [A-Za-z0-9-]. */
export function sanitizeProductId(rawId: string): string {
  return String(rawId).replace(/[^a-zA-Z0-9-]/g, '');
}

export const loadSiteProduct = cache(async (rawId: string): Promise<SitePdpProduct | null> => {
  const cleanId = sanitizeProductId(rawId);
  if (!cleanId) return null;

  const { data, error } = await getSupabase()
    .from('products')
    .select('id, name, price, description, image_url, image_urls, ad_video_url, ad_hero_image_url, category, stock_quantity, colors, sizes, user_id, shop_id')
    .eq('id', cleanId)
    .maybeSingle();
  if (error) {
    console.error(`[site-route] product read failed for id ${cleanId}: ${error.message}`);
  }

  return (data as SitePdpProduct | null) ?? null;
});

/** Ownership gate for the PDP: a /site page must never present another
 *  shop's product. Mirrors the catalog's dual-column match. */
export function productBelongsToShop(product: SitePdpProduct, shopId: string): boolean {
  return product.shop_id === shopId || product.user_id === shopId;
}
