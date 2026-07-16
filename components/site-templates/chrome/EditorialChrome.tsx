import Link from 'next/link';
import {
  findBlock,
  resolveBlocks,
  siteBasePath,
  siteCollectionsPath,
  siteProductPath,
  type SiteChromeProps,
  type SiteProduct,
} from '@/lib/siteTemplates';
import EditableText from '../EditableText';

// EDITORIAL (template_key 'editorial') chrome — the serif masthead and dark
// sign-off footer every /site page of an editorial shop shares (home,
// collections, product detail). Extracted verbatim from EditorialTemplate;
// only link targets changed for the omnichannel router: primary journeys stay
// on /site, and the single deliberate /shop escape is the subtle "View
// classic boutique" footer link.

export function editorialPrice(p: number | null) {
  return p == null ? '' : `D${Number(p).toLocaleString()}`;
}

// Stock is optional/additive: undefined (not loaded) renders nothing, so every
// legacy caller keeps its exact output. 0 = sold out, 1-5 = urgency badge.
export function editorialStockBadge(stock: number | null | undefined): { label: string; tone: 'out' | 'low' } | null {
  if (stock == null) return null;
  if (stock <= 0) return { label: 'Sold Out', tone: 'out' };
  if (stock <= 5) return { label: `Only ${stock} left`, tone: 'low' };
  return null;
}

// Deterministic gradient plates replace missing photography (Law 4: real
// product pixels when they exist, a neutral printed material when not).
const FALLBACK_PLATES = [
  'bg-gradient-to-br from-neutral-200 via-[#EDEAE2] to-neutral-300',
  'bg-gradient-to-br from-[#E4E0D6] via-neutral-100 to-[#D8D3C7]',
  'bg-gradient-to-br from-neutral-300 via-[#EFEBE3] to-neutral-200',
  'bg-gradient-to-br from-[#DDD8CC] via-white to-neutral-200',
];

export function EditorialProductPlate({ src, alt, index }: { src: string | null; alt: string; index: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
      />
    );
  }
  return (
    <div className={`flex h-full w-full items-center justify-center ${FALLBACK_PLATES[index % FALLBACK_PLATES.length]}`}>
      <span className="font-serif text-4xl italic text-neutral-400/60">{alt.charAt(0).toUpperCase()}</span>
    </div>
  );
}

// The dense hairline grid the Editorial home page and collections page share.
export const EDITORIAL_COLLECTION_GRID =
  'grid grid-cols-2 gap-px border-t border-neutral-900 bg-neutral-900 md:grid-cols-4';

/** One plate of the hairline grid — shared by home and /collections. */
export function EditorialProductCard({ product, index, href }: { product: SiteProduct; index: number; href: string }) {
  const badge = editorialStockBadge(product.stock_quantity);
  return (
    <Link href={href} className="group block bg-[#F7F5F0]">
      <div className="relative aspect-square overflow-hidden">
        <EditorialProductPlate src={product.ad_hero_image_url ?? product.image_url} alt={product.name} index={index} />
        {badge && (
          <span className={`absolute right-2 top-2 z-10 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.2em] ${
            badge.tone === 'out' ? 'bg-neutral-900 text-white' : 'bg-[#F7F5F0]/95 text-amber-800'
          }`}>
            {badge.label}
          </span>
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-neutral-900/80 px-3 text-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <p className="font-serif text-lg italic leading-snug text-white md:text-xl">{product.name}</p>
          <p className="text-xs text-white/70">{editorialPrice(product.price)}</p>
          <span className="mt-2 text-[9px] font-bold uppercase tracking-[0.3em] text-white underline underline-offset-4">View</span>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2 border-t border-neutral-900 px-3 py-2.5">
        <p className="truncate font-serif text-sm italic">{product.name}</p>
        <p className="shrink-0 text-[11px] text-neutral-500">{editorialPrice(product.price)}</p>
      </div>
    </Link>
  );
}

/** Internal PDP href with an honest fallback for slugless previews. */
export function editorialProductHref(shop: SiteChromeProps['shop'], productId: string): string {
  return siteProductPath(shop, productId) ?? `/product/${productId}`;
}

export default function EditorialChrome({ shop, config, active, children }: SiteChromeProps) {
  const { site } = config;
  // Block-driven copy (Phase 3): the hairline top bar wears the hero block's
  // tagline and the dark sign-off spread is the cta_banner block's design
  // slot. The site.* mirror keeps both identical for legacy rows, and any
  // block array missing a type falls back to the mirror.
  const blocks = resolveBlocks(config);
  const heroBlock = findBlock(blocks, 'hero_banner');
  const ctaBlock = findBlock(blocks, 'cta_banner');
  const tagline = heroBlock?.tagline ?? site.tagline;
  const cta = ctaBlock ?? site.cta_banner;
  const base = siteBasePath(shop);
  const collectionsHref = siteCollectionsPath(shop) ?? '#collection';
  // Deliberate classic-boutique escape (footer only). /shop matches the RAW
  // stored slug, so encode it as-is — lowercasing a legacy value would 404.
  const shopUrl = shop.shop_slug ? `/shop/${encodeURIComponent(shop.shop_slug)}` : '/';

  // Section anchors live on the home page; from sub-pages they route home
  // first. Slugless previews always render the home layout, so bare hashes
  // remain correct there.
  const homeAnchor = (hash: string) => (active === 'home' || !base ? hash : `${base}${hash}`);

  const navLink = (isActive: boolean) =>
    `text-[9px] font-bold uppercase tracking-[0.3em] transition hover:text-neutral-900 md:text-[10px] ${
      isActive ? 'text-neutral-900' : 'text-neutral-500'
    }`;

  const fulfillment: string[] = [];
  if (shop.offers_delivery) fulfillment.push('Local delivery available');
  if (shop.offers_pickup) fulfillment.push('In-person pickup available');
  if (fulfillment.length === 0) fulfillment.push('Fulfillment arranged when you order');

  return (
    <div className="min-h-screen bg-[#F7F5F0] font-sans text-neutral-900">

      {/* Masthead */}
      <header className="border-b border-neutral-900">
        <div className="flex items-center justify-between gap-4 border-b border-neutral-300 px-5 py-2.5 md:px-10">
          {heroBlock ? (
            <EditableText
              as="p"
              blockId={heroBlock.id}
              field="tagline"
              className="truncate text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-500"
            >
              {tagline}
            </EditableText>
          ) : (
            <p className="truncate text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-500">{tagline}</p>
          )}
          <Link href={collectionsHref} className="shrink-0 text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-900 underline underline-offset-4 transition hover:text-[#1a2e1a]">
            Shop The Collection
          </Link>
        </div>
        <div className="px-5 py-7 text-center md:py-11">
          <Link href={base ?? '#'} className="font-serif text-4xl font-black uppercase tracking-tight md:text-7xl">
            {shop.shop_name}
          </Link>
        </div>
        <nav className="flex items-center justify-center gap-7 border-t border-neutral-300 px-5 py-3 md:gap-12">
          <a href={homeAnchor('#features')} className={navLink(false)}>Features</a>
          <Link href={collectionsHref} className={navLink(active === 'collections')}>The Collection</Link>
          <a href={homeAnchor('#story')} className={navLink(false)}>Story</a>
        </nav>
      </header>

      {children}

      {/* Dark serif sign-off footer — CTA folded into the closing spread.
          This is the cta_banner block's fixed design slot in the Editorial
          anatomy (the templates' body never renders it). */}
      <footer className="bg-[#141414] text-[#F7F5F0]">
        <div className="mx-auto max-w-7xl px-5 py-20 text-center md:px-10 md:py-28">
          {ctaBlock ? (
            <>
              <EditableText as="h2" blockId={ctaBlock.id} field="headline" className="font-serif text-4xl italic leading-tight md:text-6xl">
                {cta.headline}
              </EditableText>
              <EditableText as="p" blockId={ctaBlock.id} field="subtext" className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-white/60 md:text-base">
                {cta.subtext}
              </EditableText>
              <Link
                href={collectionsHref}
                data-block-id={ctaBlock.id}
                data-block-field="button_label"
                className="mt-10 inline-block bg-[#F7F5F0] px-10 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-900 transition hover:bg-white active:scale-95"
              >
                {cta.button_label}
              </Link>
            </>
          ) : (
            <>
              <h2 className="font-serif text-4xl italic leading-tight md:text-6xl">{cta.headline}</h2>
              <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-white/60 md:text-base">{cta.subtext}</p>
              <Link
                href={collectionsHref}
                className="mt-10 inline-block bg-[#F7F5F0] px-10 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-900 transition hover:bg-white active:scale-95"
              >
                {cta.button_label}
              </Link>
            </>
          )}
        </div>

        <div className="border-t border-white/15">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 md:flex-row md:items-end md:justify-between md:px-10 md:py-12">
            <p className="font-serif text-3xl font-black uppercase tracking-tight md:text-5xl">{shop.shop_name}</p>
            <div className="flex flex-col gap-2 md:items-end md:text-right">
              {fulfillment.map((line) => (
                <p key={line} className="text-xs text-white/50">{line}</p>
              ))}
              <Link href={shopUrl} className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50 underline underline-offset-4 transition hover:text-white">
                View classic boutique
              </Link>
              <p className="mt-1 text-[9px] uppercase tracking-widest text-white/30">Site generated by Sanndikaa AI</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
