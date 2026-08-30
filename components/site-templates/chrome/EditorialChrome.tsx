import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import {
  findBlock,
  resolveVisibleBlocks,
  siteBasePath,
  siteCollectionsPath,
  siteProductPath,
  type SiteChromeProps,
  type SiteProduct,
} from '@/lib/siteTemplates';
import { siteThemeStyle } from '@/lib/siteTheme';
import CartBagButton from '../CartBagButton';
import EditableText from '../EditableText';
import SiteSearch from '../SiteSearch';

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

export function EditorialProductPlate({ src, alt, index, sizes }: {
  src: string | null;
  alt: string;
  index: number;
  /** Slot-tuned sizes; defaults to the hairline 2/4-column grid breakpoints. */
  sizes?: string;
}) {
  if (src) {
    return (
      <SmartImage
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? '(min-width: 768px) 25vw, 50vw'}
        className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
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

/**
 * Paper-colored cells that complete the hairline grid's last row. The grid
 * paints its neutral-900 background through the gap-px gutters to draw the
 * hairlines — but a partial last row would expose that same background as
 * card-sized black voids. These blank plates fill the remainder for ANY item
 * count at BOTH breakpoints: the grid is 2-col mobile / 4-col desktop, so we
 * render desktopNeed = (4 - n % 4) % 4 fillers and show only the first
 * mobileNeed = (2 - n % 2) % 2 of them below md (parity guarantees
 * mobileNeed <= desktopNeed, and desktopNeed = 0 implies mobileNeed = 0).
 * Render alongside the product cards inside EDITORIAL_COLLECTION_GRID.
 */
export function EditorialGridFillers({ itemCount }: { itemCount: number }) {
  const desktopNeed = (4 - (itemCount % 4)) % 4;
  const mobileNeed = (2 - (itemCount % 2)) % 2;
  if (desktopNeed === 0) return null;
  return (
    <>
      {Array.from({ length: desktopNeed }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className={`bg-[var(--site-bg,#F7F5F0)] ${i < mobileNeed ? '' : 'hidden md:block'}`}
        />
      ))}
    </>
  );
}

/** One plate of the hairline grid — shared by home and /collections. */
export function EditorialProductCard({ product, index, href }: { product: SiteProduct; index: number; href: string }) {
  const badge = editorialStockBadge(product.stock_quantity);
  return (
    <Link href={href} className="group block bg-[var(--site-bg,#F7F5F0)]">
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
        <p className="shrink-0 text-[11px] text-[var(--site-muted,oklch(55.6%_0_0))]">{editorialPrice(product.price)}</p>
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
  // Item 2: hidden blocks are invisible to chrome copy reads — a hidden
  // hero/cta demotes its slot to the static site.* mirror fallback (the
  // masthead and the sign-off spread are chrome anatomy and always close
  // the page; only their BLOCK affordances — edit targeting — disappear).
  const blocks = resolveVisibleBlocks(config);
  const heroBlock = findBlock(blocks, 'hero_banner');
  const ctaBlock = findBlock(blocks, 'cta_banner');
  const tagline = heroBlock?.tagline ?? site.tagline;
  const cta = ctaBlock ?? site.cta_banner;
  const base = siteBasePath(shop);
  const collectionsHref = siteCollectionsPath(shop) ?? '#collection';
  // Deliberate classic-boutique escape (footer only). /shop matches the RAW
  // stored slug, so encode it as-is — lowercasing a legacy value would 404.
  // ?classic=1: the Pillar-1 /shop server bridge 307s published-site shops
  // back to /site — this param is the escape's documented bypass.
  const shopUrl = shop.shop_slug ? `/shop/${encodeURIComponent(shop.shop_slug)}?classic=1` : '/';

  // Section anchors live on the home page; from sub-pages they route home
  // first. Slugless previews always render the home layout, so bare hashes
  // remain correct there.
  const homeAnchor = (hash: string) => (active === 'home' || !base ? hash : `${base}${hash}`);

  // ≥44px tap targets: the anchor itself carries the interactive box
  // (min-h-11 + centering) — the container's padding is not a tap area.
  const navLink = (isActive: boolean) =>
    `inline-flex min-h-11 items-center text-[9px] font-bold uppercase tracking-[0.3em] transition hover:text-[var(--site-text,oklch(20.5%_0_0))] md:text-[10px] ${
      isActive ? 'text-[var(--site-text,oklch(20.5%_0_0))]' : 'text-[var(--site-muted,oklch(55.6%_0_0))]'
    }`;

  const fulfillment: string[] = [];
  if (shop.offers_delivery) fulfillment.push('Local delivery available');
  if (shop.offers_pickup) fulfillment.push('In-person pickup available');
  if (fulfillment.length === 0) fulfillment.push('Fulfillment arranged when you order');

  return (
    // THEME SEAM: a themed config sets --site-accent/--site-serif here (the
    // one root every editorial /site page shares); absent theme → no style
    // attribute, and every var() fallback keeps the deep-green defaults.
    <div className="min-h-screen bg-[var(--site-bg,#F7F5F0)] font-sans text-[var(--site-text,oklch(20.5%_0_0))]" style={siteThemeStyle(config)}>

      {/* Masthead */}
      <header className="border-b border-neutral-900">
        <div className="flex items-center justify-between gap-4 border-b border-neutral-300 px-5 py-2.5 md:px-10">
          {heroBlock ? (
            <EditableText
              as="p"
              blockId={heroBlock.id}
              field="tagline"
              className="truncate text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(55.6%_0_0))]"
            >
              {tagline}
            </EditableText>
          ) : (
            <p className="truncate text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(55.6%_0_0))]">{tagline}</p>
          )}
          <div className="flex shrink-0 items-center gap-3 md:gap-4">
            <Link href={collectionsHref} className="inline-flex min-h-11 shrink-0 items-center text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--site-text,oklch(20.5%_0_0))] underline underline-offset-4 transition hover:text-[var(--site-accent,#1a2e1a)]">
              Shop The Collection
            </Link>
            {/* Client islands: shop-scoped search + live cart trigger in the
                utility bar — hairline squares that sit with the masthead's
                print rules. */}
            <SiteSearch tone="editorial" shopId={shop.id} basePath={base} shopName={shop.shop_name} />
            <CartBagButton tone="editorial" />
          </div>
        </div>
        <div className="px-5 py-7 text-center md:py-11">
          {/* Additive logo mark (Premium Visual Editor): renders ONLY when a
              generated/uploaded site logo exists — legacy rows keep the pure
              serif wordmark byte-identically. */}
          {config.assets?.logo_url && (
            <div className="mb-4 flex justify-center">
              <SmartImage
                src={config.assets.logo_url}
                alt={shop.shop_name ?? 'Logo'}
                width={56}
                height={56}
                blurTone="none"
                className="h-12 w-12 rounded-full object-cover ring-1 ring-neutral-300 md:h-14 md:w-14"
              />
            </div>
          )}
          {/* Quiet-luxury type cap (Beta QA pass): md:text-7xl → md:text-6xl,
              mobile 4xl → 3xl — long shop names stay one confident line at
              360px instead of a shouting wrap. */}
          <Link href={base ?? '#'} className="inline-block py-1 font-serif text-3xl font-black uppercase tracking-tight md:text-6xl">
            {shop.shop_name}
          </Link>
        </div>
        {/* py moved off the container onto the min-h-11 anchors (navLink) so
            the tap boxes themselves are ≥44px. */}
        <nav className="flex items-center justify-center gap-7 border-t border-neutral-300 px-5 md:gap-12">
          <a href={homeAnchor('#features')} className={navLink(false)}>Features</a>
          <Link href={collectionsHref} className={navLink(active === 'collections')}>The Collection</Link>
          <a href={homeAnchor('#story')} className={navLink(false)}>Story</a>
        </nav>
      </header>

      {children}

      {/* Dark serif sign-off footer — CTA folded into the closing spread.
          This is the cta_banner block's fixed design slot in the Editorial
          anatomy (the templates' body never renders it). */}
      {/* --site-primary (Pillar 4): the dark sign-off spread rides the primary token. */}
      <footer className="bg-[var(--site-primary,#141414)] text-[#F7F5F0]">
        {/* data-block-section: inert marker for the Site Editor's section
            focus (the cta_banner block's fixed design slot lives here). */}
        <div
          data-block-section={ctaBlock?.id}
          className="mx-auto max-w-7xl px-5 py-20 text-center md:px-10 md:py-28"
        >
          {ctaBlock ? (
            <>
              <EditableText as="h2" blockId={ctaBlock.id} field="headline" className="font-serif text-4xl italic leading-tight md:text-6xl">
                {cta.headline}
              </EditableText>
              <EditableText as="p" blockId={ctaBlock.id} field="subtext" className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-white/60 md:text-base">
                {cta.subtext}
              </EditableText>
              {/* Accent cohesion (Fix 6): the sign-off CTA label rides
                  --site-accent. Fallback #171717 IS neutral-900 — theme-less
                  rendering stays byte-identical. */}
              <Link
                href={collectionsHref}
                data-block-id={ctaBlock.id}
                data-block-field="button_label"
                className="mt-10 inline-block rounded-[var(--site-radius,0px)] bg-[var(--site-bg,#F7F5F0)] px-10 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-accent,#171717)] transition hover:bg-white active:scale-95"
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
                className="mt-10 inline-block rounded-[var(--site-radius,0px)] bg-[var(--site-bg,#F7F5F0)] px-10 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-accent,#171717)] transition hover:bg-white active:scale-95"
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
              <Link href={shopUrl} className="inline-flex min-h-11 items-center text-[10px] font-bold uppercase tracking-[0.25em] text-white/50 underline underline-offset-4 transition hover:text-white">
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
