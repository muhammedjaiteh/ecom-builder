// ─────────────────────────────────────────────────────────────────────────────
// Marketplace presentation helpers — shared by the dense product card, the
// cinematic tiles, and the boutique rail. Pure functions, no React.
// ─────────────────────────────────────────────────────────────────────────────

/** Dalasi price label. Locale is PINNED to en-US so the server HTML and the
 *  client hydration agree on every handset: a bare toLocaleString() renders
 *  "1 250" on a fr-locale phone against the server's "1,250" and warns on
 *  hydration. Null/NaN → null so callers can omit the line entirely. */
export function formatDalasi(value: number | string | null | undefined): string | null {
  if (value == null) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return `D${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

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
