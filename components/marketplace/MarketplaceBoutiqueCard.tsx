import Link from 'next/link';
import { ArrowRight, BadgeCheck, ShoppingBag, Store } from 'lucide-react';
import SmartImage from '@/components/SmartImage';
import { SaleBadge } from '@/components/SaleBadge';
import { saleOf } from '@/lib/pricing';
import type { MarketplaceShop } from '@/app/marketplaceData';
import { CARD_SHADOW } from './MarketplaceProductCard';
import { tierFamily } from './format';

// ─────────────────────────────────────────────────────────────────────────────
// MarketplaceBoutiqueCard — the "Shop by Boutique" rail card: logo · name ·
// tier mark · piece count · Visit, then the boutique's three newest pieces as
// square thumbs. The whole card is an ivory plate on the bone canvas; the
// tier is a mark beside the name, never an outline around the card.
//
// `href` is resolved by the caller (MarketplaceClient upgrades /shop/{slug}
// to /site/{slug} or a custom domain once the batched storefront lookup
// lands) so this card stays a pure render of one shop.
// ─────────────────────────────────────────────────────────────────────────────

/** Fixed snap-item width for the boutique rail. */
export const BOUTIQUE_CARD_WIDTH = 'w-[264px] sm:w-[300px]';

type MarketplaceBoutiqueCardProps = {
  shop: MarketplaceShop;
  /** Storefront destination for the Visit button (classic or premium path). */
  href: string;
};

export default function MarketplaceBoutiqueCard({ shop, href }: MarketplaceBoutiqueCardProps) {
  const family = tierFamily(shop.subscription_tier);
  const thumbs = shop.products.slice(0, 3);
  const count = shop.products.length;

  return (
    <article className={`flex h-full flex-col rounded-xl bg-mall-ivory p-3 ${CARD_SHADOW}`}>
      <div className="flex items-center gap-2.5">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-mall-bone ring-1 ring-mall-forest/10">
          {shop.logo_url ? (
            <SmartImage
              src={shop.logo_url}
              alt={shop.shop_name}
              fill
              blurTone="none"
              className="object-cover"
              sizes="36px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-mall-forest/30">
              <Store size={15} strokeWidth={1.75} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1 text-[13px] font-semibold leading-tight text-mall-forest">
            <span className="truncate">{shop.shop_name}</span>
            {family === 'featured' && <BadgeCheck size={13} className="shrink-0 text-mall-gold" aria-label="Featured boutique" />}
            {family === 'pro' && <BadgeCheck size={13} className="shrink-0 text-mall-sage" aria-label="Pro boutique" />}
          </h3>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mall-forest/50">
            {count} piece{count !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href={href}
          className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-[11px] font-bold uppercase tracking-[0.12em] transition ${
            family === 'featured'
              ? 'bg-mall-gold text-mall-forest hover:brightness-105'
              : 'bg-mall-forest text-mall-bone hover:bg-black'
          }`}
        >
          Visit <ArrowRight size={11} aria-hidden />
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {thumbs.map((product) => {
          const imgUrl = product.image_urls?.[0] || product.image_url || null;
          const sale = saleOf(product.price, product.compare_at_price);
          return (
            <Link
              key={product.id}
              href={`/product/${product.id}`}
              aria-label={product.name}
              className="group/thumb relative aspect-square overflow-hidden rounded-md bg-mall-bone"
            >
              {imgUrl ? (
                <SmartImage
                  src={imgUrl}
                  alt=""
                  fill
                  blurTone="none"
                  className="object-cover transition-transform duration-700 ease-out group-hover/thumb:scale-[1.05]"
                  sizes="(max-width: 640px) 80px, 92px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-mall-forest/20">
                  <ShoppingBag size={16} strokeWidth={1.5} />
                </div>
              )}
              {sale && <SaleBadge className="absolute left-1 top-1 z-[2]" />}
            </Link>
          );
        })}
      </div>
    </article>
  );
}
