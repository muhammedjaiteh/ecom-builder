import { Fragment } from 'react';
import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import {
  FEATURED_MAX,
  resolveHeroSignal,
  resolveRitualComposition,
  resolveVisibleBlocks,
  selectFeaturedProducts,
  siteCollectionsPath,
  type HeroMedia,
  type HeroSignal,
  type LayoutStrategy,
  type SiteBlock,
  type SiteShop,
  type SiteProduct,
  type SiteTemplateProps,
} from '@/lib/siteTemplates';
import CarouselTrack from './CarouselTrack';
import CategoryNav, { categoryAnchorId, distinctCategories } from './CategoryNav';
import EditableText from './EditableText';
import GatedVideo from './GatedVideo';
import HeroBrandPlate from './HeroBrandPlate';
import ProductCollage from './ProductCollage';
import ProductTabsIsland from './ProductTabsIsland';
import Reveal from './Reveal';
import SiteMarquee from './SiteMarquee';
import StoryClamp from './StoryClamp';
import VideoHeroMedia from './VideoHeroMedia';
import { buildWhatsAppLink } from '@/lib/orderFlow';
import RitualChrome, {
  RITUAL_BAND,
  RITUAL_HAIRLINE,
  RITUAL_SURFACE,
  RitualProductCard,
  ritualProductHref,
  type RitualCardRatio,
} from './chrome/RitualChrome';

// MINIMAL (template_key 'ritual') — Layout A.
// The anatomy of a premium minimal Shopify theme, in its Micro-Homepage cut:
// sticky logo nav → compact niche hero (≈40vh: one-sentence hook, an honest
// offer pill, ONE CTA) → kinetic value-props marquee (Fix 2: the static
// numbered band was retired — the value_props block renders as the moving
// brand ribbon under the hero, edited from the SectionRail inspector) →
// featured showcase (≤4 premium cards with image cross-fade, live stock
// badges) → "Explore Collection" bridge → brand-story strip (clamped to a
// 3-line teaser with a Read-the-full-story reveal — StoryClamp) → dark CTA
// banner → structured footer (shop info, delivery & pickup, contact).
// Warm off-white, stone ink.
//
// Micro-Homepage: ONE featured selection (selectFeaturedProducts) feeds both
// the hero pill (resolveHeroSignal on featured[0]) and the showcase grid, so
// the pill always describes what sits beneath it. Every new element (pill,
// bridge, cross-fade toggle) is conditionally rendered — no gray placeholders
// — and carries NO data-block-* attrs: the hero/grid SECTION owns editor
// targeting. New motion is CSS-only with a reduced-motion block (globals.css).
//
// Phase 3: the body renders from resolveBlocks(config) — one section per
// block, in block-array order. The deterministic legacy projection equals
// this template's exact historical anatomy (hero → values → grid → story →
// cta), so every stored row renders identically; a differing stored order is
// respected as-is. Copy nodes carry data-block-id/data-block-field for the
// dashboard Site Editor (inert on the public site).
//
// Phase 4: product_grid honors displayMode ('carousel' renders the shared
// scroll-snap CarouselTrack; absent/'grid' keeps the exact historical grid
// markup), and the seller-added product_tabs / video_hero blocks render in
// array order alongside the classic five. The grid/tabs/film section
// wrappers carry data-block-section markers for the Site Editor's floating
// settings chip — inert data attributes on the public site, exactly like the
// EditableText copy markers.
//
// Omnichannel router: the nav + footer live in chrome/RitualChrome (shared by
// /site home, /collections, and /products/[id]) and every journey stays on
// /site — product cards open the on-site PDP, collection CTAs open the full
// catalog page. The only /shop reference is the chrome footer's deliberate
// "View classic boutique" escape.

type HeroBlock = Extract<SiteBlock, { type: 'hero_banner' }>;
type ProductGridBlock = Extract<SiteBlock, { type: 'product_grid' }>;
type StoryBlock = Extract<SiteBlock, { type: 'story_text' }>;
type CtaBlock = Extract<SiteBlock, { type: 'cta_banner' }>;
type ProductTabsBlock = Extract<SiteBlock, { type: 'product_tabs' }>;
type VideoHeroBlock = Extract<SiteBlock, { type: 'video_hero' }>;
type TestimonialsBlock = Extract<SiteBlock, { type: 'testimonials' }>;
type SplitCtaBlock = Extract<SiteBlock, { type: 'split_cta' }>;

// ── Inspector depth (Pillar 4): per-dialect padding/align class maps ─────────
// Coverage in the RITUAL dialect: padding on product_grid / story_text /
// cta_banner / product_tabs / testimonials / split_cta; align on product_grid
// (header), story_text (copy column), cta_banner, testimonials (heading).
// Absent keys return the EXACT historical classes — byte-identical law.
type PadKey = 'compact' | 'default' | 'spacious';
function ritualPad(p: PadKey | undefined, map: Record<PadKey, string>): string {
  return map[p ?? 'default'];
}
// Pass 3 mobile rhythm: the md+ values are the historical desktop spacing;
// the base (phone) values step down one notch so a 360px screen is not 40%
// vertical padding between product rows.
const PAD_20_28: Record<PadKey, string> = {
  compact: 'py-10 md:py-16',
  default: 'py-14 md:py-28',
  spacious: 'py-20 md:py-40',
};
const PAD_16_24: Record<PadKey, string> = {
  compact: 'py-8 md:py-14',
  default: 'py-12 md:py-24',
  spacious: 'py-20 md:py-36',
};


// Phase 6B: hero/grid structural variants. The variant is read from
// config.layout_strategy (Phase 6A, strictly optional) — absent/'standard'
// (and any unknown value) falls through to the EXACT historical markup, so
// every stored legacy storefront renders byte-identically.
type HeroVariant = NonNullable<LayoutStrategy['hero']>;
type GridVariant = NonNullable<LayoutStrategy['grid']>;

// Phase 10D.1: recipe cuts. The cut is derived from resolveRitualComposition
// (Phase 10C) — 'counter' ONLY when the config asks for the Product-First
// recipe AND the live slice passes eligibility; every other recipe (classic,
// subtraction, and the not-yet-built gallery) passes undefined, so the
// sections render their exact historical markup.
type RitualCut = 'counter';

// Counter grid: the dense uniform wall — 2 / 3 / 4 / 5 columns with tight
// gaps, every tile the same 3:4 frame. Bounded, utilitarian, no air.
const COUNTER_GRID =
  'grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 md:gap-y-10 lg:grid-cols-4 xl:grid-cols-5';
const COUNTER_CARD_SIZES =
  '(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw';
// Counter section rhythm: one notch tighter than the grid's compact map.
const PAD_COUNTER: Record<PadKey, string> = {
  compact: 'py-6 md:py-10',
  default: 'py-8 md:py-12',
  spacious: 'py-12 md:py-20',
};

/** Sticky category strip — the counter's PRIMARY navigation. Pinned directly
 *  under the sticky nav (h-16 / md:h-20 → top-16 / md:top-20; a static nav
 *  pins it at top-0), one layer beneath the nav's z-50. Renders nothing below
 *  two categories or without a real /collections path (CategoryNav law), so a
 *  focused single-aisle shop never gets an empty sticky bar. Server-only, no
 *  data-block markers (like the marquee: not an editor target). */
function RitualCounterStrip({ categories, collectionsPath, stickyNav }: {
  categories: string[];
  collectionsPath: string | null;
  stickyNav: boolean;
}) {
  if (!collectionsPath || categories.length < 2) return null;
  return (
    <div className={`sticky ${stickyNav ? 'top-16 md:top-20' : 'top-0'} z-40 border-b ${RITUAL_HAIRLINE} bg-[color-mix(in_srgb,var(--site-bg,#FBFAF7)_92%,transparent)] backdrop-blur-md`}>
      <div className="mx-auto max-w-7xl px-5 py-2.5 md:px-10">
        <CategoryNav
          tone="ritual"
          label={null}
          categories={categories}
          hrefFor={(c) => `${collectionsPath}#${categoryAnchorId(c)}`}
          ariaLabel="Shop by aisle"
        />
      </div>
    </div>
  );
}

function RitualHero({ block, shop, heroMedia, signal, variant, cut }: {
  block: HeroBlock;
  shop: SiteShop;
  heroMedia: HeroMedia;
  /** Honest offer pill (resolveHeroSignal) — null renders NO pill, no gap. */
  signal: HeroSignal | null;
  /** Phase 6B structural variant — undefined ≡ 'standard'. */
  variant?: HeroVariant;
  /** Phase 10D.1 recipe cut — absent ≡ the historical variants. */
  cut?: RitualCut;
}) {
  if (cut === 'counter' && (variant === undefined || variant === 'text-centric')) {
    // Product-First "Counter" opener — the SHELF HEADER. Type-led like the
    // text-centric variant but left-aligned, compact, and WITHOUT a CTA: the
    // catalog sits directly beneath, so the catalog IS the CTA (a "Shop The
    // Collection" button pointing 100px down is noise). Desktop: a two-column
    // band — headline left, hook + honest signal right. An explicit 'split' /
    // 'standard' pick on a counter site still renders its own variant below.
    return (
      <header data-block-section={block.id} className={`border-b ${RITUAL_HAIRLINE} px-5 py-8 md:px-10 md:py-12`}>
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-end md:gap-12">
          <div>
            {block.tagline && (
              <EditableText as="p" blockId={block.id} field="tagline" className="text-[11px] font-bold uppercase tracking-[0.35em] text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">
                {block.tagline}
              </EditableText>
            )}
            <EditableText
              as="h1"
              blockId={block.id}
              field="headline"
              className="mt-3 max-w-2xl font-serif text-3xl font-bold leading-[1.08] tracking-tight text-balance text-[var(--site-text,oklch(21.6%_0.006_56.043))] md:text-5xl"
            >
              {block.headline}
            </EditableText>
          </div>
          <div className="flex flex-col items-start gap-4">
            <EditableText as="p" blockId={block.id} field="subheadline" className="max-w-md text-sm leading-relaxed text-[var(--site-muted,oklch(55.3%_0.013_58.071))] md:text-base">
              {block.subheadline}
            </EditableText>
            {signal && (
              <span className={`sndk-rise inline-flex min-h-8 items-center gap-2 rounded-full border ${RITUAL_HAIRLINE} px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--site-text,oklch(21.6%_0.006_56.043))]`}>
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${signal.kind === 'stock' ? 'bg-amber-500' : 'bg-[var(--site-accent,#1c1917)]'}`} />
                {signal.label}
              </span>
            )}
          </div>
        </div>
      </header>
    );
  }

  if (variant === 'text-centric') {
    // Typography-led opener on the site surface: NO hero plate, no scrim.
    // Centered oversized serif headline, generous vertical air, ONE accent
    // CTA. Ink tokens replace the white-on-dark palette of the full-bleed hero.
    return (
      <header data-block-section={block.id} className={`border-b ${RITUAL_HAIRLINE} px-5 py-20 md:px-10 md:py-32`}>
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center md:gap-8">
          {block.tagline && (
            <EditableText as="p" blockId={block.id} field="tagline" className="text-[11px] font-bold uppercase tracking-[0.35em] text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">
              {block.tagline}
            </EditableText>
          )}
          <EditableText
            as="h1"
            blockId={block.id}
            field="headline"
            className="font-serif text-4xl font-bold leading-[1.05] tracking-tight text-balance text-[var(--site-text,oklch(21.6%_0.006_56.043))] md:text-6xl lg:text-7xl"
          >
            {block.headline}
          </EditableText>
          <EditableText as="p" blockId={block.id} field="subheadline" className="max-w-xl text-base leading-relaxed text-[var(--site-muted,oklch(55.3%_0.013_58.071))] md:text-lg">
            {block.subheadline}
          </EditableText>
          {signal && (
            <span className={`sndk-rise inline-flex min-h-8 items-center gap-2 rounded-full border ${RITUAL_HAIRLINE} px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--site-text,oklch(21.6%_0.006_56.043))]`}>
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${signal.kind === 'stock' ? 'bg-amber-500' : 'bg-[var(--site-accent,#1c1917)]'}`} />
              {signal.label}
            </span>
          )}
          <div className="w-full pt-2 sm:w-auto">
            <a
              href="#collection"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--site-radius,9999px)] bg-[var(--site-accent,#1c1917)] px-10 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-white shadow-lg transition hover:brightness-125 active:scale-[0.98] sm:w-auto"
            >
              Shop The Collection
            </a>
          </div>
        </div>
      </header>
    );
  }

  if (variant === 'split') {
    // Two-panel opener: copy + CTA on the site surface (left), the hero media
    // as a tall rounded 4:5 plate (right) — no full-bleed wash, no scrim.
    // Mobile stacks plate-first so the brand image still leads the fold.
    return (
      <header data-block-section={block.id} className={`border-b ${RITUAL_HAIRLINE}`}>
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-8 md:grid-cols-2 md:items-center md:gap-14 md:px-10 md:py-16">
          <div className="order-2 flex flex-col items-start md:order-1">
            {block.tagline && (
              <EditableText as="p" blockId={block.id} field="tagline" className="text-[11px] font-bold uppercase tracking-[0.35em] text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">
                {block.tagline}
              </EditableText>
            )}
            <EditableText
              as="h1"
              blockId={block.id}
              field="headline"
              className="mt-4 max-w-xl font-serif text-3xl font-bold leading-[1.08] tracking-tight text-balance text-[var(--site-text,oklch(21.6%_0.006_56.043))] md:text-5xl lg:text-6xl"
            >
              {block.headline}
            </EditableText>
            <EditableText as="p" blockId={block.id} field="subheadline" className="mt-5 max-w-md text-sm leading-relaxed text-[var(--site-muted,oklch(55.3%_0.013_58.071))] md:text-base">
              {block.subheadline}
            </EditableText>
            {signal && (
              <span className={`sndk-rise mt-5 inline-flex min-h-8 items-center gap-2 rounded-full border ${RITUAL_HAIRLINE} px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--site-text,oklch(21.6%_0.006_56.043))]`}>
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${signal.kind === 'stock' ? 'bg-amber-500' : 'bg-[var(--site-accent,#1c1917)]'}`} />
                {signal.label}
              </span>
            )}
            <div className="mt-7 w-full md:mt-9">
              <a
                href="#collection"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--site-radius,9999px)] bg-[var(--site-accent,#1c1917)] px-8 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-white shadow-lg transition hover:brightness-125 active:scale-[0.98] sm:w-auto"
              >
                Shop The Collection
              </a>
            </div>
          </div>
          <div className={`relative order-1 aspect-[4/5] overflow-hidden rounded-3xl bg-stone-900 md:order-2 ${RITUAL_SURFACE}`}>
            {heroMedia?.type === 'video' ? (
              <GatedVideo
                src={heroMedia.url}
                poster={heroMedia.poster}
                alt={shop.shop_name ?? 'Hero'}
                className="absolute inset-0 h-full w-full object-cover"
                posterSizes="(min-width: 768px) 50vw, 100vw"
                posterBlurTone="dark"
                posterPriority
                fallback={<div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(214,203,186,0.35),transparent_55%),linear-gradient(to_bottom_right,#292524,#1c1917,#3a352e)]" />}
                playButtonClassName="absolute left-1/2 top-1/2 z-10 flex min-h-11 -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-full bg-white/95 px-7 py-3.5 text-[10px] font-bold uppercase tracking-[0.25em] text-stone-900 shadow-lg backdrop-blur transition hover:bg-white active:scale-95"
              />
            ) : heroMedia ? (
              <SmartImage
                src={heroMedia.url}
                alt={shop.shop_name ?? 'Hero'}
                fill
                priority
                sizes="(min-width: 768px) 50vw, 100vw"
                blurTone="dark"
                className="object-cover"
              />
            ) : (
              <HeroBrandPlate tone="ritual" shopName={shop.shop_name} />
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    // min-h (not fixed h): budget-length copy at 360px can outgrow the frame —
    // the hero grows with it instead of clipping against overflow-hidden.
    // Micro-Homepage: the hero is a compact niche opener — ≈40vh with a 360px
    // content floor (was max(560px,62vh)) so the marquee AND the showcase's
    // first row sit above the fold on mobile; min-h keeps the clip-fix
    // semantics — copy can still grow the frame past the cap.
    <header data-block-section={block.id} className="relative flex min-h-[max(360px,40vh)] w-full items-end overflow-hidden bg-stone-900 md:items-center">
      {heroMedia?.type === 'video' ? (
        // 2G media gate: unconstrained networks autoplay exactly as before;
        // save-data/2g/3g/reduced-motion get the ad poster (or the template
        // gradient) with a ≥44px tap-to-play in the ritual dialect.
        <GatedVideo
          src={heroMedia.url}
          poster={heroMedia.poster}
          alt={shop.shop_name ?? 'Hero'}
          className="absolute inset-0 h-full w-full object-cover"
          posterSizes="100vw"
          posterBlurTone="dark"
          posterPriority
          fallback={<div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(214,203,186,0.35),transparent_55%),linear-gradient(to_bottom_right,#292524,#1c1917,#3a352e)]" />}
          playButtonClassName="absolute left-1/2 top-1/2 z-10 flex min-h-11 -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-full bg-white/95 px-7 py-3.5 text-[10px] font-bold uppercase tracking-[0.25em] text-stone-900 shadow-lg backdrop-blur transition hover:bg-white active:scale-95"
        />
      ) : heroMedia ? (
        <SmartImage
          src={heroMedia.url}
          alt={shop.shop_name ?? 'Hero'}
          fill
          priority
          sizes="100vw"
          blurTone="dark"
          // .sndk-parallax: pure-CSS scroll depth (archetype pass) — static
          // where scroll-timelines/motion are unavailable (globals.css).
          className="sndk-parallax object-cover"
        />
      ) : (
        /* Null tier (Pillar 4b): the animated brand plate — same gradient
           stops, panned, with the accent glow + monogram. */
        <HeroBrandPlate tone="ritual" shopName={shop.shop_name} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />

      <div className="relative mx-auto w-full max-w-7xl px-5 pb-10 pt-20 md:px-10 md:py-12">
        {block.tagline && (
          <EditableText as="p" blockId={block.id} field="tagline" className="text-[11px] font-bold uppercase tracking-[0.35em] text-white/70">
            {block.tagline}
          </EditableText>
        )}
        <EditableText
          as="h1"
          blockId={block.id}
          field="headline"
          className="mt-4 max-w-2xl font-serif text-3xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl"
        >
          {block.headline}
        </EditableText>
        {/* The one-sentence hook. */}
        <EditableText as="p" blockId={block.id} field="subheadline" className="mt-4 max-w-xl text-sm leading-relaxed text-white/80 md:text-base">
          {block.subheadline}
        </EditableText>
        {/* Offer pill — honest-signal ladder (low stock → new this week →
            fulfillment fact); null → nothing rendered. .sndk-rise is the only
            motion here and never touches an LCP or editor-measured node. */}
        {signal && (
          <span className="sndk-rise mt-4 inline-flex min-h-8 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${signal.kind === 'stock' ? 'bg-amber-300' : 'bg-white/80'}`} />
            {signal.label}
          </span>
        )}
        {/* ONE CTA (flagged default): the secondary "View The Full Collection"
            link was removed — the Explore Collection bridge under the showcase
            owns that journey, and the stacked button cost ~50px of the mobile
            fold. To restore it, add a sibling <Link href={collectionsHref}>
            here with the historical border-white/50 outline styling. */}
        {/* Solid accent fill — same token + hover as the chrome's "Shop Now"
            nav button so the theme cascade recolors both together. The
            ring-white/20 hairline keeps the themeless stone-900 fallback
            legible against the dark hero plate. */}
        {/* Pass 3: full-width thumb-reach CTA on phones, inline from sm. */}
        <div className="mt-6 md:mt-7">
          <a
            href="#collection"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--site-radius,9999px)] bg-[var(--site-accent,#1c1917)] px-8 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-white shadow-lg ring-1 ring-white/20 transition hover:brightness-125 active:scale-[0.98] sm:w-auto"
          >
            Shop The Collection
          </a>
        </div>
      </div>
    </header>
  );
}

// Fix 2: the static numbered value-props band was retired — the value_props
// block now renders exclusively as the SiteMarquee ribbon (the block itself
// stays in the schema/rail; its editing home is the SectionRail inspector).

// Count-aware showcase layouts (Micro-Homepage): 1–2 pieces never stretch to
// a wall, 3 never strands an orphan at md, 4 keeps a 2×2 through md and opens
// to the classic four-across at lg. `sizes` is tuned per slot so no card
// downloads a wider image than it can paint.
function ritualFeaturedLayout(count: number): { grid: string; sizes: string } {
  switch (count) {
    case 1:
      return { grid: 'mx-auto grid max-w-sm grid-cols-1 gap-y-12', sizes: '(min-width: 640px) 384px, 100vw' };
    case 2:
      return { grid: 'mx-auto grid max-w-3xl grid-cols-2 gap-x-5 gap-y-12 md:gap-x-8', sizes: '(min-width: 768px) 384px, 50vw' };
    case 3:
      return { grid: 'grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 md:gap-x-8 md:gap-y-16', sizes: '(min-width: 768px) 33vw, 50vw' };
    default:
      return { grid: 'grid grid-cols-2 gap-x-5 gap-y-12 md:gap-x-8 md:gap-y-16 lg:grid-cols-4', sizes: '(min-width: 1024px) 25vw, 50vw' };
  }
}

// Step 2 (Subtraction Family): the home slice upstream (siteData) is capped
// at 12. In full-catalog mode the Explore Collection bridge renders ONLY when
// the wall hits that cap — i.e. there may be more pieces on /collections.
const HOME_SLICE_CAP = 12;

// Masonry rhythm (layout_strategy.grid === 'masonry'): every 5th card spans
// two rows in a 'tall' frame; the rest alternate 'portrait' / 'square'.
function ritualMasonryRatio(i: number): RitualCardRatio {
  if (i % 5 === 4) return 'tall';
  return i % 2 === 0 ? 'portrait' : 'square';
}

function RitualProductGrid({ block, shop, products, catalog, variant, hideCategories, cut }: {
  block: ProductGridBlock;
  shop: SiteShop;
  /** The showcase selection (selectFeaturedProducts) — capped again here so a
   *  wider caller can never turn the showcase back into a wall. */
  products: SiteProduct[];
  /** The full home slice — drives the category discovery strip (Pass 3). */
  catalog: SiteProduct[];
  /** Phase 6B structural variant — undefined ≡ 'standard'. */
  variant?: GridVariant;
  /** Step 2 (Subtraction): suppress the category discovery strip. Absent ≡ false. */
  hideCategories?: boolean;
  /** Phase 10D.1 recipe cut — absent ≡ the historical section. */
  cut?: RitualCut;
}) {
  const counter = cut === 'counter';
  // Step 2: block.catalog === 'full' renders the ENTIRE home slice (no
  // showcase cap); absent/'showcase' keeps the exact historical selection.
  // Counter (10D.1): the catalog is the page — an ABSENT pick defaults to the
  // full slice; an explicit 'showcase' from the editor still wins.
  const fullCatalog = block.catalog === 'full' || (counter && block.catalog === undefined);
  const featured = fullCatalog ? catalog : products.slice(0, FEATURED_MAX);
  const count = featured.length;
  // Counter headers sit left by default (a shelf label, not a centrepiece);
  // an explicit 'center' pick still wins.
  const alignLeft = block.align === 'left' || (counter && block.align === undefined);
  const layout = ritualFeaturedLayout(count);
  // Counter sold-out tiles carry a restock-notify WhatsApp link (null when the
  // shop has no phone → the tile renders a plain "Sold out" row).
  const notifyHrefFor = (p: SiteProduct) =>
    counter
      ? buildWhatsAppLink(shop.phone, `Hello ${shop.shop_name ?? 'there'}! Please let me know when "${p.name}" is back in stock.`)
      : null;
  // Bridge target: null in slugless studio previews → no bridge rendered.
  const collectionsPath = siteCollectionsPath(shop);
  // Full-catalog bridge law: only when the slice equals the upstream cap.
  const showBridge = fullCatalog ? count === HOME_SLICE_CAP : count > 0;
  // Category discovery: real categories from the merchant's inventory, each
  // deep-linking to its group on /collections. CategoryNav renders nothing
  // below two categories or without a real collections path.
  const categories = collectionsPath ? distinctCategories(catalog) : [];
  return (
    // padding/align consumption (Pillar 4): grid section spacing + header alignment.
    <section id="collection" data-block-section={block.id} className={`mx-auto max-w-7xl px-5 md:px-10 ${ritualPad(block.padding, counter ? PAD_COUNTER : PAD_20_28)}`}>
      <div className={alignLeft ? 'max-w-xl text-left' : 'mx-auto max-w-xl text-center'}>
        <EditableText as="h2" blockId={block.id} field="title" className={`font-serif font-bold tracking-tight text-balance text-[var(--site-text,oklch(21.6%_0.006_56.043))] ${counter ? 'text-2xl md:text-4xl' : 'text-3xl md:text-5xl'}`}>
          {block.title}
        </EditableText>
        <EditableText as="p" blockId={block.id} field="intro" className="mt-4 text-sm leading-relaxed text-[var(--site-muted,oklch(55.3%_0.013_58.071))] md:text-base">
          {block.intro}
        </EditableText>
      </div>

      {collectionsPath && !hideCategories && (
        <CategoryNav
          tone="ritual"
          label={null}
          categories={categories}
          hrefFor={(c) => `${collectionsPath}#${categoryAnchorId(c)}`}
          className={`mt-8 ${alignLeft ? '' : 'md:[&>div]:justify-center'}`}
        />
      )}

      {count === 0 ? (
        // Branded empty state (mirrors /collections): the hero's
        // "Shop The Collection" anchor lands on something dignified.
        <div className={`mx-auto mt-10 max-w-md rounded-2xl border border-dashed ${RITUAL_HAIRLINE} px-8 py-14 text-center md:mt-16`}>
          <p className="font-serif text-xl font-bold text-[var(--site-text,oklch(21.6%_0.006_56.043))]">The collection is being prepared.</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">New pieces are on their way — check back soon.</p>
        </div>
      ) : block.displayMode === 'carousel' ? (
        <div className="mt-10 md:mt-16">
          <CarouselTrack
            ariaLabel={block.title}
            trackClassName="gap-5 pb-2 md:gap-8"
            itemClassName="w-[68vw] max-w-[300px] sm:w-[300px]"
            buttonClassName="h-11 w-11 rounded-full bg-white text-stone-900 shadow-lg ring-1 ring-stone-200 hover:bg-stone-100 active:scale-95"
            items={featured.map((p, i) => ({
              key: p.id,
              node: <RitualProductCard product={p} index={i} href={ritualProductHref(shop, p.id)} sizes="(min-width: 640px) 300px, 68vw" />,
            }))}
          />
        </div>
      ) : variant === 'featured-first' ? (
        // Phase 6B featured-first: the lead piece spans the full 2-col row on
        // phones and a 2×2 block at md inside the classic four-across grid;
        // the remaining cards keep their standard size beside/below it.
        <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-12 md:mt-16 md:grid-cols-4 md:gap-x-8 md:gap-y-16">
          {featured.map((p, i) =>
            i === 0 ? (
              <div key={p.id} className="col-span-2 md:row-span-2">
                <RitualProductCard product={p} index={i} href={ritualProductHref(shop, p.id)} sizes="(min-width: 1024px) 50vw, 100vw" />
              </div>
            ) : (
              <RitualProductCard key={p.id} product={p} index={i} href={ritualProductHref(shop, p.id)} sizes="(min-width: 1024px) 25vw, 50vw" />
            ),
          )}
        </div>
      ) : variant === 'masonry' ? (
        // Step 2 masonry: dense row packing, alternating frame ratios, every
        // 5th card spanning two rows. Standard / featured-first untouched.
        <div className="mt-10 grid grid-flow-row-dense grid-cols-2 gap-x-5 gap-y-12 md:mt-16 md:grid-cols-3 md:gap-x-8 md:gap-y-16 lg:grid-cols-4">
          {featured.map((p, i) => {
            const ratio = ritualMasonryRatio(i);
            return (
              <div key={p.id} className={ratio === 'tall' ? 'row-span-2' : undefined}>
                <RitualProductCard product={p} index={i} href={ritualProductHref(shop, p.id)} ratio={ratio} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" />
              </div>
            );
          })}
        </div>
      ) : variant === 'counter' ? (
        // Phase 10D.1 counter wall: dense uniform grid, counter card anatomy
        // (hairline tile, mono aisle eyebrow, persistent order row).
        <div className={`mt-6 md:mt-10 ${COUNTER_GRID}`}>
          {featured.map((p, i) => (
            <RitualProductCard
              key={p.id}
              product={p}
              index={i}
              href={ritualProductHref(shop, p.id)}
              sizes={COUNTER_CARD_SIZES}
              anatomy="counter"
              notifyHref={notifyHrefFor(p)}
            />
          ))}
        </div>
      ) : (
        <div className={`mt-10 md:mt-16 ${layout.grid}`}>
          {featured.map((p, i) => (
            <RitualProductCard key={p.id} product={p} index={i} href={ritualProductHref(shop, p.id)} sizes={layout.sizes} />
          ))}
        </div>
      )}

      {/* "Explore Collection" bridge — the journey from the showcase to the
          full catalog. Conditional: needs pieces to explore AND a real
          /site path (slugless previews render none). No data-block attrs.
          Pass 3: full-width on phones (thumb-reach CTA), inline from sm. */}
      {showBridge && collectionsPath && (
        <div className={`mt-10 flex md:mt-14 ${alignLeft ? 'justify-start' : 'justify-center'}`}>
          <Link
            href={collectionsPath}
            className="group inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-[var(--site-radius,9999px)] bg-[var(--site-accent,#1c1917)] px-8 text-[10px] font-bold uppercase tracking-[0.25em] text-white shadow-sm transition hover:brightness-125 active:scale-[0.98] sm:w-auto"
          >
            Explore Collection
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none">&rarr;</span>
          </Link>
        </div>
      )}
    </section>
  );
}

function RitualProductTabs({ block }: { block: ProductTabsBlock }) {
  return (
    // padding consumption (Pillar 4): tabs section spacing.
    <section data-block-section={block.id} className={`border-b ${RITUAL_HAIRLINE} ${RITUAL_BAND} ${ritualPad(block.padding, PAD_16_24)}`}>
      <div className="mx-auto max-w-4xl px-5 md:px-10">
        <EditableText
          as="h2"
          blockId={block.id}
          field="title"
          className="text-center font-serif text-3xl font-bold tracking-tight text-balance text-[var(--site-text,oklch(21.6%_0.006_56.043))] md:text-4xl"
        >
          {block.title}
        </EditableText>
        <div className="mt-10">
          <ProductTabsIsland blockId={block.id} tabs={block.tabs} variant="ritual" />
        </div>
      </div>
    </section>
  );
}

function RitualVideoHero({ block, shopName }: { block: VideoHeroBlock; shopName: string | null }) {
  return (
    // Fold discipline (Fix 5): viewport component capped at 60vh (was 72vh);
    // the 480px content floor and min-h clip-fix semantics are preserved.
    <section data-block-section={block.id} className="relative flex min-h-[max(480px,60vh)] w-full items-end overflow-hidden bg-stone-900">
      <VideoHeroMedia
        src={block.videoUrl}
        poster={block.posterUrl ?? null}
        alt={shopName ?? 'Brand film'}
        className="absolute inset-0 h-full w-full object-cover"
        fallbackClassName="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(214,203,186,0.35),transparent_55%),linear-gradient(to_bottom_right,#292524,#1c1917,#3a352e)]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="relative mx-auto w-full max-w-7xl px-5 pb-14 md:px-10 md:pb-20">
        {block.headline && (
          <EditableText
            as="h2"
            blockId={block.id}
            field="headline"
            className="max-w-2xl font-serif text-3xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl"
          >
            {block.headline}
          </EditableText>
        )}
        {block.subheadline && (
          <EditableText as="p" blockId={block.id} field="subheadline" className="mt-4 max-w-xl text-base leading-relaxed text-white/80">
            {block.subheadline}
          </EditableText>
        )}
      </div>
    </section>
  );
}

function RitualStory({ block, shopName }: { block: StoryBlock; shopName: string | null }) {
  return (
    // padding/align consumption (Pillar 4): story spacing + copy alignment.
    <section id="story" data-block-section={block.id} className={`border-y ${RITUAL_HAIRLINE} ${RITUAL_BAND} ${ritualPad(block.padding, PAD_20_28)}`}>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-5 md:grid-cols-[200px_1fr] md:gap-14 md:px-10">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">Our Story</p>
          <div className="mt-5 hidden h-px w-16 bg-[var(--site-accent,#1c1917)] md:block" />
        </div>
        <div className={block.align === 'center' ? 'text-center' : undefined}>
          {/* Fix 1: 3-line teaser + Read-the-full-story reveal. StoryClamp
              renders the bare copy node in editor previews, so the
              data-block-id/-field targeting is untouched. */}
          <StoryClamp tone="ritual">
            <EditableText as="p" blockId={block.id} field="body" className="font-serif text-2xl font-medium leading-relaxed text-[var(--site-text,oklch(26.8%_0.007_34.298))] md:text-3xl">
              {block.body}
            </EditableText>
          </StoryClamp>
          <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">{shopName}</p>
        </div>
      </div>
    </section>
  );
}

// Archetype pass (Pillar 3): real customer voices in the airy stone dialect —
// serif pull-quotes on white cards, verified attribution beneath. Items are
// seeded exclusively from real reviews (integrity law).
function RitualTestimonials({ block }: { block: TestimonialsBlock }) {
  // Pass 3: an empty testimonials block renders NOTHING — never a heading
  // over a void. (The block stays in the config/rail for the editor.)
  if (block.items.length === 0) return null;
  return (
    // padding/align consumption (Pillar 4): quotes section spacing + heading alignment.
    <section data-block-section={block.id} className={`border-y ${RITUAL_HAIRLINE} ${RITUAL_BAND} ${ritualPad(block.padding, PAD_20_28)}`}>
      <div className="mx-auto max-w-6xl px-5 md:px-10">
        {block.title && (
          <EditableText
            as="h2"
            blockId={block.id}
            field="title"
            className={`font-serif text-3xl font-bold tracking-tight text-[var(--site-text,oklch(21.6%_0.006_56.043))] md:text-4xl ${block.align === 'left' ? 'text-left' : 'text-center'}`}
          >
            {block.title}
          </EditableText>
        )}
        <div className={`grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 ${block.title ? 'mt-12 md:mt-16' : ''}`}>
          {block.items.map((item, i) => (
            <figure key={`${block.id}-quote-${i}`} className={`rounded-2xl border ${RITUAL_HAIRLINE} bg-[var(--site-bg,#FBFAF7)] p-6 md:p-9`}>
              <span aria-hidden className="font-serif text-4xl leading-none text-[var(--site-accent,#1c1917)]">&ldquo;</span>
              <EditableText
                as="blockquote"
                blockId={block.id}
                field={`items.${i}.quote`}
                className="mt-3 font-serif text-lg font-medium leading-relaxed text-[var(--site-text,oklch(26.8%_0.007_34.298))] md:text-xl"
              >
                {item.quote}
              </EditableText>
              <figcaption className="mt-5">
                <EditableText
                  as="span"
                  blockId={block.id}
                  field={`items.${i}.author`}
                  className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--site-muted,oklch(55.3%_0.013_58.071))]"
                >
                  {item.author}
                </EditableText>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// Archetype pass (Pillar 3): the two-panel conversion spread — copy beside a
// product panel. Pass 3: the panel shows the merchant's own pieces
// (ProductCollage — up to two, linked, priced) instead of a 10rem monogram;
// a shop with no pictured product gets a plain accent plate. Accent rides
// --site-accent with the stone default, so themeless rendering stays on-dialect.
function RitualSplitCta({ block, shop, products, collectionsHref }: {
  block: SplitCtaBlock;
  shop: SiteShop;
  /** Home slice — the collage picks the first two pictured pieces. */
  products: SiteProduct[];
  collectionsHref: string;
}) {
  const hrefFor = (id: string) => ritualProductHref(shop, id);
  const collage = <ProductCollage tone="ritual" products={products} hrefFor={hrefFor} />;
  const hasCollage = products.some((p) => p.ad_hero_image_url || p.image_url);
  return (
    // padding consumption (Pillar 4): split-spread section spacing.
    <section data-block-section={block.id} className={`mx-auto max-w-7xl px-5 md:px-10 ${ritualPad(block.padding, PAD_16_24)}`}>
      <div className={`grid grid-cols-1 overflow-hidden rounded-3xl border ${RITUAL_HAIRLINE} ${RITUAL_SURFACE} md:grid-cols-2`}>
        <div className="flex flex-col justify-center gap-5 p-7 md:p-14">
          <EditableText as="h2" blockId={block.id} field="headline" className="font-serif text-3xl font-bold tracking-tight text-balance text-[var(--site-text,oklch(21.6%_0.006_56.043))] md:text-4xl">
            {block.headline}
          </EditableText>
          <EditableText as="p" blockId={block.id} field="body" className="max-w-md text-sm leading-relaxed text-[var(--site-muted,oklch(55.3%_0.013_58.071))] md:text-base">
            {block.body}
          </EditableText>
          <Link
            href={collectionsHref}
            data-block-id={block.id}
            data-block-field="button_label"
            className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-[var(--site-radius,9999px)] bg-[var(--site-accent,#1c1917)] px-8 text-[10px] font-bold uppercase tracking-[0.25em] text-white shadow-sm transition hover:brightness-125 active:scale-[0.98] sm:w-auto sm:self-start"
          >
            {block.button_label}
          </Link>
        </div>
        {hasCollage ? (
          <div className="p-5 md:p-10">{collage}</div>
        ) : (
          <div aria-hidden className="relative min-h-[160px] bg-[var(--site-accent,#1c1917)] md:min-h-[320px]">
            <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.16),transparent_60%)]" />
          </div>
        )}
      </div>
    </section>
  );
}

function RitualCta({ block, collectionsHref }: { block: CtaBlock; collectionsHref: string }) {
  return (
    // primary/padding/align consumption (Pillar 4): the dark banner rides
    // --site-primary (stone-900 fallback); spacing + alignment per block.
    <section data-block-section={block.id} className={`bg-[var(--site-primary,oklch(21.6%_0.006_56.043))] ${block.align === 'left' ? 'text-left' : 'text-center'} ${ritualPad(block.padding, PAD_20_28)}`}>
      <div className="mx-auto max-w-2xl px-5 md:px-10">
        <EditableText as="h2" blockId={block.id} field="headline" className="font-serif text-3xl font-bold tracking-tight text-white md:text-5xl">
          {block.headline}
        </EditableText>
        <EditableText as="p" blockId={block.id} field="subtext" className={`mt-5 max-w-lg text-base leading-relaxed text-white/60 ${block.align === 'left' ? '' : 'mx-auto'}`}>
          {block.subtext}
        </EditableText>
        <Link
          href={collectionsHref}
          data-block-id={block.id}
          data-block-field="button_label"
          className="mt-10 inline-block rounded-[var(--site-radius,9999px)] bg-white px-10 py-4 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--site-accent,#1c1917)] shadow-lg transition hover:bg-stone-100 active:scale-95"
        >
          {block.button_label}
        </Link>
      </div>
    </section>
  );
}

export default function RitualTemplate({ shop, products, config, heroMedia }: SiteTemplateProps) {
  // Item 2: hidden blocks are SKIPPED at render (the editor previews them
  // dimmed by stripping the flag client-side). Hiding the hero also hides
  // its welded seam marquee — the ribbon rides the hero→body seam by design.
  const blocks = resolveVisibleBlocks(config);
  // Internal routes, with honest fallbacks for slugless studio previews:
  // the preview renders this home layout, so bare anchors stay correct there.
  const collectionsHref = siteCollectionsPath(shop) ?? '#collection';
  // Micro-Homepage: ONE showcase selection feeds both the hero pill (anchored
  // on featured[0]) and the grid — the pill always describes what sits
  // beneath it. Deterministic: Ad Studio media → real photos → gradient
  // tiles, newest-first ties, deduped, capped at FEATURED_MAX.
  const featured = selectFeaturedProducts(products, FEATURED_MAX);
  const heroSignal = resolveHeroSignal({ shop, featured });
  // Phase 6B: structural variants from the optional layout strategy. Absent
  // on every legacy row → undefined → the historical markup, unchanged.
  // Phase 10C: the variants now arrive through resolveRitualComposition —
  // for 'classic' and 'subtraction' (every stored row today) it returns the
  // RAW config values, so this is byte-identical to reading them directly.
  // A 'counter' / 'gallery' grid (new values; written only by a future
  // generation or explicit upgrade) is eligibility-checked here against the
  // live slice and degrades one step when the data no longer qualifies. The
  // recipe cuts themselves are NOT built yet: both values fall through the
  // grid ternary below to the standard grid until Phase 10D.
  const composition = resolveRitualComposition({ config, products, heroMedia });
  const heroVariant = composition.hero;
  const gridVariant = composition.grid;
  // Step 2 (Subtraction Family, Ritual-only): Hero → Product Wall → Footer.
  // No marquee, no offer pill, no category strip. Every other family (and
  // every legacy row without storefront_family) renders exactly as before.
  const subtraction = config.storefront_family === 'subtraction';
  // Phase 10D.1 — Product-First "Counter" recipe. Activates ONLY when the
  // Phase 10C resolver lands on 'product-first' (grid 'counter' + eligible
  // slice); an ineligible request already degraded to 'classic' upstream.
  // Composition: shelf-header hero (no CTA) → STICKY category strip (the
  // grid's own strip is suppressed — one strip owns navigation) → full
  // counter wall, un-revealed (utilitarian, instant) → value-props marquee
  // relocated BELOW the wall as a trust strip → whatever else is visible →
  // the structured footer (unchanged: delivery/pickup/contact are buying
  // facts, and the desktop "Shop Now" pill stays — RitualChrome untouched).
  const counter = composition.recipe === 'product-first';
  const cut: RitualCut | undefined = counter ? 'counter' : undefined;
  const counterCollectionsPath = counter ? siteCollectionsPath(shop) : null;
  const counterCategories = counterCollectionsPath ? distinctCategories(products) : [];

  return (
    <RitualChrome shop={shop} config={config} active="home">
      {blocks.map((block, i) => {
        // The hero (LCP) never animates; every other section rides the Reveal
        // island (fade-in-up on scroll, static in editor previews / reduced
        // motion — see Reveal.tsx). Small index-based sibling stagger.
        const section = (() => {
          switch (block.type) {
            case 'hero_banner':
              return <RitualHero block={block} shop={shop} heroMedia={heroMedia} signal={subtraction ? null : heroSignal} variant={heroVariant} cut={cut} />;
            // value_props: no body section (Fix 2) — the block renders as the
            // SiteMarquee ribbon after the hero.
            case 'product_grid':
              return <RitualProductGrid block={block} shop={shop} products={featured} catalog={products} variant={gridVariant} hideCategories={subtraction || counter} cut={cut} />;
            case 'story_text':
              return <RitualStory block={block} shopName={shop.shop_name} />;
            case 'cta_banner':
              return <RitualCta block={block} collectionsHref={collectionsHref} />;
            case 'product_tabs':
              return <RitualProductTabs block={block} />;
            case 'video_hero':
              return <RitualVideoHero block={block} shopName={shop.shop_name} />;
            case 'testimonials':
              return <RitualTestimonials block={block} />;
            case 'split_cta':
              return <RitualSplitCta block={block} shop={shop} products={featured} collectionsHref={collectionsHref} />;
            default:
              return null;
          }
        })();
        if (!section) return null;
        if (block.type === 'hero_banner') {
          // Kinetic marquee rides the hero→body seam: it renders directly
          // after the hero, never inside a Reveal (it is already motion), and
          // carries no data-block markers — invisible to the Site Editor's
          // section rect math.
          // Counter (10D.1): the seam carries the sticky category strip
          // instead; the marquee moves below the wall.
          return (
            <Fragment key={block.id}>
              {section}
              {counter ? (
                <RitualCounterStrip
                  categories={counterCategories}
                  collectionsPath={counterCollectionsPath}
                  stickyNav={config.theme?.sticky_nav !== false}
                />
              ) : (
                !subtraction && <SiteMarquee config={config} tone="ritual" />
              )}
            </Fragment>
          );
        }
        if (counter && block.type === 'product_grid') {
          // Counter wall: NO Reveal (the catalog is the page — it must be
          // there the instant the shopper lands, not fade in), followed by
          // the relocated value-props ribbon as the trust strip under the
          // wall. Outside a Reveal for the same reason as at the hero seam.
          return (
            <Fragment key={block.id}>
              {section}
              <SiteMarquee config={config} tone="ritual" />
            </Fragment>
          );
        }
        return (
          <Reveal key={block.id} delay={Math.min(i * 0.05, 0.15)}>
            {section}
          </Reveal>
        );
      })}
    </RitualChrome>
  );
}
