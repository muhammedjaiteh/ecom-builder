import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import {
  siteBasePath,
  siteCollectionsPath,
  type SiteChromeProps,
  type SiteProduct,
} from '@/lib/siteTemplates';
import { siteThemeStyle } from '@/lib/siteTheme';
import CartBagButton from '../CartBagButton';
import SiteSearch from '../SiteSearch';

// NEUTRAL chrome — the graceful fallback wrapping the NEW nested routes
// (/collections, /products/[id]) for legacy 'vitality' sites, whose home
// template predates the omnichannel router and stays untouched. Tuned to sit
// alongside the Vitality aesthetic (near-black canvas, electric gold accent)
// so old sites gain the new pages without a redesign. The single deliberate
// /shop escape is the subtle "View classic boutique" footer link.

export function neutralPrice(p: number | null) {
  return p == null ? '' : `D${Number(p).toLocaleString()}`;
}

export function neutralStockBadge(stock: number | null | undefined): { label: string; tone: 'out' | 'low' } | null {
  if (stock == null) return null;
  if (stock <= 0) return { label: 'Sold Out', tone: 'out' };
  if (stock <= 5) return { label: `Only ${stock} left`, tone: 'low' };
  return null;
}

// Deterministic dark plates for missing photography (Law 4: the seller's real
// pixels when they exist, a neutral material when not).
const FALLBACK_PANELS = [
  'bg-gradient-to-br from-[#1c1c1c] via-[#141414] to-[#242424]',
  'bg-gradient-to-br from-[#181818] via-[#101010] to-amber-950/40',
  'bg-gradient-to-br from-[#222] via-[#161616] to-[#1c1c1c]',
];

export function NeutralProductVisual({ src, alt, index, sizes }: {
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
        sizes={sizes ?? '(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw'}
        blurTone="dark"
        className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
      />
    );
  }
  return (
    <div className={`flex h-full w-full items-center justify-center ${FALLBACK_PANELS[index % FALLBACK_PANELS.length]}`}>
      <span className="text-4xl font-black uppercase text-white/15">{alt.charAt(0).toUpperCase()}</span>
    </div>
  );
}

export const NEUTRAL_COLLECTION_GRID =
  'grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4';

/** Dark product card echoing the Vitality lineup rows. */
export function NeutralProductCard({ product, index, href }: { product: SiteProduct; index: number; href: string }) {
  const badge = neutralStockBadge(product.stock_quantity);
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-[#111] transition-all duration-300 hover:border-[color-mix(in_srgb,var(--site-accent,#f0a500)_50%,transparent)] hover:bg-[#151515]"
    >
      <div className="relative aspect-square overflow-hidden bg-black">
        <NeutralProductVisual src={product.ad_hero_image_url ?? product.image_url} alt={product.name} index={index} />
        {badge && (
          <span
            className={`absolute left-3 top-3 rounded-sm px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${
              badge.tone === 'out' ? 'bg-white text-black' : 'bg-[var(--site-accent,#f0a500)] text-black'
            }`}
          >
            {badge.label}
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 p-4">
        <p className="text-sm font-black uppercase leading-snug tracking-tight text-white">{product.name}</p>
        <p className="shrink-0 text-sm font-black text-[var(--site-accent,#f0a500)]">{neutralPrice(product.price)}</p>
      </div>
    </Link>
  );
}

export default function NeutralChrome({ shop, config, active, children }: SiteChromeProps) {
  const base = siteBasePath(shop);
  const collectionsHref = siteCollectionsPath(shop) ?? '#lineup';
  // Deliberate classic-boutique escape (footer only). /shop matches the RAW
  // stored slug, so encode it as-is — lowercasing a legacy value would 404.
  // ?classic=1: the Pillar-1 /shop server bridge 307s published-site shops
  // back to /site — this param is the escape's documented bypass.
  const shopUrl = shop.shop_slug ? `/shop/${encodeURIComponent(shop.shop_slug)}?classic=1` : '/';

  return (
    // THEME SEAM: mirrors the Vitality home root — a themed config sets
    // --site-accent/--site-serif; absent theme keeps the gold defaults.
    <div className="min-h-screen bg-[var(--site-bg,#0C0C0C)] font-sans text-[var(--site-text,#ffffff)]" style={siteThemeStyle(config)}>

      {/* Sticky dark bar — wordmark home link, gold collection CTA */}
      {/* sticky_nav (Pillar 4): absent/true = the historical sticky nav; false = static. */}
      <nav className={`${config.theme?.sticky_nav === false ? 'relative' : 'sticky top-0'} z-50 border-b border-white/10 bg-[color-mix(in_srgb,var(--site-bg,#0C0C0C)_90%,transparent)] backdrop-blur-md`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-10">
          <Link href={base ?? '#'} className="truncate text-lg font-black uppercase tracking-tight">
            {shop.shop_name}
          </Link>
          <div className="flex items-center gap-3 md:gap-6">
            <Link
              href={base ?? '#'}
              className="hidden text-[10px] font-black uppercase tracking-[0.25em] text-white/50 transition hover:text-white md:block"
            >
              Home
            </Link>
            {/* Client islands: shop-scoped search + live cart trigger —
                simple ghost icons, gold badge. */}
            <SiteSearch tone="neutral" shopId={shop.id} basePath={base} shopName={shop.shop_name} />
            <CartBagButton tone="neutral" />
            <Link
              href={collectionsHref}
              className={`rounded-[var(--site-radius,9999px)] px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition active:scale-95 ${
                active === 'collections'
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'bg-[var(--site-accent,#f0a500)] text-black hover:brightness-110'
              }`}
            >
              The Collection
            </Link>
          </div>
        </div>
      </nav>

      {children}

      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 md:flex-row md:px-10">
          <p className="text-sm font-black uppercase tracking-tight">{shop.shop_name}</p>
          <Link href={shopUrl} className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 transition hover:text-white">
            View classic boutique
          </Link>
          <p className="text-[10px] uppercase tracking-widest text-white/30">Site generated by Sanndikaa AI</p>
        </div>
      </footer>
    </div>
  );
}
