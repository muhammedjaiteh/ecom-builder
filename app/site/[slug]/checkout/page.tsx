import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SITE_CHROMES } from '@/components/site-templates/chrome';
import SiteThemeCascade from '@/components/site-templates/SiteThemeCascade';
import CheckoutForm from '@/components/CheckoutForm';
import { WebsiteConfigSchema, siteCollectionsPath } from '@/lib/siteTemplates';
import { siteThemeVars } from '@/lib/siteTheme';
import { loadSite, requireSite } from '../siteData';
import SiteDraftBadge from '../SiteDraftBadge';

// /site/[slug]/checkout — the BOUTIQUE checkout. The shared CheckoutForm
// rendered inside the seller's premium chrome, pinned to THIS shop's bag
// lines, with the theme cascade mirrored onto the document root so the
// root-layout cart drawer wears the boutique tokens here too. Same visibility
// rules and '[site-route]' telemetry as every nested /site page, via the
// shared cached requireSite.
//
// OWNERSHIP GATE (the PDP rule, applied to checkout): a boutique never
// presents another seller's checkout. The drawer appends ?shop=<id> to every
// "Checkout with …" link; if that id is not this shop, the buyer is sent to
// the global /checkout, which handles any seller.

// CACHED DATA, DYNAMIC SHELL: force-dynamic stays (owner-draft cookie gate +
// per-viewer redirect outcomes in requireSite). The site resolution is cached
// in siteData.ts under `site:{shopId}`; the bag itself is client state.
export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ shop?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadSite(slug);
  const noindex = { robots: { index: false, follow: false } } as const;
  if (!data?.website) return { title: 'Checkout — Sanndikaa Boutique', ...noindex };

  const parsed = WebsiteConfigSchema.safeParse(data.website.config);
  const siteTitle = parsed.success ? parsed.data.site.seo.title : data.shop.shop_name ?? 'Sanndikaa Boutique';
  return { title: `Checkout — ${siteTitle}`, ...noindex };
}

function cleanShopParam(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(value) ? value : null;
}

export default async function SiteCheckoutPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const site = await requireSite(slug, 'checkout');

  const { shop: requestedShop } = await searchParams;
  const requestedShopId = cleanShopParam(requestedShop);
  if (requestedShopId && requestedShopId !== site.shop.id) {
    console.log(`[site-route] slug=${slug} route=checkout shop=${site.shop.id} requested=${requestedShopId} → redirect:/checkout`);
    redirect(`/checkout?shop=${encodeURIComponent(requestedShopId)}`);
  }

  const entry = SITE_CHROMES[site.config.template_key] ?? SITE_CHROMES.vitality;
  const { Chrome, tone } = entry;

  // requireSite resolved this shop BY slug, so a canonical collections path
  // always exists here; the slug-derived fallback is belt-and-suspenders only.
  const continueHref = siteCollectionsPath(site.shop) ?? `/site/${slug}/collections`;

  // Cascade gap (Pillar 4): mirror the theme onto document.documentElement so
  // the root-layout Cart drawer wears the boutique tokens on this page too.
  const themeVars = siteThemeVars(site.config);

  return (
    <>
      {themeVars && <SiteThemeCascade vars={themeVars} />}
      {site.isDraftPreview && <SiteDraftBadge />}
      {/* active="product": no nav item emphasized, section anchors route back
          to the home page — exactly the posture a checkout page wants. */}
      <Chrome shop={site.shop} config={site.config} active="product">
        <CheckoutForm
          tone={tone}
          pinnedShop={{
            id: site.shop.id,
            name: site.shop.shop_name ?? 'This boutique',
            whatsapp: site.shop.phone ?? null,
            offersDelivery: site.shop.offers_delivery,
            offersPickup: site.shop.offers_pickup,
            pickupInstructions: site.shop.pickup_instructions,
          }}
          continueHref={continueHref}
          continueLabel="Back to the collection"
        />
      </Chrome>
    </>
  );
}
