// ─────────────────────────────────────────────────────────────────────────────
// feedRanking — pure review-aware ranking math for the marketplace feed.
//
// reviewScore = average × log1p(count). The log damping means volume must be
// earned: a single 5★ scores 5 × ln(2) ≈ 3.47 and can never beat ten 4★ at
// 4 × ln(11) ≈ 9.59 — one friendly review is not a moat.
//
// THE SORT CONTRACT (founder-approved, do not re-litigate): tier rank is
// STRICTLY PRIMARY — tier placement is the paid contract, so reviews reorder
// products only WITHIN a tier. An advanced shop with zero reviews still
// outranks a 5★ starter. reviewScore is secondary; ties return 0 so the
// (spec-stable) Array.prototype.sort preserves the incoming recency order as
// the third key. Shops rank by tier, then the Σ of their members'
// reviewScores.
//
// SCALE THRESHOLD (documented): the homepage pulls `reviews(product_id,
// rating)` wholesale and aggregates client-side. Past ~10k review rows move
// this aggregation server-side (a view or RPC) — the math in this module
// stays identical either way.
// ─────────────────────────────────────────────────────────────────────────────

export type ProductReviewRow = {
  product_id: string;
  rating: number | null;
};

export type ReviewStats = {
  count: number;
  average: number;
  /** average × log1p(count) — the within-tier ranking key. */
  score: number;
};

/** Aggregate raw review rows into per-product stats. Malformed rows (missing
 *  product, non-finite rating) are dropped, never thrown on. */
export function buildReviewStats(rows: ProductReviewRow[] | null | undefined): Map<string, ReviewStats> {
  const sums = new Map<string, { sum: number; count: number }>();
  for (const row of rows ?? []) {
    if (!row?.product_id) continue;
    const rating = Number(row.rating);
    if (!Number.isFinite(rating)) continue;
    const entry = sums.get(row.product_id);
    if (entry) {
      entry.sum += rating;
      entry.count += 1;
    } else {
      sums.set(row.product_id, { sum: rating, count: 1 });
    }
  }
  const stats = new Map<string, ReviewStats>();
  for (const [productId, { sum, count }] of sums) {
    const average = sum / count;
    stats.set(productId, { count, average, score: average * Math.log1p(count) });
  }
  return stats;
}

/** A product's ranking score — 0 when unreviewed (or the read failed, which
 *  degrades the whole feed to today's exact tier-only order). */
export function reviewScoreOf(stats: Map<string, ReviewStats>, productId: string): number {
  return stats.get(productId)?.score ?? 0;
}

/** A shop's ranking score: Σ of its member products' reviewScores. */
export function shopReviewScore(stats: Map<string, ReviewStats>, productIds: Array<string | null | undefined>): number {
  let total = 0;
  for (const id of productIds) {
    if (id) total += reviewScoreOf(stats, id);
  }
  return total;
}

/** THE comparator: tier strictly primary (descending), reviewScore secondary
 *  (descending), 0 on full tie so the stable sort preserves recency. */
export function compareTierThenReviewScore(
  a: { tierRank: number; reviewScore: number },
  b: { tierRank: number; reviewScore: number }
): number {
  if (b.tierRank !== a.tierRank) return b.tierRank - a.tierRank;
  if (b.reviewScore !== a.reviewScore) return b.reviewScore - a.reviewScore;
  return 0;
}
