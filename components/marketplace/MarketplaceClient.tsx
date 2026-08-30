'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Search, ShoppingBag, Store, X, Menu, Sparkles,
  BadgeCheck, Shield, MessageCircle, Mail, ArrowRight,
} from 'lucide-react';
import { useCart } from '@/components/CartProvider';
import SmartImage from '@/components/SmartImage';
import CinematicTile, { type CinematicTileData } from '@/components/marketplace/CinematicTile';
import MarketplaceMarquee from '@/components/marketplace/MarketplaceMarquee';
import PlaybackCoordinator from '@/components/marketplace/PlaybackCoordinator';
import {
  compareTierThenReviewScore,
  getTierRank,
  reviewScoreOf,
  type ReviewStats,
} from '@/lib/feedRanking';
import { fetchJSON } from '@/lib/transport';
import type { Product } from '@/lib/types';
import type { MarketplaceShop, ReviewScoreEntry } from '@/app/marketplaceData';

// ─────────────────────────────────────────────────────────────────────────────
// MarketplaceClient — the mall's interactive shell (B1 split).
//
// app/page.tsx is now a SERVER component: it runs the bounded cached reads
// (app/marketplaceData.ts — shops ≤40, products ≤96 lean, review aggregates
// over a 5k window, all unstable_cache'd under the 'marketplace' tag) and
// hands the RANKED result here as props. This component is the historical
// client page minus its data layer: the first paint is real server HTML with
// products above the fold on 2G, zero CLS (no skeleton branch — the shelves
// ARE the initial render), and every interactive behavior (semantic search,
// cinematic tiles, playback coordination, storefront-link upgrades, cart)
// survives byte-identical. Client-side refresh of the feed is deliberately
// absent: the server Data Cache revalidates every 120s, which IS the feed's
// freshness contract.
// ─────────────────────────────────────────────────────────────────────────────

type Shop = MarketplaceShop;

type CategoryShelf = {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  emptyMessage: string;
};

const CATEGORY_SHELVES: CategoryShelf[] = [
  {
    id: 'beauty-personal-care',
    title: 'Beauty & Personal Care',
    description: 'Skincare, fragrance, and self-care essentials from independent boutiques.',
    keywords: ['beauty', 'wellness', 'personal care', 'skincare', 'makeup', 'fragrance'],
    emptyMessage: 'No beauty products have been added yet.',
  },
  {
    id: 'fashion-apparel',
    title: 'Fashion & Apparel',
    description: 'Statement clothing, ready-to-wear pieces, and everyday style picks.',
    keywords: ['fashion', 'apparel', 'clothing'],
    emptyMessage: 'No fashion products have been added yet.',
  },
  {
    id: 'sneakers-footwear',
    title: 'Sneakers & Footwear',
    description: 'Sneakers, slides, and standout footwear worth rotating into your collection.',
    keywords: ['sneaker', 'footwear', 'shoe'],
    emptyMessage: 'No footwear products have been added yet.',
  },
  {
    id: 'home-artisan',
    title: 'Home & Artisan',
    description: 'Handcrafted goods, home decor, and artisan-made pieces for every space.',
    keywords: ['home', 'artisan', 'decor', 'handmade', 'craft'],
    emptyMessage: 'No home and artisan products have been added yet.',
  },
  {
    id: 'tech-accessories',
    title: 'Tech Accessories',
    description: 'Cables, cases, and smart accessories for modern everyday life.',
    keywords: ['tech', 'accessories', 'electronics', 'gadget', 'phone', 'cable', 'case'],
    emptyMessage: 'No tech products have been added yet.',
  },
  {
    id: 'food-culinary',
    title: 'Food & Culinary',
    description: 'Local flavours, spices, snacks, and artisan food products.',
    keywords: ['food', 'culinary', 'spice', 'snack', 'drink', 'beverage', 'sauce', 'ingredient'],
    emptyMessage: 'No food products have been added yet.',
  },
];

type ProductWithShop = Product & {
  shop: {
    shop_name: string;
    shop_slug: string;
    subscription_tier: string;
  };
};

function categoryMatchesShelf(category: string | null | undefined, keywords: string[]): boolean {
  const value = category?.toLowerCase().trim();
  if (!value) return false;
  return keywords.some((kw) => value.includes(kw));
}

// ── Cinematic curation ────────────────────────────────────────────────────────
// CADENCE CAP (enforced in code, not taste): at most ONE interlude banner per
// INTERLUDE_EVERY_N_SHELVES shelf sections — two shelves ≈ one viewport of
// content — and at most ONE feature tile per shelf section (the selector
// takes only the first film-bearing product per shelf).
const INTERLUDE_EVERY_N_SHELVES = 2;

function toCinematicTile(p: ProductWithShop, withVideo: boolean): CinematicTileData {
  return {
    id: p.id,
    name: p.name,
    price: p.price ?? null,
    shopName: p.shop?.shop_name || 'Sanndikaa boutique',
    // The seller's best pixels: Ad Studio hero still first, then the photo.
    // (The lean feed select drops image_urls; image_url IS image_urls[0] by
    // the insert contract, so the fallback chain renders the same pixel.)
    posterUrl: p.ad_hero_image_url ?? p.image_urls?.[0] ?? p.image_url ?? null,
    videoUrl: withVideo ? p.ad_video_url ?? null : null,
  };
}

type MarketplaceClientProps = {
  /** Ranked shops with products attached — app/marketplaceData.loadMarketplace. */
  initialShops: MarketplaceShop[];
  /** Serialized review stats entries — rebuilt into the ranking Map here. */
  initialReviewScores: ReviewScoreEntry[];
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function MarketplaceClient({ initialShops, initialReviewScores }: MarketplaceClientProps) {
  const shops: Shop[] = initialShops;
  // Review-aware ranking (Pillar 1c): per-product stats power the
  // within-tier reorder + the ★ line on cards. A failed server read arrives
  // as an empty entries array → today's exact tier-only order.
  const reviewStats = useMemo<Map<string, ReviewStats>>(
    () => new Map(initialReviewScores),
    [initialReviewScores]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ProductWithShop[] | null>(null);
  // Honest-label flag (Fix 3): true when the API served the semantic weak
  // fallback (zero category/title matches) instead of exact lexical results.
  const [searchRelated, setSearchRelated] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);

  const { cartCount, setIsCartOpen } = useCart();

  // ── Premium storefront links (Pillar 2) ────────────────────────────────
  // ONE batched resolve for every shop on the floor, keyed on the SORTED id
  // list so reordering shops never re-fetches. Renders /shop instantly and
  // upgrades to /site/{slug} or https://{domain} non-blocking; any failure
  // simply keeps the classic /shop links. Sliced to the route's 60-id cap.
  const storefrontIdsKey = useMemo(() => {
    if (shops.length === 0) return null;
    return shops.slice(0, 60).map((s) => s.id).sort().join(',');
  }, [shops]);

  const { data: storefrontData } = useSWR(
    storefrontIdsKey ? `/api/storefronts?ids=${storefrontIdsKey}` : null,
    (url: string) => fetchJSON<{ paths: Record<string, string> }>(url),
    { revalidateOnFocus: false }
  );

  const shopHref = (shop: Pick<Shop, 'id' | 'shop_slug'>): string =>
    storefrontData?.paths?.[shop.id] ?? `/shop/${encodeURIComponent(shop.shop_slug)}`;

  const marketplaceProducts = useMemo(() => {
    const all: ProductWithShop[] = [];
    shops.forEach((shop) => {
      shop.products.forEach((product) => {
        all.push({
          ...(product as Product),
          shop: { shop_name: shop.shop_name, shop_slug: shop.shop_slug, subscription_tier: shop.subscription_tier },
        } as ProductWithShop);
      });
    });
    // Tier strictly primary — reviews reorder only WITHIN a tier (an
    // advanced shop with zero reviews still outranks a 5★ starter); stable
    // sort preserves recency as the third key.
    return all
      .map((product) => ({
        product,
        tierRank: getTierRank(product.shop?.subscription_tier),
        reviewScore: reviewScoreOf(reviewStats, product.id),
      }))
      .sort(compareTierThenReviewScore)
      .map((ranked) => ranked.product);
  }, [shops, reviewStats]);

  const categoryShelves = useMemo(
    () => CATEGORY_SHELVES.map((shelf) => ({
      ...shelf,
      products: marketplaceProducts.filter((p) => categoryMatchesShelf(p.category, shelf.keywords)),
    })),
    [marketplaceProducts]
  );

  // Cinematic curation — tier-ranked by construction (marketplaceProducts is
  // already flagship/advanced-first). One pass assigns every living slot so a
  // product never appears in two curation surfaces at once:
  //   1. feature tiles: first film-bearing product per shelf (max 1/section);
  //   2. interludes: cadence-capped queue between shelves — films first,
  //      still-life editions (ad hero stills) fill when no film remains;
  //   3. empty-shelf fills: still-life editorial curation, never an apology.
  const curation = useMemo(() => {
    const used = new Set<string>();

    const featureByShelf = new Map<string, ProductWithShop>();
    for (const shelf of categoryShelves) {
      const candidate = shelf.products.find((p) => p.ad_video_url && !used.has(p.id));
      if (candidate) {
        featureByShelf.set(shelf.id, candidate);
        used.add(candidate.id);
      }
    }

    const queue = [
      ...marketplaceProducts.filter((p) => p.ad_video_url && !used.has(p.id)),
      ...marketplaceProducts.filter((p) => !p.ad_video_url && p.ad_hero_image_url && !used.has(p.id)),
    ];
    let cursor = 0;
    const next = () => (cursor < queue.length ? queue[cursor++] : null);

    const interludeByIndex = new Map<number, ProductWithShop>();
    categoryShelves.forEach((_, i) => {
      if ((i + 1) % INTERLUDE_EVERY_N_SHELVES !== 0) return;
      const pick = next();
      if (pick) interludeByIndex.set(i, pick);
    });

    const fillByShelf = new Map<string, ProductWithShop>();
    for (const shelf of categoryShelves) {
      if (shelf.products.length > 0) continue;
      const pick = next();
      if (pick) fillByShelf.set(shelf.id, pick);
    }

    return { featureByShelf, interludeByIndex, fillByShelf };
  }, [categoryShelves, marketplaceProducts]);

  const handleCategoryJump = (sectionId: string) => {
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults(null);
    setSearchRelated(false);
    setIsMobileMenuOpen(false);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Clear results when the input is emptied so swimlanes reappear
    if (!value.trim()) {
      setSearchResults(null);
    }
  };

  const handleSearchSubmit = async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setIsSearching(true);
    setSearchResults(null);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');

      // Enrich returned products with shop data from locally loaded shops
      const shopMap = new Map(shops.map((s) => [s.id, s]));
      const enriched: ProductWithShop[] = (data.products ?? []).map((p: Product) => {
        const shop = shopMap.get((p.user_id || p.shop_id) as string);
        return {
          ...p,
          shop: shop
            ? { shop_name: shop.shop_name, shop_slug: shop.shop_slug, subscription_tier: shop.subscription_tier }
            : { shop_name: '', shop_slug: '', subscription_tier: 'starter' },
        };
      });

      setSearchResults(enriched);
      setSearchRelated(Boolean(data.related));
    } catch (err) {
      console.error('[search] client error:', err);
      setSearchResults([]);
      setSearchRelated(false);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults(null);
    setSearchRelated(false);
  };

  // ── Product card ─────────────────────────────────────────────────────────
  const renderProductCard = (product: ProductWithShop) => {
    const imgUrl = product.image_urls?.[0] || product.image_url;
    const tier = (product.shop?.subscription_tier || 'starter').toLowerCase().trim();
    // Gold "Featured" family = flagship + legacy advanced (Blind Spot fix:
    // flagship ranks ABOVE advanced in the feed but historically rendered
    // with NO badge at all — the top payer showed less than the tier below).
    const isAdvanced = tier === 'advanced' || tier === 'flagship';
    const isPro = tier === 'pro';
    const stats = reviewStats.get(product.id);

    return (
      <Link
        href={`/product/${product.id}`}
        key={`${product.id}-${product.shop?.shop_slug}`}
        className="group flex flex-col"
      >
        <div
          className={`relative aspect-square overflow-hidden rounded-xl border bg-neutral-100 ${
            isAdvanced ? 'border-yellow-300' : isPro ? 'border-purple-300' : 'border-black/5'
          }`}
        >
          {imgUrl ? (
            <SmartImage
              src={imgUrl}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="(max-width: 640px) 160px, (max-width: 1024px) 192px, 208px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-300">
              <ShoppingBag size={22} />
            </div>
          )}
          {(isAdvanced || isPro) && (
            <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur">
              {isAdvanced ? (
                <><BadgeCheck size={10} className="text-yellow-500" /><span className="text-yellow-700">Featured</span></>
              ) : (
                <><BadgeCheck size={10} className="text-purple-500" /><span className="text-purple-700">Pro</span></>
              )}
            </div>
          )}
        </div>
        <div className="mt-2.5 space-y-0.5">
          <h4 className="line-clamp-2 text-[13px] font-medium leading-5 text-gray-900 group-hover:underline">
            {product.name}
          </h4>
          <p className="text-[13px] font-semibold text-gray-900">D{product.price}</p>
          {stats && stats.count > 0 && (
            <p className="text-[11px] text-gray-500">
              <span aria-hidden className="text-yellow-500">★</span> {stats.average.toFixed(1)}{' '}
              <span className="sr-only">out of 5 stars,</span>({stats.count})
            </p>
          )}
          <p className="truncate text-[11px] text-gray-500">{product.shop?.shop_name}</p>
        </div>
      </Link>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  // No loading skeleton branch: the server hands this component real shelves,
  // so the first frame IS the mall (zero CLS on the initial paint).
  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-gray-900 selection:bg-green-100">


      {/* ═══════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50">

        {/* ── MOBILE HEADER: dark green, two-row Amazon-style (hidden on md+) ── */}
        <div className="bg-[#1a2e1a] md:hidden">
          {/* Row 1: Burger | Logo | Cart */}
          <div className="grid grid-cols-[44px_1fr_44px] items-center px-3 pb-2 pt-3">
            <button
              onClick={() => setIsMobileMenuOpen((o) => !o)}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-white transition hover:bg-white/10 active:bg-white/20"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={22} strokeWidth={1.8} /> : <Menu size={22} strokeWidth={1.8} />}
            </button>

            <div className="flex items-center justify-center">
              <Link href="/" className="flex-shrink-0">
                <img
                  src="/logo.png"
                  alt="Sanndikaa"
                  className="h-16 w-auto flex-shrink-0 object-contain brightness-0 invert"
                />
              </Link>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-white transition hover:bg-white/10 active:bg-white/20"
              aria-label="Open cart"
            >
              <ShoppingBag size={22} strokeWidth={1.8} />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-yellow-400 text-[9px] font-bold leading-none text-[#1a2e1a] shadow">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>
          </div>

          {/* Row 2: Full-width search bar */}
          <div className="px-3 pb-3">
            <div className="flex h-11 overflow-hidden rounded-lg bg-white shadow-sm">
              <label htmlFor="mobile-search" className="flex cursor-text items-center pl-3 text-gray-400">
                <Search size={16} />
              </label>
              <input
                id="mobile-search"
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                placeholder="Search 'summer wedding outfit' or 'glowing skin'..."
                className="flex-1 bg-transparent px-2 text-base text-gray-900 outline-none placeholder:text-gray-400"
              />
              {searchQuery ? (
                <button
                  onClick={clearSearch}
                  className="flex items-center justify-center px-3 text-gray-400 hover:text-gray-700"
                >
                  <X size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSearchSubmit}
                  className="flex items-center justify-center bg-[#f0a500] px-4"
                >
                  <Search size={17} className="text-[#1a2e1a]" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── DESKTOP HEADER (visible from md+) ── */}
        <div className="hidden w-full border-b border-black/5 bg-white/95 backdrop-blur-md md:block">
          <div className="mx-auto flex max-w-7xl items-center gap-5 px-10 py-4">
            <Link href="/" className="flex-shrink-0">
              <img
                src="/logo.png"
                alt="Sanndikaa"
                className="h-16 w-auto flex-shrink-0 object-contain"
              />
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
              >
                Seller Login
              </Link>
              <Link
                href="/pricing"
                className="rounded-full bg-[#1a2e1a] px-5 py-2 text-sm font-medium text-white transition hover:bg-black"
              >
                Open Boutique
              </Link>
            </div>
            <div className="ml-auto flex w-full max-w-md items-center overflow-hidden rounded-full border border-black/10 bg-neutral-50 px-4 py-3 shadow-sm">
              <Search size={16} className="flex-shrink-0 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                placeholder="Search 'summer wedding outfit' or 'glowing skin'..."
                className="w-full bg-transparent px-3 text-base text-gray-900 outline-none placeholder:text-gray-400"
              />
              {searchQuery ? (
                <button onClick={clearSearch} className="flex-shrink-0 text-gray-400 transition hover:text-gray-900">
                  <X size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSearchSubmit}
                  className="flex-shrink-0 rounded-full bg-[#1a2e1a] p-1.5 text-white transition hover:bg-black"
                  aria-label="Search"
                >
                  <Search size={13} />
                </button>
              )}
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-gray-900 transition hover:bg-neutral-100"
              aria-label="Open cart"
            >
              <ShoppingBag size={21} strokeWidth={1.8} />
              {cartCount > 0 && (
                <span className="absolute right-1 top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── MOBILE MENU PANEL ── */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out md:hidden ${
            isMobileMenuOpen
              ? 'max-h-[28rem] border-b border-black/5 opacity-100'
              : 'max-h-0 opacity-0'
          }`}
        >
          <div className="flex flex-col gap-1 bg-white px-4 py-4 shadow-lg">
            <Link
              href="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-neutral-50"
            >
              Seller Login
            </Link>
            <Link
              href="/pricing"
              onClick={() => setIsMobileMenuOpen(false)}
              className="rounded-xl bg-[#1a2e1a] px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-black"
            >
              Open Your Boutique
            </Link>
            <div className="my-2 border-t border-black/5" />
            <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Categories
            </p>
            {CATEGORY_SHELVES.map((shelf) => (
              <button
                key={shelf.id}
                onClick={() => handleCategoryJump(shelf.id)}
                className="flex items-center justify-between rounded-xl px-4 py-2.5 text-left text-sm font-medium text-gray-700 transition hover:bg-neutral-50"
              >
                {shelf.title}
                <ArrowRight size={14} className="text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════
          TRUST MARQUEE — every claim feature-verified (Pillar 3)
      ═══════════════════════════════════════════════════════ */}
      <MarketplaceMarquee />

      {/* ═══════════════════════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════════════════════ */}
      <main className="pb-0 pt-6 md:pt-8" id="category-shelves">
        {isSearching ? (

          /* ── AI LOADING STATE ────────────────────────────── */
          <motion.div
            className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <div className="relative mb-6 flex h-16 w-16 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1a2e1a]/20" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#1a2e1a] text-white shadow-lg">
                <Sparkles size={22} />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Your Personal Stylist is curating matches...</h2>
            <p className="mt-2 text-sm text-gray-500">Searching across every boutique for &ldquo;{searchQuery}&rdquo;</p>
            <div className="mt-6 flex items-center gap-1.5">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-2 w-2 animate-bounce rounded-full bg-[#1a2e1a]/40"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </motion.div>

        ) : searchResults !== null ? (

          /* ── SEMANTIC SEARCH RESULTS ─────────────────────── */
          <div className="animate-in fade-in mx-auto max-w-7xl px-4 pb-20 duration-300 md:px-10">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-[#1a2e1a]" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#1a2e1a]">
                    {searchRelated ? 'AI Stylist — Closest Matches' : 'Marketplace Results'}
                  </span>
                </div>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-gray-900">
                  Matches for{' '}
                  <span className="text-gray-500">&ldquo;{searchQuery}&rdquo;</span>
                </h2>
              </div>
              <button
                onClick={clearSearch}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium text-gray-600 shadow-sm transition hover:border-black/20 hover:text-gray-900"
              >
                <X size={13} /> Clear Search
              </button>
            </div>

            {searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white px-4 py-24 text-center shadow-sm">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-gray-300">
                  <Search size={22} />
                </div>
                <h3 className="text-base font-semibold text-gray-900">No exact matches found</h3>
                <p className="mt-2 max-w-sm text-sm text-gray-500">
                  We couldn&apos;t find an exact match for that vibe. Try another search, or browse a category below.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {CATEGORY_SHELVES.map((shelf) => (
                    <button
                      key={shelf.id}
                      onClick={() => handleCategoryJump(shelf.id)}
                      className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-neutral-50 hover:border-black/20"
                    >
                      {shelf.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <p className="mb-4 text-xs text-gray-400">
                  {searchResults.length} item{searchResults.length !== 1 ? 's' : ''} found
                  {searchRelated && ' — no exact category or title matches, showing the closest pieces instead'}
                </p>
                <motion.div
                  className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                  initial="hidden"
                  animate="show"
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.055 } } }}
                >
                  {searchResults.map((product) => (
                    <motion.div
                      key={`${product.id}-${product.shop?.shop_slug}`}
                      variants={{
                        hidden: { opacity: 0, y: 18 },
                        show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' } },
                      }}
                    >
                      {renderProductCard(product)}
                    </motion.div>
                  ))}
                </motion.div>
              </>
            )}
          </div>

        ) : (

          /* ── CATEGORY SWIMLANES + CINEMATIC CURATION ──────────
             PlaybackCoordinator enforces the one-playing-video rule across
             every interlude and feature tile below. */
          <PlaybackCoordinator>
          <div className="space-y-2 pb-0 md:space-y-4">

            {categoryShelves.map((shelf, shelfIndex) => {
              const featured = curation.featureByShelf.get(shelf.id) ?? null;
              const shelfProducts = featured
                ? shelf.products.filter((p) => p.id !== featured.id)
                : shelf.products;
              const fill = curation.fillByShelf.get(shelf.id) ?? null;
              const interlude = curation.interludeByIndex.get(shelfIndex) ?? null;
              return (
              <div key={shelf.id}>
              <section id={shelf.id} className="bg-white py-5 md:py-6">

                {/* Shelf header */}
                <div className="mb-3 flex items-center justify-between px-4 md:px-10">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-gray-900 md:text-2xl">
                      {shelf.title}
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-gray-500 md:text-sm">
                      {shelf.description}
                    </p>
                  </div>
                  {shelf.products.length > 0 && (
                    <span className="flex-shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-gray-600">
                      {shelf.products.length} item{shelf.products.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {shelf.products.length === 0 ? (
                  /* An empty shelf renders CURATION, never an apology:
                     still-life editorial fill from the marketplace edit →
                     featured boutiques → an invitation to open the shelf. */
                  fill ? (
                    <div className="mx-4 overflow-hidden rounded-2xl md:mx-10">
                      <CinematicTile
                        variant="interlude"
                        data={toCinematicTile(fill, false)}
                        kicker={`From the marketplace edit — ${fill.shop?.shop_name ?? 'Sanndikaa'}`}
                      />
                    </div>
                  ) : shops.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 md:px-10">
                      {shops.slice(0, 2).map((shop) => (
                        <Link
                          key={`${shelf.id}-fill-${shop.id}`}
                          href={shopHref(shop)}
                          className="group flex min-h-[88px] items-center gap-4 rounded-2xl border border-black/5 bg-neutral-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-black/10 bg-white">
                            {shop.logo_url ? (
                              <SmartImage src={shop.logo_url} alt={shop.shop_name} fill blurTone="none" className="rounded-full object-cover" sizes="48px" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-gray-300"><Store size={18} /></div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Featured boutique</p>
                            <p className="truncate text-sm font-semibold text-gray-900 group-hover:underline">{shop.shop_name}</p>
                          </div>
                          <ArrowRight size={14} className="ml-auto flex-shrink-0 text-gray-400" />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="mx-4 flex min-h-[160px] flex-col items-center justify-center rounded-2xl bg-[#1a2e1a] px-6 py-10 text-center md:mx-10">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#f0a500]">The First Edit</p>
                      <h4 className="mt-2 text-lg font-semibold text-white">This shelf opens with the first boutique.</h4>
                      <Link
                        href="/pricing"
                        className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-white px-6 text-xs font-semibold text-[#1a2e1a] transition hover:bg-neutral-100"
                      >
                        Open your boutique
                      </Link>
                    </div>
                  )
                ) : (
                  /*
                    Horizontal carousel — fixed 160px card width on mobile.
                    On a 375px screen with 16px left padding and 12px gap:
                    First card ends at 16+160=176px, gap at 188px, second card
                    visible from 188px → 348px (full), third card starts at 360px
                    → 15px of third card visible. Net effect: ~2 full + sliver,
                    giving a clear swipe affordance.
                  */
                  <div className="scrollbar-none flex gap-3 overflow-x-auto snap-x snap-mandatory px-4 pb-4 md:gap-5 md:px-10">
                    {/* Feature tile — max ONE per shelf section (cadence cap):
                        double-width, same card anatomy, living media box. */}
                    {featured && (
                      <div className="w-[332px] flex-shrink-0 snap-start sm:w-[396px] md:w-[436px] lg:w-[468px]">
                        <CinematicTile variant="feature" data={toCinematicTile(featured, true)} />
                      </div>
                    )}
                    {shelfProducts.map((product) => (
                      <div
                        key={`${shelf.id}-${product.id}-${product.shop.shop_slug}`}
                        className="w-[160px] flex-shrink-0 snap-start sm:w-48 md:w-52 lg:w-56"
                      >
                        {renderProductCard(product)}
                      </div>
                    ))}
                    {/* Right-edge spacer so last card doesn't hug the scroll edge */}
                    <div className="w-4 flex-shrink-0 md:w-6" aria-hidden="true" />
                  </div>
                )}
              </section>

              {/* Full-bleed interlude — cadence-capped to one per
                  ~viewport of shelf content (every second shelf). */}
              {interlude && (
                <CinematicTile variant="interlude" data={toCinematicTile(interlude, true)} />
              )}
              </div>
              );
            })}

            {/* ── SHOP BY BOUTIQUE ──────────────────────────── */}
            <section className="bg-white py-5 md:py-8">
              <div className="mb-5 flex items-center justify-between px-4 md:px-10">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-gray-900 md:text-2xl">
                    Shop by Boutique
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-gray-500">
                    Discover curated boutiques from independent sellers
                  </p>
                </div>
              </div>

              {shops.length === 0 ? (
                /* Curation, never an apology: the empty boutique floor is a
                   designed invitation (conversion surface, Law 1). */
                <div className="mx-4 flex flex-col items-center justify-center rounded-2xl bg-[#1a2e1a] px-6 py-16 text-center md:mx-10">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#f0a500]">Opening Soon</p>
                  <h3 className="mt-3 max-w-md text-xl font-semibold text-white">
                    The first boutiques are being fitted. Yours could open the floor.
                  </h3>
                  <Link
                    href="/pricing"
                    className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-[#1a2e1a] transition hover:bg-neutral-100"
                  >
                    Open your boutique <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 px-4 md:grid-cols-2 md:gap-8 md:px-10">
                  {shops.map((shop) => {
                    const tier = (shop.subscription_tier || 'starter').toLowerCase().trim();
                    // Gold family = flagship + legacy advanced (see card note).
                    const isAdvanced = tier === 'advanced' || tier === 'flagship';
                    const isPro = tier === 'pro';

                    return (
                      <div
                        key={shop.id}
                        className={`group flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                          isAdvanced ? 'border-yellow-300' : isPro ? 'border-purple-300' : 'border-black/5'
                        }`}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border bg-gray-50 ${
                                isAdvanced ? 'border-yellow-400' : isPro ? 'border-purple-400' : 'border-black/10'
                              }`}
                            >
                              {shop.logo_url ? (
                                <SmartImage
                                  src={shop.logo_url}
                                  alt={shop.shop_name}
                                  fill
                                  blurTone="none"
                                  className="rounded-full object-cover"
                                  sizes="40px"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-gray-300">
                                  <Store size={16} />
                                </div>
                              )}
                            </div>
                            <div>
                              <h3 className="flex items-center gap-1 text-sm font-medium text-gray-900">
                                {shop.shop_name}
                                {isAdvanced && <BadgeCheck size={13} className="text-yellow-500" />}
                                {isPro && <BadgeCheck size={13} className="text-purple-500" />}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {shop.products.length} product{shop.products.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <Link
                            href={shopHref(shop)}
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                              isAdvanced
                                ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                                : isPro
                                  ? 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            Visit <ArrowRight size={11} />
                          </Link>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {shop.products.slice(0, 3).map((product) => {
                            const imgUrl = product.image_urls?.[0] || product.image_url;
                            return (
                              <Link
                                href={`/product/${product.id}`}
                                key={product.id}
                                className="group/item flex flex-col gap-1.5"
                              >
                                <div
                                  className={`relative aspect-[4/5] overflow-hidden rounded-xl border bg-gray-50 ${
                                    isAdvanced ? 'border-yellow-100' : isPro ? 'border-purple-100' : 'border-black/5'
                                  }`}
                                >
                                  {imgUrl ? (
                                    <SmartImage
                                      src={imgUrl}
                                      alt={product.name}
                                      fill
                                      className="object-cover transition-transform duration-700 group-hover/item:scale-105"
                                      sizes="(max-width: 768px) 33vw, 16vw"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center text-gray-200">
                                      <ShoppingBag size={18} />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="truncate text-xs font-medium text-gray-900">{product.name}</p>
                                  <p className="text-xs font-semibold text-gray-700">D{product.price}</p>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

          </div>
          </PlaybackCoordinator>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════
          NEWSLETTER
      ═══════════════════════════════════════════════════════ */}
      <section className="mt-8 border-t border-black/5 bg-[#1a2e1a]">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-10">
          <div className="mx-auto max-w-xl text-center">
            <div className="mb-3 flex items-center justify-center">
              <Mail size={22} className="text-white/50" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Stay in the loop</h2>
            <p className="mt-2 text-sm text-white/60">
              New boutiques, exclusive drops, and curated edits — straight to your inbox.
            </p>
            {newsletterSubmitted ? (
              <div className="mt-6 rounded-2xl bg-white/10 px-6 py-4 text-sm font-medium text-white">
                ✓ You&apos;re on the list. Welcome to the Sanndikaa community.
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newsletterEmail.trim()) setNewsletterSubmitted(true);
                }}
                className="mt-6 flex w-full flex-col gap-3 sm:flex-row"
              >
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="w-full rounded-full border border-white/10 bg-white/10 px-5 py-3 text-base font-medium text-white outline-none placeholder:text-white/40 transition focus:border-white/30"
                />
                <button
                  type="submit"
                  className="whitespace-nowrap rounded-full bg-white px-7 py-3 text-sm font-semibold text-[#1a2e1a] transition hover:bg-neutral-100"
                >
                  Subscribe
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════ */}
      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-10">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-4 lg:grid-cols-5">

            <div className="col-span-2 lg:col-span-2">
              <Link href="/">
                <img src="/logo.png" alt="Sanndikaa" className="h-14 w-auto flex-shrink-0 object-contain" />
              </Link>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-gray-500">
                Where African design meets global discovery. A premium marketplace connecting buyers with Africa&apos;s finest boutiques.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-black/5 bg-neutral-50 px-3 py-1.5 text-[10px] font-semibold text-gray-600">
                  <Shield size={11} className="text-green-600" /> Secure Payments
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-black/5 bg-neutral-50 px-3 py-1.5 text-[10px] font-semibold text-gray-600">
                  <MessageCircle size={11} className="text-green-600" /> Direct WhatsApp Checkout
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-900">Shop</h4>
              <ul className="space-y-3">
                <li>
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="text-sm text-gray-500 transition hover:text-gray-900"
                  >
                    Homepage
                  </button>
                </li>
                {CATEGORY_SHELVES.map((shelf) => (
                  <li key={shelf.id}>
                    <button
                      onClick={() => handleCategoryJump(shelf.id)}
                      className="text-left text-sm text-gray-500 transition hover:text-gray-900"
                    >
                      {shelf.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-900">Sell</h4>
              <ul className="space-y-3">
                <li><Link href="/sell" className="text-sm text-gray-500 transition hover:text-gray-900">Why Sell on Sanndikaa</Link></li>
                <li><Link href="/pricing" className="text-sm text-gray-500 transition hover:text-gray-900">Open Boutique</Link></li>
                <li><Link href="/login" className="text-sm text-gray-500 transition hover:text-gray-900">Seller Login</Link></li>
                <li><Link href="/pricing" className="text-sm text-gray-500 transition hover:text-gray-900">Pricing &amp; Plans</Link></li>
                <li><Link href="/dashboard" className="text-sm text-gray-500 transition hover:text-gray-900">Seller Dashboard</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-900">Support</h4>
              <ul className="space-y-3">
                <li><Link href="/" className="text-sm text-gray-500 transition hover:text-gray-900">Help Center</Link></li>
                <li><Link href="/" className="text-sm text-gray-500 transition hover:text-gray-900">How Ordering Works</Link></li>
                <li><Link href="/" className="text-sm text-gray-500 transition hover:text-gray-900">Contact Us</Link></li>
              </ul>
            </div>

          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-black/5 pt-6 md:flex-row">
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} Sanndikaa. All rights reserved.
            </p>
            <div className="flex items-center gap-5">
              <Link href="/" className="text-xs text-gray-400 transition hover:text-gray-600">Privacy Policy</Link>
              <Link href="/" className="text-xs text-gray-400 transition hover:text-gray-600">Terms of Service</Link>
              <Link href="/" className="text-xs text-gray-400 transition hover:text-gray-600">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
