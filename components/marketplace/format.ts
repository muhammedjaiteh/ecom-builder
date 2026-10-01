// ─────────────────────────────────────────────────────────────────────────────
// Marketplace presentation helpers — shared by the dense product card, the
// cinematic tiles, and the boutique rail. Pure functions, no React.
// ─────────────────────────────────────────────────────────────────────────────

// Dalasi labels come from the single shared formatter (lib/currency.ts):
// "D" prefix only, en-GM three-digit grouping, null for unpriced pieces.
export { formatDalasi } from '@/lib/currency';

/** The three visual families a subscription tier collapses into on the mall.
 *  'featured' = flagship + legacy advanced (the gold family — flagship ranks
 *  ABOVE advanced in the feed and must never render with less than it). */
export type TierFamily = 'featured' | 'pro' | 'standard';

export function tierFamily(tier: string | null | undefined): TierFamily {
  const value = (tier || 'starter').toLowerCase().trim();
  if (value === 'flagship' || value === 'advanced') return 'featured';
  if (value === 'pro') return 'pro';
  return 'standard';
}
