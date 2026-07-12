import Link from 'next/link';
import type { SiteTemplateProps } from '@/lib/siteTemplates';

// EDITORIAL (template_key 'editorial') — Layout B.
// Magazine anatomy, structurally distinct from the Minimal layout:
// hairline top bar + oversized serif masthead → asymmetric split hero
// (media 7 columns, copy 5) → alternating full-width product features →
// dense hairline collection grid with hover reveals → pull-quote brand
// story → numbered index row → dark serif sign-off footer.
// Paper `#F7F5F0`, near-black ink, deep-green accent.

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

// Deterministic gradient plates replace missing photography (Law 4: real
// product pixels when they exist, a neutral printed material when not).
const FALLBACK_PLATES = [
  'bg-gradient-to-br from-neutral-200 via-[#EDEAE2] to-neutral-300',
  'bg-gradient-to-br from-[#E4E0D6] via-neutral-100 to-[#D8D3C7]',
  'bg-gradient-to-br from-neutral-300 via-[#EFEBE3] to-neutral-200',
  'bg-gradient-to-br from-[#DDD8CC] via-white to-neutral-200',
];

function ProductPlate({ src, alt, index }: { src: string | null; alt: string; index: number }) {
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

export default function EditorialTemplate({ shop, products, config, heroMedia }: SiteTemplateProps) {
  const { site } = config;
  // Null-safe + lowercase (Law 2 slug safety): a missing slug falls back to the
  // mall root instead of minting a broken /shop/null link.
  const shopUrl = shop.shop_slug ? `/shop/${shop.shop_slug.toLowerCase()}` : '/';
  const initial = (shop.shop_name ?? 'S').trim().charAt(0).toUpperCase() || 'S';
  const featured = products.slice(0, 2);

  const fulfillment: string[] = [];
  if (shop.offers_delivery) fulfillment.push('Local delivery available');
  if (shop.offers_pickup) fulfillment.push('In-person pickup available');
  if (fulfillment.length === 0) fulfillment.push('Fulfillment arranged when you order');

  return (
    <div className="min-h-screen bg-[#F7F5F0] font-sans text-neutral-900">

      {/* Masthead */}
      <header className="border-b border-neutral-900">
        <div className="flex items-center justify-between gap-4 border-b border-neutral-300 px-5 py-2.5 md:px-10">
          <p className="truncate text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-500">{site.tagline}</p>
          <Link href={shopUrl} className="shrink-0 text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-900 underline underline-offset-4 transition hover:text-[#1a2e1a]">
            Visit The Boutique
          </Link>
        </div>
        <div className="px-5 py-7 text-center md:py-11">
          <p className="font-serif text-4xl font-black uppercase tracking-tight md:text-7xl">{shop.shop_name}</p>
        </div>
        <nav className="flex items-center justify-center gap-7 border-t border-neutral-300 px-5 py-3 md:gap-12">
          <a href="#features" className="text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-500 transition hover:text-neutral-900 md:text-[10px]">Features</a>
          <a href="#collection" className="text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-500 transition hover:text-neutral-900 md:text-[10px]">The Collection</a>
          <a href="#story" className="text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-500 transition hover:text-neutral-900 md:text-[10px]">Story</a>
        </nav>
      </header>

      {/* Asymmetric split hero — media 7 cols, copy 5 */}
      <section className="grid grid-cols-1 border-b border-neutral-900 md:grid-cols-12">
        <div className="relative min-h-[340px] border-neutral-900 md:col-span-7 md:min-h-[580px] md:border-r">
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
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-200 via-[#EDEAE2] to-neutral-300">
              <span className="font-serif text-[10rem] italic leading-none text-neutral-400/40 md:text-[16rem]">{initial}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center gap-6 px-5 py-14 md:col-span-5 md:px-12 md:py-20">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#1a2e1a]">No. 01 — The Opening</p>
          <h1 className="font-serif text-4xl italic leading-[1.08] tracking-tight md:text-5xl lg:text-6xl">
            {site.hero_headline}
          </h1>
          <p className="max-w-md text-base leading-relaxed text-neutral-600">{site.hero_subheadline}</p>
          <a
            href="#collection"
            className="group inline-flex items-center gap-3 self-start border-b-2 border-neutral-900 pb-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-900 transition hover:border-[#1a2e1a] hover:text-[#1a2e1a]"
          >
            Read The Collection
            <span aria-hidden className="transition-transform group-hover:translate-x-1.5">&rarr;</span>
          </a>
        </div>
      </section>

      {/* Alternating full-width product features */}
      {featured.length > 0 && (
        <section id="features" className="border-b border-neutral-900">
          {featured.map((p, i) => {
            const badge = stockBadge(p.stock_quantity);
            const reversed = i % 2 === 1;
            return (
              <article
                key={p.id}
                className={`grid grid-cols-1 md:grid-cols-2 ${i > 0 ? 'border-t border-neutral-900' : ''}`}
              >
                <div className={`group relative aspect-[4/3] overflow-hidden border-neutral-900 md:aspect-auto md:min-h-[500px] ${reversed ? 'md:order-2 md:border-l' : 'md:border-r'}`}>
                  <div className="absolute inset-0">
                    <ProductPlate src={p.ad_hero_image_url ?? p.image_url} alt={p.name} index={i} />
                  </div>
                  {badge && (
                    <span className={`absolute left-4 top-4 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.25em] ${
                      badge.tone === 'out' ? 'bg-neutral-900 text-white' : 'bg-[#F7F5F0] text-amber-800 ring-1 ring-neutral-900'
                    }`}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <div className={`flex flex-col justify-center gap-5 px-5 py-14 md:px-14 md:py-24 ${reversed ? 'md:order-1' : ''}`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400">Feature No. 0{i + 1}</p>
                  <h2 className="font-serif text-3xl font-bold leading-tight md:text-5xl">{p.name}</h2>
                  {p.description && (
                    <p className="line-clamp-3 max-w-md text-sm leading-relaxed text-neutral-600 md:text-base">{p.description}</p>
                  )}
                  <p className="font-serif text-2xl italic text-neutral-900">{price(p.price)}</p>
                  <Link
                    href={`/product/${p.id}`}
                    className="inline-flex self-start border border-neutral-900 px-9 py-3.5 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-900 transition hover:bg-neutral-900 hover:text-[#F7F5F0] active:scale-95"
                  >
                    View The Piece
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Dense editorial collection grid — hairline gutters, hover reveals */}
      <section id="collection" className="border-b border-neutral-900">
        <div className="flex flex-col items-start justify-between gap-4 px-5 py-10 md:flex-row md:items-baseline md:px-10 md:py-14">
          <h2 className="font-serif text-4xl font-black tracking-tight md:text-6xl">{site.collection_title}</h2>
          <p className="max-w-md text-sm leading-relaxed text-neutral-500">{site.collection_intro}</p>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-neutral-900 bg-neutral-900 md:grid-cols-4">
          {products.slice(0, 12).map((p, i) => {
            const badge = stockBadge(p.stock_quantity);
            return (
              <Link key={p.id} href={`/product/${p.id}`} className="group block bg-[#F7F5F0]">
                <div className="relative aspect-square overflow-hidden">
                  <ProductPlate src={p.ad_hero_image_url ?? p.image_url} alt={p.name} index={i} />
                  {badge && (
                    <span className={`absolute right-2 top-2 z-10 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.2em] ${
                      badge.tone === 'out' ? 'bg-neutral-900 text-white' : 'bg-[#F7F5F0]/95 text-amber-800'
                    }`}>
                      {badge.label}
                    </span>
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-neutral-900/80 px-3 text-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <p className="font-serif text-lg italic leading-snug text-white md:text-xl">{p.name}</p>
                    <p className="text-xs text-white/70">{price(p.price)}</p>
                    <span className="mt-2 text-[9px] font-bold uppercase tracking-[0.3em] text-white underline underline-offset-4">View</span>
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-t border-neutral-900 px-3 py-2.5">
                  <p className="truncate font-serif text-sm italic">{p.name}</p>
                  <p className="shrink-0 text-[11px] text-neutral-500">{price(p.price)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Pull-quote brand story */}
      <section id="story" className="border-b border-neutral-900 px-5 py-20 md:px-10 md:py-32">
        <div className="relative mx-auto max-w-4xl">
          <span aria-hidden className="pointer-events-none absolute -top-10 left-0 select-none font-serif text-[8rem] leading-none text-neutral-300 md:-top-16 md:text-[12rem]">
            &ldquo;
          </span>
          <blockquote className="relative pt-14 font-serif text-3xl italic leading-[1.2] text-neutral-900 md:pt-20 md:text-5xl">
            {site.brand_story}
          </blockquote>
          <p className="mt-9 text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-500">&mdash; {shop.shop_name}</p>
        </div>
      </section>

      {/* Numbered index row — the value props as editorial columns */}
      <section className="grid grid-cols-1 border-b border-neutral-900 md:grid-cols-3">
        {site.value_props.map((v, i) => (
          <div key={v.title} className={`px-5 py-10 md:px-10 md:py-14 ${i > 0 ? 'border-t border-neutral-900 md:border-l md:border-t-0' : ''}`}>
            <p className="font-serif text-4xl italic text-neutral-300">0{i + 1}</p>
            <p className="mt-4 font-serif text-xl font-bold">{v.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{v.body}</p>
          </div>
        ))}
      </section>

      {/* Dark serif sign-off footer — CTA folded into the closing spread */}
      <footer className="bg-[#141414] text-[#F7F5F0]">
        <div className="mx-auto max-w-7xl px-5 py-20 text-center md:px-10 md:py-28">
          <h2 className="font-serif text-4xl italic leading-tight md:text-6xl">{site.cta_banner.headline}</h2>
          <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-white/60 md:text-base">{site.cta_banner.subtext}</p>
          <Link
            href={shopUrl}
            className="mt-10 inline-block bg-[#F7F5F0] px-10 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-900 transition hover:bg-white active:scale-95"
          >
            {site.cta_banner.button_label}
          </Link>
        </div>

        <div className="border-t border-white/15">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 md:flex-row md:items-end md:justify-between md:px-10 md:py-12">
            <p className="font-serif text-3xl font-black uppercase tracking-tight md:text-5xl">{shop.shop_name}</p>
            <div className="flex flex-col gap-2 md:items-end md:text-right">
              {fulfillment.map((line) => (
                <p key={line} className="text-xs text-white/50">{line}</p>
              ))}
              <Link href={shopUrl} className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/80 underline underline-offset-4 transition hover:text-white">
                Full Boutique & Checkout
              </Link>
              <p className="mt-1 text-[9px] uppercase tracking-widest text-white/30">Site generated by Sanndikaa AI</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
