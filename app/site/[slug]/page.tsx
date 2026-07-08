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

async function loadSite(slug: string, preview: boolean) {
  const supabase = getSupabase();
  // Law 2 slug safety: strip illegal chars AND lowercase before lookup.
  const cleanSlug = slug.replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();

  const { data: shop } = await supabase
    .from('shops')
    .select('id, shop_name, shop_slug, logo_url, banner_url, bio')
    .eq('shop_slug', cleanSlug)
    .maybeSingle();

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

  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, description, image_url, ad_video_url, ad_hero_image_url, category')
    .eq('shop_id', shop.id)
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
  if (!data.website) redirect(`/shop/${data.shop.shop_slug ?? slug}`);

  const parsed = WebsiteConfigSchema.safeParse(data.website.config);
  if (!parsed.success) {
    console.error(`[site/${slug}] Stored config failed validation:`, parsed.error.issues);
    redirect(`/shop/${data.shop.shop_slug ?? slug}`);
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
