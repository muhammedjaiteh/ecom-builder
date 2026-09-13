// ─────────────────────────────────────────────────────────────────────────────
// SaleBadge / SavingsPill — the platform's ONE sale mark.
//
// Server-safe (no hooks, no 'use client'): rendered by the mall's product
// cards (MarketplaceClient), the /site chrome cards (Ritual, Editorial,
// Neutral), and both PDPs. Wears the mall tokens (--mall-forest ink,
// --mall-gold text — globals.css @theme inline) on EVERY surface so a
// Sanndikaa sale reads identically on the mall and inside a seller's
// themed boutique: a platform-issued trust signal, like the Featured pill,
// not a per-theme decoration. Editorial passes shape="square" to honour its
// hairline, zero-radius chrome.
// ─────────────────────────────────────────────────────────────────────────────

type Shape = 'pill' | 'square';

const SHAPE: Record<Shape, string> = {
  pill: 'rounded-full',
  square: 'rounded-none',
};

const MARK = 'inline-flex items-center bg-mall-forest text-mall-gold uppercase';

export function SaleBadge({ className = '', shape = 'pill' }: { className?: string; shape?: Shape }) {
  return (
    <span
      className={`${MARK} ${SHAPE[shape]} px-2 py-0.5 text-[9px] font-semibold tracking-[0.18em] shadow-sm ${className}`}
    >
      Sale
    </span>
  );
}

/** "Save 20%" — renders nothing when the saving rounds below 1% so a
 *  near-zero markdown never advertises "Save 0%". */
export function SavingsPill({
  percentOff,
  className = '',
  shape = 'pill',
}: {
  percentOff: number;
  className?: string;
  shape?: Shape;
}) {
  if (!Number.isFinite(percentOff) || percentOff < 1) return null;
  return (
    <span className={`${MARK} ${SHAPE[shape]} px-2.5 py-1 text-[10px] font-semibold tracking-wider ${className}`}>
      Save {percentOff}%
    </span>
  );
}
