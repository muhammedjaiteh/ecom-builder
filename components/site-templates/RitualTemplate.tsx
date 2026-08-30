import { Fragment } from 'react';
import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import {
  resolveVisibleBlocks,
  siteCollectionsPath,
  type HeroMedia,
  type SiteBlock,
  type SiteShop,
  type SiteProduct,
  type SiteTemplateProps,
} from '@/lib/siteTemplates';
import CarouselTrack from './CarouselTrack';
import EditableText from './EditableText';
import GatedVideo from './GatedVideo';
import HeroBrandPlate from './HeroBrandPlate';
import ProductTabsIsland from './ProductTabsIsland';
import Reveal from './Reveal';
import SiteMarquee from './SiteMarquee';
import StoryClamp from './StoryClamp';
import VideoHeroMedia from './VideoHeroMedia';
import RitualChrome, {
  RITUAL_COLLECTION_GRID,
  RitualProductCard,
  ritualProductHref,
} from './chrome/RitualChrome';

// MINIMAL (template_key 'ritual') — Layout A.
// The anatomy of a premium minimal Shopify theme:
// sticky logo nav → full-bleed cinematic hero with dual CTAs → kinetic
// value-props marquee (Fix 2: the static numbered band was retired — the
// value_props block renders as the moving brand ribbon under the hero, edited
// from the SectionRail inspector) → airy spacious product grid with
// quick-view hovers and live stock badges → brand-story strip (clamped to a
// 3-line teaser with a Read-the-full-story reveal — StoryClamp) → dark CTA
// banner → structured footer (shop info, delivery & pickup, contact).
// Warm off-white, stone ink.
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
const PAD_20_28: Record<PadKey, string> = {
  compact: 'py-12 md:py-16',
  default: 'py-20 md:py-28',
  spacious: 'py-28 md:py-40',
};
const PAD_16_24: Record<PadKey, string> = {
  compact: 'py-10 md:py-14',
  default: 'py-16 md:py-24',
  spacious: 'py-24 md:py-36',
};


function RitualHero({ block, shop, heroMedia, collectionsHref }: {
  block: HeroBlock;
  shop: SiteShop;
  heroMedia: HeroMedia;
  collectionsHref: string;
}) {
  return (
    // min-h (not fixed h): budget-length copy at 360px can outgrow the frame —
    // the hero grows with it instead of clipping against overflow-hidden.
    // Fold discipline (Fix 5): the viewport-driven component is capped at 62vh
    // (was 82vh) so the marquee + first grid row peek above the fold on
    // desktop; the 560px content floor stays, and min-h preserves the
    // clip-fix semantics — copy can still grow the frame past the cap.
    <header data-block-section={block.id} className="relative flex min-h-[max(560px,62vh)] w-full items-end overflow-hidden bg-stone-900 md:items-center">
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

      <div className="relative mx-auto w-full max-w-7xl px-5 pb-16 pt-24 md:px-10 md:pb-0 md:pt-0">
        {block.tagline && (
          <EditableText as="p" blockId={block.id} field="tagline" className="text-[11px] font-bold uppercase tracking-[0.35em] text-white/70">
            {block.tagline}
          </EditableText>
        )}
        <EditableText
          as="h1"
          blockId={block.id}
          field="headline"
          className="mt-6 max-w-2xl font-serif text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl"
        >
          {block.headline}
        </EditableText>
        <EditableText as="p" blockId={block.id} field="subheadline" className="mt-6 max-w-xl text-base leading-relaxed text-white/80 md:text-lg">
          {block.subheadline}
        </EditableText>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href="#collection"
            className="rounded-[var(--site-radius,9999px)] bg-white px-8 py-4 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--site-accent,#1c1917)] shadow-lg transition hover:bg-stone-100 active:scale-95"
          >
            Shop The Collection
          </a>
          <Link
            href={collectionsHref}
            className="rounded-[var(--site-radius,9999px)] border border-white/50 px-8 py-4 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-white transition hover:border-white hover:bg-white/10 active:scale-95"
          >
            View The Full Collection
          </Link>
        </div>
      </div>
    </header>
  );
}

// Fix 2: the static numbered value-props band was retired — the value_props
// block now renders exclusively as the SiteMarquee ribbon (the block itself
// stays in the schema/rail; its editing home is the SectionRail inspector).

function RitualProductGrid({ block, shop, products }: {
  block: ProductGridBlock;
  shop: SiteShop;
  products: SiteProduct[];
}) {
  return (
    // padding/align consumption (Pillar 4): grid section spacing + header alignment.
    <section id="collection" data-block-section={block.id} className={`mx-auto max-w-7xl px-5 md:px-10 ${ritualPad(block.padding, PAD_20_28)}`}>
      <div className={block.align === 'left' ? 'max-w-xl text-left' : 'mx-auto max-w-xl text-center'}>
        <EditableText as="h2" blockId={block.id} field="title" className="font-serif text-3xl font-bold tracking-tight text-[var(--site-text,oklch(21.6%_0.006_56.043))] md:text-5xl">
          {block.title}
        </EditableText>
        <EditableText as="p" blockId={block.id} field="intro" className="mt-4 text-sm leading-relaxed text-[var(--site-muted,oklch(55.3%_0.013_58.071))] md:text-base">
          {block.intro}
        </EditableText>
      </div>

      {products.length === 0 ? (
        // Branded empty state (mirrors /collections): the hero's
        // "Shop The Collection" anchor lands on something dignified.
        <div className="mx-auto mt-14 max-w-md rounded-2xl border border-dashed border-stone-300 px-8 py-14 text-center md:mt-20">
          <p className="font-serif text-xl font-bold text-[var(--site-text,oklch(21.6%_0.006_56.043))]">The collection is being prepared.</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">New pieces are on their way — check back soon.</p>
        </div>
      ) : block.displayMode === 'carousel' ? (
        <div className="mt-14 md:mt-20">
          <CarouselTrack
            ariaLabel={block.title}
            trackClassName="gap-5 pb-2 md:gap-8"
            itemClassName="w-[68vw] max-w-[300px] sm:w-[300px]"
            buttonClassName="h-11 w-11 rounded-full bg-white text-stone-900 shadow-lg ring-1 ring-stone-200 hover:bg-stone-100 active:scale-95"
            items={products.slice(0, 12).map((p, i) => ({
              key: p.id,
              node: <RitualProductCard product={p} index={i} href={ritualProductHref(shop, p.id)} />,
            }))}
          />
        </div>
      ) : (
        <div className={`mt-14 md:mt-20 ${RITUAL_COLLECTION_GRID}`}>
          {products.slice(0, 12).map((p, i) => (
            <RitualProductCard key={p.id} product={p} index={i} href={ritualProductHref(shop, p.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function RitualProductTabs({ block }: { block: ProductTabsBlock }) {
  return (
    // padding consumption (Pillar 4): tabs section spacing.
    <section data-block-section={block.id} className={`border-b border-stone-200 bg-white ${ritualPad(block.padding, PAD_16_24)}`}>
      <div className="mx-auto max-w-4xl px-5 md:px-10">
        <EditableText
          as="h2"
          blockId={block.id}
          field="title"
          className="text-center font-serif text-3xl font-bold tracking-tight text-stone-900 md:text-4xl"
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
    <section id="story" data-block-section={block.id} className={`border-y border-stone-200 bg-white ${ritualPad(block.padding, PAD_20_28)}`}>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-5 md:grid-cols-[200px_1fr] md:gap-14 md:px-10">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-stone-400">Our Story</p>
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
          <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">{shopName}</p>
        </div>
      </div>
    </section>
  );
}

// Archetype pass (Pillar 3): real customer voices in the airy stone dialect —
// serif pull-quotes on white cards, verified attribution beneath. Items are
// seeded exclusively from real reviews (integrity law).
function RitualTestimonials({ block }: { block: TestimonialsBlock }) {
  return (
    // padding/align consumption (Pillar 4): quotes section spacing + heading alignment.
    <section data-block-section={block.id} className={`border-y border-stone-200 bg-white ${ritualPad(block.padding, PAD_20_28)}`}>
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
            <figure key={`${block.id}-quote-${i}`} className="rounded-2xl border border-stone-200 bg-[var(--site-bg,#FBFAF7)] p-7 md:p-9">
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
                  className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--site-muted,oklch(70.9%_0.01_56.259))]"
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
// solid accent panel carrying the boutique monogram. Accent rides
// --site-accent with the stone default, so themeless rendering stays on-dialect.
function RitualSplitCta({ block, shopName, collectionsHref }: {
  block: SplitCtaBlock;
  shopName: string | null;
  collectionsHref: string;
}) {
  const monogram = (shopName ?? 'S').trim().charAt(0).toUpperCase() || 'S';
  return (
    // padding consumption (Pillar 4): split-spread section spacing.
    <section data-block-section={block.id} className={`mx-auto max-w-7xl px-5 md:px-10 ${ritualPad(block.padding, PAD_16_24)}`}>
      <div className="grid grid-cols-1 overflow-hidden rounded-3xl border border-stone-200 bg-white md:grid-cols-2">
        <div className="flex flex-col justify-center gap-5 p-8 md:p-14">
          <EditableText as="h2" blockId={block.id} field="headline" className="font-serif text-3xl font-bold tracking-tight text-[var(--site-text,oklch(21.6%_0.006_56.043))] md:text-4xl">
            {block.headline}
          </EditableText>
          <EditableText as="p" blockId={block.id} field="body" className="max-w-md text-sm leading-relaxed text-[var(--site-muted,oklch(55.3%_0.013_58.071))] md:text-base">
            {block.body}
          </EditableText>
          <Link
            href={collectionsHref}
            data-block-id={block.id}
            data-block-field="button_label"
            className="mt-2 inline-flex min-h-11 items-center self-start rounded-[var(--site-radius,9999px)] bg-[var(--site-accent,#1c1917)] px-8 text-[10px] font-bold uppercase tracking-[0.25em] text-white shadow-sm transition hover:brightness-125 active:scale-95"
          >
            {block.button_label}
          </Link>
        </div>
        <div aria-hidden className="relative flex min-h-[220px] items-center justify-center bg-[var(--site-accent,#1c1917)] md:min-h-[320px]">
          <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.16),transparent_60%)]" />
          <span className="relative font-serif text-[7rem] italic leading-none text-white/25 md:text-[10rem]">{monogram}</span>
        </div>
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

  return (
    <RitualChrome shop={shop} config={config} active="home">
      {blocks.map((block, i) => {
        // The hero (LCP) never animates; every other section rides the Reveal
        // island (fade-in-up on scroll, static in editor previews / reduced
        // motion — see Reveal.tsx). Small index-based sibling stagger.
        const section = (() => {
          switch (block.type) {
            case 'hero_banner':
              return <RitualHero block={block} shop={shop} heroMedia={heroMedia} collectionsHref={collectionsHref} />;
            // value_props: no body section (Fix 2) — the block renders as the
            // SiteMarquee ribbon after the hero.
            case 'product_grid':
              return <RitualProductGrid block={block} shop={shop} products={products} />;
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
              return <RitualSplitCta block={block} shopName={shop.shop_name} collectionsHref={collectionsHref} />;
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
