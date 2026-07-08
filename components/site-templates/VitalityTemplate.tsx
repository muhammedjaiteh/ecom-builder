import Link from 'next/link';
import type { SiteTemplateProps } from '@/lib/siteTemplates';

// VITALITY — Health, Fitness & Bold General Brands.
// Structure: bold nav with pill CTA → dark full-width hero with condensed
// uppercase type and DIAGONAL bottom edge → stats band (large numerals) →
// benefit-led horizontal product rows → gold value-prop stripes → CTA →
// footer. Near-black + electric gold.

function price(p: number | null) {
  return p == null ? '' : `D${Number(p).toLocaleString()}`;
}

export default function VitalityTemplate({ shop, products, config, heroMedia }: SiteTemplateProps) {
  const { site } = config;
  // Null-safe + lowercase (Law 2 slug safety): a missing slug falls back to the
  // mall root instead of minting a broken /shop/null link.
  const shopUrl = shop.shop_slug ? `/shop/${shop.shop_slug.toLowerCase()}` : '/';
  const categoryCount = new Set(products.map((p) => p.category).filter(Boolean)).size || 1;

  return (
    <div className="min-h-screen bg-[#0C0C0C] font-sans text-white">

      {/* Nav — bold left wordmark, pill CTA right */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0C0C0C]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-10">
          <span className="text-lg font-black uppercase tracking-tight">{shop.shop_name}</span>
          <div className="flex items-center gap-6">
            <a href="#lineup" className="hidden text-[10px] font-black uppercase tracking-[0.25em] text-white/50 transition hover:text-white md:block">The Lineup</a>
            <Link
              href={shopUrl}
              className="rounded-full bg-[#f0a500] px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-black transition hover:bg-amber-400 active:scale-95"
            >
              Shop Direct
            </Link>
          </div>
        </div>
      </nav>

      {/* Dark hero with diagonal bottom edge */}
      <header className="relative overflow-hidden" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 92%, 0 100%)' }}>
        <div className="absolute inset-0">
          {heroMedia?.type === 'video' ? (
            <video
              src={heroMedia.url}
              poster={heroMedia.poster ?? undefined}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover opacity-40"
            />
          ) : heroMedia ? (
            <img src={heroMedia.url} alt={shop.shop_name ?? 'Hero'} className="h-full w-full object-cover opacity-40" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#141414] via-[#0C0C0C] to-amber-950/40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0C0C0C] via-transparent to-black/40" />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 pb-32 pt-20 md:px-10 md:pb-44 md:pt-28">
          <p className="inline-block rounded-sm bg-[#f0a500] px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-black">
            {site.tagline}
          </p>
          <h1 className="mt-6 max-w-4xl text-6xl font-black uppercase leading-[0.95] tracking-tighter md:text-8xl">
            {site.hero_headline}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">{site.hero_subheadline}</p>
          <a
            href="#lineup"
            className="mt-10 inline-block skew-x-[-6deg] bg-[#f0a500] px-10 py-4 text-xs font-black uppercase tracking-[0.25em] text-black shadow-[6px_6px_0_rgba(240,165,0,0.25)] transition hover:bg-amber-400 active:translate-y-0.5"
          >
            <span className="inline-block skew-x-[6deg]">See The Lineup</span>
          </a>
        </div>
      </header>

      {/* Stats band */}
      <section className="mx-auto max-w-7xl px-5 py-16 md:px-10">
        <div className="grid grid-cols-3 divide-x divide-white/10 text-center">
          {[
            { n: `${products.length}`, label: 'Products In The Lineup' },
            { n: `${categoryCount}`, label: categoryCount === 1 ? 'Focused Category' : 'Categories Covered' },
            { n: '100%', label: 'Escrow-Protected Orders' },
          ].map((s) => (
            <div key={s.label} className="px-4">
              <p className="text-5xl font-black tracking-tighter text-[#f0a500] md:text-6xl">{s.n}</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.25em] text-white/50">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Gold value-prop stripes */}
      <section className="space-y-3 py-8">
        {site.value_props.map((v, i) => (
          <div
            key={v.title}
            className={`flex flex-col gap-1 border-y border-white/10 px-5 py-6 md:flex-row md:items-center md:gap-10 md:px-10 ${i === 1 ? 'bg-[#f0a500] text-black' : 'bg-[#111]'}`}
          >
            <p className={`w-full shrink-0 text-2xl font-black uppercase tracking-tight md:w-96 ${i === 1 ? 'text-black' : 'text-white'}`}>
              {v.title}
            </p>
            <p className={`text-sm leading-relaxed ${i === 1 ? 'text-black/70' : 'text-white/60'}`}>{v.body}</p>
          </div>
        ))}
      </section>

      {/* Benefit-led product rows */}
      <section id="lineup" className="mx-auto max-w-7xl px-5 py-20 md:px-10">
        <h2 className="text-4xl font-black uppercase tracking-tighter md:text-6xl">{site.collection_title}</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">{site.collection_intro}</p>

        <div className="mt-14 space-y-8">
          {products.slice(0, 6).map((p, i) => (
            <Link
              key={p.id}
              href={`/product/${p.id}`}
              className={`group grid grid-cols-1 items-center gap-6 rounded-2xl border border-white/10 bg-[#111] p-5 transition-all duration-300 hover:border-[#f0a500]/50 hover:bg-[#151515] md:grid-cols-[280px_1fr_auto] ${i % 2 === 1 ? 'md:grid-cols-[1fr_280px_auto]' : ''}`}
            >
              <div className={`relative aspect-[4/3] overflow-hidden rounded-xl bg-black ${i % 2 === 1 ? 'md:order-2' : ''}`}>
                {(p.ad_hero_image_url || p.image_url) ? (
                  <img
                    src={p.ad_hero_image_url ?? p.image_url ?? ''}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/20">—</div>
                )}
              </div>
              <div className={i % 2 === 1 ? 'md:order-1' : ''}>
                <p className="text-2xl font-black uppercase tracking-tight">{p.name}</p>
                {p.description && (
                  <p className="mt-2 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/55">{p.description}</p>
                )}
                <p className="mt-3 text-lg font-black text-[#f0a500]">{price(p.price)}</p>
              </div>
              <span className={`hidden shrink-0 rounded-full border border-[#f0a500] px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#f0a500] transition group-hover:bg-[#f0a500] group-hover:text-black md:block ${i % 2 === 1 ? 'md:order-3' : ''}`}>
                View
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Brand story */}
      <section className="border-y border-white/10 bg-[#111] py-20">
        <div className="mx-auto max-w-3xl px-5 md:px-10">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#f0a500]">The Mission</p>
          <p className="mt-6 text-2xl font-bold leading-relaxed text-white/90 md:text-3xl">{site.brand_story}</p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 text-center">
        <div className="mx-auto max-w-2xl px-5 md:px-10">
          <h2 className="text-4xl font-black uppercase tracking-tighter md:text-6xl">{site.cta_banner.headline}</h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/60">{site.cta_banner.subtext}</p>
          <Link
            href={shopUrl}
            className="mt-10 inline-block skew-x-[-6deg] bg-[#f0a500] px-12 py-5 text-sm font-black uppercase tracking-[0.25em] text-black shadow-[8px_8px_0_rgba(240,165,0,0.25)] transition hover:bg-amber-400 active:translate-y-0.5"
          >
            <span className="inline-block skew-x-[6deg]">{site.cta_banner.button_label}</span>
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 md:flex-row md:px-10">
          <p className="text-sm font-black uppercase tracking-tight">{shop.shop_name}</p>
          <Link href={shopUrl} className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 transition hover:text-white">
            Full Boutique & Checkout
          </Link>
          <p className="text-[10px] uppercase tracking-widest text-white/30">Site generated by Sanndikaa AI</p>
        </div>
      </footer>
    </div>
  );
}
