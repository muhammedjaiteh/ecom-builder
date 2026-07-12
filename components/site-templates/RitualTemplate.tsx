import Link from 'next/link';
import type { SiteTemplateProps } from '@/lib/siteTemplates';

// MINIMAL (template_key 'ritual') — Layout A.
// The anatomy of a premium minimal Shopify theme:
// sticky logo nav → full-bleed cinematic hero with dual CTAs → numbered
// value-props band → airy spacious product grid with quick-view hovers and
// live stock badges → brand-story strip → dark CTA banner → structured
// footer (shop info, delivery & pickup, contact). Warm off-white, stone ink.

function price(p: number | null) {
  return p == null ? '' : `D${Number(p).toLocaleString()}`;
}

// Stock is optional/additive: undefined (not loaded) renders nothing, so every
// legacy caller keeps its exact output. 0 = sold out, 1-5 = urgency badge.
function stockBadge(stock: number | null | undefined): { label: string; tone: 'out' | 'low' } | null {
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

function ProductVisual({ src, alt, index }: { src: string | null; alt: string; index: number }) {
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

export default function RitualTemplate({ shop, products, config, heroMedia }: SiteTemplateProps) {
  const { site } = config;
  // Null-safe + lowercase (Law 2 slug safety): a missing slug falls back to the
  // mall root instead of minting a broken /shop/null link.
  const shopUrl = shop.shop_slug ? `/shop/${shop.shop_slug.toLowerCase()}` : '/';
  const monogram = (shop.shop_name ?? 'S').trim().charAt(0).toUpperCase() || 'S';

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

  return (
    <div className="min-h-screen bg-[#FBFAF7] font-sans text-stone-900">

      {/* Sticky logo nav */}
      <nav className="sticky top-0 z-50 border-b border-stone-200/80 bg-[#FBFAF7]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:h-20 md:px-10">
          <div className="flex min-w-0 items-center gap-3">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt={shop.shop_name ?? 'Logo'} className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-stone-200" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-900 font-serif text-sm font-bold text-[#FBFAF7]">
                {monogram}
              </span>
            )}
            <span className="truncate font-serif text-lg font-bold tracking-tight">{shop.shop_name}</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#collection" className="text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500 transition hover:text-stone-900">Collection</a>
            <a href="#story" className="text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500 transition hover:text-stone-900">Story</a>
            <a href="#contact" className="text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500 transition hover:text-stone-900">Contact</a>
          </div>
          <Link
            href={shopUrl}
            className="shrink-0 rounded-full bg-stone-900 px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-sm transition hover:bg-stone-700 active:scale-95"
          >
            Shop Now
          </Link>
        </div>
      </nav>

      {/* Full-bleed hero */}
      <header className="relative flex h-[82vh] min-h-[560px] w-full items-end overflow-hidden bg-stone-900 md:items-center">
        {heroMedia?.type === 'video' ? (
          <video
            src={heroMedia.url}
            poster={heroMedia.poster ?? undefined}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : heroMedia ? (
          <img src={heroMedia.url} alt={shop.shop_name ?? 'Hero'} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(214,203,186,0.35),transparent_55%),linear-gradient(to_bottom_right,#292524,#1c1917,#3a352e)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />

        <div className="relative mx-auto w-full max-w-7xl px-5 pb-16 pt-24 md:px-10 md:pb-0 md:pt-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-white/70">{site.tagline}</p>
          <h1 className="mt-5 max-w-2xl font-serif text-4xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl lg:text-7xl">
            {site.hero_headline}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 md:text-lg">{site.hero_subheadline}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#collection"
              className="rounded-full bg-white px-8 py-4 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-stone-900 shadow-lg transition hover:bg-stone-100 active:scale-95"
            >
              Shop The Collection
            </a>
            <Link
              href={shopUrl}
              className="rounded-full border border-white/50 px-8 py-4 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-white transition hover:border-white hover:bg-white/10 active:scale-95"
            >
              Visit The Boutique
            </Link>
          </div>
        </div>
      </header>

      {/* Numbered value-props band */}
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-stone-100 md:grid-cols-3 md:divide-x md:divide-y-0">
          {site.value_props.map((v, i) => (
            <div key={v.title} className="px-6 py-9 text-center md:px-10 md:py-12">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">0{i + 1}</p>
              <p className="mt-3 font-serif text-lg font-bold text-stone-900">{v.title}</p>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-stone-500">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Airy product grid */}
      <section id="collection" className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-serif text-3xl font-bold tracking-tight text-stone-900 md:text-5xl">{site.collection_title}</h2>
          <p className="mt-4 text-sm leading-relaxed text-stone-500 md:text-base">{site.collection_intro}</p>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-x-5 gap-y-12 md:mt-20 md:grid-cols-3 md:gap-x-8 md:gap-y-16 lg:grid-cols-4">
          {products.slice(0, 12).map((p, i) => {
            const badge = stockBadge(p.stock_quantity);
            return (
              <Link key={p.id} href={`/product/${p.id}`} className="group block">
                <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-stone-100">
                  <ProductVisual src={p.ad_hero_image_url ?? p.image_url} alt={p.name} index={i} />
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
                  <p className="text-sm font-medium leading-snug text-stone-800">{p.name}</p>
                  <p className="shrink-0 text-sm text-stone-500">{price(p.price)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Brand-story strip */}
      <section id="story" className="border-y border-stone-200 bg-white py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-5 md:grid-cols-[200px_1fr] md:gap-14 md:px-10">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-stone-400">Our Story</p>
            <div className="mt-5 hidden h-px w-16 bg-stone-900 md:block" />
          </div>
          <div>
            <p className="font-serif text-2xl font-medium leading-relaxed text-stone-800 md:text-3xl">{site.brand_story}</p>
            <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">{shop.shop_name}</p>
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="bg-stone-900 py-20 text-center md:py-28">
        <div className="mx-auto max-w-2xl px-5 md:px-10">
          <h2 className="font-serif text-3xl font-bold tracking-tight text-white md:text-5xl">{site.cta_banner.headline}</h2>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-white/60">{site.cta_banner.subtext}</p>
          <Link
            href={shopUrl}
            className="mt-10 inline-block rounded-full bg-white px-10 py-4 text-[10px] font-bold uppercase tracking-[0.25em] text-stone-900 shadow-lg transition hover:bg-stone-100 active:scale-95"
          >
            {site.cta_banner.button_label}
          </Link>
        </div>
      </section>

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
              {shop.bio?.trim() ? shop.bio.trim().slice(0, 220) : site.tagline}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">Shop</p>
            <div className="mt-5 flex flex-col gap-3">
              <a href="#collection" className="text-sm text-stone-600 transition hover:text-stone-900">The Collection</a>
              <a href="#story" className="text-sm text-stone-600 transition hover:text-stone-900">Our Story</a>
              <Link href={shopUrl} className="text-sm text-stone-600 transition hover:text-stone-900">Full Boutique & Checkout</Link>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">Delivery & Contact</p>
            <div className="mt-5 flex flex-col gap-3">
              {fulfillment.map((line) => (
                <p key={line} className="text-sm text-stone-600">{line}</p>
              ))}
              {pickupNote && <p className="text-xs leading-relaxed text-stone-400">{pickupNote}</p>}
              <Link href={shopUrl} className="text-sm font-medium text-stone-900 underline underline-offset-4 transition hover:text-stone-600">
                Message the boutique
              </Link>
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
