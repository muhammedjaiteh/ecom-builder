import type { SiteProduct } from '@/lib/siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// CategoryNav — category discovery as a horizontally scrolling chip strip.
// SERVER component, zero client JS. Pass 3 (presentation): the merchant's real
// product categories become the shopper's first navigation layer — the strip
// renders ONLY when the catalog spans at least two categories, so a focused
// single-category shop never gets a one-chip row of filler.
//
// Mobile: the strip bleeds to the gutters (-mx-5 px-5) and scrolls inside its
// own box (hidden scrollbar) so the PAGE never scrolls horizontally. Desktop
// wraps instead. Every chip is a ≥40px tap target.
//
// Dialect: three tones that mirror the chromes — ritual pills, editorial
// hairline squares, vitality/neutral dark pills. Colors ride the theme
// cascade (var(--site-*) with the historical literal as fallback) so the
// deep-luxury dark palette and the light palettes both stay legible.
// ─────────────────────────────────────────────────────────────────────────────

export type CategoryNavTone = 'ritual' | 'editorial' | 'neutral';

/** Distinct categories ordered by frequency (ties alphabetical), capped. */
export function distinctCategories(products: ReadonlyArray<Pick<SiteProduct, 'category'>>, max = 8): string[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    const c = p.category?.trim();
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([c]) => c);
}

/** Stable in-page anchor id for a category group on /collections. */
export function categoryAnchorId(category: string): string {
  const slug = category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `cat-${slug || 'other'}`;
}

const TONES: Record<CategoryNavTone, { label: string; chip: string; chipActive: string }> = {
  ritual: {
    label: 'text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(55.3%_0.013_58.071))]',
    chip: 'inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-[var(--site-radius,9999px)] border border-[color-mix(in_srgb,var(--site-text,#1c1917)_18%,transparent)] px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--site-text,oklch(21.6%_0.006_56.043))] transition hover:border-[var(--site-accent,#1c1917)] hover:bg-[var(--site-accent,#1c1917)] hover:text-white active:scale-95',
    chipActive: 'inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-[var(--site-radius,9999px)] border border-[var(--site-accent,#1c1917)] bg-[var(--site-accent,#1c1917)] px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white',
  },
  editorial: {
    label: 'text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--site-muted,oklch(55.6%_0_0))]',
    chip: 'inline-flex min-h-10 shrink-0 items-center whitespace-nowrap border border-[var(--site-text,#171717)] px-4 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--site-text,oklch(20.5%_0_0))] transition hover:bg-[var(--site-text,#171717)] hover:text-[var(--site-bg,#F7F5F0)] active:scale-95',
    chipActive: 'inline-flex min-h-10 shrink-0 items-center whitespace-nowrap border border-[var(--site-text,#171717)] bg-[var(--site-text,#171717)] px-4 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--site-bg,#F7F5F0)]',
  },
  neutral: {
    label: 'text-[10px] font-black uppercase tracking-[0.25em] text-white/60',
    chip: 'inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border border-white/15 bg-[#111] px-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/85 transition hover:border-[var(--site-accent,#f0a500)] hover:text-[var(--site-accent,#f0a500)] active:scale-95',
    chipActive: 'inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border border-[var(--site-accent,#f0a500)] bg-[var(--site-accent,#f0a500)] px-4 text-[10px] font-black uppercase tracking-[0.2em] text-black',
  },
};

export default function CategoryNav({
  categories,
  hrefFor,
  tone,
  label = 'Shop by category',
  activeCategory,
  className = '',
  ariaLabel = 'Shop by category',
}: {
  categories: string[];
  hrefFor: (category: string) => string;
  tone: CategoryNavTone;
  /** Small eyebrow above the strip; pass null to render chips only. */
  label?: string | null;
  activeCategory?: string | null;
  className?: string;
  ariaLabel?: string;
}) {
  if (categories.length < 2) return null;
  const t = TONES[tone];
  return (
    <nav aria-label={ariaLabel} className={className}>
      {label && <p className={t.label}>{label}</p>}
      <div className={`${label ? 'mt-3' : ''} -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0`}>
        {categories.map((category) => (
          <a
            key={category}
            href={hrefFor(category)}
            aria-current={activeCategory === category ? 'true' : undefined}
            className={activeCategory === category ? t.chipActive : t.chip}
          >
            {category}
          </a>
        ))}
      </div>
    </nav>
  );
}
