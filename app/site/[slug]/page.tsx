import type { Metadata } from 'next';
import EditorialTemplate from '@/components/site-templates/EditorialTemplate';
import RitualTemplate from '@/components/site-templates/RitualTemplate';
import VitalityTemplate from '@/components/site-templates/VitalityTemplate';
import {
  WebsiteConfigSchema,
  resolveHeroMedia,
  type TemplateKey,
} from '@/lib/siteTemplates';
import { loadSite, requireSite } from './siteData';
import SiteDraftBadge from './SiteDraftBadge';

// /site/[slug] — the HOME page of the seller's generated website. Shop/site
// resolution, visibility rules, and telemetry live in ./siteData (shared with
// the nested /collections and /products/[id] routes so all pages agree on one
// cached read per request).

const TEMPLATE_COMPONENTS: Record<TemplateKey, typeof EditorialTemplate> = {
  editorial: EditorialTemplate,
  ritual: RitualTemplate,
  vitality: VitalityTemplate,
};

// CACHED DATA, DYNAMIC SHELL: this route stays force-dynamic on purpose. The
// owner-draft branch reads cookies per request (the 307-saga fix), and the
// redirect outcomes (no website → /shop, unknown slug → /) are viewer-derived
// — letting the full route cache capture ANY of those states would leak the
// wrong one to the next visitor. What IS cached is every anon data read
// underneath (siteData.ts → unstable_cache, tags site:{shopId} +
// site:slug:{slug}, 300s backstop), so the per-request work is just the
// (cheap) shell render + the cookie check when a draft gate is needed.
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

export default async function SitePage({ params }: PageProps) {
  const { slug } = await params;
  const site = await requireSite(slug, 'home');

  const Template = TEMPLATE_COMPONENTS[site.config.template_key] ?? VitalityTemplate;
  // Hero fallback chain (Pillar 4b): config.assets.hero_image_url (the
  // deliberate hero) → shop banner → null (the animated brand plate). Raw
  // product media never auto-fills the masthead anymore.
  const heroMedia = resolveHeroMedia(site.shop, site.config);

  return (
    <>
      {site.isDraftPreview && <SiteDraftBadge />}
      <Template
        shop={site.shop}
        products={site.products}
        config={site.config}
        heroMedia={heroMedia}
      />
    </>
  );
}
