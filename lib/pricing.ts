// ─────────────────────────────────────────────────────────────────────────────
// Compare-at pricing — the ONE place the "is this a sale?" rule lives.
//
// products.compare_at_price is the seller's optional "was" price (sql/
// compare-at-price.sql). products.price stays the ONLY charged price: the
// cart, checkout, and WhatsApp order flows never read compare_at_price. A
// sale is rendered (strikethrough + Sale badge + "Save N%") STRICTLY when
// compare_at_price > price — an equal/lower/absent compare-at is silently
// not a sale, so a seller can never show a fake or inverted markdown.
// ─────────────────────────────────────────────────────────────────────────────

export type SaleInfo = {
  /** The seller's "was" price, coerced to a finite number. */
  compareAt: number;
  /** Whole-percent saving, rounded half-up (0 when the gap rounds away). */
  percentOff: number;
};

/** Dalasi display idiom shared by the chrome cards, PDPs, and cart. */
export function formatDalasi(amount: number | null | undefined): string {
  return amount == null ? '' : `D${Number(amount).toLocaleString()}`;
}

/** Returns sale facts ONLY when compare-at is a finite number strictly above
 *  a finite, non-negative price. PostgREST hands numerics over as JSON
 *  numbers, but Number() coercion keeps this safe against string drift. */
export function saleOf(
  price: number | string | null | undefined,
  compareAt: number | string | null | undefined,
): SaleInfo | null {
  if (price == null || compareAt == null) return null;
  const current = Number(price);
  const was = Number(compareAt);
  if (!Number.isFinite(current) || !Number.isFinite(was)) return null;
  if (current < 0 || was <= current) return null;
  return { compareAt: was, percentOff: Math.round(((was - current) / was) * 100) };
}
