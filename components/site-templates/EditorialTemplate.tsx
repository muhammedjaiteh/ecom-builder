import { Fragment } from 'react';
import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import {
  FEATURED_MAX,
  resolveHeroSignal,
  resolveVisibleBlocks,
  selectFeaturedProducts,
  siteCollectionsPath,
  type HeroMedia,
  type HeroSignal,
  type LayoutStrategy,
  type SiteBlock,
  type SiteProduct,
  type SiteShop,
  type SiteTemplateProps,
} from '@/lib/siteTemplates';
import CarouselTrack from './CarouselTrack';
import CategoryNav, { categoryAnchorId, distinctCategories } from './CategoryNav';
import EditableText from './EditableText';
import GatedVideo from './GatedVideo';
import HeroBrandPlate from './HeroBrandPlate';
import ProductCollage, { picturedProducts } from './ProductCollage';
import ProductTabsIsland from './ProductTabsIsland';
import Reveal from './Reveal';
import SiteMarquee from './SiteMarquee';
import StoryClamp from './StoryClamp';
import VideoHeroMedia from './VideoHeroMedia';
import EditorialChrome, {
  EDITORIAL_COLLECTION_GRID,
  EditorialGridFillers,
  EditorialProductCard,
  EditorialProductPlate,
  editorialPrice,
  editorialProductHref,
  editorialStockBadge,
} from './chrome/EditorialChrome';

// EDITORIAL (template_key 'editorial') — Layout B.
// Magazine anatomy, structurally distinct from the Minimal layout, in its
// Micro-Homepage cut: hairline top bar + oversized serif masthead → compact
// asymmetric split hero (media 7 columns at ≈40vh, copy 5: one-sentence hook
// + honest offer pill) → kinetic value-props marquee (Fix 2: the pinned
// numbered index row was retired — the value_props block renders as the
// moving brand ribbon on the hero→features seam, edited from the SectionRail
// inspector) → two alternating full-width product features (the spread) →
// dense hairline showcase grid (≤4 plates, none repeating the spread, image
// cross-fade) → "Explore Collection" bridge → pull-quote brand story (clamped
// to a 3-line teaser with a Read-the-full-story reveal — StoryClamp) → dark
// serif sign-off footer. Paper `#F7F5F0`, near-black ink, deep-green accent.
//
// Micro-Homepage: the spread takes the top 2 of selectFeaturedProducts, the
// showcase the next ≤4 from what remains (zero repeats), and the hero pill
// (resolveHeroSignal) reads that same ordered union — it always describes
// what sits beneath it. Every new element (pill, bridge, cross-fade toggle)
// is conditionally rendered — no gray placeholders — and carries NO
// data-block-* attrs: the hero/grid SECTION owns editor targeting. New motion
// is CSS-only with a reduced-motion block (globals.css).
//
// Phase 3 block rendering: the body iterates resolveBlocks(config) in array
// order, with one fixed DESIGN SLOT that is part of the Editorial anatomy
// itself (exactly like a magazine's pinned back-matter):
//   - cta_banner always renders as the chrome's dark sign-off spread (that is
//     where it has lived since Phase 2 — see chrome/EditorialChrome).
// The product-features spread consumes live product data (not block copy) and
// is welded to the hero block, preserving the historical hero → features
// opening. With the deterministic legacy projection this yields the exact
// pre-block anatomy; hero/grid/story reorderings in stored blocks are
// respected as-is. Copy nodes carry data-block-id/data-block-field for the
// dashboard Site Editor (inert on the public site).
//
// Phase 4: product_grid honors displayMode ('carousel' renders the shared
// scroll-snap CarouselTrack in the hairline dialect; absent/'grid' keeps the
// exact historical grid markup), and the seller-added product_tabs /
// video_hero blocks flow in array order — they are body blocks, never design
// slots, so the chrome sign-off is untouched. The
// grid/tabs/film section wrappers carry data-block-section markers for the
// Site Editor's floating settings chip — inert data attributes on the public
// site, exactly like the EditableText copy markers.
//
// Omnichannel router: the masthead + sign-off footer live in
// chrome/EditorialChrome (shared by /site home, /collections, and
// /products/[id]) and every journey stays on /site — features and grid plates
// open the on-site PDP, collection CTAs open the full catalog page. The only
// /shop reference is the chrome footer's deliberate "View classic boutique"
// escape.

type HeroBlock = Extract<SiteBlock, { type: 'hero_banner' }>;
type ProductGridBlock = Extract<SiteBlock, { type: 'product_grid' }>;
type StoryBlock = Extract<SiteBlock, { type: 'story_text' }>;
type ProductTabsBlock = Extract<SiteBlock, { type: 'product_tabs' }>;
type VideoHeroBlock = Extract<SiteBlock, { type: 'video_hero' }>;
type TestimonialsBlock = Extract<SiteBlock, { type: 'testimonials' }>;
type SplitCtaBlock = Extract<SiteBlock, { type: 'split_cta' }>;

// ── Inspector depth (Pillar 4): per-dialect padding/align class maps ─────────
// Coverage in the EDITORIAL dialect: padding on product_grid (header zone) /
// story_text / product_tabs / testimonials / split_cta (copy column); align on
// product_grid (header row), story_text (quote), testimonials (heading).
// cta_banner is the chrome sign-off DESIGN SLOT — no per-block spacing there.
// Absent keys return the EXACT historical classes — byte-identical law.
type PadKey = 'compact' | 'default' | 'spacious';
function editorialPad(p: PadKey | undefined, map: Record<PadKey, string>): string {
  return map[p ?? 'default'];
}
const PAD_GRID_HEAD: Record<PadKey, string> = {
  compact: 'py-6 md:py-8',
  default: 'py-10 md:py-14',
  spacious: 'py-16 md:py-24',
};
const PAD_STORY: Record<PadKey, string> = {
  compact: 'py-12 md:py-20',
  default: 'py-20 md:py-32',
  spacious: 'py-28 md:py-44',
};
const PAD_16_24: Record<PadKey, string> = {
  compact: 'py-10 md:py-14',
  default: 'py-16 md:py-24',
  spacious: 'py-24 md:py-36',
};
const PAD_SPLIT: Record<PadKey, string> = {
  compact: 'py-8 md:py-12',
  default: 'py-14 md:py-20',
  spacious: 'py-20 md:py-32',
};


// Phase 6B: hero/grid structural variants. The variant is read from
// config.layout_strategy (Phase 6A, strictly optional) — absent/'standard'
// (and any unknown value) falls through to the EXACT historical markup, so
// every stored legacy storefront renders byte-identically.
type HeroVariant = NonNullable<LayoutStrategy['hero']>;
type GridVariant = NonNullable<LayoutStrategy['grid']>;

function EditorialHero({ block, shop, heroMedia, signal, variant }: {
  block: HeroBlock;
  shop: SiteShop;
  heroMedia: HeroMedia;
  /** Honest offer pill (resolveHeroSignal) — null renders NO pill, no gap. */
  signal: HeroSignal | null;
  /** Phase 6B structural variant — undefined ≡ 'standard'. */
  variant?: HeroVariant;
}) {
  // Shared copy nodes — identical EditableText targeting in every variant so
  // the Site Editor's field mapping never changes with the layout.
  const pill = signal && (
    <span className="sndk-rise inline-flex min-h-8 items-center gap-2 self-start border border-[var(--site-text,#171717)] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--site-text,oklch(20.5%_0_0))]">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${signal.kind === 'stock' ? 'bg-amber-700' : 'bg-[var(--site-accent,#1a2e1a)]'}`} />
      {signal.label}
    </span>
  );
  const cta = (
    <a
      href="#collection"
      className="group inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-[var(--site-radius,0px)] bg-[var(--site-accent,#171717)] px-8 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-bg,#F7F5F0)] transition hover:brightness-125 active:scale-[0.98] sm:w-auto sm:self-start"
    >
      Shop The Collection
      <span aria-hidden className="transition-transform group-hover:translate-x-1.5 motion-reduce:transition-none">&rarr;</span>
    </a>
  );

  if (variant === 'text-centric') {
    // Typography-led opener: NO hero plate. A centered, oversized serif
    // headline on paper with a hairline rule above, generous vertical air,
    // and the same accent CTA. Media (if any) is deliberately unused here.
    return (
      <section data-block-section={block.id} className="border-b border-[var(--site-text,#171717)] px-5 py-20 md:px-10 md:py-32">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center md:gap-8">
          <span aria-hidden className="h-px w-16 bg-[var(--site-text,#171717)]" />
          <EditableText
            as="h1"
            blockId={block.id}
            field="headline"
            className="font-serif text-4xl italic leading-[1.05] tracking-tight text-balance md:text-6xl lg:text-7xl"
          >
            {block.headline}
          </EditableText>
          <EditableText as="p" blockId={block.id} field="subheadline" className="max-w-xl text-base leading-relaxed text-[var(--site-muted,oklch(43.9%_0_0))] md:text-lg">
            {block.subheadline}
          </EditableText>
          {/* Row wrappers: the shared pill/CTA carry self-start (a cross-axis
              hint in the standard column) — in a row they stay centered. */}
          {signal && <div className="flex justify-center">{pill}</div>}
          <div className="flex w-full justify-center">{cta}</div>
        </div>
      </section>
    );
  }

  if (variant === 'split') {
    // Mirrored, taller split: copy leads on the LEFT (5 cols, bold upright
    // serif, left rule) and the plate sits on the RIGHT (7 cols at ≈56vh) —
    // the inverse of the standard 7/5 media-first opener.
    return (
      <section data-block-section={block.id} className="grid grid-cols-1 border-b border-[var(--site-text,#171717)] md:grid-cols-12">
        <div className="order-2 flex flex-col justify-center gap-5 border-[var(--site-text,#171717)] px-5 py-10 md:order-1 md:col-span-5 md:gap-6 md:border-r md:px-12 md:py-16">
          <span aria-hidden className="h-px w-12 bg-[var(--site-accent,#1a2e1a)]" />
          <EditableText
            as="h1"
            blockId={block.id}
            field="headline"
            className="font-serif text-3xl font-bold leading-[1.05] tracking-tight text-balance md:text-5xl lg:text-6xl"
          >
            {block.headline}
          </EditableText>
          <EditableText as="p" blockId={block.id} field="subheadline" className="max-w-md text-sm leading-relaxed text-[var(--site-muted,oklch(43.9%_0_0))] md:text-base">
            {block.subheadline}
          </EditableText>
          {pill}
          {cta}
        </div>
        <div className="relative order-1 min-h-[280px] overflow-hidden md:order-2 md:col-span-7 md:min-h-[max(480px,56vh)]">
          {heroMedia?.type === 'video' ? (
            <GatedVideo
              src={heroMedia.url}
              poster={heroMedia.poster}
              alt={shop.shop_name ?? 'Hero'}
              className="absolute inset-0 h-full w-full object-cover"
              posterSizes="(min-width: 768px) 58vw, 100vw"
              posterBlurTone="light"
              posterPriority
              fallback={
                <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-neutral-200 via-[#EDEAE2] to-neutral-300" />
              }
              playButtonClassName="absolute left-1/2 top-1/2 z-10 flex min-h-11 -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 border border-[var(--site-text,#171717)] bg-[color-mix(in_srgb,var(--site-bg,#F7F5F0)_95%,transparent)] px-7 py-3.5 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-text,#171717)] backdrop-blur-sm transition hover:bg-[var(--site-text,#171717)] hover:text-[var(--site-bg,#F7F5F0)] active:scale-95"
            />
          ) : heroMedia ? (
            <SmartImage
              src={heroMedia.url}
              alt={shop.shop_name ?? 'Hero'}
              fill
              priority
              sizes="(min-width: 768px) 58vw, 100vw"
              className="sndk-parallax object-cover"
            />
          ) : (
            <HeroBrandPlate tone="editorial" shopName={shop.shop_name} />
          )}
        </div>
      </section>
    );
  }

  return (
    <section data-block-section={block.id} className="grid grid-cols-1 border-b border-[var(--site-text,#171717)] md:grid-cols-12">
      {/* Micro-Homepage: a compact niche opener — the md media pane sits at
          ≈40vh with a 360px content floor (was min(580px,62vh)); mobile drops
          to a 240px plate so the hook + pill + features peek above the fold.
          The copy column still grows the section (min-h clip-fix semantics). */}
      <div className="relative min-h-[240px] overflow-hidden border-[var(--site-text,#171717)] md:col-span-7 md:min-h-[max(360px,40vh)] md:border-r">
        {heroMedia?.type === 'video' ? (
          // 2G media gate: unconstrained networks autoplay exactly as before;
          // save-data/2g/3g/reduced-motion get the ad poster (or the monogram
          // plate) with a ≥44px hairline tap-to-play in the print dialect.
          <GatedVideo
            src={heroMedia.url}
            poster={heroMedia.poster}
            alt={shop.shop_name ?? 'Hero'}
            className="absolute inset-0 h-full w-full object-cover"
            posterSizes="(min-width: 768px) 58vw, 100vw"
            posterBlurTone="light"
            posterPriority
            fallback={
              <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-neutral-200 via-[#EDEAE2] to-neutral-300" />
            }
            playButtonClassName="absolute left-1/2 top-1/2 z-10 flex min-h-11 -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 border border-[var(--site-text,#171717)] bg-[color-mix(in_srgb,var(--site-bg,#F7F5F0)_95%,transparent)] px-7 py-3.5 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-text,#171717)] backdrop-blur-sm transition hover:bg-[var(--site-text,#171717)] hover:text-[var(--site-bg,#F7F5F0)] active:scale-95"
          />
        ) : heroMedia ? (
          <SmartImage
            src={heroMedia.url}
            alt={shop.shop_name ?? 'Hero'}
            fill
            priority
            sizes="(min-width: 768px) 58vw, 100vw"
            // .sndk-parallax: pure-CSS scroll depth (archetype pass) — static
            // where scroll-timelines/motion are unavailable (globals.css).
            className="sndk-parallax object-cover"
          />
        ) : (
          /* Null tier (Pillar 4b): the animated brand plate — same gradient
             stops, panned, with the accent glow + monogram. */
          <HeroBrandPlate tone="editorial" shopName={shop.shop_name} />
        )}
      </div>
      {/* Pass 3: the "No. 01 — The Opening" eyebrow was retired (decorative
          numbering, not merchant identity); the headline leads. */}
      <div className="flex flex-col justify-center gap-4 px-5 py-8 md:col-span-5 md:gap-5 md:px-10 md:py-12">
        <EditableText
          as="h1"
          blockId={block.id}
          field="headline"
          className="font-serif text-3xl italic leading-[1.1] tracking-tight md:text-4xl lg:text-5xl"
        >
          {block.headline}
        </EditableText>
        {/* The one-sentence hook. */}
        <EditableText as="p" blockId={block.id} field="subheadline" className="max-w-md text-sm leading-relaxed text-[var(--site-muted,oklch(43.9%_0_0))] md:text-base">
          {block.subheadline}
        </EditableText>
        {/* Offer pill — hairline chip in the print dialect. Honest-signal
            ladder (low stock → new this week → fulfillment fact); null →
            nothing rendered. .sndk-rise never touches an LCP/editor node. */}
        {signal && (
          <span className="sndk-rise inline-flex min-h-8 items-center gap-2 self-start border border-[var(--site-text,#171717)] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--site-text,oklch(20.5%_0_0))]">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${signal.kind === 'stock' ? 'bg-amber-700' : 'bg-[var(--site-accent,#1a2e1a)]'}`} />
            {signal.label}
          </span>
        )}
        {/* Solid accent fill in the print dialect (square --site-radius,
            paper ink) — the same token the chrome CTAs ride, so the theme
            cascade recolors the hero button with the rest of the site.
            Fallback #171717 IS neutral-900 (the existing Editorial CTA law). */}
        <a
          href="#collection"
          className="group inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-[var(--site-radius,0px)] bg-[var(--site-accent,#171717)] px-8 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-bg,#F7F5F0)] transition hover:brightness-125 active:scale-[0.98] sm:w-auto sm:self-start"
        >
          Shop The Collection
          <span aria-hidden className="transition-transform group-hover:translate-x-1.5 motion-reduce:transition-none">&rarr;</span>
        </a>
      </div>
    </section>
  );
}

function EditorialFeatures({ shop, featured }: {
  shop: SiteShop;
  /** The 2-piece spread (selectFeaturedProducts(products, 2)) — selected by
   *  the body so the showcase grid can exclude exactly these ids. */
  featured: SiteProduct[];
}) {
  if (featured.length === 0) {
    // Keep the #features anchor alive (the masthead nav always links to it)
    // with a minimal section header instead of a dead jump — the cleaner of
    // the two options for an empty catalog.
    return (
      <section id="features" className="border-b border-[var(--site-text,#171717)] px-5 py-12 text-center md:px-10 md:py-16">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--site-muted,oklch(55.6%_0_0))]">Features</p>
        <p className="mt-3 font-serif text-2xl italic text-[var(--site-text,#171717)]">The first features are being prepared.</p>
      </section>
    );
  }
  return (
    <section id="features" className="border-b border-[var(--site-text,#171717)]">
      {featured.map((p, i) => {
        const badge = editorialStockBadge(p.stock_quantity);
        const reversed = i % 2 === 1;
        return (
          <article
            key={p.id}
            className={`grid grid-cols-1 md:grid-cols-2 ${i > 0 ? 'border-t border-[var(--site-text,#171717)]' : ''}`}
          >
            <div className={`group relative aspect-[4/3] overflow-hidden border-[var(--site-text,#171717)] md:aspect-auto md:min-h-[500px] ${reversed ? 'md:order-2 md:border-l' : 'md:border-r'}`}>
              <div className="absolute inset-0">
                <EditorialProductPlate
                  src={p.ad_hero_image_url ?? p.image_url}
                  alt={p.name}
                  index={i}
                  sizes="(min-width: 768px) 50vw, 100vw"
                />
              </div>
              {badge && (
                <span className={`absolute left-4 top-4 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.25em] ${
                  badge.tone === 'out' ? 'bg-[var(--site-text,#171717)] text-white' : 'bg-[var(--site-bg,#F7F5F0)] text-amber-800 ring-1 ring-[var(--site-text,#171717)]'
                }`}>
                  {badge.label}
                </span>
              )}
            </div>
            {/* Pass 3: the eyebrow is the piece's REAL category (or nothing)
                instead of "Feature No. 0X"; price sits directly under the
                name in bold ink; the CTA is full-width on phones. */}
            <div className={`flex flex-col justify-center gap-4 px-5 py-10 md:gap-5 md:px-14 md:py-24 ${reversed ? 'md:order-1' : ''}`}>
              {p.category && (
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--site-muted,oklch(55.6%_0_0))]">{p.category}</p>
              )}
              <h2 className="font-serif text-3xl font-bold leading-tight text-balance md:text-5xl">{p.name}</h2>
              <p className="text-2xl font-bold tracking-tight text-[var(--site-text,oklch(20.5%_0_0))]">{editorialPrice(p.price)}</p>
              {p.description && (
                <p className="line-clamp-3 max-w-md text-sm leading-relaxed text-[var(--site-muted,oklch(43.9%_0_0))] md:text-base">{p.description}</p>
              )}
              {/* Accent cohesion (Fix 6): the feature CTA rides --site-accent.
                  Fallback #171717 IS neutral-900 — theme-less rendering stays
                  byte-identical; a themed site recolors the outline + fill. */}
              <Link
                href={editorialProductHref(shop, p.id)}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--site-radius,0px)] border border-[var(--site-accent,#171717)] px-9 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-accent,#171717)] transition hover:bg-[var(--site-accent,#171717)] hover:text-[var(--site-bg,#F7F5F0)] active:scale-[0.98] sm:w-auto sm:self-start"
              >
                View The Piece
              </Link>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function EditorialGrid({ block, shop, products, catalog, variant }: {
  block: ProductGridBlock;
  shop: SiteShop;
  /** The showcase (≤FEATURED_MAX pieces, none repeating the features spread). */
  products: SiteProduct[];
  /** Full home slice — its size distinguishes "empty catalog" (branded empty
   *  state) from "the spread already shows everything" (header + bridge
   *  only); its categories drive the discovery strip (Pass 3). */
  catalog: SiteProduct[];
  /** Phase 6B structural variant — undefined ≡ 'standard'. */
  variant?: GridVariant;
}) {
  const catalogSize = catalog.length;
  const showcase = products.slice(0, FEATURED_MAX);
  // Bridge target: null in slugless studio previews → no bridge rendered.
  const collectionsPath = siteCollectionsPath(shop);
  const categories = collectionsPath ? distinctCategories(catalog) : [];
  return (
    // padding/align consumption (Pillar 4): grid header zone spacing + layout.
    <section id="collection" data-block-section={block.id} className="border-b border-[var(--site-text,#171717)]">
      <div className={`flex flex-col gap-4 px-5 md:px-10 ${editorialPad(block.padding, PAD_GRID_HEAD)} ${block.align === 'center' ? 'items-center text-center' : 'items-start justify-between md:flex-row md:items-baseline'}`}>
        <EditableText as="h2" blockId={block.id} field="title" className="font-serif text-3xl font-black tracking-tight text-balance md:text-5xl">
          {block.title}
        </EditableText>
        <EditableText as="p" blockId={block.id} field="intro" className="max-w-md text-sm leading-relaxed text-[var(--site-muted,oklch(55.6%_0_0))]">
          {block.intro}
        </EditableText>
      </div>
      {/* Category discovery (Pass 3): real inventory categories, hairline
          chips, each deep-linking to its group on /collections. Renders
          nothing below two categories. */}
      {collectionsPath && categories.length >= 2 && (
        <div className="border-t border-[color-mix(in_srgb,var(--site-text,#171717)_25%,transparent)] px-5 py-4 md:px-10">
          <CategoryNav
            tone="editorial"
            label={null}
            categories={categories}
            hrefFor={(c) => `${collectionsPath}#${categoryAnchorId(c)}`}
          />
        </div>
      )}
      {catalogSize === 0 ? (
        // Branded empty state (mirrors /collections): the hero's
        // "Read The Collection" anchor lands on something dignified.
        <div className="border-t border-[var(--site-text,#171717)] px-5 py-20 text-center md:px-10">
          <p className="font-serif text-2xl italic text-[var(--site-text,#171717)]">The collection is being prepared.</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--site-muted,oklch(55.6%_0_0))]">New pieces are on their way — check back soon.</p>
        </div>
      ) : showcase.length === 0 ? (
        // 1–2 piece shops: the features spread already shows every piece —
        // no repeats by design, so the header hands straight to the bridge.
        null
      ) : block.displayMode === 'carousel' ? (
        <CarouselTrack
          ariaLabel={block.title}
          trackClassName="gap-px border-t border-[var(--site-text,#171717)] bg-[var(--site-text,#171717)]"
          itemClassName="w-[64vw] max-w-[300px] bg-[var(--site-bg,#F7F5F0)] sm:w-[300px]"
          buttonClassName="h-11 w-11 border border-[var(--site-text,#171717)] bg-[var(--site-bg,#F7F5F0)] text-[var(--site-text,#171717)] shadow-lg hover:bg-[var(--site-text,#171717)] hover:text-[var(--site-bg,#F7F5F0)] active:scale-95"
          items={showcase.map((p, i) => ({
            key: p.id,
            node: <EditorialProductCard product={p} index={i} href={editorialProductHref(shop, p.id)} sizes="(min-width: 640px) 300px, 64vw" />,
          }))}
        />
      ) : variant === 'featured-first' ? (
        // Phase 6B featured-first: the lead piece spans the full 2-col row on
        // phones and a 2×2 block at md inside the SAME hairline grid; the rest
        // keep their standard plates beside/below it. The lead occupies 2
        // cells on mobile / 4 at md — i.e. 1 + 1 = 2 / 1 + 3 = 4 extra cells
        // versus a plain card — so itemCount + 3 feeds the exact same filler
        // arithmetic (both breakpoints, parity preserved) with no new helper.
        <div className={EDITORIAL_COLLECTION_GRID}>
          {showcase.map((p, i) =>
            i === 0 ? (
              <div key={p.id} className="col-span-2 bg-[var(--site-bg,#F7F5F0)] md:row-span-2 [&>*]:h-full">
                <EditorialProductCard product={p} index={i} href={editorialProductHref(shop, p.id)} sizes="(min-width: 768px) 50vw, 100vw" />
              </div>
            ) : (
              <EditorialProductCard key={p.id} product={p} index={i} href={editorialProductHref(shop, p.id)} />
            ),
          )}
          <EditorialGridFillers itemCount={showcase.length + 3} />
        </div>
      ) : (
        <div className={EDITORIAL_COLLECTION_GRID}>
          {showcase.map((p, i) => (
            <EditorialProductCard key={p.id} product={p} index={i} href={editorialProductHref(shop, p.id)} />
          ))}
          <EditorialGridFillers itemCount={showcase.length} />
        </div>
      )}

      {/* "Explore Collection" bridge — a full-width hairline row from the
          showcase to the full catalog. Conditional: needs a catalog AND a
          real /site path (slugless previews render none). No data-block attrs. */}
      {catalogSize > 0 && collectionsPath && (
        <Link
          href={collectionsPath}
          className="group flex min-h-14 items-center justify-between border-t border-[var(--site-text,#171717)] bg-[var(--site-accent,#171717)] px-5 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-bg,#F7F5F0)] transition hover:brightness-125 md:px-10"
        >
          <span>Explore Collection</span>
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1.5 motion-reduce:transition-none">&rarr;</span>
        </Link>
      )}
    </section>
  );
}

function EditorialProductTabs({ block }: { block: ProductTabsBlock }) {
  return (
    // padding consumption (Pillar 4): tabs section spacing.
    <section data-block-section={block.id} className={`border-b border-[var(--site-text,#171717)] px-5 md:px-10 ${editorialPad(block.padding, PAD_16_24)}`}>
      <div className="mx-auto max-w-4xl">
        <EditableText
          as="h2"
          blockId={block.id}
          field="title"
          className="font-serif text-3xl font-black tracking-tight md:text-5xl"
        >
          {block.title}
        </EditableText>
        <div className="mt-8 md:mt-10">
          <ProductTabsIsland blockId={block.id} tabs={block.tabs} variant="editorial" />
        </div>
      </div>
    </section>
  );
}

function EditorialVideoHero({ block, shopName }: { block: VideoHeroBlock; shopName: string | null }) {
  return (
    <section data-block-section={block.id} className="border-b border-[var(--site-text,#171717)]">
      {/* Fold discipline (Fix 5): md frame caps at min(560px,60vh) — px floor
          behavior on large screens, honest height on short laptops. */}
      <div className="relative min-h-[380px] overflow-hidden md:min-h-[min(560px,60vh)]">
        <VideoHeroMedia
          src={block.videoUrl}
          poster={block.posterUrl ?? null}
          alt={shopName ?? 'Brand film'}
          className="absolute inset-0 h-full w-full object-cover"
          fallbackClassName="absolute inset-0 bg-gradient-to-br from-neutral-200 via-[#EDEAE2] to-neutral-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/75 via-neutral-950/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-5 py-10 md:px-10 md:py-14">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/60">The Film</p>
          {block.headline && (
            <EditableText
              as="h2"
              blockId={block.id}
              field="headline"
              className="mt-3 max-w-3xl font-serif text-3xl italic leading-tight text-white md:text-5xl"
            >
              {block.headline}
            </EditableText>
          )}
          {block.subheadline && (
            <EditableText
              as="p"
              blockId={block.id}
              field="subheadline"
              className="mt-4 max-w-xl text-sm leading-relaxed text-white/75 md:text-base"
            >
              {block.subheadline}
            </EditableText>
          )}
        </div>
      </div>
    </section>
  );
}

// Archetype pass (Pillar 3): reader letters in the print dialect — hairline
// column rules, italic quotes, em-dash attribution. Items are seeded
// exclusively from real reviews (integrity law).
function EditorialTestimonials({ block }: { block: TestimonialsBlock }) {
  // Pass 3: an empty testimonials block renders NOTHING — never a heading
  // over a void. (The block stays in the config/rail for the editor.)
  if (block.items.length === 0) return null;
  return (
    // padding/align consumption (Pillar 4): quotes spacing + heading alignment.
    <section data-block-section={block.id} className={`border-b border-[var(--site-text,#171717)] px-5 md:px-10 ${editorialPad(block.padding, PAD_16_24)}`}>
      <div className="mx-auto max-w-5xl">
        {block.title ? (
          <EditableText
            as="h2"
            blockId={block.id}
            field="title"
            className={`font-serif text-3xl font-black tracking-tight md:text-5xl ${block.align === 'center' ? 'text-center' : ''}`}
          >
            {block.title}
          </EditableText>
        ) : (
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--site-muted,oklch(55.6%_0_0))]">Letters</p>
        )}
        <div className="mt-10 grid grid-cols-1 gap-y-10 md:grid-cols-2 md:gap-x-14">
          {block.items.map((item, i) => (
            <figure key={`${block.id}-quote-${i}`} className={`md:pr-2 ${i > 0 ? 'border-t border-[color-mix(in_srgb,var(--site-text,#171717)_25%,transparent)] pt-8 md:border-t-0 md:pt-0' : ''}`}>
              <EditableText
                as="blockquote"
                blockId={block.id}
                field={`items.${i}.quote`}
                className="font-serif text-xl italic leading-relaxed text-[var(--site-text,oklch(20.5%_0_0))] md:text-2xl"
              >
                {item.quote}
              </EditableText>
              <figcaption className="mt-4">
                <EditableText
                  as="span"
                  blockId={block.id}
                  field={`items.${i}.author`}
                  className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(55.6%_0_0))]"
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

// Archetype pass (Pillar 3): the two-panel conversion spread in the hairline
// dialect — copy column beside a product panel. Pass 3: the panel shows the
// merchant's own pieces (ProductCollage — up to two, linked, priced) instead
// of an 11rem monogram; a shop with no pictured product gets a plain accent
// plate. Square corners, print borders; --site-accent, deep-green default.
function EditorialSplitCta({ block, shop, products }: { block: SplitCtaBlock; shop: SiteShop; products: SiteProduct[] }) {
  const hasCollage = picturedProducts(products, 1).length > 0;
  return (
    <section data-block-section={block.id} className="grid grid-cols-1 border-b border-[var(--site-text,#171717)] md:grid-cols-2">
      {/* padding consumption (Pillar 4): split copy-column spacing. */}
      <div className={`flex flex-col justify-center gap-5 border-[var(--site-text,#171717)] px-5 md:border-r md:px-14 ${editorialPad(block.padding, PAD_SPLIT)}`}>
        <EditableText as="h2" blockId={block.id} field="headline" className="font-serif text-3xl italic leading-tight text-balance md:text-5xl">
          {block.headline}
        </EditableText>
        <EditableText as="p" blockId={block.id} field="body" className="max-w-md text-sm leading-relaxed text-[var(--site-muted,oklch(43.9%_0_0))] md:text-base">
          {block.body}
        </EditableText>
        <Link
          href={siteCollectionsPath(shop) ?? '#collection'}
          data-block-id={block.id}
          data-block-field="button_label"
          className="mt-1 inline-flex min-h-12 w-full items-center justify-center rounded-[var(--site-radius,0px)] border border-[var(--site-accent,#171717)] px-9 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-accent,#171717)] transition hover:bg-[var(--site-accent,#171717)] hover:text-[var(--site-bg,#F7F5F0)] active:scale-[0.98] sm:w-auto sm:self-start"
        >
          {block.button_label}
        </Link>
      </div>
      {hasCollage ? (
        <div className="border-t border-[var(--site-text,#171717)] px-5 py-8 md:border-t-0 md:px-12 md:py-12">
          <ProductCollage tone="editorial" products={products} hrefFor={(id) => editorialProductHref(shop, id)} />
        </div>
      ) : (
        <div aria-hidden className="relative min-h-[160px] bg-[var(--site-accent,#1a2e1a)] md:min-h-[340px]">
          <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(247,245,240,0.14),transparent_60%)]" />
        </div>
      )}
    </section>
  );
}

// Pull-quote scale guard (Phase 8): brand_story is budgeted to 600 chars but
// md:text-5xl only reads as a pull-quote for SHORT copy. Beyond 220 chars
// (~3 display lines at 5xl on a 4xl-max column) the quote steps down to a
// long-read scale — still serif-italic print, but readable instead of a wall.
const STORY_LONG_THRESHOLD = 220;

function EditorialStory({ block, shopName }: { block: StoryBlock; shopName: string | null }) {
  const isLong = block.body.length > STORY_LONG_THRESHOLD;
  return (
    // padding/align consumption (Pillar 4): story spacing + quote alignment.
    <section id="story" data-block-section={block.id} className={`border-b border-[var(--site-text,#171717)] px-5 md:px-10 ${editorialPad(block.padding, PAD_STORY)}`}>
      <div className="relative mx-auto max-w-4xl">
        {/* Pass 3: the pull-quote mark stepped down from 8/12rem to 5/8rem —
            a typographic cue, not a decorative wall behind the copy. */}
        <span aria-hidden className="pointer-events-none absolute -top-6 left-0 select-none font-serif text-[5rem] leading-none text-[color-mix(in_srgb,var(--site-text,#171717)_20%,transparent)] md:-top-10 md:text-[8rem]">
          &ldquo;
        </span>
        {/* Fix 1: the quote-clearing padding moved onto this relative wrapper
            (paint order over the glyph preserved) so the clamp island wraps a
            clean copy node — StoryClamp renders it bare in editor previews. */}
        <div className={`relative pt-14 md:pt-20 ${block.align === 'center' ? 'text-center' : ''}`}>
          <StoryClamp tone="editorial">
            <EditableText
              as="blockquote"
              blockId={block.id}
              field="body"
              className={`font-serif italic text-[var(--site-text,oklch(20.5%_0_0))] ${
                isLong ? 'text-2xl leading-[1.35] md:text-3xl' : 'text-3xl leading-[1.2] md:text-5xl'
              }`}
            >
              {block.body}
            </EditableText>
          </StoryClamp>
        </div>
        <p className="mt-9 text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--site-muted,oklch(55.6%_0_0))]">&mdash; {shopName}</p>
      </div>
    </section>
  );
}

// Fix 2: the pinned numbered index row was retired — the value_props block
// now renders exclusively as the SiteMarquee ribbon (the block itself stays
// in the schema/rail; its editing home is the SectionRail inspector).

export default function EditorialTemplate({ shop, products, config, heroMedia }: SiteTemplateProps) {
  // Item 2: hidden blocks are SKIPPED at render (the editor previews them
  // dimmed by stripping the flag client-side). Hiding the hero also hides
  // its welded companions — the seam marquee and the features spread ride
  // the Editorial opening by design.
  const blocks = resolveVisibleBlocks(config);
  // Design slot (see header comment): the CTA banner belongs to the chrome
  // sign-off; value_props render as the marquee ribbon. Everything else flows
  // in block-array order.
  const flowBlocks = blocks.filter((b) => b.type !== 'value_props' && b.type !== 'cta_banner');
  // Micro-Homepage: the spread takes the top 2 of the deterministic ranking,
  // the showcase the next ≤FEATURED_MAX from what remains — NO product ever
  // repeats between the two. The hero pill reads the same ordered union, so
  // it always describes what sits beneath it (anchor = the first feature).
  const spread = selectFeaturedProducts(products, 2);
  const spreadIds = new Set(spread.map((p) => p.id));
  const showcase = selectFeaturedProducts(products.filter((p) => !spreadIds.has(p.id)), FEATURED_MAX);
  const heroSignal = resolveHeroSignal({ shop, featured: [...spread, ...showcase] });
  // Phase 6B: structural variants from the optional layout strategy. Absent
  // on every legacy row → undefined → the historical markup, unchanged.
  const heroVariant = config.layout_strategy?.hero;
  const gridVariant = config.layout_strategy?.grid;

  return (
    <EditorialChrome shop={shop} config={config} active="home">
      {flowBlocks.map((block, i) => {
        // The hero (LCP) stays static; the welded features spread and every
        // other body section ride the Reveal island (fade-in-up on scroll,
        // static in editor previews / reduced motion — see Reveal.tsx).
        switch (block.type) {
          case 'hero_banner':
            return (
              <Fragment key={block.id}>
                <EditorialHero block={block} shop={shop} heroMedia={heroMedia} signal={heroSignal} variant={heroVariant} />
                {/* Kinetic marquee on the hero→features seam — never inside a
                    Reveal (it is already motion), no data-block markers, so
                    the Site Editor's rect math is untouched. */}
                <SiteMarquee config={config} tone="editorial" />
                <Reveal>
                  <EditorialFeatures shop={shop} featured={spread} />
                </Reveal>
              </Fragment>
            );
          case 'product_grid':
            return (
              <Reveal key={block.id} delay={Math.min(i * 0.05, 0.15)}>
                <EditorialGrid block={block} shop={shop} products={showcase} catalog={products} variant={gridVariant} />
              </Reveal>
            );
          case 'story_text':
            return (
              <Reveal key={block.id} delay={Math.min(i * 0.05, 0.15)}>
                <EditorialStory block={block} shopName={shop.shop_name} />
              </Reveal>
            );
          case 'product_tabs':
            return (
              <Reveal key={block.id} delay={Math.min(i * 0.05, 0.15)}>
                <EditorialProductTabs block={block} />
              </Reveal>
            );
          case 'video_hero':
            return (
              <Reveal key={block.id} delay={Math.min(i * 0.05, 0.15)}>
                <EditorialVideoHero block={block} shopName={shop.shop_name} />
              </Reveal>
            );
          case 'testimonials':
            return (
              <Reveal key={block.id} delay={Math.min(i * 0.05, 0.15)}>
                <EditorialTestimonials block={block} />
              </Reveal>
            );
          case 'split_cta':
            return (
              <Reveal key={block.id} delay={Math.min(i * 0.05, 0.15)}>
                <EditorialSplitCta block={block} shop={shop} products={[...spread, ...showcase]} />
              </Reveal>
            );
          default:
            return null;
        }
      })}
    </EditorialChrome>
  );
}
