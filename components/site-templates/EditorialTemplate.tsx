import { Fragment } from 'react';
import Link from 'next/link';
import {
  findBlock,
  resolveBlocks,
  type HeroMedia,
  type SiteBlock,
  type SiteProduct,
  type SiteShop,
  type SiteTemplateProps,
} from '@/lib/siteTemplates';
import EditableText from './EditableText';
import EditorialChrome, {
  EDITORIAL_COLLECTION_GRID,
  EditorialProductCard,
  EditorialProductPlate,
  editorialPrice,
  editorialProductHref,
  editorialStockBadge,
} from './chrome/EditorialChrome';

// EDITORIAL (template_key 'editorial') — Layout B.
// Magazine anatomy, structurally distinct from the Minimal layout:
// hairline top bar + oversized serif masthead → asymmetric split hero
// (media 7 columns, copy 5) → alternating full-width product features →
// dense hairline collection grid with hover reveals → pull-quote brand
// story → numbered index row → dark serif sign-off footer.
// Paper `#F7F5F0`, near-black ink, deep-green accent.
//
// Phase 3 block rendering: the body iterates resolveBlocks(config) in array
// order, with two fixed DESIGN SLOTS that are part of the Editorial anatomy
// itself (exactly like a magazine's pinned back-matter):
//   - value_props always closes the body as the numbered index row;
//   - cta_banner always renders as the chrome's dark sign-off spread (that is
//     where it has lived since Phase 2 — see chrome/EditorialChrome).
// The product-features spread consumes live product data (not block copy) and
// is welded to the hero block, preserving the historical hero → features
// opening. With the deterministic legacy projection this yields the exact
// pre-block anatomy; hero/grid/story reorderings in stored blocks are
// respected as-is. Copy nodes carry data-block-id/data-block-field for the
// dashboard Site Editor (inert on the public site).
//
// Omnichannel router: the masthead + sign-off footer live in
// chrome/EditorialChrome (shared by /site home, /collections, and
// /products/[id]) and every journey stays on /site — features and grid plates
// open the on-site PDP, collection CTAs open the full catalog page. The only
// /shop reference is the chrome footer's deliberate "View classic boutique"
// escape.

type HeroBlock = Extract<SiteBlock, { type: 'hero_banner' }>;
type ValuePropsBlock = Extract<SiteBlock, { type: 'value_props' }>;
type ProductGridBlock = Extract<SiteBlock, { type: 'product_grid' }>;
type StoryBlock = Extract<SiteBlock, { type: 'story_text' }>;

function EditorialHero({ block, shop, heroMedia }: {
  block: HeroBlock;
  shop: SiteShop;
  heroMedia: HeroMedia;
}) {
  const initial = (shop.shop_name ?? 'S').trim().charAt(0).toUpperCase() || 'S';
  return (
    <section className="grid grid-cols-1 border-b border-neutral-900 md:grid-cols-12">
      <div className="relative min-h-[340px] border-neutral-900 md:col-span-7 md:min-h-[580px] md:border-r">
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
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-200 via-[#EDEAE2] to-neutral-300">
            <span className="font-serif text-[10rem] italic leading-none text-neutral-400/40 md:text-[16rem]">{initial}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center gap-6 px-5 py-14 md:col-span-5 md:px-12 md:py-20">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#1a2e1a]">No. 01 — The Opening</p>
        <EditableText
          as="h1"
          blockId={block.id}
          field="headline"
          className="font-serif text-4xl italic leading-[1.08] tracking-tight md:text-5xl lg:text-6xl"
        >
          {block.headline}
        </EditableText>
        <EditableText as="p" blockId={block.id} field="subheadline" className="max-w-md text-base leading-relaxed text-neutral-600">
          {block.subheadline}
        </EditableText>
        <a
          href="#collection"
          className="group inline-flex items-center gap-3 self-start border-b-2 border-neutral-900 pb-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-900 transition hover:border-[#1a2e1a] hover:text-[#1a2e1a]"
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
  if (featured.length === 0) return null;
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
                <EditorialProductPlate src={p.ad_hero_image_url ?? p.image_url} alt={p.name} index={i} />
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
              <Link
                href={editorialProductHref(shop, p.id)}
                className="inline-flex self-start border border-neutral-900 px-9 py-3.5 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-900 transition hover:bg-neutral-900 hover:text-[#F7F5F0] active:scale-95"
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
    <section id="collection" className="border-b border-neutral-900">
      <div className="flex flex-col items-start justify-between gap-4 px-5 py-10 md:flex-row md:items-baseline md:px-10 md:py-14">
        <EditableText as="h2" blockId={block.id} field="title" className="font-serif text-4xl font-black tracking-tight md:text-6xl">
          {block.title}
        </EditableText>
        <EditableText as="p" blockId={block.id} field="intro" className="max-w-md text-sm leading-relaxed text-neutral-500">
          {block.intro}
        </EditableText>
      </div>
      <div className={EDITORIAL_COLLECTION_GRID}>
        {products.slice(0, 12).map((p, i) => (
          <EditorialProductCard key={p.id} product={p} index={i} href={editorialProductHref(shop, p.id)} />
        ))}
      </div>
    </section>
  );
}

function EditorialStory({ block, shopName }: { block: StoryBlock; shopName: string | null }) {
  return (
    <section id="story" className="border-b border-neutral-900 px-5 py-20 md:px-10 md:py-32">
      <div className="relative mx-auto max-w-4xl">
        <span aria-hidden className="pointer-events-none absolute -top-10 left-0 select-none font-serif text-[8rem] leading-none text-neutral-300 md:-top-16 md:text-[12rem]">
          &ldquo;
        </span>
        <EditableText
          as="blockquote"
          blockId={block.id}
          field="body"
          className="relative pt-14 font-serif text-3xl italic leading-[1.2] text-neutral-900 md:pt-20 md:text-5xl"
        >
          {block.body}
        </EditableText>
        <p className="mt-9 text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-500">&mdash; {shopName}</p>
      </div>
    </section>
  );
}

function EditorialIndexRow({ block }: { block: ValuePropsBlock }) {
  return (
    <section className="grid grid-cols-1 border-b border-neutral-900 md:grid-cols-3">
      {block.items.map((v, i) => (
        <div key={i} className={`px-5 py-10 md:px-10 md:py-14 ${i > 0 ? 'border-t border-neutral-900 md:border-l md:border-t-0' : ''}`}>
          <p className="font-serif text-4xl italic text-neutral-300">0{i + 1}</p>
          <EditableText as="p" blockId={block.id} field={`items.${i}.title`} className="mt-4 font-serif text-xl font-bold">
            {v.title}
          </EditableText>
          <EditableText as="p" blockId={block.id} field={`items.${i}.body`} className="mt-2 text-sm leading-relaxed text-neutral-600">
            {v.body}
          </EditableText>
        </div>
      ))}
    </section>
  );
}

export default function EditorialTemplate({ shop, products, config, heroMedia }: SiteTemplateProps) {
  const blocks = resolveBlocks(config);
  // Design slots (see header comment): the numbered index row always closes
  // the body; the CTA banner belongs to the chrome sign-off. Everything else
  // flows in block-array order.
  const indexRow = findBlock(blocks, 'value_props');
  const flowBlocks = blocks.filter((b) => b.type !== 'value_props' && b.type !== 'cta_banner');

  return (
    <EditorialChrome shop={shop} config={config} active="home">
      {flowBlocks.map((block) => {
        switch (block.type) {
          case 'hero_banner':
            return (
              <Fragment key={block.id}>
                <EditorialHero block={block} shop={shop} heroMedia={heroMedia} />
                <EditorialFeatures shop={shop} products={products} />
              </Fragment>
            );
          case 'product_grid':
            return <EditorialGrid key={block.id} block={block} shop={shop} products={products} />;
          case 'story_text':
            return <EditorialStory key={block.id} block={block} shopName={shop.shop_name} />;
          default:
            return null;
        }
      })}
      {indexRow && <EditorialIndexRow block={indexRow} />}
    </EditorialChrome>
  );
}
