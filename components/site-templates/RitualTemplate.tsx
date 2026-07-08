import Link from 'next/link';
import type { SiteTemplateProps } from '@/lib/siteTemplates';

// RITUAL — Beauty & Cosmetics.
// Structure: centered-logo nav with split links → split hero (copy left, media
// in an ARCH mask right) → "The Ritual" 3-step band → symmetric product cards →
// brand story on soft gradient → CTA card → footer. Cream + pastel palette.

function price(p: number | null) {
  return p == null ? '' : `D${Number(p).toLocaleString()}`;
}

export default function RitualTemplate({ shop, products, config, heroMedia }: SiteTemplateProps) {
  const { site } = config;
  // Null-safe + lowercase (Law 2 slug safety): a missing slug falls back to the
  // mall root instead of minting a broken /shop/null link.
  const shopUrl = shop.shop_slug ? `/shop/${shop.shop_slug.toLowerCase()}` : '/';

  return (
    <div className="min-h-screen bg-[#FBF7F0] font-sans text-stone-800">

      {/* Nav — centered logo, links split either side */}
      <nav className="sticky top-0 z-50 border-b border-stone-200/70 bg-[#FBF7F0]/90 backdrop-blur-md">
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-3 items-center px-5 md:px-10">
          <div className="flex gap-6">
            <a href="#ritual" className="text-[10px] font-bold uppercase tracking-[0.25em] text-stone-400 transition hover:text-stone-800">The Ritual</a>
            <a href="#collection" className="hidden text-[10px] font-bold uppercase tracking-[0.25em] text-stone-400 transition hover:text-stone-800 md:block">Collection</a>
          </div>
          <div className="text-center">
            <span className="font-serif text-lg font-bold tracking-wide">{shop.shop_name}</span>
          </div>
          <div className="flex justify-end">
            <Link href={shopUrl} className="rounded-full border border-stone-300 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600 transition hover:border-stone-800 hover:text-stone-900">
              Boutique
            </Link>
          </div>
        </div>
      </nav>

      {/* Split hero with arch-masked media */}
      <header className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 py-16 md:grid-cols-2 md:px-10 md:py-24">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-rose-300">{site.tagline}</p>
          <h1 className="mt-5 font-serif text-5xl font-bold leading-[1.05] tracking-tight text-stone-900 md:text-6xl">
            {site.hero_headline}
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-stone-500">{site.hero_subheadline}</p>
          <a
            href="#collection"
            className="mt-9 inline-block rounded-full bg-stone-900 px-9 py-4 text-[10px] font-bold uppercase tracking-[0.25em] text-white shadow-lg transition hover:bg-stone-700"
          >
            Begin The Ritual
          </a>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          {/* soft aura */}
          <div className="absolute -inset-6 rounded-t-full rounded-b-[3rem] bg-gradient-to-b from-rose-100 via-amber-50 to-transparent" />
          <div className="relative aspect-[3/4] overflow-hidden rounded-t-full rounded-b-[2rem] shadow-2xl ring-1 ring-stone-200">
            {heroMedia?.type === 'video' ? (
              <video
                src={heroMedia.url}
                poster={heroMedia.poster ?? undefined}
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover"
              />
            ) : heroMedia ? (
              <img src={heroMedia.url} alt={shop.shop_name ?? 'Hero'} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-b from-rose-100 to-amber-100" />
            )}
          </div>
        </div>
      </header>

      {/* "The Ritual" 3-step band */}
      <section id="ritual" className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-rose-300">The Ritual</p>
            <h2 className="mt-3 font-serif text-4xl font-bold tracking-tight text-stone-900">Three quiet promises</h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-3">
            {site.value_props.map((v, i) => (
              <div key={v.title} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FBF7F0] font-serif text-lg font-bold text-stone-500 ring-1 ring-stone-200">
                  0{i + 1}
                </div>
                <p className="mt-5 font-serif text-xl font-bold text-stone-900">{v.title}</p>
                <p className="mx-auto mt-2.5 max-w-xs text-sm leading-relaxed text-stone-500">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Symmetric product cards */}
      <section id="collection" className="mx-auto max-w-6xl px-5 py-20 md:px-10 md:py-24">
        <div className="text-center">
          <h2 className="font-serif text-4xl font-bold tracking-tight text-stone-900">{site.collection_title}</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-stone-500">{site.collection_intro}</p>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-8">
          {products.slice(0, 6).map((p) => (
            <Link
              key={p.id}
              href={`/product/${p.id}`}
              className="group rounded-[1.75rem] bg-white p-3 shadow-[0_10px_40px_-18px_rgba(120,90,60,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-16px_rgba(120,90,60,0.45)]"
            >
              <div className="aspect-square overflow-hidden rounded-[1.35rem] bg-[#FBF7F0]">
                {(p.ad_hero_image_url || p.image_url) ? (
                  <img
                    src={p.ad_hero_image_url ?? p.image_url ?? ''}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-stone-300">—</div>
                )}
              </div>
              <div className="px-2 py-4 text-center">
                <p className="font-serif text-base font-bold text-stone-900">{p.name}</p>
                <p className="mt-1 text-sm text-stone-400">{price(p.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Brand story on gradient */}
      <section className="bg-gradient-to-b from-rose-50 via-[#FBF7F0] to-amber-50 py-24">
        <div className="mx-auto max-w-2xl px-5 text-center md:px-10">
          <div className="mx-auto h-px w-14 bg-rose-200" />
          <p className="mt-8 font-serif text-2xl font-medium leading-relaxed text-stone-700">
            {site.brand_story}
          </p>
          <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">— {shop.shop_name}</p>
        </div>
      </section>

      {/* CTA card */}
      <section className="mx-auto max-w-6xl px-5 pb-24 md:px-10">
        <div className="rounded-[2.5rem] bg-stone-900 px-8 py-16 text-center shadow-2xl md:px-16">
          <h2 className="font-serif text-3xl font-bold tracking-tight text-white md:text-5xl">{site.cta_banner.headline}</h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-stone-300">{site.cta_banner.subtext}</p>
          <Link
            href={shopUrl}
            className="mt-9 inline-block rounded-full bg-[#FBF7F0] px-10 py-4 text-[10px] font-bold uppercase tracking-[0.25em] text-stone-900 transition hover:bg-white"
          >
            {site.cta_banner.button_label}
          </Link>
        </div>
      </section>

      <footer className="border-t border-stone-200 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 md:flex-row md:px-10">
          <p className="font-serif text-sm font-bold text-stone-700">{shop.shop_name}</p>
          <Link href={shopUrl} className="text-[10px] font-bold uppercase tracking-[0.25em] text-stone-400 transition hover:text-stone-800">
            Full Boutique & Checkout
          </Link>
          <p className="text-[10px] uppercase tracking-widest text-stone-300">Site generated by Sanndikaa AI</p>
        </div>
      </footer>
    </div>
  );
}
