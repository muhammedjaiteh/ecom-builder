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

export default async function SitePage({ params }: PageProps) {
  const { slug } = await params;
  const site = await requireSite(slug, 'home');

  const Template = TEMPLATE_COMPONENTS[site.config.template_key] ?? VitalityTemplate;
  const heroMedia = resolveHeroMedia(site.products, site.shop);

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
