import Link from 'next/link';
import { SaleBadge } from '@/components/SaleBadge';
import SmartImage from '@/components/SmartImage';
import {
  LOW_STOCK_MAX,
  findBlock,
  resolveVisibleBlocks,
  resolveLogoUrl,
  secondaryProductImage,
  siteBasePath,
  siteCollectionsPath,
  siteProductPath,
  type SiteChromeProps,
  type SiteProduct,
} from '@/lib/siteTemplates';
import { buildWhatsAppLink } from '@/lib/orderFlow';
import { saleOf } from '@/lib/pricing';
import { siteThemeStyle } from '@/lib/siteTheme';
import CartBagButton from '../CartBagButton';
import EditableText from '../EditableText';
import ProductCardXfade from '../ProductCardXfade';
import SiteSearch from '../SiteSearch';

// MINIMAL (template_key 'ritual') chrome — the sticky logo nav and structured
// footer every /site page of a ritual shop shares (home, collections, product
// detail). Extracted verbatim from RitualTemplate so the buyer experiences ONE
// continuous branded site; only the link targets changed for the omnichannel
// router: primary journeys stay on /site, and the single deliberate /shop
// escape is the subtle "View classic boutique" footer link.

export function ritualPrice(p: number | null) {
  return p == null ? '' : `D${Number(p).toLocaleString()}`;
}

// Pass 3 — palette-safe structure tokens. The deep-luxury archetype pairs
// this template with a near-black paper (#12100d), where the historical
// `border-stone-200` / `bg-white` surfaces vanished or glared. Both tokens
// derive from the live --site-text / --site-bg pair, so the themeless cream
// site keeps its quiet stone hairlines and the dark palette gets the same
// relationships inverted. Shared by the template, the chrome and the PDP.
/** Hairline rule: 12% ink over transparent. */
export const RITUAL_HAIRLINE = 'border-[color-mix(in_srgb,var(--site-text,#1c1917)_12%,transparent)]';
/** Section band: paper tinted 6% toward ink (the story/testimonial strips). */
export const RITUAL_BAND = 'bg-[color-mix(in_srgb,var(--site-bg,#FBFAF7)_94%,var(--site-text,#1c1917))]';
/** Raised surface: paper tinted 3% toward ink (cards, pills, panes). */
export const RITUAL_SURFACE = 'bg-[color-mix(in_srgb,var(--site-bg,#FBFAF7)_97%,var(--site-text,#1c1917))]';

// Stock is optional/additive: undefined (not loaded) renders nothing, so every
// legacy caller keeps its exact output. 0 = sold out, 1..LOW_STOCK_MAX =
// urgency badge (the same ceiling the hero offer pill uses).
export function ritualStockBadge(stock: number | null | undefined): { label: string; tone: 'out' | 'low' } | null {
  if (stock == null) return null;
  if (stock <= 0) return { label: 'Sold Out', tone: 'out' };
  if (stock <= LOW_STOCK_MAX) return { label: `Only ${stock} left`, tone: 'low' };
  return null;
}

// Deterministic gradient blocks stand in for missing product photography —
// never an external placeholder URL, never a broken frame (Law 4: we present
// the seller's real pixels when they exist, and a neutral material when not).
const FALLBACK_TILES = [
  'bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300',
  'bg-gradient-to-br from-[#EAE4DA] via-stone-100 to-stone-200',
  'bg-gradient-to-br from-stone-300 via-stone-200 to-[#EFEAE2]',
  'bg-gradient-to-br from-[#E7E2D8] via-white to-stone-200',
];

/** Responsive `sizes` for a card in the shared 2/3/4-column grid. */
export const RITUAL_CARD_SIZES = '(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw';

export function RitualProductVisual({ src, alt, index, sizes }: {
  src: string | null;
  alt: string;
  index: number;
  /** Slot-tuned sizes; defaults to the shared 2/3/4-column grid breakpoints. */
  sizes?: string;
}) {
  if (src) {
    return (
      <SmartImage
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? RITUAL_CARD_SIZES}
        className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
      />
    );
  }
  return (
    <div className={`flex h-full w-full items-center justify-center ${FALLBACK_TILES[index % FALLBACK_TILES.length]}`}>
      <span className="font-serif text-3xl italic text-stone-400/70">{alt.charAt(0).toUpperCase()}</span>
    </div>
  );
}

// The airy grid the Minimal home page and collections page both compose.
export const RITUAL_COLLECTION_GRID =
  'grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 md:gap-x-8 md:gap-y-16 lg:grid-cols-4';

/**
 * One product card of the airy grid — shared by home and /collections.
 *
 * Micro-Homepage anatomy: the root is an <article> carrying a STRETCHED
 * <Link> (absolute inset-0, z-10) rather than a <Link> root — the hover state
 * must live on an ancestor of BOTH image layers, and the cross-fade toggle
 * must be a sibling of the anchor (a button inside a link is invalid HTML).
 * Cards with a DISTINCT second photo (secondaryProductImage) mount the
 * ProductCardXfade island plus the alt image layer; single-photo cards —
 * every /collections card, whose select omits image_urls — render the plain
 * server article: identical visuals, zero JavaScript. No data-block-* attrs
 * are added here (the grid SECTION owns editor targeting).
 */
export function RitualProductCard({ product, index, href, sizes }: {
  product: SiteProduct;
  index: number;
  href: string;
  /** Slot-tuned sizes; defaults to the shared grid breakpoints. */
  sizes?: string;
}) {
  const badge = ritualStockBadge(product.stock_quantity);
  // Compare-at sale (lib/pricing.ts): strictly compare_at_price > price.
  const sale = saleOf(product.price, product.compare_at_price);
  const altSrc = secondaryProductImage(product);
  const imgSizes = sizes ?? RITUAL_CARD_SIZES;
  const inner = (
    <>
      <Link href={href} className="absolute inset-0 z-10 rounded-2xl">
        <span className="sr-only">{product.name}</span>
      </Link>
      <div className={`relative aspect-[3/4] overflow-hidden rounded-2xl ${RITUAL_SURFACE}`}>
        <RitualProductVisual src={product.ad_hero_image_url ?? product.image_url} alt={product.name} index={index} sizes={imgSizes} />
        {altSrc && (
          // Second photo — revealed by hover (pointer devices) or the toggle
          // (globals.css .sndk-xfade). z-[1] pins it ABOVE the primary image
          // (ProductCardXfade layer contract); mirrors the primary's zoom so
          // the two layers never drift apart mid-fade.
          <div aria-hidden className="sndk-xfade-alt absolute inset-0 z-[1]">
            <SmartImage
              src={altSrc}
              alt=""
              fill
              sizes={imgSizes}
              blurTone="none"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
            />
          </div>
        )}
        {/* z-[2]: badge + chip stay legible over EITHER photo, below the
            stretched link (z-10) so they never carve a dead tap zone. */}
        {(badge || sale) && (
          <div className="absolute left-3 top-3 z-[2] flex flex-col items-start gap-1.5">
            {badge && (
              <span
                className={`rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-widest ${
                  badge.tone === 'out'
                    ? 'bg-stone-900/90 text-white'
                    : 'bg-white/90 text-amber-700 ring-1 ring-amber-200 backdrop-blur'
                }`}
              >
                {badge.label}
              </span>
            )}
            {sale && <SaleBadge />}
          </div>
        )}
        <span className="absolute inset-x-3 bottom-3 z-[2] hidden translate-y-2 rounded-full bg-white/95 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-stone-900 opacity-0 shadow-lg backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 md:block">
          View Product
        </span>
      </div>
      {/* Pass 3 hierarchy: name, then the price DIRECTLY beneath it in bold
          ink (never floated to the card's outer edge) — price is the second
          thing a shopper reads, so it is the second line of the card. */}
      <div className="mt-3 px-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-[var(--site-text,oklch(26.8%_0.007_34.298))]">{product.name}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-bold tracking-tight text-[var(--site-text,oklch(21.6%_0.006_56.043))]">{ritualPrice(product.price)}</span>
          {sale && (
            // The seller's "was" price — muted strikethrough beside the price.
            <s className="text-xs text-[var(--site-muted,oklch(55.3%_0.013_58.071))] line-through">
              <span className="sr-only">Was </span>{ritualPrice(sale.compareAt)}
            </s>
          )}
        </p>
      </div>
    </>
  );
  if (altSrc) {
    return (
      <ProductCardXfade
        className="group relative"
        toggleClassName="right-1 top-1 text-stone-900"
        chipClassName="rounded-full bg-white/90 px-2 py-1.5 shadow-sm ring-1 ring-stone-200 backdrop-blur"
        toggleLabel={`Show another photo of ${product.name}`}
      >
        {inner}
      </ProductCardXfade>
    );
  }
  return <article className="group relative">{inner}</article>;
}

/** Internal PDP href with an honest fallback for slugless previews. */
export function ritualProductHref(shop: SiteChromeProps['shop'], productId: string): string {
  return siteProductPath(shop, productId) ?? `/product/${productId}`;
}

export default function RitualChrome({ shop, config, active, children }: SiteChromeProps) {
  const { site } = config;
  // Block-driven copy (Phase 3): the footer's bio fallback is the hero
  // block's tagline; the site.* mirror keeps the value identical for legacy
  // rows and any block array missing a hero.
  // Item 2: hidden blocks are invisible to chrome copy reads too — the
  // site.* mirror (which stores hidden content as well) keeps the fallback.
  const heroBlock = findBlock(resolveVisibleBlocks(config), 'hero_banner');
  const taglineFallback = heroBlock?.tagline ?? site.tagline;
  const base = siteBasePath(shop);
  const collectionsHref = siteCollectionsPath(shop) ?? '#collection';
  // Deliberate classic-boutique escape (footer only). /shop matches the RAW
  // stored slug, so encode it as-is — lowercasing a legacy value would 404.
  // ?classic=1: the Pillar-1 /shop server bridge 307s published-site shops
  // back to /site — this param is the escape's documented bypass.
  const shopUrl = shop.shop_slug ? `/shop/${encodeURIComponent(shop.shop_slug)}?classic=1` : '/';
  const monogram = (shop.shop_name ?? 'S').trim().charAt(0).toUpperCase() || 'S';
  // Logo slot fallback chain (Premium Visual Editor): generated/uploaded site
  // logo → shop.logo_url → the monogram mark. Legacy rows (no assets) render
  // byte-identically.
  const logoUrl = resolveLogoUrl(config, shop);

  // Section anchors live on the home page; from sub-pages they route home
  // first. Slugless previews always render the home layout, so bare hashes
  // remain correct there.
  const homeAnchor = (hash: string) => (active === 'home' || !base ? hash : `${base}${hash}`);

  // ≥44px tap targets: the anchor itself carries the interactive box
  // (min-h-11 + centering) — inside the h-16/h-20 nav row nothing grows.
  const navLink = (isActive: boolean) =>
    `inline-flex min-h-11 items-center text-[10px] font-bold uppercase tracking-[0.25em] transition hover:text-[var(--site-text,oklch(21.6%_0.006_56.043))] ${
      isActive ? 'text-[var(--site-text,oklch(21.6%_0.006_56.043))]' : 'text-[var(--site-muted,oklch(55.3%_0.013_58.071))]'
    }`;

  // Fulfillment facts for the structured footer. Fields are optional/additive:
  // when they are not loaded (legacy callers, previews) we show neutral copy
  // instead of asserting services the shop may not offer.
  const fulfillment: string[] = [];
  if (shop.offers_delivery) fulfillment.push('Local delivery available');
  if (shop.offers_pickup) fulfillment.push('In-person pickup available');
  if (fulfillment.length === 0) fulfillment.push('Fulfillment arranged when you order');
  const pickupNote = shop.offers_pickup && shop.pickup_instructions?.trim()
    ? shop.pickup_instructions.trim().slice(0, 140)
    : null;
  const whatsAppHref = buildWhatsAppLink(
    shop.phone,
    `Hello ${shop.shop_name ?? 'there'}! I'm browsing your boutique website and have a question.`
  );

  return (
    // THEME SEAM: a themed config sets --site-accent/--site-serif here (the
    // one root every ritual /site page shares); absent theme → no style
    // attribute, and every var() fallback below keeps the stone defaults.
    <div className="min-h-screen bg-[var(--site-bg,#FBFAF7)] font-sans text-[var(--site-text,oklch(21.6%_0.006_56.043))]" style={siteThemeStyle(config)}>

      {/* Sticky logo nav */}
      {/* sticky_nav (Pillar 4): absent/true = the historical sticky nav; false = static. */}
      <nav className={`${config.theme?.sticky_nav === false ? 'relative' : 'sticky top-0'} z-50 border-b ${RITUAL_HAIRLINE} bg-[color-mix(in_srgb,var(--site-bg,#FBFAF7)_90%,transparent)] backdrop-blur-md`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-5 md:h-20 md:px-10">
          {/* Pass 3 mobile header law: brand identity owns the row (min-w-0
              flex-1 — long names truncate gracefully instead of pushing the
              icons out), flanked ONLY by Search + Bag below md. */}
          <Link href={base ?? '#'} className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
            {logoUrl ? (
              <SmartImage
                src={logoUrl}
                alt={shop.shop_name ?? 'Logo'}
                width={36}
                height={36}
                blurTone="none"
                className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-[color-mix(in_srgb,var(--site-text,#1c1917)_12%,transparent)]"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--site-accent,#1c1917)] font-serif text-sm font-bold text-[#FBFAF7]">
                {monogram}
              </span>
            )}
            <span className="min-w-0 truncate font-serif text-lg font-bold tracking-tight">{shop.shop_name}</span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <Link href={collectionsHref} className={navLink(active === 'collections')}>Collection</Link>
            <a href={homeAnchor('#story')} className={navLink(false)}>Story</a>
            <a href="#contact" className={navLink(false)}>Contact</a>
          </div>
          <div className="flex shrink-0 items-center gap-1 md:gap-2">
            {/* Client islands: shop-scoped search + live cart trigger — the
                drawer is mounted once in the root layout, so the context
                reaches every /site page. */}
            <SiteSearch tone="ritual" shopId={shop.id} basePath={base} shopName={shop.shop_name} />
            <CartBagButton tone="ritual" />
            <Link
              href={collectionsHref}
              className="hidden min-h-11 shrink-0 items-center rounded-[var(--site-radius,9999px)] bg-[var(--site-accent,#1c1917)] px-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-sm transition hover:brightness-125 active:scale-95 md:inline-flex"
            >
              Shop Now
            </Link>
          </div>
        </div>
      </nav>

      {children}

      {/* Structured footer — shop info, delivery & pickup, contact */}
      {/* Pass 3: the footer rides the live paper token (the historical literal
          #FBFAF7 glared against the deep-luxury dark palette) and gains a
          bottom allowance on the PDP so the sticky buy bar never covers the
          last footer row. */}
      <footer id="contact" className={`border-t ${RITUAL_HAIRLINE} bg-[var(--site-bg,#FBFAF7)] ${active === 'product' ? 'pb-24 md:pb-20' : ''}`}>
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 py-14 md:grid-cols-4 md:gap-8 md:px-10 md:py-20">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <SmartImage
                  src={logoUrl}
                  alt={shop.shop_name ?? 'Logo'}
                  width={40}
                  height={40}
                  blurTone="none"
                  className="h-10 w-10 rounded-full object-cover ring-1 ring-stone-200"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--site-accent,#1c1917)] font-serif text-base font-bold text-[#FBFAF7]">
                  {monogram}
                </span>
              )}
              <p className="font-serif text-xl font-bold text-[var(--site-text,oklch(21.6%_0.006_56.043))]">{shop.shop_name}</p>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">
              {shop.bio?.trim() ? (
                shop.bio.trim().slice(0, 220)
              ) : heroBlock ? (
                <EditableText as="span" blockId={heroBlock.id} field="tagline">
                  {taglineFallback}
                </EditableText>
              ) : (
                taglineFallback
              )}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">Shop</p>
            {/* ≥44px rows: each link IS its tap box (min-h-11), so the column
                gap shrinks to keep the printed rhythm. */}
            <div className="mt-3 flex flex-col gap-1">
              <Link href={collectionsHref} className="flex min-h-11 items-center text-sm text-[var(--site-muted,oklch(44.4%_0.011_73.639))] transition hover:text-[var(--site-text,oklch(21.6%_0.006_56.043))]">The Collection</Link>
              <a href={homeAnchor('#story')} className="flex min-h-11 items-center text-sm text-[var(--site-muted,oklch(44.4%_0.011_73.639))] transition hover:text-[var(--site-text,oklch(21.6%_0.006_56.043))]">Our Story</a>
              <Link href={shopUrl} className="flex min-h-11 items-center text-xs text-[var(--site-muted,oklch(55.3%_0.013_58.071))] underline-offset-4 transition hover:text-[var(--site-text,oklch(21.6%_0.006_56.043))] hover:underline">
                View classic boutique
              </Link>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">Delivery & Contact</p>
            <div className="mt-5 flex flex-col gap-3">
              {fulfillment.map((line) => (
                <p key={line} className="text-sm text-[var(--site-muted,oklch(44.4%_0.011_73.639))]">{line}</p>
              ))}
              {pickupNote && <p className="text-xs leading-relaxed text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">{pickupNote}</p>}
              {/* Pass 3: a full-width tactile secondary action instead of a
                  plain-text link — WhatsApp IS the checkout on Sanndikaa. */}
              {whatsAppHref && (
                <a
                  href={whatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--site-radius,9999px)] border-2 border-[var(--site-accent,#1c1917)] px-5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--site-accent,#1c1917)] transition hover:bg-[var(--site-accent,#1c1917)] hover:text-white active:scale-[0.98]"
                >
                  Message us on WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>

        <div className={`border-t ${RITUAL_HAIRLINE}`}>
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-5 py-6 md:flex-row md:px-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">{shop.shop_name}</p>
            <p className="text-[10px] uppercase tracking-widest text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">Site generated by Sanndikaa AI</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
