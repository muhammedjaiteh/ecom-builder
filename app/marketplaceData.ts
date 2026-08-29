import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import {
  buildReviewStats,
  compareTierThenReviewScore,
  getTierRank,
  shopReviewScore,
  type ProductReviewRow,
  type ReviewStats,
} from '@/lib/feedRanking';
import type { Product } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Marketplace root data — BOUNDED, CACHED, SERVER-RENDERED (Law 1: the root
// domain is the mall, and the mall must paint real products on 2G).
//
// The historical client page fired UNBOUNDED anon reads on every visit
// (all products including image_urls arrays, the full reviews table) and
// SSR'd only a skeleton. This module is the replacement: the exact reads,
// bounded and pushed through Next's Data Cache per the siteData.ts idiom —
//   - keys:   static ('marketplace-shelf' / 'marketplace-review-scores')
//   - tag:    'marketplace' — fire revalidateTag('marketplace') from any
//             future write path that must repaint the mall instantly
//   - revalidate: 120s backstop (product adds/shop edits surface within 2min)
// Fetchers THROW on query errors so a transient DB failure is never frozen
// into the cache as an empty mall; the read-through wrapper retries once
// uncached, then the call site degrades exactly as the historical code did
// (empty shelves / tier-only ranking).
//
// BOUNDS (documented contract):
//   SHOPS_LIMIT 40      — active shops, alphabetical subscription_tier ASC.
//                         By vocabulary accident that is exactly tier-rank
//                         order (advanced < flagship < pro < starter), so the
//                         paid tiers always survive the cut; the real ranking
//                         (tier strictly primary, Σ member reviewScores) is
//                         recomputed below via lib/feedRanking.
//   PRODUCTS_LIMIT 96   — newest-first. LEAN COLUMNS: image_urls is DROPPED
//                         from this select — every mall renderer (product
//                         cards, cinematic tiles, boutique mini-grids) falls
//                         back to image_url, which the insert path always
//                         writes as image_urls[0] (app/dashboard/add:449), so
//                         the rendered pixel is identical without shipping
//                         the gallery arrays to the feed.
//   REVIEWS_LIMIT 5000  — newest-first (product_id, rating) window, then
//                         aggregated INSIDE the cached fetcher into compact
//                         [productId, stats] entries (a Map is not
//                         JSON-serializable through unstable_cache).
//                         SCALE THRESHOLD: past ~5k review rows the ranking
//                         window is the most recent 5k reviews — at that
//                         volume move the aggregation into a DB view/RPC
//                         (lib/feedRanking's math is unchanged either way).
// ─────────────────────────────────────────────────────────────────────────────

export const MARKETPLACE_CACHE_TAG = 'marketplace';
const MARKETPLACE_CACHE_REVALIDATE = 120;

const SHOPS_LIMIT = 40;
const PRODUCTS_LIMIT = 96;
const REVIEWS_LIMIT = 5000;

export type MarketplaceShop = {
  id: string;
  shop_name: string;
  shop_slug: string;
  logo_url: string | null;
  theme_color: string | null;
  subscription_tier: string;
  status?: string;
  products: Product[];
};

/** Serializable Map entries — the client rebuilds `new Map(entries)`. */
export type ReviewScoreEntry = [string, ReviewStats];

export type MarketplaceData = {
  /** Tier-then-review ranked shops with their products attached. */
  shops: MarketplaceShop[];
  reviewScores: ReviewScoreEntry[];
};

// Anon server client — shops/products/reviews public-read RLS is live-proven
// (RLS_PRODUCTS_ORDERS_SHOPS.sql + the ReviewList anon read). No service role
// needed for a public feed.
function getAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// siteData.ts's readThroughSiteCache pattern: cache-or-first-read failure →
// ONE uncached retry so a transient error is never served (or stored) as a
// false empty mall. A second failure propagates to the caller's degradation.
async function readThroughMarketplaceCache<T>(
  label: string,
  keyParts: string[],
  read: () => Promise<T>
): Promise<T> {
  try {
    return await unstable_cache(read, keyParts, {
      revalidate: MARKETPLACE_CACHE_REVALIDATE,
      tags: [MARKETPLACE_CACHE_TAG],
    })();
  } catch (error) {
    console.error(
      `[marketplace-cache] ${label} read failed, retrying uncached:`,
      error instanceof Error ? error.message : error
    );
    return read();
  }
}

// NO FK EMBED (2026-08-26 live probe, preserved from the client page):
// products↔shops carries TWO relationships in the live DB (shop_id FK plus
// the out-of-repo products_shop_link on user_id), so an un-hinted embed fails
// with PGRST201 and rendered the mall EMPTY. Two plain reads + dual-column
// grouping (shop_id ?? user_id — siteData.ts's resolution) are immune to live
// FK topology AND to shop_id-NULL ghost rows. THROWS on error.
async function readMarketplaceShelf(): Promise<MarketplaceShop[]> {
  const supabase = getAnonClient();

  const [shopsRes, productsRes] = await Promise.all([
    supabase
      .from('shops')
      .select('id, shop_name, shop_slug, logo_url, theme_color, subscription_tier, status')
      .eq('status', 'active')
      .order('subscription_tier', { ascending: true })
      .limit(SHOPS_LIMIT),
    supabase
      .from('products')
      .select('id, name, price, image_url, category, stock_quantity, ad_video_url, ad_hero_image_url, shop_id, user_id')
      .order('created_at', { ascending: false })
      .limit(PRODUCTS_LIMIT),
  ]);

  if (shopsRes.error) throw new Error(`marketplace shops read failed: ${shopsRes.error.message}`);
  if (productsRes.error) throw new Error(`marketplace products read failed: ${productsRes.error.message}`);

  const productsByShop = new Map<string, Product[]>();
  for (const product of (productsRes.data ?? []) as Product[]) {
    const sellerId = product.shop_id ?? product.user_id;
    if (!sellerId) continue;
    const list = productsByShop.get(sellerId);
    if (list) list.push(product);
    else productsByShop.set(sellerId, [product]);
  }

  return ((shopsRes.data ?? []) as unknown as Omit<MarketplaceShop, 'products'>[])
    .map((shop) => ({ ...shop, products: productsByShop.get(shop.id) ?? [] }))
    .filter((shop) => shop.products.length > 0);
}

// Review-aware ranking (Pillar 1c) — aggregated server-side inside the cached
// fetcher; only the compact per-product stats ever leave this module. THROWS
// on error so the failure degrades per-request to tier-only ranking (the
// historical contract) instead of caching as "no reviews anywhere".
async function readReviewScoreEntries(): Promise<ReviewScoreEntry[]> {
  const { data, error } = await getAnonClient()
    .from('reviews')
    .select('product_id, rating')
    .order('created_at', { ascending: false })
    .limit(REVIEWS_LIMIT);
  if (error) throw new Error(`marketplace reviews read failed: ${error.message}`);
  return Array.from(buildReviewStats((data ?? []) as ProductReviewRow[]).entries());
}

/** The page's ONE entry point: bounded cached reads + the exact historical
 *  ranking (lib/feedRanking contract — tier STRICTLY primary, Σ member
 *  reviewScores within a tier, stable third key preserves recency). */
export async function loadMarketplace(): Promise<MarketplaceData> {
  const [shelfResult, reviewsResult] = await Promise.allSettled([
    readThroughMarketplaceCache('shelf', ['marketplace-shelf'], readMarketplaceShelf),
    readThroughMarketplaceCache('review-scores', ['marketplace-review-scores'], readReviewScoreEntries),
  ]);

  // Historical degradations, preserved verbatim: shops/products failure →
  // empty mall (the designed "Opening Soon" invitation, never a 500); reviews
  // failure → empty stats map → today's exact tier-only order.
  const shelf = shelfResult.status === 'fulfilled' ? shelfResult.value : [];
  if (shelfResult.status === 'rejected') {
    console.error('[marketplace] shelf unavailable (mall renders its designed empty state):', shelfResult.reason);
  }
  const reviewScores = reviewsResult.status === 'fulfilled' ? reviewsResult.value : [];
  if (reviewsResult.status === 'rejected') {
    console.error('[marketplace] reviews unavailable (feed stays tier-only):', reviewsResult.reason);
  }

  const stats = new Map(reviewScores);
  const shops = shelf
    .map((shop) => ({
      shop,
      tierRank: getTierRank(shop.subscription_tier),
      reviewScore: shopReviewScore(stats, shop.products.map((p) => p.id)),
    }))
    .sort(compareTierThenReviewScore)
    .map((ranked) => ranked.shop);

  return { shops, reviewScores };
}
