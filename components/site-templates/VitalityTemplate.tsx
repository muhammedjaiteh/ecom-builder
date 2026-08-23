import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import GatedVideo from '@/components/site-templates/GatedVideo';
import Reveal from '@/components/site-templates/Reveal';
import SiteSearch from '@/components/site-templates/SiteSearch';
import { siteBasePath, siteCollectionsPath, siteProductPath, type SiteTemplateProps } from '@/lib/siteTemplates';

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
  // Omnichannel hygiene (Phase 9): primary journeys stay on the branded site.
  // Nav/CTA route to the on-site catalog; product rows open the on-site PDP —
  // the same siteProductPath helper the chromes use (slugless previews keep
  // the honest legacy fallback). The ONE deliberate classic-boutique escape is
  // the footer link, and — per the documented RitualChrome:119-120 pattern —
  // /shop matches the RAW stored slug, so encode it as-is: lowercasing a
  // legacy value would 404.
  const shopUrl = shop.shop_slug ? `/shop/${encodeURIComponent(shop.shop_slug)}` : '/';
  const collectionsHref = siteCollectionsPath(shop) ?? '#lineup';
  const productHref = (id: string) => siteProductPath(shop, id) ?? `/product/${id}`;
  const categoryCount = new Set(products.map((p) => p.category).filter(Boolean)).size || 1;

  return (
    <div className="min-h-screen bg-[#0C0C0C] font-sans text-white">

      {/* Nav — bold left wordmark, pill CTA right */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0C0C0C]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-10">
          <span className="text-lg font-black uppercase tracking-tight">{shop.shop_name}</span>
          <div className="flex items-center gap-3 md:gap-6">
            <a href="#lineup" className="hidden min-h-11 items-center text-[10px] font-black uppercase tracking-[0.25em] text-white/50 transition hover:text-white md:inline-flex">The Lineup</a>
            {/* Client island: shop-scoped search (neutral/dark dialect). */}
            <SiteSearch tone="neutral" shopId={shop.id} basePath={siteBasePath(shop)} shopName={shop.shop_name} />
            <Link
              href={collectionsHref}
              className="inline-flex min-h-11 items-center rounded-full bg-[#f0a500] px-6 text-[10px] font-black uppercase tracking-[0.2em] text-black transition hover:bg-amber-400 active:scale-95"
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
            // 2G media gate: unconstrained networks autoplay exactly as
            // before; save-data/2g/3g/reduced-motion get the ad poster (or
            // the template gradient) with a ≥44px gold tap-to-play pill.
            <GatedVideo
              src={heroMedia.url}
              poster={heroMedia.poster}
              alt={shop.shop_name ?? 'Hero'}
              className="absolute inset-0 h-full w-full object-cover opacity-40"
              posterSizes="100vw"
              posterBlurTone="dark"
              posterPriority
              fallback={<div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[#141414] via-[#0C0C0C] to-amber-950/40" />}
              playButtonClassName="absolute left-1/2 top-1/2 z-10 flex min-h-11 -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-full bg-[#f0a500] px-7 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-lg transition hover:bg-amber-400 active:scale-95"
            />
          ) : heroMedia ? (
            <SmartImage
              src={heroMedia.url}
              alt={shop.shop_name ?? 'Hero'}
              fill
              priority
              sizes="100vw"
              blurTone="dark"
              className="object-cover opacity-40"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#141414] via-[#0C0C0C] to-amber-950/40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0C0C0C] via-transparent to-black/40" />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 pb-32 pt-20 md:px-10 md:pb-44 md:pt-28">
          <p className="inline-block rounded-sm bg-[#f0a500] px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-black">
            {site.tagline}
          </p>
          {/* Quiet-luxury type cap (Beta QA pass): 6xl/8xl → 5xl/6xl with
              breathing leading — the condensed dialect survives, the shout
              does not. */}
          <h1 className="mt-6 max-w-4xl text-5xl font-black uppercase leading-[1.02] tracking-tight md:text-6xl">
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

      {/* Stats band — fade-in-up on scroll (static under reduced motion
          and in editor previews — see Reveal.tsx). */}
      <section className="mx-auto max-w-7xl px-5 py-16 md:px-10">
        <Reveal className="grid grid-cols-3 divide-x divide-white/10 text-center">
          {[
            { n: `${products.length}`, label: 'Products In The Lineup' },
            { n: `${categoryCount}`, label: categoryCount === 1 ? 'Focused Category' : 'Categories Covered' },
            // Truthful signal only (Law 4 integrity): checkout on this site
            // IS a direct WhatsApp conversation with the seller — never claim
            // protections the platform does not operate.
            { n: '1:1', label: 'Direct WhatsApp Checkout' },
          ].map((s) => (
            <div key={s.label} className="px-4">
              <p className="text-4xl font-black tracking-tighter text-[#f0a500] md:text-5xl">{s.n}</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.25em] text-white/50">{s.label}</p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* Gold value-prop stripes — sibling stagger as they co-enter the fold */}
      <section className="space-y-3 py-8">
        {site.value_props.map((v, i) => (
          <Reveal key={v.title} delay={i * 0.08}>
            <div
              className={`flex flex-col gap-1 border-y border-white/10 px-5 py-6 md:flex-row md:items-center md:gap-10 md:px-10 ${i === 1 ? 'bg-[#f0a500] text-black' : 'bg-[#111]'}`}
            >
              <p className={`w-full shrink-0 text-2xl font-black uppercase tracking-tight md:w-96 ${i === 1 ? 'text-black' : 'text-white'}`}>
                {v.title}
              </p>
              <p className={`text-sm leading-relaxed ${i === 1 ? 'text-black/70' : 'text-white/60'}`}>{v.body}</p>
            </div>
          </Reveal>
        ))}
      </section>

      {/* Benefit-led product rows */}
      <section id="lineup" className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-24">
        <Reveal>
          <h2 className="text-4xl font-black uppercase tracking-tight md:text-5xl">{site.collection_title}</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">{site.collection_intro}</p>
        </Reveal>

        <div className="mt-14 space-y-8">
          {products.slice(0, 6).map((p, i) => (
            <Reveal key={p.id} delay={Math.min(i, 2) * 0.06}>
            <Link
              href={productHref(p.id)}
              className={`group grid grid-cols-1 items-center gap-6 rounded-2xl border border-white/10 bg-[#111] p-5 transition-all duration-300 hover:border-[#f0a500]/50 hover:bg-[#151515] md:grid-cols-[280px_1fr_auto] ${i % 2 === 1 ? 'md:grid-cols-[1fr_280px_auto]' : ''}`}
            >
              <div className={`relative aspect-[4/3] overflow-hidden rounded-xl bg-black ${i % 2 === 1 ? 'md:order-2' : ''}`}>
                {(p.ad_hero_image_url || p.image_url) ? (
                  <SmartImage
                    src={p.ad_hero_image_url ?? p.image_url ?? ''}
                    alt={p.name}
                    fill
                    sizes="(min-width: 768px) 280px, 100vw"
                    blurTone="dark"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
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
            </Reveal>
          ))}
        </div>
      </section>

      {/* Brand story */}
      <section className="border-y border-white/10 bg-[#111] py-20 md:py-24">
        <Reveal className="mx-auto max-w-3xl px-5 md:px-10">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#f0a500]">The Mission</p>
          <p className="mt-6 text-2xl font-bold leading-relaxed text-white/90 md:text-3xl">{site.brand_story}</p>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="py-24 text-center">
        <Reveal className="mx-auto max-w-2xl px-5 md:px-10">
          <h2 className="text-4xl font-black uppercase tracking-tight md:text-5xl">{site.cta_banner.headline}</h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/60">{site.cta_banner.subtext}</p>
          <Link
            href={collectionsHref}
            className="mt-10 inline-block skew-x-[-6deg] bg-[#f0a500] px-12 py-5 text-sm font-black uppercase tracking-[0.25em] text-black shadow-[8px_8px_0_rgba(240,165,0,0.25)] transition hover:bg-amber-400 active:translate-y-0.5"
          >
            <span className="inline-block skew-x-[6deg]">{site.cta_banner.button_label}</span>
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 md:flex-row md:px-10">
          <p className="text-sm font-black uppercase tracking-tight">{shop.shop_name}</p>
          {/* Deliberate classic-boutique escape (footer only) — mirrors the
              chromes' "View classic boutique" contract. */}
          <Link href={shopUrl} className="inline-flex min-h-11 items-center text-[10px] font-black uppercase tracking-[0.25em] text-white/40 transition hover:text-white">
            View classic boutique
          </Link>
          <p className="text-[10px] uppercase tracking-widest text-white/30">Site generated by Sanndikaa AI</p>
        </div>
      </footer>
    </div>
  );
}
