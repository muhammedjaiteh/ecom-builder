import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import SmartImage from '@/components/SmartImage';
import type { MarketplaceShop } from '@/app/marketplaceData';
import MarketplaceProductCard, { type RailProduct } from './MarketplaceProductCard';

// ─────────────────────────────────────────────────────────────────────────────
// MarketplaceBoutiqueCard — the HOUSE CHAPTER (Phase 9A Step B). One
// full-width editorial block per ranked shop on the merchant-first home:
//
//   HOUSE NO. N                      ← eyebrow
//   Shop name           (logo mark)  ← serif, text-balance, clamps at 2 lines
//   1–3 pieces as EVIDENCE           ← MarketplaceProductCard variant="evidence"
//   Enter the house                  ← one full-width tactile link
//
// Nothing else: no piece counts, tier/pro/featured marks, paid-plan hints,
// ratings, sale badges or was-prices (claude.md Marketplace Identity
// Principle — a buyer remembers who sold it before what was sold).
//
// Rhythm alternates by chapter number so no two consecutive houses look
// alike: ODD chapters lead with one dominant piece (full-width 4:5, then the
// rest in a half row); EVEN chapters align the heading right and give every
// piece an equal frame. A one-piece house renders a single frame in both
// rhythms — no structure is fabricated where the catalogue lacks pieces.
//
// `href` is resolved by the caller (MarketplaceClient upgrades /shop/{slug}
// to /site/{slug} or a custom domain once the batched storefront lookup
// lands) so this card stays a pure render of one shop.
// ─────────────────────────────────────────────────────────────────────────────

/** Evidence frames the chapter renders at most. */
const EVIDENCE_LIMIT = 3;

const SIZES_FULL = '(max-width: 768px) calc(100vw - 32px), 672px';
const SIZES_HALF = '(max-width: 768px) calc(50vw - 22px), 330px';
const SIZES_THIRD = '(max-width: 768px) calc(33vw - 16px), 216px';

type MarketplaceBoutiqueCardProps = {
  shop: MarketplaceShop;
  /** Storefront destination for "Enter the house" (classic or premium path). */
  href: string;
  /** 1-based chapter number ("House No. N"); governs the odd/even rhythm. */
  number?: number;
};

function HouseMark({ shop }: { shop: MarketplaceShop }) {
  return (
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-mall-forest ring-1 ring-mall-forest/15">
      {shop.logo_url ? (
        <SmartImage
          src={shop.logo_url}
          alt=""
          fill
          blurTone="none"
          className="object-cover"
          sizes="40px"
        />
      ) : (
        // Initial plate — the same idiom as CinematicTile's empty poster.
        <span className="flex h-full items-center justify-center font-serif text-lg italic text-mall-bone/80">
          {(shop.shop_name || 'S').charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

export default function MarketplaceBoutiqueCard({ shop, href, number = 1 }: MarketplaceBoutiqueCardProps) {
  const odd = number % 2 === 1;
  const pieces: RailProduct[] = shop.products.slice(0, EVIDENCE_LIMIT).map((product) => ({
    ...product,
    shop: { shop_name: shop.shop_name, shop_slug: shop.shop_slug, subscription_tier: shop.subscription_tier },
  }));
  const [lead, ...rest] = pieces;

  // Evidence layout — derived from what the house actually has.
  let evidence: ReactNode = null;
  if (pieces.length === 1 && lead) {
    evidence = <MarketplaceProductCard product={lead} variant="evidence" sizes={SIZES_FULL} />;
  } else if (odd && lead) {
    evidence = (
      <div className="flex flex-col gap-4 md:gap-5">
        <MarketplaceProductCard product={lead} variant="evidence" sizes={SIZES_FULL} />
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {rest.map((product) => (
            <MarketplaceProductCard key={product.id} product={product} variant="evidence" sizes={SIZES_HALF} />
          ))}
        </div>
      </div>
    );
  } else if (pieces.length > 0) {
    const cols = pieces.length === 2 ? 'grid-cols-2' : 'grid-cols-3';
    evidence = (
      <div className={`grid gap-3 md:gap-4 ${cols}`}>
        {pieces.map((product) => (
          <MarketplaceProductCard
            key={product.id}
            product={product}
            variant="evidence"
            sizes={pieces.length === 2 ? SIZES_HALF : SIZES_THIRD}
          />
        ))}
      </div>
    );
  }

  return (
    <article className="border-t border-mall-forest/10 pt-10 md:pt-14">
      <header className={`flex items-start gap-4 ${odd ? '' : 'flex-row-reverse text-right'}`}>
        <HouseMark shop={shop} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-mall-gold">
            House No. {number}
          </p>
          <h3 className="mt-1.5 line-clamp-2 break-words text-balance font-serif text-2xl font-semibold leading-tight text-mall-forest md:text-3xl">
            {shop.shop_name}
          </h3>
        </div>
      </header>

      {evidence && <div className="mt-6 md:mt-8">{evidence}</div>}

      <Link
        href={href}
        className="mt-6 flex h-12 w-full items-center justify-center gap-2 bg-mall-forest text-[11px] font-bold uppercase tracking-[0.22em] text-mall-bone transition hover:bg-black active:scale-[0.98] md:mt-8"
      >
        Enter the house <ArrowRight size={13} aria-hidden />
      </Link>
    </article>
  );
}
