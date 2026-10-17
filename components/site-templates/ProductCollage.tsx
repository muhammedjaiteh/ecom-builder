import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import type { SiteProduct } from '@/lib/siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// ProductCollage — real inventory where a decorative panel used to be.
// SERVER component, zero client JS. Pass 3 (presentation): the split_cta
// blocks' oversized monogram panels are retired; the panel now shows the
// merchant's own pieces (up to two, 4:5, offset for asymmetry), each a link to
// its on-site PDP with name + price beneath — products are the hero, pricing
// stays visible. Renders null when no pictured product exists so the caller
// can fall back to a plain accent plate (never a gray placeholder).
// ─────────────────────────────────────────────────────────────────────────────

export type CollageTone = 'ritual' | 'editorial' | 'neutral';

const TONES: Record<CollageTone, { tile: string; caption: string; name: string; price: string }> = {
  ritual: {
    tile: 'relative aspect-[4/5] overflow-hidden rounded-2xl bg-[color-mix(in_srgb,var(--site-bg,#FBFAF7)_90%,var(--site-text,#1c1917))]',
    caption: 'mt-2.5 px-0.5',
    name: 'line-clamp-1 text-xs font-medium text-[var(--site-text,oklch(21.6%_0.006_56.043))]',
    price: 'mt-0.5 text-sm font-bold text-[var(--site-text,oklch(21.6%_0.006_56.043))]',
  },
  editorial: {
    tile: 'relative aspect-[4/5] overflow-hidden border border-[var(--site-text,#171717)] bg-[#EDEAE2]',
    caption: 'mt-2.5',
    name: 'line-clamp-1 font-serif text-sm italic text-[var(--site-text,oklch(20.5%_0_0))]',
    price: 'mt-0.5 text-sm font-bold text-[var(--site-text,oklch(20.5%_0_0))]',
  },
  neutral: {
    tile: 'relative aspect-[4/5] overflow-hidden rounded-xl bg-black ring-1 ring-white/10',
    caption: 'mt-2.5 px-0.5',
    name: 'line-clamp-1 text-xs font-bold uppercase tracking-wide text-white',
    price: 'mt-0.5 text-sm font-black text-[var(--site-accent,#f0a500)]',
  },
};

function priceLabel(p: number | null): string {
  return p == null ? '' : `D${Number(p).toLocaleString()}`;
}

/** Products that carry a real image, in the caller's order. */
export function picturedProducts(products: ReadonlyArray<SiteProduct>, max = 2): SiteProduct[] {
  const out: SiteProduct[] = [];
  for (const p of products) {
    if (p.ad_hero_image_url || p.image_url) out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

export default function ProductCollage({
  products,
  hrefFor,
  tone,
  className = '',
}: {
  products: ReadonlyArray<SiteProduct>;
  hrefFor: (productId: string) => string;
  tone: CollageTone;
  className?: string;
}) {
  const picks = picturedProducts(products, 2);
  if (picks.length === 0) return null;
  const t = TONES[tone];

  if (picks.length === 1) {
    const p = picks[0];
    return (
      <Link href={hrefFor(p.id)} className={`group block ${className}`}>
        <div className={t.tile}>
          <SmartImage
            src={p.ad_hero_image_url ?? p.image_url ?? ''}
            alt={p.name}
            fill
            sizes="(min-width: 768px) 40vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        </div>
        <div className={t.caption}>
          <p className={t.name}>{p.name}</p>
          {p.price != null && <p className={t.price}>{priceLabel(p.price)}</p>}
        </div>
      </Link>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-4 ${className}`}>
      {picks.map((p, i) => (
        <Link key={p.id} href={hrefFor(p.id)} className={`group block ${i === 1 ? 'mt-8 md:mt-12' : ''}`}>
          <div className={t.tile}>
            <SmartImage
              src={p.ad_hero_image_url ?? p.image_url ?? ''}
              alt={p.name}
              fill
              sizes="(min-width: 768px) 20vw, 45vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
          </div>
          <div className={t.caption}>
            <p className={t.name}>{p.name}</p>
            {p.price != null && <p className={t.price}>{priceLabel(p.price)}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}
