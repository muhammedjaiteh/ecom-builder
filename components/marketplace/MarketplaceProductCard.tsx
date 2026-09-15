import Link from 'next/link';
import { BadgeCheck, ShoppingBag, Star } from 'lucide-react';
import SmartImage from '@/components/SmartImage';
import ProductCardXfade from '@/components/site-templates/ProductCardXfade';
import { SaleBadge } from '@/components/SaleBadge';
import type { ReviewStats } from '@/lib/feedRanking';
import { saleOf } from '@/lib/pricing';
import { secondaryProductImage } from '@/lib/productMedia';
import type { Product } from '@/lib/types';
import { formatDalasi, tierFamily } from './format';

// ─────────────────────────────────────────────────────────────────────────────
// MarketplaceProductCard — the mall's high-density rail card (Amazon-mobile
// scan pattern, luxury finish). Every pixel budget goes to the photo: a 4:5
// media box with NO border (a forest-tinted contact + ambient shadow lifts it
// off the bone canvas instead), then three tight text rows —
//
//   D1,250  D1,500      ★ 4.8 (12)   ← price + was-price, rating flush right
//   Silk wrap dress in emerald       ← name, two lines max
//   ATELIER NDEYE                     ← boutique, whisper caps
//
// CROSS-FADE contract (unchanged from the /site Micro-Homepage idiom): the
// root is an <article> with a STRETCHED <Link> (absolute inset-0 z-10) so the
// hover state lives on an ancestor of both image layers and the toggle is a
// sibling of the anchor. Cards with a DISTINCT second photo mount the
// ProductCardXfade island + the .sndk-xfade-alt layer; every other card is a
// plain article with zero extra JS. Layers: alt z-[1] · badges z-[2] · link
// z-10 · toggle z-50.
// ─────────────────────────────────────────────────────────────────────────────

export type RailProduct = Product & {
  shop: {
    shop_name: string;
    shop_slug: string;
    subscription_tier: string;
  };
};

/** Fixed snap-item widths. On a 360px handset with 16px inset and 12px gaps:
 *  16 + 150 + 12 + 150 = 328 → 20px of the third card peeks in — the swipe cue. */
export const RAIL_CARD_WIDTH = 'w-[150px] sm:w-[168px] md:w-[184px] lg:w-[200px]';
export const RAIL_CARD_SIZES =
  '(max-width: 640px) 150px, (max-width: 768px) 168px, (max-width: 1024px) 184px, 200px';

/** Forest-tinted shadow: a 1px contact line plus a soft ambient falloff. This
 *  is the ONLY edge treatment on the mall's cards — no borders, no rings. */
export const CARD_SHADOW =
  'shadow-[0_1px_2px_rgba(27,58,45,0.08),0_14px_30px_-18px_rgba(27,58,45,0.45)]';

type MarketplaceProductCardProps = {
  product: RailProduct;
  /** Aggregate for the ★ line — omitted/zero-count renders no rating row. */
  stats?: ReviewStats;
  /** LCP hint — true only for the leading cards of the topmost rail. */
  priority?: boolean;
};

export default function MarketplaceProductCard({
  product,
  stats,
  priority = false,
}: MarketplaceProductCardProps) {
  const imgUrl = product.image_urls?.[0] || product.image_url || null;
  const altSrc = secondaryProductImage({ image_url: imgUrl, image_urls: product.image_urls });
  const family = tierFamily(product.shop?.subscription_tier);
  // Compare-at sale (lib/pricing.ts): rendered ONLY when compare_at_price is
  // strictly above price — the charged price is always `price`.
  const sale = saleOf(product.price, product.compare_at_price);
  const price = formatDalasi(product.price);
  const wasPrice = sale ? formatDalasi(sale.compareAt) : null;
  const rated = Boolean(stats && stats.count > 0);

  const root = 'group relative flex flex-col';

  const inner = (
    <>
      <Link href={`/product/${product.id}`} className="absolute inset-0 z-10 rounded-lg">
        <span className="sr-only">{product.name}</span>
      </Link>

      {/* Media box — 4:5, edge-to-edge photo, shadow instead of border. */}
      <div className={`relative aspect-[4/5] overflow-hidden rounded-lg bg-mall-ivory ${CARD_SHADOW}`}>
        {imgUrl ? (
          <SmartImage
            src={imgUrl}
            alt={product.name}
            fill
            priority={priority}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            sizes={RAIL_CARD_SIZES}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-mall-forest/20">
            <ShoppingBag size={22} strokeWidth={1.5} />
          </div>
        )}

        {altSrc && (
          // Second photo — hover (pointer devices) or the dot toggle
          // (globals.css .sndk-xfade); z-[1] pins it above the primary and it
          // mirrors the primary's zoom so the layers never drift apart.
          <div aria-hidden className="sndk-xfade-alt absolute inset-0 z-[1]">
            <SmartImage
              src={altSrc}
              alt=""
              fill
              blurTone="none"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              sizes={RAIL_CARD_SIZES}
            />
          </div>
        )}

        {(family !== 'standard' || sale) && (
          // Badge stack (z-[2]: above both photos, below the stretched link).
          // Tier is a micro-pill — never a coloured ring around the photo.
          <div className="absolute left-1.5 top-1.5 z-[2] flex flex-col items-start gap-1">
            {family === 'featured' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-mall-gold px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-mall-forest shadow-sm">
                <BadgeCheck size={10} strokeWidth={2.2} aria-hidden /> Featured
              </span>
            )}
            {family === 'pro' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-mall-ivory/95 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-mall-forest shadow-sm ring-1 ring-mall-forest/10 backdrop-blur">
                <BadgeCheck size={10} strokeWidth={2.2} className="text-mall-sage" aria-hidden /> Pro
              </span>
            )}
            {sale && <SaleBadge />}
          </div>
        )}
      </div>

      {/* Text block — three rows, zero slack. */}
      <div className="mt-2 min-w-0 px-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="mr-auto flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-[14px] font-semibold leading-none tracking-tight text-mall-forest tabular-nums md:text-[15px]">
              {price ?? '—'}
            </span>
            {wasPrice && (
              <s className="text-[11px] font-normal leading-none text-mall-forest/45 tabular-nums">
                <span className="sr-only">Was </span>{wasPrice}
              </s>
            )}
          </p>
          {rated && stats && (
            <p className="flex items-center gap-0.5 whitespace-nowrap text-[11px] leading-none text-mall-forest">
              <Star size={11} strokeWidth={1.75} className="fill-yellow-400 text-yellow-400" aria-hidden />
              <span className="font-semibold tabular-nums">{stats.average.toFixed(1)}</span>
              <span className="sr-only">out of 5 stars,</span>
              <span className="text-mall-forest/50 tabular-nums">({stats.count})</span>
            </p>
          )}
        </div>
        <h3 className="mt-1 line-clamp-2 text-[12px] font-medium leading-4 text-mall-forest/90 group-hover:underline md:text-[13px] md:leading-[18px]">
          {product.name}
        </h3>
        {product.shop?.shop_name && (
          <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-mall-forest/50">
            {product.shop.shop_name}
          </p>
        )}
      </div>
    </>
  );

  if (altSrc) {
    return (
      <ProductCardXfade
        className={root}
        toggleClassName="right-0.5 top-0.5 text-mall-forest"
        chipClassName="rounded-full bg-mall-ivory/95 px-1.5 py-1 shadow-sm ring-1 ring-mall-forest/10 backdrop-blur"
        toggleLabel={`Show another photo of ${product.name}`}
      >
        {inner}
      </ProductCardXfade>
    );
  }
  return <article className={root}>{inner}</article>;
}
