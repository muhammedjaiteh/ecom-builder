import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import EditorialTemplate from '@/components/site-templates/EditorialTemplate';
import RitualTemplate from '@/components/site-templates/RitualTemplate';
import VitalityTemplate from '@/components/site-templates/VitalityTemplate';
import {
  WebsiteConfigSchema,
  resolveHeroMedia,
  type SiteProduct,
  type SiteShop,
  type TemplateKey,
} from '@/lib/siteTemplates';
import { slugify } from '@/lib/slugify';

const TEMPLATE_COMPONENTS: Record<TemplateKey, typeof EditorialTemplate> = {
  editorial: EditorialTemplate,
  ritual: RitualTemplate,
  vitality: VitalityTemplate,
};

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
// shop's owner id. This file is a Server Component — the key never ships to
// the client.
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// Cookie-bound client so the owner's session is visible in this Server
// Component. setAll is a no-op: Server Components cannot write cookies, and
// this client only needs to read the session.
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

// Fulfillment columns feed the structured template footers (all confirmed
// shops columns — also selected by app/shop/[slug]/page.tsx).
const SHOP_COLUMNS = 'id, shop_name, shop_slug, logo_url, banner_url, bio, offers_delivery, offers_pickup, pickup_instructions';

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
type SiteViewer = {
  checked: boolean;
  userId: string | null;
  isOwner: boolean;
  hasAuthCookie: boolean;
  authNote: string | null;
};

// cache(): generateMetadata and the page body both resolve the site; without
// request-level deduplication every hit paid TWO full sets of DB round trips.
const loadSite = cache(async (slug: string) => {
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
  // published-only redirect below.
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

// The live storefront must always reflect the current publish state and the
// latest generated config. Previously this page was implicitly dynamic via its
// searchParams read; now that ?preview=1 is no longer load-bearing, pin it
// explicitly so the route is never served from the full route cache.
export const dynamic = 'force-dynamic';

// ?preview=1 is still accepted on the URL (legacy dashboard links) but ignored:
// ownership resolution in loadSite covers both the bare and preview URLs.
type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadSite(slug);
  if (!data?.website) return { title: 'Sanndikaa Boutique' };

  const parsed = WebsiteConfigSchema.safeParse(data.website.config);
  if (!parsed.success) return { title: data.shop.shop_name ?? 'Sanndikaa Boutique' };

  return {
    title: parsed.data.site.seo.title,
    description: parsed.data.site.seo.description,
    ...(data.isOwnerPreview ? { robots: { index: false, follow: false } } : {}),
  };
}

// Permanent branch telemetry: any 307 from this route must print exactly which
// branch fired and why. `user` is the network-verified session id, 'anon' when
// the gate ran and found none, or 'unchecked' when no gate was needed (public
// published serve / no row at all with published visibility already decided).
function viewerLog(v: SiteViewer): string {
  const user = v.checked ? (v.userId ?? 'anon') : 'unchecked';
  const note = v.checked && v.authNote ? ` authNote="${v.authNote}" authCookie=${v.hasAuthCookie}` : '';
  return `user=${user} owner=${v.isOwner}${note}`;
}

export default async function SitePage({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadSite(slug);

  // No shop → back to the mall; no visible website → fall back to the
  // standard boutique page rather than a dead end.
  if (!data) {
    console.log(`[site-route] slug=${slug} shop=miss → redirect:/`);
    redirect('/');
  }
  // /shop decodes its param and matches the raw stored value, so legacy slugs
  // (with spaces) must be URL-encoded here to survive the round trip.
  if (!data.website) {
    console.log(`[site-route] slug=${slug} shop=found website=${data.storedStatus} ${viewerLog(data.viewer)} → redirect:/shop`);
    redirect(`/shop/${encodeURIComponent(data.shop.shop_slug ?? slug)}`);
  }

  const parsed = WebsiteConfigSchema.safeParse(data.website.config);
  if (!parsed.success) {
    console.error(`[site/${slug}] Stored config failed validation:`, parsed.error.issues);
    console.log(`[site-route] slug=${slug} shop=found website=${data.storedStatus} ${viewerLog(data.viewer)} config=invalid → redirect:/shop`);
    redirect(`/shop/${encodeURIComponent(data.shop.shop_slug ?? slug)}`);
  }

  console.log(`[site-route] slug=${slug} shop=found website=${data.storedStatus} ${viewerLog(data.viewer)} → serve`);

  const config = parsed.data;
  const Template = TEMPLATE_COMPONENTS[config.template_key] ?? VitalityTemplate;
  const heroMedia = resolveHeroMedia(data.products, data.shop);
  const isDraftPreview = data.isOwnerPreview && data.website.status !== 'published';

  return (
    <>
      {isDraftPreview && (
        <div className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#1a2e1a] px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-2xl ring-1 ring-white/15">
          <span className="h-1.5 w-1.5 rounded-full bg-[#f0a500]" />
          Draft Preview — only you can see this
        </div>
      )}
      <Template
        shop={data.shop}
        products={data.products}
        config={config}
        heroMedia={heroMedia}
      />
    </>
  );
}
