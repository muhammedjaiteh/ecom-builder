import { Fragment } from 'react';
import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import {
  resolveVisibleBlocks,
  type HeroMedia,
  type SiteBlock,
  type SiteProduct,
  type SiteShop,
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
// Magazine anatomy, structurally distinct from the Minimal layout:
// hairline top bar + oversized serif masthead → asymmetric split hero
// (media 7 columns, copy 5) → kinetic value-props marquee (Fix 2: the pinned
// numbered index row was retired — the value_props block renders as the
// moving brand ribbon on the hero→features seam, edited from the SectionRail
// inspector) → alternating full-width product features → dense hairline
// collection grid with hover reveals → pull-quote brand story (clamped to a
// 3-line teaser with a Read-the-full-story reveal — StoryClamp) → dark serif
// sign-off footer. Paper `#F7F5F0`, near-black ink, deep-green accent.
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

function EditorialHero({ block, shop, heroMedia }: {
  block: HeroBlock;
  shop: SiteShop;
  heroMedia: HeroMedia;
}) {
  const initial = (shop.shop_name ?? 'S').trim().charAt(0).toUpperCase() || 'S';
  return (
    <section data-block-section={block.id} className="grid grid-cols-1 border-b border-neutral-900 md:grid-cols-12">
      {/* Fold discipline (Fix 5): the md media pane caps at min(580px,62vh) —
          on short laptop viewports the hero no longer swallows the fold, and
          large desktops keep the exact historical 580px. The copy column
          still grows the section (min-h clip-fix semantics preserved). */}
      <div className="relative min-h-[340px] border-neutral-900 md:col-span-7 md:min-h-[min(580px,62vh)] md:border-r">
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
              <div aria-hidden className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-200 via-[#EDEAE2] to-neutral-300">
                <span className="font-serif text-[10rem] italic leading-none text-neutral-400/40 md:text-[16rem]">{initial}</span>
              </div>
            }
            playButtonClassName="absolute left-1/2 top-1/2 z-10 flex min-h-11 -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 border border-neutral-900 bg-[#F7F5F0]/95 px-7 py-3.5 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-900 backdrop-blur-sm transition hover:bg-neutral-900 hover:text-[#F7F5F0] active:scale-95"
          />
        ) : heroMedia ? (
          <SmartImage
            src={heroMedia.url}
            alt={shop.shop_name ?? 'Hero'}
            fill
            priority
            sizes="(min-width: 768px) 58vw, 100vw"
            className="object-cover"
          />
        ) : (
          /* Null tier (Pillar 4b): the animated brand plate — same gradient
             stops, panned, with the accent glow + monogram. */
          <HeroBrandPlate tone="editorial" shopName={shop.shop_name} />
        )}
      </div>
      <div className="flex flex-col justify-center gap-6 px-5 py-14 md:col-span-5 md:px-12 md:py-20">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--site-accent,#1a2e1a)]">No. 01 — The Opening</p>
        <EditableText
          as="h1"
          blockId={block.id}
          field="headline"
          className="font-serif text-4xl italic leading-[1.12] tracking-tight md:text-5xl lg:text-6xl"
        >
          {block.headline}
        </EditableText>
        <EditableText as="p" blockId={block.id} field="subheadline" className="max-w-md text-base leading-relaxed text-neutral-600">
          {block.subheadline}
        </EditableText>
        <a
          href="#collection"
          className="group inline-flex items-center gap-3 self-start border-b-2 border-neutral-900 pb-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-900 transition hover:border-[var(--site-accent,#1a2e1a)] hover:text-[var(--site-accent,#1a2e1a)]"
        >
          Read The Collection
          <span aria-hidden className="transition-transform group-hover:translate-x-1.5">&rarr;</span>
        </a>
      </div>
    </section>
  );
}

function EditorialFeatures({ shop, products }: { shop: SiteShop; products: SiteProduct[] }) {
  const featured = products.slice(0, 2);
  if (featured.length === 0) {
    // Keep the #features anchor alive (the masthead nav always links to it)
    // with a minimal section header instead of a dead jump — the cleaner of
    // the two options for an empty catalog.
    return (
      <section id="features" className="border-b border-neutral-900 px-5 py-12 text-center md:px-10 md:py-16">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400">Features</p>
        <p className="mt-3 font-serif text-2xl italic text-neutral-900">The first features are being prepared.</p>
      </section>
    );
  }
  return (
    <section id="features" className="border-b border-neutral-900">
      {featured.map((p, i) => {
        const badge = editorialStockBadge(p.stock_quantity);
        const reversed = i % 2 === 1;
        return (
          <article
            key={p.id}
            className={`grid grid-cols-1 md:grid-cols-2 ${i > 0 ? 'border-t border-neutral-900' : ''}`}
          >
            <div className={`group relative aspect-[4/3] overflow-hidden border-neutral-900 md:aspect-auto md:min-h-[500px] ${reversed ? 'md:order-2 md:border-l' : 'md:border-r'}`}>
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
              <p className="font-serif text-2xl italic text-neutral-900">{editorialPrice(p.price)}</p>
              {/* Accent cohesion (Fix 6): the feature CTA rides --site-accent.
                  Fallback #171717 IS neutral-900 — theme-less rendering stays
                  byte-identical; a themed site recolors the outline + fill. */}
              <Link
                href={editorialProductHref(shop, p.id)}
                className="inline-flex self-start border border-[var(--site-accent,#171717)] px-9 py-3.5 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-accent,#171717)] transition hover:bg-[var(--site-accent,#171717)] hover:text-[#F7F5F0] active:scale-95"
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

function EditorialGrid({ block, shop, products }: {
  block: ProductGridBlock;
  shop: SiteShop;
  products: SiteProduct[];
}) {
  return (
    <section id="collection" data-block-section={block.id} className="border-b border-neutral-900">
      <div className="flex flex-col items-start justify-between gap-4 px-5 py-10 md:flex-row md:items-baseline md:px-10 md:py-14">
        <EditableText as="h2" blockId={block.id} field="title" className="font-serif text-4xl font-black tracking-tight md:text-5xl">
          {block.title}
        </EditableText>
        <EditableText as="p" blockId={block.id} field="intro" className="max-w-md text-sm leading-relaxed text-neutral-500">
          {block.intro}
        </EditableText>
      </div>
      {products.length === 0 ? (
        // Branded empty state (mirrors /collections): the hero's
        // "Read The Collection" anchor lands on something dignified.
        <div className="border-t border-neutral-900 px-5 py-20 text-center md:px-10">
          <p className="font-serif text-2xl italic text-neutral-900">The collection is being prepared.</p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-500">New pieces are on their way — check back soon.</p>
        </div>
      ) : block.displayMode === 'carousel' ? (
        <CarouselTrack
          ariaLabel={block.title}
          trackClassName="gap-px border-t border-neutral-900 bg-neutral-900"
          itemClassName="w-[64vw] max-w-[300px] bg-[#F7F5F0] sm:w-[300px]"
          buttonClassName="h-11 w-11 border border-neutral-900 bg-[#F7F5F0] text-neutral-900 shadow-lg hover:bg-neutral-900 hover:text-[#F7F5F0] active:scale-95"
          items={products.slice(0, 12).map((p, i) => ({
            key: p.id,
            node: <EditorialProductCard product={p} index={i} href={editorialProductHref(shop, p.id)} />,
          }))}
        />
      ) : (
        <div className={EDITORIAL_COLLECTION_GRID}>
          {products.slice(0, 12).map((p, i) => (
            <EditorialProductCard key={p.id} product={p} index={i} href={editorialProductHref(shop, p.id)} />
          ))}
          <EditorialGridFillers itemCount={Math.min(products.length, 12)} />
        </div>
      )}
    </section>
  );
}

function EditorialProductTabs({ block }: { block: ProductTabsBlock }) {
  return (
    <section data-block-section={block.id} className="border-b border-neutral-900 px-5 py-16 md:px-10 md:py-24">
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
    <section data-block-section={block.id} className="border-b border-neutral-900">
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

// Pull-quote scale guard (Phase 8): brand_story is budgeted to 600 chars but
// md:text-5xl only reads as a pull-quote for SHORT copy. Beyond 220 chars
// (~3 display lines at 5xl on a 4xl-max column) the quote steps down to a
// long-read scale — still serif-italic print, but readable instead of a wall.
const STORY_LONG_THRESHOLD = 220;

function EditorialStory({ block, shopName }: { block: StoryBlock; shopName: string | null }) {
  const isLong = block.body.length > STORY_LONG_THRESHOLD;
  return (
    <section id="story" data-block-section={block.id} className="border-b border-neutral-900 px-5 py-20 md:px-10 md:py-32">
      <div className="relative mx-auto max-w-4xl">
        <span aria-hidden className="pointer-events-none absolute -top-10 left-0 select-none font-serif text-[8rem] leading-none text-neutral-300 md:-top-16 md:text-[12rem]">
          &ldquo;
        </span>
        {/* Fix 1: the quote-clearing padding moved onto this relative wrapper
            (paint order over the glyph preserved) so the clamp island wraps a
            clean copy node — StoryClamp renders it bare in editor previews. */}
        <div className="relative pt-14 md:pt-20">
          <StoryClamp tone="editorial">
            <EditableText
              as="blockquote"
              blockId={block.id}
              field="body"
              className={`font-serif italic text-neutral-900 ${
                isLong ? 'text-2xl leading-[1.35] md:text-3xl' : 'text-3xl leading-[1.2] md:text-5xl'
              }`}
            >
              {block.body}
            </EditableText>
          </StoryClamp>
        </div>
        <p className="mt-9 text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-500">&mdash; {shopName}</p>
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
                <EditorialHero block={block} shop={shop} heroMedia={heroMedia} />
                {/* Kinetic marquee on the hero→features seam — never inside a
                    Reveal (it is already motion), no data-block markers, so
                    the Site Editor's rect math is untouched. */}
                <SiteMarquee config={config} tone="editorial" />
                <Reveal>
                  <EditorialFeatures shop={shop} products={products} />
                </Reveal>
              </Fragment>
            );
          case 'product_grid':
            return (
              <Reveal key={block.id} delay={Math.min(i * 0.05, 0.15)}>
                <EditorialGrid block={block} shop={shop} products={products} />
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
          default:
            return null;
        }
      })}
    </EditorialChrome>
  );
}
