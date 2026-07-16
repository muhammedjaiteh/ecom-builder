import Link from 'next/link';
import {
  resolveBlocks,
  siteCollectionsPath,
  type HeroMedia,
  type SiteBlock,
  type SiteShop,
  type SiteProduct,
  type SiteTemplateProps,
} from '@/lib/siteTemplates';
import EditableText from './EditableText';
import RitualChrome, {
  RITUAL_COLLECTION_GRID,
  RitualProductCard,
  ritualProductHref,
} from './chrome/RitualChrome';

// MINIMAL (template_key 'ritual') — Layout A.
// The anatomy of a premium minimal Shopify theme:
// sticky logo nav → full-bleed cinematic hero with dual CTAs → numbered
// value-props band → airy spacious product grid with quick-view hovers and
// live stock badges → brand-story strip → dark CTA banner → structured
// footer (shop info, delivery & pickup, contact). Warm off-white, stone ink.
//
// Phase 3: the body renders from resolveBlocks(config) — one section per
// block, in block-array order. The deterministic legacy projection equals
// this template's exact historical anatomy (hero → values → grid → story →
// cta), so every stored row renders identically; a differing stored order is
// respected as-is. Copy nodes carry data-block-id/data-block-field for the
// dashboard Site Editor (inert on the public site).
//
// Omnichannel router: the nav + footer live in chrome/RitualChrome (shared by
// /site home, /collections, and /products/[id]) and every journey stays on
// /site — product cards open the on-site PDP, collection CTAs open the full
// catalog page. The only /shop reference is the chrome footer's deliberate
// "View classic boutique" escape.

type HeroBlock = Extract<SiteBlock, { type: 'hero_banner' }>;
type ValuePropsBlock = Extract<SiteBlock, { type: 'value_props' }>;
type ProductGridBlock = Extract<SiteBlock, { type: 'product_grid' }>;
type StoryBlock = Extract<SiteBlock, { type: 'story_text' }>;
type CtaBlock = Extract<SiteBlock, { type: 'cta_banner' }>;

function RitualHero({ block, shop, heroMedia, collectionsHref }: {
  block: HeroBlock;
  shop: SiteShop;
  heroMedia: HeroMedia;
  collectionsHref: string;
}) {
  return (
    <header className="relative flex h-[82vh] min-h-[560px] w-full items-end overflow-hidden bg-stone-900 md:items-center">
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(214,203,186,0.35),transparent_55%),linear-gradient(to_bottom_right,#292524,#1c1917,#3a352e)]" />
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
          className="mt-5 max-w-2xl font-serif text-4xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl lg:text-7xl"
        >
          {block.headline}
        </EditableText>
        <EditableText as="p" blockId={block.id} field="subheadline" className="mt-6 max-w-xl text-base leading-relaxed text-white/80 md:text-lg">
          {block.subheadline}
        </EditableText>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href="#collection"
            className="rounded-full bg-white px-8 py-4 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-stone-900 shadow-lg transition hover:bg-stone-100 active:scale-95"
          >
            Shop The Collection
          </a>
          <Link
            href={collectionsHref}
            className="rounded-full border border-white/50 px-8 py-4 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-white transition hover:border-white hover:bg-white/10 active:scale-95"
          >
            View The Full Collection
          </Link>
        </div>
      </div>
    </header>
  );
}

function RitualValueProps({ block }: { block: ValuePropsBlock }) {
  return (
    <section className="border-b border-stone-200 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-stone-100 md:grid-cols-3 md:divide-x md:divide-y-0">
        {block.items.map((v, i) => (
          <div key={i} className="px-6 py-9 text-center md:px-10 md:py-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">0{i + 1}</p>
            <EditableText as="p" blockId={block.id} field={`items.${i}.title`} className="mt-3 font-serif text-lg font-bold text-stone-900">
              {v.title}
            </EditableText>
            <EditableText as="p" blockId={block.id} field={`items.${i}.body`} className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-stone-500">
              {v.body}
            </EditableText>
          </div>
        ))}
      </div>
    </section>
  );
}

function RitualProductGrid({ block, shop, products }: {
  block: ProductGridBlock;
  shop: SiteShop;
  products: SiteProduct[];
}) {
  return (
    <section id="collection" className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
      <div className="mx-auto max-w-xl text-center">
        <EditableText as="h2" blockId={block.id} field="title" className="font-serif text-3xl font-bold tracking-tight text-stone-900 md:text-5xl">
          {block.title}
        </EditableText>
        <EditableText as="p" blockId={block.id} field="intro" className="mt-4 text-sm leading-relaxed text-stone-500 md:text-base">
          {block.intro}
        </EditableText>
      </div>

      <div className={`mt-14 md:mt-20 ${RITUAL_COLLECTION_GRID}`}>
        {products.slice(0, 12).map((p, i) => (
          <RitualProductCard key={p.id} product={p} index={i} href={ritualProductHref(shop, p.id)} />
        ))}
      </div>
    </section>
  );
}

function RitualStory({ block, shopName }: { block: StoryBlock; shopName: string | null }) {
  return (
    <section id="story" className="border-y border-stone-200 bg-white py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-5 md:grid-cols-[200px_1fr] md:gap-14 md:px-10">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-stone-400">Our Story</p>
          <div className="mt-5 hidden h-px w-16 bg-stone-900 md:block" />
        </div>
        <div>
          <EditableText as="p" blockId={block.id} field="body" className="font-serif text-2xl font-medium leading-relaxed text-stone-800 md:text-3xl">
            {block.body}
          </EditableText>
          <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">{shopName}</p>
        </div>
      </div>
    </section>
  );
}

function RitualCta({ block, collectionsHref }: { block: CtaBlock; collectionsHref: string }) {
  return (
    <section className="bg-stone-900 py-20 text-center md:py-28">
      <div className="mx-auto max-w-2xl px-5 md:px-10">
        <EditableText as="h2" blockId={block.id} field="headline" className="font-serif text-3xl font-bold tracking-tight text-white md:text-5xl">
          {block.headline}
        </EditableText>
        <EditableText as="p" blockId={block.id} field="subtext" className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-white/60">
          {block.subtext}
        </EditableText>
        <Link
          href={collectionsHref}
          data-block-id={block.id}
          data-block-field="button_label"
          className="mt-10 inline-block rounded-full bg-white px-10 py-4 text-[10px] font-bold uppercase tracking-[0.25em] text-stone-900 shadow-lg transition hover:bg-stone-100 active:scale-95"
        >
          {block.button_label}
        </Link>
      </div>
    </section>
  );
}

export default function RitualTemplate({ shop, products, config, heroMedia }: SiteTemplateProps) {
  const blocks = resolveBlocks(config);
  // Internal routes, with honest fallbacks for slugless studio previews:
  // the preview renders this home layout, so bare anchors stay correct there.
  const collectionsHref = siteCollectionsPath(shop) ?? '#collection';

  return (
    <RitualChrome shop={shop} config={config} active="home">
      {blocks.map((block) => {
        switch (block.type) {
          case 'hero_banner':
            return <RitualHero key={block.id} block={block} shop={shop} heroMedia={heroMedia} collectionsHref={collectionsHref} />;
          case 'value_props':
            return <RitualValueProps key={block.id} block={block} />;
          case 'product_grid':
            return <RitualProductGrid key={block.id} block={block} shop={shop} products={products} />;
          case 'story_text':
            return <RitualStory key={block.id} block={block} shopName={shop.shop_name} />;
          case 'cta_banner':
            return <RitualCta key={block.id} block={block} collectionsHref={collectionsHref} />;
          default:
            return null;
        }
      })}
    </RitualChrome>
  );
}
