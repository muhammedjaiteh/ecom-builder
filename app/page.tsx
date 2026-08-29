import MarketplaceClient from '@/components/marketplace/MarketplaceClient';
import { loadMarketplace } from './marketplaceData';

// ─────────────────────────────────────────────────────────────────────────────
// The root domain IS the mall (Law 1) — and now it is SERVER-RENDERED.
//
// This page is a Server Component: it awaits the bounded, cached feed
// (app/marketplaceData.ts — shops ≤40, products ≤96 lean columns, review
// aggregates over the newest 5k rows, unstable_cache tag 'marketplace',
// 120s revalidate) and streams REAL shelves as HTML. A 2G buyer receives
// products above the fold in the first response instead of a skeleton plus
// three unbounded client reads. All interactivity lives in
// components/marketplace/MarketplaceClient.tsx, hydrating over this exact
// markup — zero CLS, zero behavior change.
//
// Route-level ISR matches the Data Cache backstop so the rendered HTML and
// the cached data revalidate on the same clock.
// ─────────────────────────────────────────────────────────────────────────────

export const revalidate = 120;

export default async function GlobalHomepage() {
  const { shops, reviewScores } = await loadMarketplace();

  return <MarketplaceClient initialShops={shops} initialReviewScores={reviewScores} />;
}
