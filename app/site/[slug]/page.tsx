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

const SHOP_COLUMNS = 'id, shop_name, shop_slug, logo_url, banner_url, bio';

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

async function loadSite(slug: string, preview: boolean) {
  const supabase = getSupabase();
  const shop = await findShopBySlug(supabase, slug);

  if (!shop) return null;

  let website: SiteWebsite | null = null;
  let isOwnerPreview = false;

  // Owner draft preview: ?preview=1 + an authenticated session matching the
  // shop's id lets the seller see their site regardless of publish status.
  // Everyone else stays strictly published-only.
  if (preview) {
    const authed = getAuthedClient();
    const { data: { user } } = await authed.auth.getUser();
    if (user && user.id === shop.id) {
      // Query with the owner's session so RLS treats this exactly like the
      // dashboard's own read — drafts included.
      const { data } = await authed
        .from('shop_websites')
        .select('template_key, config, status')
        .eq('shop_id', shop.id)
        .maybeSingle();
      website = (data as SiteWebsite | null) ?? null;
      isOwnerPreview = website !== null;
    }
  }

  if (!website) {
    const { data } = await supabase
      .from('shop_websites')
      .select('template_key, config, status')
      .eq('shop_id', shop.id)
      .eq('status', 'published')
      .maybeSingle();
    website = (data as SiteWebsite | null) ?? null;
    isOwnerPreview = false;
  }

  if (!website) {
    return { shop: shop as SiteShop, website: null, products: [] as SiteProduct[], isOwnerPreview: false };
  }

  // Mixed legacy schema: the app's insert path (app/api/products) writes only
  // products.user_id — which equals the shop's id, since shops are keyed on
  // the owner's auth id — while older rows may carry shop_id instead. Match
  // either column so app-added inventory always renders on the generated site.
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, description, image_url, ad_video_url, ad_hero_image_url, category')
    .or(`shop_id.eq.${shop.id},user_id.eq.${shop.id}`)
    .order('created_at', { ascending: false })
    .limit(12);

  return { shop: shop as SiteShop, website, products: (products ?? []) as SiteProduct[], isOwnerPreview };
}

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await loadSite(slug, sp?.preview === '1');
  if (!data?.website) return { title: 'Sanndikaa Boutique' };

  const parsed = WebsiteConfigSchema.safeParse(data.website.config);
  if (!parsed.success) return { title: data.shop.shop_name ?? 'Sanndikaa Boutique' };

  return {
    title: parsed.data.site.seo.title,
    description: parsed.data.site.seo.description,
    ...(data.isOwnerPreview ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function SitePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await loadSite(slug, sp?.preview === '1');

  // No shop → back to the mall; no visible website → fall back to the
  // standard boutique page rather than a dead end.
  if (!data) redirect('/');
  // /shop decodes its param and matches the raw stored value, so legacy slugs
  // (with spaces) must be URL-encoded here to survive the round trip.
  if (!data.website) redirect(`/shop/${encodeURIComponent(data.shop.shop_slug ?? slug)}`);

  const parsed = WebsiteConfigSchema.safeParse(data.website.config);
  if (!parsed.success) {
    console.error(`[site/${slug}] Stored config failed validation:`, parsed.error.issues);
    redirect(`/shop/${encodeURIComponent(data.shop.shop_slug ?? slug)}`);
  }

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
