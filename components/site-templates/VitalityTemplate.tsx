import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import CartBagButton from '@/components/site-templates/CartBagButton';
import CategoryNav, { categoryAnchorId, distinctCategories } from '@/components/site-templates/CategoryNav';
import EditableText from '@/components/site-templates/EditableText';
import GatedVideo from '@/components/site-templates/GatedVideo';
import HeroBrandPlate from '@/components/site-templates/HeroBrandPlate';
import ProductCollage, { picturedProducts } from '@/components/site-templates/ProductCollage';
import Reveal from '@/components/site-templates/Reveal';
import SiteMarquee from '@/components/site-templates/SiteMarquee';
import SiteSearch from '@/components/site-templates/SiteSearch';
import StoryClamp from '@/components/site-templates/StoryClamp';
import { neutralStockBadge } from '@/components/site-templates/chrome/NeutralChrome';
import {
  findBlock,
  resolveVisibleBlocks,
  siteBasePath,
  siteCollectionsPath,
  siteProductPath,
  type SiteBlock,
  type SiteProduct,
  type SiteTemplateProps,
} from '@/lib/siteTemplates';
import { buildWhatsAppLink } from '@/lib/orderFlow';
import { siteThemeStyle } from '@/lib/siteTheme';

// VITALITY — Health, Fitness & Bold General Brands.
// Structure: bold nav with pill CTA → dark full-width hero with condensed
// uppercase type and DIAGONAL bottom edge → kinetic value-props marquee
// (Fix 2: the static gold stripes were retired — the value_props render as
// the moving banner, edited from the SectionRail inspector) → stats band
// (large numerals) → benefit-led horizontal product rows → brand story
// (3-line StoryClamp teaser) → CTA → footer. Near-black + electric gold.
//
// COCKPIT ADMISSION (Hotfix 2): the high-contrast-street archetype made
// vitality a first-class GENERATED base, so this template is now an editable
// cockpit surface (EDITABLE_TEMPLATE_COMPONENTS). The FIXED-SLOT contract
// stays — sections render in this file's deterministic positions (first
// visible block of each type wins, never array order) — but every section is
// now ANCHORED to its block: data-block-section on the wrapper and
// EditableText/data-block-field on every copy node (inert data attributes on
// the public site, exactly like RitualTemplate's), and a hidden/removed block
// skips its slot via resolveVisibleBlocks. Copy reads from the block — the
// writers keep it byte-identical to the retired site.* reads
// (blocksToLegacySite mirror), so every stored row renders unchanged.
// value_props stay marquee-only (rail-edited — an animated track is a hostile
// edit target); product_tabs/video_hero have NO slot in this dialect, so the
// editor's add catalog excludes them here (editorModel addableSectionCatalog).

function price(p: number | null) {
  return p == null ? '' : `D${Number(p).toLocaleString()}`;
}

type TestimonialsBlock = Extract<SiteBlock, { type: 'testimonials' }>;
type SplitCtaBlock = Extract<SiteBlock, { type: 'split_cta' }>;

// ── Inspector depth (Pillar 4): per-dialect padding/align class maps ─────────
// Coverage in the VITALITY dialect: the classic anatomy keeps its fixed
// street spacing (block-anchored since the cockpit admission, but padding/
// align stay unconsumed there — the documented editorial-cta precedent for a
// dialect that owns its own rhythm), so ONLY the archetype-slot sections
// consume — padding + align (heading) on testimonials, padding on split_cta.
type PadKey = 'compact' | 'default' | 'spacious';
function vitalityPad(p: PadKey | undefined, map: Record<PadKey, string>): string {
  return map[p ?? 'default'];
}
const PAD_16_20: Record<PadKey, string> = {
  compact: 'py-10 md:py-12',
  default: 'py-16 md:py-20',
  spacious: 'py-24 md:py-32',
};


// Archetype pass (Pillar 3): customer receipts in the street dialect — dark
// cards, condensed uppercase attribution, accent quote marks. Items are
// seeded exclusively from real reviews (integrity law).
function VitalityTestimonials({ block }: { block: TestimonialsBlock }) {
  // Pass 3: an empty testimonials block renders NOTHING — never a heading
  // over a void. (The block stays in the config/rail for the editor.)
  if (block.items.length === 0) return null;
  return (
    // padding/align consumption (Pillar 4): quotes spacing + heading alignment.
    <section data-block-section={block.id} className={`mx-auto max-w-7xl px-5 md:px-10 ${vitalityPad(block.padding, PAD_16_20)}`}>
      {block.title && (
        <EditableText as="h2" blockId={block.id} field="title" className={`text-3xl font-black uppercase tracking-tight md:text-4xl ${block.align === 'center' ? 'text-center' : ''}`}>
          {block.title}
        </EditableText>
      )}
      <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 ${block.title ? 'mt-10' : ''}`}>
        {block.items.map((item, i) => (
          <figure key={`${block.id}-quote-${i}`} className="rounded-2xl border border-white/10 bg-[#111] p-6 md:p-8">
            <span aria-hidden className="text-4xl font-black leading-none text-[var(--site-accent,#f0a500)]">&ldquo;</span>
            <EditableText
              as="blockquote"
              blockId={block.id}
              field={`items.${i}.quote`}
              className="mt-2 text-base font-bold leading-relaxed text-white/90 md:text-lg"
            >
              {item.quote}
            </EditableText>
            <figcaption className="mt-4">
              <EditableText
                as="span"
                blockId={block.id}
                field={`items.${i}.author`}
                className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40"
              >
                {item.author}
              </EditableText>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

// Archetype pass (Pillar 3): the two-panel spread — copy beside a product
// panel. Pass 3: the panel shows the merchant's own pieces (ProductCollage —
// up to two, linked, priced) instead of a 10rem monogram; a shop with no
// pictured product gets a plain accent plate. Skewed CTA keeps the street
// register; the plate rides --site-accent with the electric-gold default.
function VitalitySplitCta({ block, products, productHref, collectionsHref }: {
  block: SplitCtaBlock;
  products: SiteProduct[];
  productHref: (id: string) => string;
  collectionsHref: string;
}) {
  const hasCollage = picturedProducts(products, 1).length > 0;
  return (
    // padding consumption (Pillar 4): split-spread spacing. The skewed CTA
    // deliberately skips the radius token — skew + radius breaks the dialect.
    <section data-block-section={block.id} className={`mx-auto max-w-7xl px-5 md:px-10 ${vitalityPad(block.padding, PAD_16_20)}`}>
      <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-white/10 md:grid-cols-2">
        <div className="flex flex-col justify-center gap-5 bg-[#111] p-8 md:p-12">
          <EditableText as="h2" blockId={block.id} field="headline" className="text-3xl font-black uppercase leading-tight tracking-tight md:text-4xl">
            {block.headline}
          </EditableText>
          <EditableText as="p" blockId={block.id} field="body" className="max-w-md text-sm leading-relaxed text-white/60 md:text-base">
            {block.body}
          </EditableText>
          <Link
            href={collectionsHref}
            data-block-id={block.id}
            data-block-field="button_label"
            className="mt-2 inline-block skew-x-[-6deg] self-start bg-[var(--site-accent,#f0a500)] px-9 py-4 text-xs font-black uppercase tracking-[0.25em] text-black transition hover:brightness-110 active:translate-y-0.5"
          >
            <span className="inline-block skew-x-[6deg]">{block.button_label}</span>
          </Link>
        </div>
        {hasCollage ? (
          <div className="bg-[#0C0C0C] p-5 md:p-10">
            <ProductCollage tone="neutral" products={products} hrefFor={productHref} />
          </div>
        ) : (
          <div aria-hidden className="relative min-h-[140px] bg-[var(--site-accent,#f0a500)] md:min-h-[300px]">
            <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,0,0,0.25),transparent_60%)]" />
          </div>
        )}
      </div>
    </section>
  );
}

export default function VitalityTemplate({ shop, products, config, heroMedia }: SiteTemplateProps) {
  // Cockpit admission (see header): EVERY section is block-anchored now. The
  // classic anatomy reads its copy from the first VISIBLE block of each type
  // (byte-identical to the retired site.* reads on every stored row — the
  // writers keep the mirror in sync); the archetype slots keep their
  // deterministic positions — testimonials after the Brand story, the split
  // spread after that (before the CTA). A hidden/removed block skips its slot.
  const visibleBlocks = resolveVisibleBlocks(config);
  const heroBlock = findBlock(visibleBlocks, 'hero_banner');
  const gridBlock = findBlock(visibleBlocks, 'product_grid');
  const storyBlock = findBlock(visibleBlocks, 'story_text');
  const ctaBlock = findBlock(visibleBlocks, 'cta_banner');
  const testimonialsBlock = findBlock(visibleBlocks, 'testimonials');
  const splitCtaBlock = findBlock(visibleBlocks, 'split_cta');
  // Omnichannel hygiene (Phase 9): primary journeys stay on the branded site.
  // Nav/CTA route to the on-site catalog; product rows open the on-site PDP —
  // the same siteProductPath helper the chromes use (slugless previews keep
  // the honest legacy fallback). The ONE deliberate classic-boutique escape is
  // the footer link, and — per the documented RitualChrome:119-120 pattern —
  // /shop matches the RAW stored slug, so encode it as-is: lowercasing a
  // legacy value would 404. ?classic=1: the Pillar-1 /shop server bridge 307s
  // published-site shops back to /site — the escape's documented bypass.
  const shopUrl = shop.shop_slug ? `/shop/${encodeURIComponent(shop.shop_slug)}?classic=1` : '/';
  const collectionsPath = siteCollectionsPath(shop);
  const collectionsHref = collectionsPath ?? '#lineup';
  const productHref = (id: string) => siteProductPath(shop, id) ?? `/product/${id}`;
  // Pass 3: the stats band ("N products · 1:1 WhatsApp checkout") was retired
  // as filler; the hero→lineup seam now carries CATEGORY DISCOVERY — the
  // merchant's real categories as chips deep-linking into /collections
  // (nothing renders below two categories or in slugless previews).
  const categories = collectionsPath ? distinctCategories(products) : [];
  const lineup = products.slice(0, 6);
  const whatsAppHref = buildWhatsAppLink(
    shop.phone,
    `Hello ${shop.shop_name ?? 'there'}! I'm browsing your website and have a question.`
  );

  return (
    // THEME SEAM: a themed config sets --site-accent/--site-serif here (this
    // legacy home template is its own root; the shared sub-pages ride
    // NeutralChrome's identical seam). Absent theme → no style attribute and
    // every var() fallback keeps the electric-gold defaults.
    <div className="min-h-screen bg-[var(--site-bg,#0C0C0C)] font-sans text-[var(--site-text,#ffffff)]" style={siteThemeStyle(config)}>

      {/* Nav — bold left wordmark, pill CTA right */}
      {/* sticky_nav (Pillar 4): absent/true = the historical sticky nav; false = static. */}
      <nav className={`${config.theme?.sticky_nav === false ? 'relative' : 'sticky top-0'} z-50 border-b border-white/10 bg-[color-mix(in_srgb,var(--site-bg,#0C0C0C)_90%,transparent)] backdrop-blur-md`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-5 md:px-10">
          {/* Pass 3 mobile header law: the wordmark owns the row below md
              (min-w-0 flex-1, truncating long names instead of pushing the
              icons out), flanked ONLY by Search + Bag; the pill joins from md. */}
          <span className="min-w-0 flex-1 truncate text-lg font-black uppercase tracking-tight md:flex-none">{shop.shop_name}</span>
          <div className="flex shrink-0 items-center gap-1 md:gap-6">
            <a href="#lineup" className="hidden min-h-11 items-center text-[10px] font-black uppercase tracking-[0.25em] text-[color-mix(in_srgb,var(--site-text,#fff)_60%,transparent)] transition hover:text-[var(--site-text,#ffffff)] md:inline-flex">The Lineup</a>
            {/* Client islands: shop-scoped search + live cart trigger (the
                bag was missing from this home nav — the PDP adds to a cart
                the shopper could not reopen from here). */}
            <SiteSearch tone="neutral" shopId={shop.id} basePath={siteBasePath(shop)} shopName={shop.shop_name} />
            <CartBagButton tone="neutral" />
            <Link
              href={collectionsHref}
              className="hidden min-h-11 items-center rounded-[var(--site-radius,9999px)] bg-[var(--site-accent,#f0a500)] px-6 text-[10px] font-black uppercase tracking-[0.2em] text-black transition hover:brightness-110 active:scale-95 md:inline-flex"
            >
              Shop Direct
            </Link>
          </div>
        </div>
      </nav>

      {/* Dark hero with diagonal bottom edge — anchored to the hero_banner
          block (data-block-section + copy markers) for the cockpit canvas;
          hiding/removing the block skips the whole header, marquee tagline
          falls back to the site.* mirror (SiteMarquee). */}
      {heroBlock && (
      <header data-block-section={heroBlock.id} className="relative overflow-hidden" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 92%, 0 100%)' }}>
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
              playButtonClassName="absolute left-1/2 top-1/2 z-10 flex min-h-11 -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-full bg-[var(--site-accent,#f0a500)] px-7 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-lg transition hover:brightness-110 active:scale-95"
            />
          ) : heroMedia ? (
            <SmartImage
              src={heroMedia.url}
              alt={shop.shop_name ?? 'Hero'}
              fill
              priority
              sizes="100vw"
              blurTone="dark"
              // .sndk-parallax: pure-CSS scroll depth (archetype pass) —
              // static where scroll-timelines/motion are unavailable.
              className="sndk-parallax object-cover opacity-40"
            />
          ) : (
            /* Null tier (Pillar 4b): the animated brand plate — same gradient
               stops, panned, with the accent glow + monogram. */
            <HeroBrandPlate tone="vitality" shopName={shop.shop_name} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0C0C0C] via-transparent to-black/40" />
        </div>

        {/* Pass 3 fold discipline: pb-32/pt-20 → pb-24/pt-14 on phones so the
            lineup's first row is reachable in one swipe (md keeps the street
            scale minus the deepest slab). */}
        <div className="relative mx-auto max-w-7xl px-5 pb-24 pt-14 md:px-10 md:pb-36 md:pt-28">
          {/* tagline is schema-optional on the block (every stored row carries
              it — the legacy projection copies site.tagline); clearing it in
              the cockpit drops the chip, exactly like Ritual's. */}
          {heroBlock.tagline && (
            <EditableText
              as="p"
              blockId={heroBlock.id}
              field="tagline"
              className="inline-block rounded-sm bg-[var(--site-accent,#f0a500)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-black"
            >
              {heroBlock.tagline}
            </EditableText>
          )}
          {/* Quiet-luxury type cap (Beta QA pass): 6xl/8xl → 5xl/6xl with
              breathing leading — the condensed dialect survives, the shout
              does not. */}
          <EditableText
            as="h1"
            blockId={heroBlock.id}
            field="headline"
            className="mt-5 max-w-4xl text-4xl font-black uppercase leading-[1.02] tracking-tight text-balance break-words md:text-6xl"
          >
            {heroBlock.headline}
          </EditableText>
          <EditableText
            as="p"
            blockId={heroBlock.id}
            field="subheadline"
            className="mt-5 max-w-xl text-base leading-relaxed text-[color-mix(in_srgb,var(--site-text,#fff)_75%,transparent)] md:text-lg"
          >
            {heroBlock.subheadline}
          </EditableText>
          <a
            href="#lineup"
            className="mt-8 inline-block min-h-12 skew-x-[-6deg] bg-[var(--site-accent,#f0a500)] px-10 py-4 text-xs font-black uppercase tracking-[0.25em] text-black shadow-[6px_6px_0_color-mix(in_srgb,var(--site-accent,#f0a500)_25%,transparent)] transition hover:brightness-110 active:translate-y-0.5 md:mt-10"
          >
            <span className="inline-block skew-x-[6deg]">See The Lineup</span>
          </a>
        </div>
      </header>
      )}

      {/* Kinetic marquee on the hero→stats seam — pure CSS, never wrapped in
          Reveal (it is already motion). Fix 2: this ribbon IS the value-props
          surface (the static gold stripes were retired). */}
      <SiteMarquee config={config} tone="vitality" />

      {/* Category discovery (Pass 3) — replaces the retired stats band. */}
      {collectionsPath && categories.length >= 2 && (
        <section className="mx-auto max-w-7xl px-5 pt-10 md:px-10 md:pt-14">
          <CategoryNav
            tone="neutral"
            categories={categories}
            hrefFor={(c) => `${collectionsPath}#${categoryAnchorId(c)}`}
          />
        </section>
      )}

      {/* Benefit-led product rows — anchored to the product_grid block. The
          rows themselves are this dialect's fixed anatomy (displayMode has no
          surface here — the grid/carousel switch belongs to ritual/editorial). */}
      {gridBlock && (
      <section id="lineup" data-block-section={gridBlock.id} className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-24">
        <Reveal>
          <EditableText as="h2" blockId={gridBlock.id} field="title" className="text-3xl font-black uppercase tracking-tight text-balance md:text-5xl">
            {gridBlock.title}
          </EditableText>
          <EditableText
            as="p"
            blockId={gridBlock.id}
            field="intro"
            className="mt-3 max-w-xl text-sm leading-relaxed text-[color-mix(in_srgb,var(--site-text,#fff)_60%,transparent)]"
          >
            {gridBlock.intro}
          </EditableText>
        </Reveal>

        {/* Pass 3 row anatomy: phones get a compact two-column card (square
            thumb + name/price/stock) so six pieces fit in two screens; md
            keeps the alternating wide rows. Price sits directly under the
            name, live stock badge beside it; the row is one tap target. */}
        <div className="mt-10 space-y-4 md:mt-14 md:space-y-8">
          {lineup.map((p, i) => {
            const badge = neutralStockBadge(p.stock_quantity);
            return (
            <Reveal key={p.id} delay={Math.min(i, 2) * 0.06}>
            <Link
              href={productHref(p.id)}
              className={`group grid grid-cols-[112px_1fr] items-center gap-4 rounded-2xl border border-white/10 bg-[#111] p-3 transition-all duration-300 hover:border-[color-mix(in_srgb,var(--site-accent,#f0a500)_50%,transparent)] hover:bg-[#151515] md:gap-6 md:p-5 ${i % 2 === 1 ? 'md:grid-cols-[1fr_280px_auto]' : 'md:grid-cols-[280px_1fr_auto]'}`}
            >
              <div className={`relative aspect-square overflow-hidden rounded-xl bg-black md:aspect-[4/3] ${i % 2 === 1 ? 'md:order-2' : ''}`}>
                {(p.ad_hero_image_url || p.image_url) ? (
                  <SmartImage
                    src={p.ad_hero_image_url ?? p.image_url ?? ''}
                    alt={p.name}
                    fill
                    sizes="(min-width: 768px) 280px, 112px"
                    blurTone="dark"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/20">—</div>
                )}
              </div>
              <div className={`min-w-0 ${i % 2 === 1 ? 'md:order-1' : ''}`}>
                {p.category && (
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/60">{p.category}</p>
                )}
                <p className="mt-0.5 line-clamp-2 text-lg font-black uppercase leading-tight tracking-tight md:text-2xl">{p.name}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xl font-black text-[var(--site-accent,#f0a500)]">{price(p.price)}</span>
                  {badge && (
                    <span className={`rounded-sm px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                      badge.tone === 'out' ? 'bg-white text-black' : 'bg-[var(--site-accent,#f0a500)] text-black'
                    }`}>
                      {badge.label}
                    </span>
                  )}
                </p>
                {p.description && (
                  <p className="mt-2 hidden line-clamp-2 max-w-xl text-sm leading-relaxed text-white/60 md:block">{p.description}</p>
                )}
              </div>
              <span className={`hidden shrink-0 rounded-full border border-[var(--site-accent,#f0a500)] px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--site-accent,#f0a500)] transition group-hover:bg-[var(--site-accent,#f0a500)] group-hover:text-black md:block ${i % 2 === 1 ? 'md:order-3' : ''}`}>
                View
              </span>
            </Link>
            </Reveal>
            );
          })}
        </div>

        {/* Conversion bridge (Pass 3): the lineup shows six; the full catalog
            is one tap away — full-width on phones. */}
        {collectionsPath && products.length > 0 && (
          <div className="mt-8 md:mt-10">
            <Link
              href={collectionsPath}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--site-radius,9999px)] border border-[var(--site-accent,#f0a500)] px-8 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--site-accent,#f0a500)] transition hover:bg-[var(--site-accent,#f0a500)] hover:text-black active:scale-[0.98] sm:w-auto"
            >
              {products.length > lineup.length ? 'See The Full Lineup' : 'Browse The Collection'}
            </Link>
          </div>
        )}
      </section>
      )}

      {/* Brand story — anchored to the story_text block. */}
      {storyBlock && (
      <section data-block-section={storyBlock.id} className="border-y border-white/10 bg-[#111] py-20 md:py-24">
        <Reveal className="mx-auto max-w-3xl px-5 md:px-10">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--site-accent,#f0a500)]">The Mission</p>
          {/* Fix 1: 3-line teaser + Read-the-full-story reveal (fade matches
              this section's #111 panel). StoryClamp renders the bare copy node
              in editor previews, so the data-block targeting stays intact. */}
          <div className="mt-6">
            <StoryClamp tone="vitality">
              <EditableText
                as="p"
                blockId={storyBlock.id}
                field="body"
                className="text-2xl font-bold leading-relaxed text-[color-mix(in_srgb,var(--site-text,#fff)_90%,transparent)] md:text-3xl"
              >
                {storyBlock.body}
              </EditableText>
            </StoryClamp>
          </div>
        </Reveal>
      </section>
      )}

      {/* Archetype slots — render ONLY when the config carries the blocks. */}
      {testimonialsBlock && (
        <Reveal>
          <VitalityTestimonials block={testimonialsBlock} />
        </Reveal>
      )}
      {splitCtaBlock && (
        <Reveal>
          <VitalitySplitCta block={splitCtaBlock} products={lineup} productHref={productHref} collectionsHref={collectionsHref} />
        </Reveal>
      )}

      {/* CTA — anchored to the cta_banner block. Button copy carries the two
          data attributes on the Link itself (the documented interactive-node
          pattern — see EditableText's header); the click-capture's closest()
          walk resolves clicks on the inner skew span to it. */}
      {ctaBlock && (
      <section data-block-section={ctaBlock.id} className="py-24 text-center">
        <Reveal className="mx-auto max-w-2xl px-5 md:px-10">
          <EditableText as="h2" blockId={ctaBlock.id} field="headline" className="text-4xl font-black uppercase tracking-tight md:text-5xl">
            {ctaBlock.headline}
          </EditableText>
          <EditableText
            as="p"
            blockId={ctaBlock.id}
            field="subtext"
            className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-[color-mix(in_srgb,var(--site-text,#fff)_60%,transparent)]"
          >
            {ctaBlock.subtext}
          </EditableText>
          <Link
            href={collectionsHref}
            data-block-id={ctaBlock.id}
            data-block-field="button_label"
            className="mt-10 inline-block skew-x-[-6deg] bg-[var(--site-accent,#f0a500)] px-12 py-5 text-sm font-black uppercase tracking-[0.25em] text-black shadow-[8px_8px_0_color-mix(in_srgb,var(--site-accent,#f0a500)_25%,transparent)] transition hover:brightness-110 active:translate-y-0.5"
          >
            <span className="inline-block skew-x-[6deg]">{ctaBlock.button_label}</span>
          </Link>
        </Reveal>
      </section>
      )}

      <footer className="border-t border-white/10 py-10">
        {/* Pass 3: a full-width tactile WhatsApp action (the checkout
            channel) above the meta row, when the shop has a number. */}
        {whatsAppHref && (
          <div className="mx-auto mb-8 max-w-7xl px-5 md:px-10">
            <a
              href={whatsAppHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--site-radius,9999px)] border border-white/20 px-5 text-[10px] font-black uppercase tracking-[0.2em] text-white transition hover:border-[var(--site-accent,#f0a500)] hover:text-[var(--site-accent,#f0a500)] active:scale-[0.98] sm:w-auto"
            >
              Message us on WhatsApp
            </a>
          </div>
        )}
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 md:flex-row md:px-10">
          <p className="text-sm font-black uppercase tracking-tight">{shop.shop_name}</p>
          {/* Deliberate classic-boutique escape (footer only) — mirrors the
              chromes' "View classic boutique" contract. */}
          <Link href={shopUrl} className="inline-flex min-h-11 items-center text-[10px] font-black uppercase tracking-[0.25em] text-white/60 transition hover:text-white">
            View classic boutique
          </Link>
          <p className="text-[10px] uppercase tracking-widest text-white/50">Site generated by Sanndikaa AI</p>
        </div>
      </footer>
    </div>
  );
}
