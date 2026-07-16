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
import { buildWhatsAppLink } from '@/lib/orderFlow';
import EditableText from '../EditableText';

// MINIMAL (template_key 'ritual') chrome — the sticky logo nav and structured
// footer every /site page of a ritual shop shares (home, collections, product
// detail). Extracted verbatim from RitualTemplate so the buyer experiences ONE
// continuous branded site; only the link targets changed for the omnichannel
// router: primary journeys stay on /site, and the single deliberate /shop
// escape is the subtle "View classic boutique" footer link.

export function ritualPrice(p: number | null) {
  return p == null ? '' : `D${Number(p).toLocaleString()}`;
}

// Stock is optional/additive: undefined (not loaded) renders nothing, so every
// legacy caller keeps its exact output. 0 = sold out, 1-5 = urgency badge.
export function ritualStockBadge(stock: number | null | undefined): { label: string; tone: 'out' | 'low' } | null {
  if (stock == null) return null;
  if (stock <= 0) return { label: 'Sold Out', tone: 'out' };
  if (stock <= 5) return { label: `Only ${stock} left`, tone: 'low' };
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

export function RitualProductVisual({ src, alt, index }: { src: string | null; alt: string; index: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
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

/** One product card of the airy grid — shared by home and /collections. */
export function RitualProductCard({ product, index, href }: { product: SiteProduct; index: number; href: string }) {
  const badge = ritualStockBadge(product.stock_quantity);
  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-stone-100">
        <RitualProductVisual src={product.ad_hero_image_url ?? product.image_url} alt={product.name} index={index} />
        {badge && (
          <span
            className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-widest ${
              badge.tone === 'out'
                ? 'bg-stone-900/90 text-white'
                : 'bg-white/90 text-amber-700 ring-1 ring-amber-200 backdrop-blur'
            }`}
          >
            {badge.label}
          </span>
        )}
        <span className="absolute inset-x-3 bottom-3 translate-y-2 rounded-full bg-white/95 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-stone-900 opacity-0 shadow-lg backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          View Product
        </span>
      </div>
      <div className="mt-4 flex items-start justify-between gap-3 px-1">
        <p className="text-sm font-medium leading-snug text-stone-800">{product.name}</p>
        <p className="shrink-0 text-sm text-stone-500">{ritualPrice(product.price)}</p>
      </div>
    </Link>
  );
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
  const heroBlock = findBlock(resolveBlocks(config), 'hero_banner');
  const taglineFallback = heroBlock?.tagline ?? site.tagline;
  const base = siteBasePath(shop);
  const collectionsHref = siteCollectionsPath(shop) ?? '#collection';
  // Deliberate classic-boutique escape (footer only). /shop matches the RAW
  // stored slug, so encode it as-is — lowercasing a legacy value would 404.
  const shopUrl = shop.shop_slug ? `/shop/${encodeURIComponent(shop.shop_slug)}` : '/';
  const monogram = (shop.shop_name ?? 'S').trim().charAt(0).toUpperCase() || 'S';

  // Section anchors live on the home page; from sub-pages they route home
  // first. Slugless previews always render the home layout, so bare hashes
  // remain correct there.
  const homeAnchor = (hash: string) => (active === 'home' || !base ? hash : `${base}${hash}`);

  const navLink = (isActive: boolean) =>
    `text-[10px] font-bold uppercase tracking-[0.25em] transition hover:text-stone-900 ${
      isActive ? 'text-stone-900' : 'text-stone-500'
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
    <div className="min-h-screen bg-[#FBFAF7] font-sans text-stone-900">

      {/* Sticky logo nav */}
      <nav className="sticky top-0 z-50 border-b border-stone-200/80 bg-[#FBFAF7]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:h-20 md:px-10">
          <Link href={base ?? '#'} className="flex min-w-0 items-center gap-3">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt={shop.shop_name ?? 'Logo'} className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-stone-200" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-900 font-serif text-sm font-bold text-[#FBFAF7]">
                {monogram}
              </span>
            )}
            <span className="truncate font-serif text-lg font-bold tracking-tight">{shop.shop_name}</span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <Link href={collectionsHref} className={navLink(active === 'collections')}>Collection</Link>
            <a href={homeAnchor('#story')} className={navLink(false)}>Story</a>
            <a href="#contact" className={navLink(false)}>Contact</a>
          </div>
          <Link
            href={collectionsHref}
            className="shrink-0 rounded-full bg-stone-900 px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-sm transition hover:bg-stone-700 active:scale-95"
          >
            Shop Now
          </Link>
        </div>
      </nav>

      {children}

      {/* Structured footer — shop info, delivery & pickup, contact */}
      <footer id="contact" className="bg-[#FBFAF7]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-5 py-16 md:grid-cols-4 md:gap-8 md:px-10 md:py-20">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              {shop.logo_url ? (
                <img src={shop.logo_url} alt={shop.shop_name ?? 'Logo'} className="h-10 w-10 rounded-full object-cover ring-1 ring-stone-200" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-900 font-serif text-base font-bold text-[#FBFAF7]">
                  {monogram}
                </span>
              )}
              <p className="font-serif text-xl font-bold text-stone-900">{shop.shop_name}</p>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-stone-500">
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
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">Shop</p>
            <div className="mt-5 flex flex-col gap-3">
              <Link href={collectionsHref} className="text-sm text-stone-600 transition hover:text-stone-900">The Collection</Link>
              <a href={homeAnchor('#story')} className="text-sm text-stone-600 transition hover:text-stone-900">Our Story</a>
              <Link href={shopUrl} className="text-xs text-stone-400 underline-offset-4 transition hover:text-stone-600 hover:underline">
                View classic boutique
              </Link>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">Delivery & Contact</p>
            <div className="mt-5 flex flex-col gap-3">
              {fulfillment.map((line) => (
                <p key={line} className="text-sm text-stone-600">{line}</p>
              ))}
              {pickupNote && <p className="text-xs leading-relaxed text-stone-400">{pickupNote}</p>}
              {whatsAppHref && (
                <a
                  href={whatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-stone-900 underline underline-offset-4 transition hover:text-stone-600"
                >
                  Message the boutique on WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-stone-200">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-5 py-6 md:flex-row md:px-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500">{shop.shop_name}</p>
            <p className="text-[10px] uppercase tracking-widest text-stone-400">Site generated by Sanndikaa AI</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
