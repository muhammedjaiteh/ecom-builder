import Link from 'next/link';
import type { SiteTemplateProps } from '@/lib/siteTemplates';

// EDITORIAL — Fashion & Apparel.
// Structure: minimal top-line nav → full-bleed hero with overlaid serif headline
// (bottom-left) → hook marquee → asymmetric lookbook grid → brand story →
// CTA banner → footer. Monochrome + deep-green accent.

function price(p: number | null) {
  return p == null ? '' : `D${Number(p).toLocaleString()}`;
}

export default function EditorialTemplate({ shop, products, config, heroMedia }: SiteTemplateProps) {
  const { site } = config;
  // Null-safe + lowercase (Law 2 slug safety): a missing slug falls back to the
  // mall root instead of minting a broken /shop/null link.
  const shopUrl = shop.shop_slug ? `/shop/${shop.shop_slug.toLowerCase()}` : '/';
  const marqueeItems = [site.tagline, ...site.value_props.map((v) => v.title)];

  return (
    <div className="min-h-screen bg-[#FAFAF8] font-sans text-neutral-900">
      <style>{`@keyframes editorial-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>

      {/* Nav — single hairline, right-aligned links */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-black/10 bg-[#FAFAF8]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-10">
          <span className="font-serif text-lg font-bold tracking-tight">{shop.shop_name}</span>
          <div className="flex items-center gap-6">
            <a href="#collection" className="hidden text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 transition hover:text-neutral-900 md:block">Collection</a>
            <a href="#story" className="hidden text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 transition hover:text-neutral-900 md:block">Story</a>
            <Link href={shopUrl} className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#1a2e1a] underline underline-offset-4 transition hover:text-black">
              Visit Boutique
            </Link>
          </div>
        </div>
      </nav>

      {/* Full-bleed hero */}
      <header className="relative h-[88vh] min-h-[540px] w-full overflow-hidden bg-neutral-900">
        {heroMedia?.type === 'video' ? (
          <video
            src={heroMedia.url}
            poster={heroMedia.poster ?? undefined}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover opacity-90"
          />
        ) : heroMedia ? (
          <img src={heroMedia.url} alt={shop.shop_name ?? 'Hero'} className="absolute inset-0 h-full w-full object-cover opacity-90" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-800 to-[#1a2e1a]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />

        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-5 pb-14 md:px-10 md:pb-20">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/60">{site.tagline}</p>
          <h1 className="mt-4 max-w-3xl font-serif text-5xl font-bold leading-[1.02] tracking-tight text-white md:text-7xl">
            {site.hero_headline}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75">{site.hero_subheadline}</p>
          <a
            href="#collection"
            className="mt-8 inline-block border border-white/70 px-8 py-3.5 text-[10px] font-bold uppercase tracking-[0.3em] text-white transition hover:bg-white hover:text-black"
          >
            View The Collection
          </a>
        </div>
      </header>

      {/* Hook marquee */}
      <div className="overflow-hidden border-y border-black/10 bg-white py-4">
        <div
          className="flex w-max items-center gap-10 whitespace-nowrap"
          style={{ animation: 'editorial-marquee 26s linear infinite' }}
        >
          {[...marqueeItems, ...marqueeItems].map((t, i) => (
            <span key={i} className="flex items-center gap-10 font-serif text-xl italic text-neutral-700">
              {t} <span className="h-1.5 w-1.5 rounded-full bg-[#1a2e1a]" />
            </span>
          ))}
        </div>
      </div>

      {/* Asymmetric lookbook grid */}
      <section id="collection" className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
        <div className="mb-12 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <h2 className="max-w-md font-serif text-4xl font-bold tracking-tight md:text-5xl">{site.collection_title}</h2>
          <p className="max-w-sm text-sm leading-relaxed text-neutral-500">{site.collection_intro}</p>
        </div>

        <div className="columns-2 gap-4 md:columns-3 md:gap-6 [&>*]:mb-4 md:[&>*]:mb-6">
          {products.slice(0, 9).map((p, i) => (
            <Link
              key={p.id}
              href={`/product/${p.id}`}
              className="group block break-inside-avoid overflow-hidden bg-white shadow-sm transition-shadow hover:shadow-xl"
            >
              <div className={`relative w-full overflow-hidden bg-neutral-100 ${i % 3 === 0 ? 'aspect-[3/4]' : i % 3 === 1 ? 'aspect-square' : 'aspect-[4/5]'}`}>
                {(p.ad_hero_image_url || p.image_url) ? (
                  <img
                    src={p.ad_hero_image_url ?? p.image_url ?? ''}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-neutral-300">—</div>
                )}
              </div>
              <div className="flex items-baseline justify-between gap-3 px-4 py-4">
                <p className="font-serif text-base font-bold leading-snug">{p.name}</p>
                <p className="shrink-0 text-sm text-neutral-500">{price(p.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Brand story */}
      <section id="story" className="border-y border-black/10 bg-white py-24">
        <div className="mx-auto max-w-3xl px-5 text-center md:px-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#1a2e1a]">The House</p>
          <p className="mt-8 font-serif text-2xl font-medium leading-relaxed text-neutral-800 md:text-3xl">
            “{site.brand_story}”
          </p>
          <div className="mx-auto mt-8 h-px w-16 bg-[#1a2e1a]" />
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.3em] text-neutral-400">{shop.shop_name}</p>
        </div>
      </section>

      {/* Value props — three minimal columns */}
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 py-20 md:grid-cols-3 md:px-10">
        {site.value_props.map((v, i) => (
          <div key={v.title} className={i === 1 ? 'md:border-x md:border-black/10 md:px-10' : ''}>
            <p className="font-serif text-xl font-bold">{v.title}</p>
            <p className="mt-2.5 text-sm leading-relaxed text-neutral-500">{v.body}</p>
          </div>
        ))}
      </section>

      {/* CTA banner */}
      <section className="bg-[#1a2e1a] py-24 text-center">
        <div className="mx-auto max-w-2xl px-5 md:px-10">
          <h2 className="font-serif text-4xl font-bold tracking-tight text-white md:text-5xl">{site.cta_banner.headline}</h2>
          <p className="mt-4 text-base leading-relaxed text-white/65">{site.cta_banner.subtext}</p>
          <Link
            href={shopUrl}
            className="mt-9 inline-block border border-white px-10 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-white transition hover:bg-white hover:text-[#1a2e1a]"
          >
            {site.cta_banner.button_label}
          </Link>
        </div>
      </section>

      <footer className="bg-[#FAFAF8] py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 md:flex-row md:px-10">
          <p className="font-serif text-sm font-bold">{shop.shop_name}</p>
          <Link href={shopUrl} className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 transition hover:text-neutral-900">
            Full Boutique & Checkout
          </Link>
          <p className="text-[10px] uppercase tracking-widest text-neutral-400">Site generated by Sanndikaa AI</p>
        </div>
      </footer>
    </div>
  );
}
