import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { SITE_CHROMES, type SiteTone } from '@/components/site-templates/chrome';
import SiteThemeCascade from '@/components/site-templates/SiteThemeCascade';
import {
  LOW_STOCK_MAX,
  WebsiteConfigSchema,
  siteBasePath,
  siteCollectionsPath,
} from '@/lib/siteTemplates';
import { siteThemeVars } from '@/lib/siteTheme';
import {
  loadSite,
  loadSiteProduct,
  productBelongsToShop,
  requireSite,
  sanitizeProductId,
  type SitePdpProduct,
  type SiteRoute,
} from '../../siteData';
import SiteDraftBadge from '../../SiteDraftBadge';
import SiteFulfillmentPane from './SiteFulfillmentPane';
import SiteProductGallery, { type GalleryMedia } from './SiteProductGallery';
import SiteProductPurchase from './SiteProductPurchase';

// /site/[slug]/products/[id] — the on-site Product Detail Page. Gallery,
// price, stock, quantity, and the REAL checkout (shared cart drawer + direct
// WhatsApp order via lib/orderFlow) inside the seller's premium chrome — the
// buyer completes the purchase without ever leaving the branded site.
// Ownership gate: a product that does not belong to this shop redirects to
// the site's own collections page (never render another seller's product).
//
// PDP OVERHAUL (Phase 2 — the Sanndikaa luxury aesthetic):
//   • Gallery-led 7/5 split (the Editorial hero ratio): a vertical thumbnail
//     rail + tall 4:5 frame on desktop, a full-bleed swipe frame on mobile,
//     with a live "01 / 04" counter (SiteProductGallery).
//   • The purchase column is sticky on desktop so the price + CTAs stay in
//     view while the buyer studies the gallery.
//   • Typography + color ride the theme cascade: font-serif resolves through
//     --site-serif; every ink/muted/accent spot is var(--site-*, <historical
//     literal>) — the same tokens the committed Micro-Homepage buttons use.
//   • Beat 5: a scroll-revealed STICKY BUY BAR on every viewport
//     (SiteProductPurchase) — safe-area padded, both CTAs, same order logic.
//   • "Delivery & Pickup" is a dedicated data pane (SiteFulfillmentPane)
//     rendered from the validated shop facts, never invented copy.

// CACHED DATA, DYNAMIC SHELL: force-dynamic stays (owner-draft cookie gate +
// per-viewer redirect outcomes in requireSite). The product row and the site
// resolution are cached in siteData.ts under `site:{shopId}`; live stock truth
// comes from SiteProductPurchase's on-mount refresh + the atomic decrement RPC.
export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ slug: string; id: string }>;
};

// Ordered media list — Ad Studio video first, then the AI hero still, then
// the seller's original photography (Law 4: always their real pixels).
function buildGalleryMedia(product: SitePdpProduct): GalleryMedia[] {
  const media: GalleryMedia[] = [];
  const seen = new Set<string>();

  if (product.ad_video_url) {
    media.push({
      type: 'video',
      url: product.ad_video_url,
      poster: product.ad_hero_image_url ?? product.image_url,
    });
  }
  const stills = [product.ad_hero_image_url, ...(product.image_urls ?? []), product.image_url];
  for (const url of stills) {
    if (url && !seen.has(url)) {
      seen.add(url);
      media.push({ type: 'image', url });
    }
  }
  return media;
}

// Same ceiling as the chrome badges and the hero offer pill (LOW_STOCK_MAX).
function stockStatus(stock: number | null | undefined): { label: string; kind: 'in' | 'low' | 'out' } | null {
  if (stock == null) return null;
  if (stock <= 0) return { label: 'Sold Out', kind: 'out' };
  if (stock <= LOW_STOCK_MAX) return { label: `Only ${stock} left`, kind: 'low' };
  return { label: 'In Stock', kind: 'in' };
}

type PdpStyles = {
  section: string;
  breadcrumb: string;
  breadcrumbLink: string;
  breadcrumbCurrent: string;
  grid: string;
  galleryCol: string;
  infoCol: string;
  eyebrow: string;
  title: string;
  price: string;
  stock: Record<'in' | 'low' | 'out', string>;
  divider: string;
  description: string;
};

// Every ink/muted/accent literal below is the template's historical value,
// wrapped as a var() fallback so the theme cascade recolors the PDP exactly
// like the home page (FALLBACK LAW: themeless renders stay byte-stable).
const PDP_STYLES: Record<SiteTone, PdpStyles> = {
  ritual: {
    section: 'mx-auto max-w-7xl px-5 pb-16 pt-6 md:px-10 md:pb-24 md:pt-10',
    breadcrumb: 'flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--site-muted,oklch(70.9%_0.01_56.259))]',
    breadcrumbLink: 'transition hover:text-[var(--site-text,oklch(21.6%_0.006_56.043))]',
    breadcrumbCurrent: 'truncate text-[var(--site-text,oklch(21.6%_0.006_56.043))]',
    grid: 'mt-6 grid grid-cols-1 items-start gap-10 md:mt-10 md:grid-cols-12 md:gap-12 lg:gap-16',
    galleryCol: 'md:col-span-7',
    // Sticky under the h-20 sticky nav (top-24 = 96px clears it).
    infoCol: 'md:col-span-5 md:sticky md:top-24 md:self-start',
    eyebrow: 'text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(70.9%_0.01_56.259))]',
    title: 'mt-3 font-serif text-3xl font-bold leading-[1.1] tracking-tight text-[var(--site-text,oklch(21.6%_0.006_56.043))] md:text-4xl lg:text-5xl',
    price: 'text-2xl font-light tracking-tight text-[var(--site-text,oklch(21.6%_0.006_56.043))]',
    stock: {
      in: 'rounded-full border border-emerald-700/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800',
      low: 'rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200',
      out: 'rounded-full bg-[var(--site-text,#1c1917)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white',
    },
    divider: 'my-7 h-px w-16 bg-[var(--site-accent,#1c1917)]',
    description: 'max-w-md text-[15px] font-light leading-relaxed text-[var(--site-muted,oklch(44.4%_0.011_73.639))]',
  },
  editorial: {
    section: 'mx-auto max-w-7xl border-b border-neutral-900 px-5 pb-16 pt-6 md:px-10 md:pb-24 md:pt-10',
    breadcrumb: 'flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(70.8%_0_0))]',
    breadcrumbLink: 'transition hover:text-[var(--site-text,oklch(20.5%_0_0))]',
    breadcrumbCurrent: 'truncate text-[var(--site-text,oklch(20.5%_0_0))]',
    grid: 'mt-6 grid grid-cols-1 items-start gap-10 md:mt-10 md:grid-cols-12 md:gap-12 lg:gap-16',
    galleryCol: 'md:col-span-7',
    // The masthead is static, so the column only needs to clear the top edge.
    infoCol: 'md:col-span-5 md:sticky md:top-10 md:self-start',
    eyebrow: 'text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--site-accent,#1a2e1a)]',
    title: 'mt-3 font-serif text-3xl italic leading-[1.08] tracking-tight text-[var(--site-text,oklch(20.5%_0_0))] md:text-4xl lg:text-5xl',
    price: 'font-serif text-2xl italic text-[var(--site-text,oklch(20.5%_0_0))]',
    stock: {
      in: 'border border-neutral-900 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--site-text,oklch(20.5%_0_0))]',
      low: 'bg-[#F7F5F0] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-amber-800 ring-1 ring-neutral-900',
      out: 'bg-neutral-900 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white',
    },
    divider: 'my-7 h-px w-20 bg-[var(--site-text,#171717)]',
    description: 'max-w-md text-[15px] leading-relaxed text-[var(--site-muted,oklch(43.9%_0_0))]',
  },
  neutral: {
    section: 'mx-auto max-w-7xl px-5 pb-16 pt-6 md:px-10 md:pb-24 md:pt-10',
    breadcrumb: 'flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-white/40',
    breadcrumbLink: 'transition hover:text-[var(--site-text,#ffffff)]',
    breadcrumbCurrent: 'truncate text-[var(--site-text,#ffffff)]',
    grid: 'mt-6 grid grid-cols-1 items-start gap-10 md:mt-10 md:grid-cols-12 md:gap-12 lg:gap-16',
    galleryCol: 'md:col-span-7',
    infoCol: 'md:col-span-5 md:sticky md:top-24 md:self-start',
    eyebrow: 'text-[10px] font-black uppercase tracking-[0.25em] text-[var(--site-accent,#f0a500)]',
    title: 'mt-3 text-3xl font-black uppercase leading-tight tracking-tighter text-[var(--site-text,#ffffff)] md:text-4xl lg:text-5xl',
    price: 'text-2xl font-black text-[var(--site-accent,#f0a500)]',
    stock: {
      in: 'rounded-sm border border-white/25 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white/80',
      low: 'rounded-sm bg-[var(--site-accent,#f0a500)] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-black',
      out: 'rounded-sm bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-black',
    },
    divider: 'my-7 h-px w-16 bg-white/15',
    description: 'max-w-md text-[15px] leading-relaxed text-white/70',
  },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, id } = await params;
  const data = await loadSite(slug);
  if (!data?.website) return { title: 'Sanndikaa Boutique' };

  const parsed = WebsiteConfigSchema.safeParse(data.website.config);
  if (!parsed.success) return { title: data.shop.shop_name ?? 'Sanndikaa Boutique' };

  const product = await loadSiteProduct(id, data.shop.id);
  // Never leak a foreign product's name into this site's metadata — the page
  // body redirects those requests to the site's collections.
  if (!product || !productBelongsToShop(product, data.shop.id)) {
    return {
      title: parsed.data.site.seo.title,
      description: parsed.data.site.seo.description,
      ...(data.isOwnerPreview ? { robots: { index: false, follow: false } } : {}),
    };
  }

  const ogImage = product.ad_hero_image_url ?? product.image_url;
  return {
    title: `${product.name} — ${parsed.data.site.seo.title}`,
    description: product.description?.trim()
      ? product.description.trim().slice(0, 170)
      : parsed.data.site.seo.description,
    ...(ogImage ? { openGraph: { images: [{ url: ogImage }] } } : {}),
    ...(data.isOwnerPreview ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function SiteProductPage({ params }: PageProps) {
  const { slug, id } = await params;
  const cleanId = sanitizeProductId(id);
  const route: SiteRoute = `product:${cleanId || 'invalid'}`;

  const site = await requireSite(slug, route);

  // requireSite resolved this shop BY slug, so canonical paths always exist
  // here; the slug-derived fallbacks are belt-and-suspenders only.
  const basePath = siteBasePath(site.shop) ?? `/site/${slug}`;
  const collectionsPath = siteCollectionsPath(site.shop) ?? `/site/${slug}/collections`;

  const product = cleanId ? await loadSiteProduct(cleanId, site.shop.id) : null;
  if (!product || !productBelongsToShop(product, site.shop.id)) {
    console.log(`[site-route] slug=${slug} route=${route} product=${product ? 'foreign' : 'miss'} → redirect:collections`);
    redirect(collectionsPath);
  }

  const entry = SITE_CHROMES[site.config.template_key] ?? SITE_CHROMES.vitality;
  const { Chrome, tone } = entry;
  const s = PDP_STYLES[tone];

  const media = buildGalleryMedia(product);
  const stock = stockStatus(product.stock_quantity);
  const description = product.description?.trim() || null;
  const priceLabel = product.price == null ? 'Price on request' : `D${Number(product.price).toLocaleString()}`;

  // Cascade gap (Pillar 4): mirror the theme onto document.documentElement so
  // the root-layout Cart drawer wears the boutique tokens on the PDP — the
  // page where the cart is opened most.
  const themeVars = siteThemeVars(site.config);

  return (
    <>
      {themeVars && <SiteThemeCascade vars={themeVars} />}
      {site.isDraftPreview && <SiteDraftBadge />}
      <Chrome shop={site.shop} config={site.config} active="product">
        <section className={s.section}>
          {/* Breadcrumb — every step stays on the branded site */}
          <nav aria-label="Breadcrumb" className={s.breadcrumb}>
            <Link href={basePath} className={s.breadcrumbLink}>Home</Link>
            <span aria-hidden>/</span>
            <Link href={collectionsPath} className={s.breadcrumbLink}>Collection</Link>
            <span aria-hidden>/</span>
            <span aria-current="page" className={s.breadcrumbCurrent}>{product.name}</span>
          </nav>

          <div className={s.grid}>
            <div className={s.galleryCol}>
              <SiteProductGallery name={product.name} media={media} tone={tone} />
            </div>

            <div className={s.infoCol}>
              {product.category && <p className={s.eyebrow}>{product.category}</p>}
              <h1 className={s.title}>{product.name}</h1>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <p className={s.price}>{priceLabel}</p>
                {stock && <span className={s.stock[stock.kind]}>{stock.label}</span>}
              </div>

              {description && (
                <>
                  <div className={s.divider} />
                  <p className={s.description}>{description}</p>
                </>
              )}

              <div className="mt-9">
                <SiteProductPurchase
                  product={{
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image_url: product.image_url,
                    stock_quantity: product.stock_quantity ?? null,
                    colors: product.colors,
                    sizes: product.sizes,
                    sellerId: product.user_id,
                  }}
                  shopId={site.shop.id}
                  shopName={site.shop.shop_name ?? 'Boutique'}
                  shopPhone={site.shop.phone ?? null}
                  tone={tone}
                />
              </div>

              {/* Delivery & Pickup — the validated shop facts as a data pane. */}
              <div className="mt-10">
                <SiteFulfillmentPane shop={site.shop} productName={product.name} tone={tone} />
              </div>
            </div>
          </div>
        </section>
      </Chrome>
    </>
  );
}
