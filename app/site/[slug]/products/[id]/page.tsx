import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { SITE_CHROMES, type SiteTone } from '@/components/site-templates/chrome';
import {
  WebsiteConfigSchema,
  siteBasePath,
  siteCollectionsPath,
  type SiteShop,
} from '@/lib/siteTemplates';
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
import SiteProductGallery, { type GalleryMedia } from './SiteProductGallery';
import SiteProductPurchase from './SiteProductPurchase';

// /site/[slug]/products/[id] — the on-site Product Detail Page. Gallery,
// price, stock, quantity, and the REAL checkout (shared cart drawer + direct
// WhatsApp order via lib/orderFlow) inside the seller's premium chrome — the
// buyer completes the purchase without ever leaving the branded site.
// Ownership gate: a product that does not belong to this shop redirects to
// the site's own collections page (never render another seller's product).

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

function stockStatus(stock: number | null | undefined): { label: string; kind: 'in' | 'low' | 'out' } | null {
  if (stock == null) return null;
  if (stock <= 0) return { label: 'Sold Out', kind: 'out' };
  if (stock <= 5) return { label: `Only ${stock} left`, kind: 'low' };
  return { label: 'In Stock', kind: 'in' };
}

type PdpStyles = {
  section: string;
  breadcrumb: string;
  breadcrumbLink: string;
  breadcrumbCurrent: string;
  grid: string;
  eyebrow: string;
  title: string;
  price: string;
  stock: Record<'in' | 'low' | 'out', string>;
  divider: string;
  description: string;
  factsLabel: string;
  factLine: string;
  factNote: string;
};

const PDP_STYLES: Record<SiteTone, PdpStyles> = {
  ritual: {
    section: 'mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-16',
    breadcrumb: 'flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-stone-400',
    breadcrumbLink: 'transition hover:text-stone-900',
    breadcrumbCurrent: 'truncate text-stone-900',
    grid: 'mt-8 grid grid-cols-1 items-start gap-10 md:mt-12 md:grid-cols-2 md:gap-16',
    eyebrow: 'text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400',
    title: 'mt-3 font-serif text-3xl font-bold leading-tight tracking-tight text-stone-900 md:text-5xl',
    price: 'text-2xl font-light text-stone-900',
    stock: {
      in: 'rounded-full border border-emerald-700/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800',
      low: 'rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200',
      out: 'rounded-full bg-stone-900 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white',
    },
    divider: 'my-7 h-px w-16 bg-stone-300',
    description: 'max-w-md text-base font-light leading-relaxed text-stone-600',
    factsLabel: 'text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400',
    factLine: 'text-sm text-stone-600',
    factNote: 'text-xs leading-relaxed text-stone-400',
  },
  editorial: {
    section: 'mx-auto max-w-7xl border-b border-neutral-900 px-5 py-10 md:px-10 md:py-16',
    breadcrumb: 'flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-400',
    breadcrumbLink: 'transition hover:text-neutral-900',
    breadcrumbCurrent: 'truncate text-neutral-900',
    grid: 'mt-8 grid grid-cols-1 items-start gap-10 md:mt-12 md:grid-cols-2 md:gap-16',
    eyebrow: 'text-[10px] font-bold uppercase tracking-[0.35em] text-[#1a2e1a]',
    title: 'mt-3 font-serif text-3xl italic leading-[1.08] tracking-tight text-neutral-900 md:text-5xl',
    price: 'font-serif text-2xl italic text-neutral-900',
    stock: {
      in: 'border border-neutral-900 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-900',
      low: 'bg-[#F7F5F0] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-amber-800 ring-1 ring-neutral-900',
      out: 'bg-neutral-900 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white',
    },
    divider: 'my-7 h-px w-20 bg-neutral-900',
    description: 'max-w-md text-base leading-relaxed text-neutral-600',
    factsLabel: 'text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400',
    factLine: 'text-sm text-neutral-600',
    factNote: 'text-xs leading-relaxed text-neutral-400',
  },
  neutral: {
    section: 'mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-16',
    breadcrumb: 'flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-white/40',
    breadcrumbLink: 'transition hover:text-white',
    breadcrumbCurrent: 'truncate text-white',
    grid: 'mt-8 grid grid-cols-1 items-start gap-10 md:mt-12 md:grid-cols-2 md:gap-16',
    eyebrow: 'text-[10px] font-black uppercase tracking-[0.25em] text-[#f0a500]',
    title: 'mt-3 text-3xl font-black uppercase leading-tight tracking-tighter text-white md:text-5xl',
    price: 'text-2xl font-black text-[#f0a500]',
    stock: {
      in: 'rounded-sm border border-white/25 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white/80',
      low: 'rounded-sm bg-[#f0a500] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-black',
      out: 'rounded-sm bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-black',
    },
    divider: 'my-7 h-px w-16 bg-white/15',
    description: 'max-w-md text-base leading-relaxed text-white/70',
    factsLabel: 'text-[10px] font-black uppercase tracking-[0.25em] text-white/50',
    factLine: 'text-sm text-white/70',
    factNote: 'text-xs leading-relaxed text-white/40',
  },
};

function fulfillmentFacts(shop: SiteShop): { lines: string[]; note: string | null } {
  const lines: string[] = [];
  if (shop.offers_delivery) lines.push('Local delivery available');
  if (shop.offers_pickup) lines.push('In-person pickup available');
  if (lines.length === 0) lines.push('Fulfillment arranged when you order');
  const note = shop.offers_pickup && shop.pickup_instructions?.trim()
    ? shop.pickup_instructions.trim().slice(0, 140)
    : null;
  return { lines, note };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, id } = await params;
  const data = await loadSite(slug);
  if (!data?.website) return { title: 'Sanndikaa Boutique' };

  const parsed = WebsiteConfigSchema.safeParse(data.website.config);
  if (!parsed.success) return { title: data.shop.shop_name ?? 'Sanndikaa Boutique' };

  const product = await loadSiteProduct(id);
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

  const product = cleanId ? await loadSiteProduct(cleanId) : null;
  if (!product || !productBelongsToShop(product, site.shop.id)) {
    console.log(`[site-route] slug=${slug} route=${route} product=${product ? 'foreign' : 'miss'} → redirect:collections`);
    redirect(collectionsPath);
  }

  const entry = SITE_CHROMES[site.config.template_key] ?? SITE_CHROMES.vitality;
  const { Chrome, tone } = entry;
  const s = PDP_STYLES[tone];

  const media = buildGalleryMedia(product);
  const stock = stockStatus(product.stock_quantity);
  const facts = fulfillmentFacts(site.shop);
  const description = product.description?.trim() || null;
  const priceLabel = product.price == null ? 'Price on request' : `D${Number(product.price).toLocaleString()}`;

  return (
    <>
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
            <SiteProductGallery name={product.name} media={media} tone={tone} />

            <div>
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

              <div className="mt-10">
                <p className={s.factsLabel}>Delivery & Pickup</p>
                <div className="mt-3 flex flex-col gap-1.5">
                  {facts.lines.map((line) => (
                    <p key={line} className={s.factLine}>{line}</p>
                  ))}
                  {facts.note && <p className={s.factNote}>{facts.note}</p>}
                </div>
              </div>
            </div>
          </div>
        </section>
      </Chrome>
    </>
  );
}
