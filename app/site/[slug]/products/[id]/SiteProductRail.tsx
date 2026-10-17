import Link from 'next/link';
import { SITE_CHROMES, type SiteTone } from '@/components/site-templates/chrome';
import { siteProductPath, type SiteProduct, type SiteShop, type TemplateKey } from '@/lib/siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// SiteProductRail — the PDP's cross-sell discovery rail (Phase 4A, item 1).
// Server component: zero JavaScript, no extra query. It ranks the ALREADY
// LOADED site.products (the cached `home-products` read in siteData.ts) and
// renders the boutique's own chrome card (SITE_CHROMES[...].ProductCard), so
// the rail speaks the same dialect as the collections grid.
//
// RANKING (stable — the rows arrive newest-first and ties keep that order):
//   1. same category as the piece on the page
//   2. in stock (unknown stock counts as available; 0 sinks to the bottom)
//   3. everything else from the boutique
// The current product is never shown; the rail renders nothing when the
// boutique has no other product.
//
// MOBILE-FIRST: a thumb-swipe snap track below md (scroll-padding keeps the
// first card on the page gutter), the chrome's own grid rhythm from md.
// ─────────────────────────────────────────────────────────────────────────────

/** Card cap — a discovery nudge, never a second catalog page. */
export const RAIL_MAX = 8;

function normCategory(c: string | null | undefined): string {
  return (c ?? '').trim().toLowerCase();
}

/** Pure ranking helper — exported so tests can reason about the same order
 *  the rail renders. */
export function rankCrossSell(
  products: ReadonlyArray<SiteProduct>,
  currentId: string,
  currentCategory: string | null | undefined,
  max: number = RAIL_MAX,
): SiteProduct[] {
  const cat = normCategory(currentCategory);
  const score = (p: SiteProduct): number => {
    const sameCategory = cat !== '' && normCategory(p.category) === cat ? 2 : 0;
    const inStock = p.stock_quantity == null || p.stock_quantity > 0 ? 1 : 0;
    return sameCategory + inStock;
  };
  return products
    .filter((p) => p.id !== currentId)
    .map((p, i) => ({ p, s: score(p), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, max)
    .map(({ p }) => p);
}

type RailStyles = {
  shell: string;
  eyebrow: string;
  title: string;
  link: string;
  /** Snap track below md, the chrome grid from md. */
  track: string;
  /** Per-card slot: fixed swipe width below md, grid cell from md. */
  slot: string;
};

const RAIL_STYLES: Record<SiteTone, RailStyles> = {
  ritual: {
    shell: 'mt-14 border-t border-[color-mix(in_srgb,var(--site-text,#1c1917)_12%,transparent)] pt-10 md:mt-24 md:pt-16',
    eyebrow: 'text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(55.3%_0.013_58.071))]',
    title: 'mt-2 font-serif text-2xl font-bold leading-tight tracking-tight text-balance text-[var(--site-text,oklch(21.6%_0.006_56.043))] md:text-3xl',
    link: 'inline-flex min-h-11 items-center text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--site-accent,#1c1917)] underline underline-offset-4 transition hover:opacity-70',
    track: '-mx-5 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 scroll-px-5 overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:mt-10 md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-16 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4',
    slot: 'w-[68vw] max-w-[300px] shrink-0 snap-start md:w-auto md:max-w-none',
  },
  editorial: {
    shell: 'mt-16 border-t border-[var(--site-text,#171717)] pt-12 md:mt-24 md:pt-16',
    eyebrow: 'text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--site-accent,#1a2e1a)]',
    title: 'mt-2 font-serif text-2xl italic leading-tight tracking-tight text-balance text-[var(--site-text,oklch(20.5%_0_0))] md:text-3xl',
    link: 'inline-flex min-h-11 items-center border-b-2 border-[var(--site-accent,#1a2e1a)] text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-accent,#1a2e1a)] transition hover:opacity-70',
    // Hairline grid from md (the collections dialect); bordered slots below.
    track: '-mx-5 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 scroll-px-5 overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:mt-10 md:grid md:grid-cols-4 md:gap-px md:overflow-visible md:border-t md:border-[var(--site-text,#171717)] md:bg-[var(--site-text,#171717)] md:px-0 md:pb-0',
    slot: 'w-[68vw] max-w-[300px] shrink-0 snap-start border border-[var(--site-text,#171717)] md:w-auto md:max-w-none md:border-0',
  },
  neutral: {
    shell: 'mt-16 border-t border-white/10 pt-12 md:mt-24 md:pt-16',
    eyebrow: 'text-[10px] font-black uppercase tracking-[0.25em] text-[var(--site-accent,#f0a500)]',
    title: 'mt-2 text-2xl font-black uppercase leading-tight tracking-tighter text-balance text-[var(--site-text,#ffffff)] md:text-3xl',
    link: 'inline-flex min-h-11 items-center text-[10px] font-black uppercase tracking-[0.25em] text-white/60 transition hover:text-white',
    track: '-mx-5 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 scroll-px-5 overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:mt-10 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4',
    slot: 'w-[68vw] max-w-[300px] shrink-0 snap-start md:w-auto md:max-w-none',
  },
};

export default function SiteProductRail({
  shop,
  templateKey,
  tone,
  products,
  currentId,
  currentCategory,
  collectionsPath,
}: {
  shop: SiteShop;
  templateKey: TemplateKey;
  tone: SiteTone;
  products: SiteProduct[];
  currentId: string;
  currentCategory: string | null;
  collectionsPath: string;
}) {
  const picks = rankCrossSell(products, currentId, currentCategory);
  if (picks.length === 0) return null;

  const styles = RAIL_STYLES[tone];
  const { ProductCard } = SITE_CHROMES[templateKey] ?? SITE_CHROMES.vitality;
  // Honest heading: "More in <Category>" only when the lead picks really
  // share the category; otherwise the boutique's name.
  const category = currentCategory?.trim() || null;
  const leadsWithCategory = category != null && normCategory(picks[0].category) === normCategory(category);
  const title = leadsWithCategory ? `More in ${category}` : `More from ${shop.shop_name ?? 'the boutique'}`;

  return (
    <section aria-labelledby="pdp-rail-heading" className={styles.shell}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className={styles.eyebrow}>Keep Looking</p>
          <h2 id="pdp-rail-heading" className={styles.title}>{title}</h2>
        </div>
        <Link href={collectionsPath} className={styles.link}>View the collection</Link>
      </div>
      <div className={styles.track}>
        {picks.map((p, i) => (
          <div key={p.id} className={styles.slot}>
            <ProductCard
              product={p}
              index={i}
              href={siteProductPath(shop, p.id) ?? `${collectionsPath.replace(/\/collections$/, '')}/products/${p.id}`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
