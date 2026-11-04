'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Search, ShoppingBag, X, Menu,
  Shield, MessageCircle, ArrowRight,
} from 'lucide-react';
import { useCart } from '@/components/CartProvider';
import CinematicTile, { type CinematicTileData } from '@/components/marketplace/CinematicTile';
import PlaybackCoordinator from '@/components/marketplace/PlaybackCoordinator';
import MarketplaceBoutiqueCard from '@/components/marketplace/MarketplaceBoutiqueCard';
import MarketplaceProductCard, {
  CARD_SHADOW,
  type RailProduct,
} from '@/components/marketplace/MarketplaceProductCard';
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
// MarketplaceClient — the mall's interactive shell, MERCHANT-FIRST
// (Phase 9A, Step A: hierarchy and subtraction).
//
// app/page.tsx is a SERVER component: it runs the bounded cached reads
// (app/marketplaceData.ts — shops ≤40, products ≤96 lean, review aggregates
// over a 5k window, all unstable_cache'd under the 'marketplace' tag) and
// hands the RANKED result here as props. Nothing in this file fetches feed
// data: every surface below is a pure re-slicing of that one payload —
//
//   header (forest, two-row on mobile: burger · logo · cart / search)
//   HERO              — edge-to-edge featured banner, fixed heights (188→340px)
//   THE HOUSES        — every ranked shop as a full-width vertical merchant
//                       block (Step B replaces the block with a chapter)
//   BROWSE BY CATEGORY — one compact text-link row; each link runs the
//                       existing semantic search for that category
//   footer
//
// Subtracted in Step A (merchant-first law, claude.md Marketplace Identity
// Principle): browse chips, trust marquee, the three discovery rails,
// category product shelves, interlude banners, and the disabled newsletter.
// The only product grid left is the search-results view, where a dense
// 2-up grid IS the right scan pattern. Interactivity — semantic search,
// playback election, storefront link upgrades, cart — is unchanged.
// ─────────────────────────────────────────────────────────────────────────────

type Shop = MarketplaceShop;
type ProductWithShop = RailProduct;

type CategoryShelf = {
  id: string;
  title: string;
  keywords: string[];
};

const CATEGORY_SHELVES: CategoryShelf[] = [
  {
    id: 'beauty-personal-care',
    title: 'Beauty & Personal Care',
    keywords: ['beauty', 'wellness', 'personal care', 'skincare', 'makeup', 'fragrance'],
  },
  {
    id: 'fashion-apparel',
    title: 'Fashion & Apparel',
    keywords: ['fashion', 'apparel', 'clothing'],
  },
  {
    id: 'sneakers-footwear',
    title: 'Sneakers & Footwear',
    keywords: ['sneaker', 'footwear', 'shoe'],
  },
  {
    id: 'home-artisan',
    title: 'Home & Artisan',
    keywords: ['home', 'artisan', 'decor', 'handmade', 'craft'],
  },
  {
    id: 'tech-accessories',
    title: 'Tech Accessories',
    keywords: ['tech', 'accessories', 'electronics', 'gadget', 'phone', 'cable', 'case'],
  },
  {
    id: 'food-culinary',
    title: 'Food & Culinary',
    keywords: ['food', 'culinary', 'spice', 'snack', 'drink', 'beverage', 'sauce', 'ingredient'],
  },
];

function categoryMatchesShelf(category: string | null | undefined, keywords: string[]): boolean {
  const value = category?.toLowerCase().trim();
  if (!value) return false;
  return keywords.some((kw) => value.includes(kw));
}

function withShop(product: Product, shop: Shop): ProductWithShop {
  return {
    ...product,
    shop: { shop_name: shop.shop_name, shop_slug: shop.shop_slug, subscription_tier: shop.subscription_tier },
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
        all.push(withShop(product as Product, shop));
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

  // ── FEATURED HOUSE — the first-ranked shop opens the mall ────────────────
  // shops[] arrives tier-then-review ranked (app/marketplaceData), so the
  // paid placement law (flagship first) still governs who opens the floor.
  // Media is the house's strongest REAL pixels, the hero's historical chain
  // scoped to one shop: a film first, then an Ad Studio still, then any
  // photographed piece, then the house logo. No media at all → the brand
  // plate renders (never an empty dark slab). The tile's `id` keys the
  // playback election, so it stays the film-bearing product's id.
  const featuredHouse = shops[0] ?? null;
  const featuredHouseTile = useMemo<CinematicTileData | null>(() => {
    if (!featuredHouse) return null;
    const film = featuredHouse.products.find((p) => p.ad_video_url) ?? null;
    const still = featuredHouse.products.find((p) => p.ad_hero_image_url) ?? null;
    const photo = featuredHouse.products.find((p) => p.image_urls?.[0] || p.image_url) ?? null;
    const posterUrl =
      film?.ad_hero_image_url ?? film?.image_urls?.[0] ?? film?.image_url ??
      still?.ad_hero_image_url ??
      photo?.image_urls?.[0] ?? photo?.image_url ??
      featuredHouse.logo_url ?? null;
    if (!posterUrl && !film) return null;
    return {
      id: film?.id ?? still?.id ?? photo?.id ?? featuredHouse.id,
      name: featuredHouse.shop_name,
      price: null,
      shopName: featuredHouse.shop_name,
      posterUrl,
      videoUrl: film?.ad_video_url ?? null,
    };
  }, [featuredHouse]);

  // ── THE HOUSES — every ranked shop as a chapter ──────────────────────────
  // The Featured House already opened the page, so the chapters start at the
  // second-ranked shop. A one-house floor still gets a chapter: that is the
  // only place its pieces appear as evidence.
  const houseChapters = shops.length > 1 ? shops.slice(1) : shops;

  // Browse by category — only categories with live products exist on the
  // page (an empty category renders no link anywhere: row or footer). Each
  // link runs the existing semantic search for its title; there are no
  // product shelves to jump to any more.
  const visibleShelves = useMemo(
    () => CATEGORY_SHELVES.filter((shelf) =>
      marketplaceProducts.some((p) => categoryMatchesShelf(p.category, shelf.keywords))
    ),
    [marketplaceProducts]
  );


  // ── Search ──────────────────────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Clear results when the input is emptied so the rails reappear
    if (!value.trim()) {
      setSearchResults(null);
    }
  };

  const handleSearchSubmit = async (query?: string) => {
    const q = (query ?? searchQuery).trim();
    if (!q) return;

    if (query !== undefined) setSearchQuery(q);
    setIsMobileMenuOpen(false);
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

  // ── Card renderers ───────────────────────────────────────────────────────
  const renderProductCard = (product: ProductWithShop, options: { priority?: boolean } = {}) => (
    <MarketplaceProductCard
      product={product}
      stats={reviewStats.get(product.id)}
      priority={options.priority === true}
    />
  );

  // ── Render ────────────────────────────────────────────────────────────────
  // No loading skeleton branch: the server hands this component real rails,
  // so the first frame IS the mall (zero CLS on the initial paint).
  return (
    <div className="min-h-screen bg-mall-bone font-sans text-mall-forest selection:bg-mall-gold/30">

      {/* ═══════════════════════════════════════════════════════
          HEADER — forest ink on every breakpoint
      ═══════════════════════════════════════════════════════ */}
      {/* z-[60]: sits above the z-50 ProductCardXfade toggle chips while cards
          scroll under it. Safe-area padding lives on the WRAPPER, and the wrapper
          paints its own bg so the notch and status-bar strip is never a
          transparent window onto scrolling content in standalone PWA mode
          (viewportFit 'cover' in app/layout.tsx). */}
      <header className="sticky top-0 z-[60] bg-mall-forest pt-[env(safe-area-inset-top)] shadow-[0_1px_0_rgba(0,0,0,0.25)]">

        {/* ── MOBILE HEADER: two-row Amazon-style (hidden on md+) ── */}
        <div className="md:hidden">
          {/* Row 1: Burger | Logo | Cart — 68px */}
          <div className="grid grid-cols-[44px_1fr_44px] items-center px-3 pb-2 pt-3">
            <button
              onClick={() => setIsMobileMenuOpen((o) => !o)}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-mall-bone transition active:bg-white/15"
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X size={22} strokeWidth={1.8} /> : <Menu size={22} strokeWidth={1.8} />}
            </button>

            <div className="flex items-center justify-center">
              {/* /logo.png is a 500×500 canvas whose wordmark occupies only rows
                  193–296 (~21% of the height). Rendering the canvas at 48px left
                  a ~10px wordmark. Crop in CSS instead: a 48px window clips a
                  192px-tall render so the wordmark lands ~40px tall. Header
                  height is unchanged. Replace with a cropped asset post-launch. */}
              <Link href="/" className="flex h-12 flex-shrink-0 items-center overflow-hidden" aria-label="Sanndikaa home">
                <img
                  src="/logo.png"
                  alt="Sanndikaa"
                  className="h-[192px] w-auto max-w-none flex-shrink-0 -translate-y-[2px] brightness-0 invert"
                />
              </Link>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-mall-bone transition active:bg-white/15"
              aria-label="Open cart"
            >
              <ShoppingBag size={22} strokeWidth={1.8} />
              {cartCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-mall-gold px-1 text-[9px] font-bold leading-none text-mall-forest shadow">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>
          </div>

          {/* Row 2: Full-width search bar — 56px */}
          <div className="px-3 pb-3">
            <div className="flex h-11 overflow-hidden rounded-lg bg-mall-ivory shadow-[inset_0_0_0_1px_rgba(27,58,45,0.06)]">
              <label htmlFor="mobile-search" className="flex cursor-text items-center pl-3 text-mall-forest/45">
                <Search size={16} />
              </label>
              <input
                id="mobile-search"
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                placeholder="Search 'summer wedding outfit' or 'glowing skin'..."
                className="flex-1 bg-transparent px-2 text-base text-mall-forest outline-none placeholder:text-mall-forest/40"
              />
              {searchQuery ? (
                <button
                  onClick={clearSearch}
                  className="flex min-w-[44px] items-center justify-center px-3 text-mall-forest/50 hover:text-mall-forest"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              ) : (
                <button
                  onClick={() => handleSearchSubmit()}
                  className="flex min-w-[44px] items-center justify-center bg-mall-gold px-4"
                  aria-label="Search"
                >
                  <Search size={17} className="text-mall-forest" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── DESKTOP HEADER (visible from md+) — 72px ── */}
        <div className="hidden w-full md:block">
          <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-10 py-3">
            {/* Same CSS crop as the mobile logo — see the note there. */}
            <Link href="/" className="flex h-12 flex-shrink-0 items-center overflow-hidden" aria-label="Sanndikaa home">
              <img
                src="/logo.png"
                alt="Sanndikaa"
                className="h-[192px] w-auto max-w-none flex-shrink-0 -translate-y-[2px] brightness-0 invert"
              />
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-mall-bone/70 transition hover:text-mall-bone"
              >
                Seller Login
              </Link>
              <Link
                href="/pricing"
                className="rounded-full bg-mall-gold px-5 py-2 text-sm font-semibold text-mall-forest transition hover:brightness-105"
              >
                Open Boutique
              </Link>
            </div>
            <div className="ml-auto flex h-11 w-full max-w-xl items-center overflow-hidden rounded-full bg-mall-ivory pl-4 pr-1.5 shadow-[inset_0_0_0_1px_rgba(27,58,45,0.06)]">
              <Search size={16} className="flex-shrink-0 text-mall-forest/45" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                placeholder="Search 'summer wedding outfit' or 'glowing skin'..."
                className="w-full bg-transparent px-3 text-base text-mall-forest outline-none placeholder:text-mall-forest/40"
              />
              {searchQuery ? (
                <button
                  onClick={clearSearch}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-mall-forest/50 transition hover:text-mall-forest"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              ) : (
                <button
                  onClick={() => handleSearchSubmit()}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-mall-gold text-mall-forest transition hover:brightness-105"
                  aria-label="Search"
                >
                  <Search size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-mall-bone transition hover:bg-white/10"
              aria-label="Open cart"
            >
              <ShoppingBag size={21} strokeWidth={1.8} />
              {cartCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-mall-gold px-1 text-[10px] font-bold text-mall-forest shadow-sm">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── MOBILE MENU PANEL ── */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out md:hidden ${
            isMobileMenuOpen ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="flex flex-col gap-1 bg-mall-ivory px-4 py-4 shadow-lg">
            <Link
              href="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex min-h-[44px] items-center rounded-xl px-4 text-sm font-medium text-mall-forest transition active:bg-mall-bone"
            >
              Seller Login
            </Link>
            <Link
              href="/pricing"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex min-h-[44px] items-center justify-center rounded-xl bg-mall-forest px-4 text-sm font-semibold text-mall-bone transition active:bg-black"
            >
              Open Your Boutique
            </Link>
            {visibleShelves.length > 0 && (
              <>
                <div className="my-2 border-t border-mall-forest/10" />
                <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-[0.28em] text-mall-gold">
                  Browse
                </p>
                {visibleShelves.map((shelf) => (
                  <button
                    key={shelf.id}
                    onClick={() => handleSearchSubmit(shelf.title)}
                    className="flex min-h-[44px] items-center justify-between rounded-xl px-4 text-left text-sm font-medium text-mall-forest transition active:bg-mall-bone"
                  >
                    {shelf.title}
                    <ArrowRight size={14} className="text-mall-forest/40" aria-hidden />
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════════════════════ */}
      <main className="pb-0" id="category-shelves">
        {/* The page's single <h1> (the logo is an <img>) — visually silent so
            products are the first pixels, still present for SEO + screen readers. */}
        <h1 className="sr-only">Sanndikaa Marketplace &mdash; Africa&apos;s finest boutiques, under one roof.</h1>
        {isSearching ? (

          /* ── SEARCH LOADING — one quiet line, no theatre ── */
          <motion.div
            className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            role="status"
            aria-live="polite"
          >
            <p className="font-serif text-lg text-mall-forest">Searching the houses for &ldquo;{searchQuery}&rdquo;</p>
          </motion.div>
        ) : searchResults !== null ? (

          /* ── SEMANTIC SEARCH RESULTS — the one dense grid on the page ── */
          <div className="animate-in fade-in mx-auto max-w-[1600px] px-4 pb-20 pt-5 duration-300 md:px-10 md:pt-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-mall-gold">
                  {searchRelated ? 'Closest matches' : 'Results'}
                </span>
                <h2 className="mt-1 truncate font-serif text-xl font-semibold tracking-tight text-mall-forest md:text-2xl">
                  Matches for{' '}
                  <span className="text-mall-forest/55">&ldquo;{searchQuery}&rdquo;</span>
                </h2>
              </div>
              <button
                onClick={clearSearch}
                className="flex h-10 flex-shrink-0 items-center gap-1.5 rounded-full bg-mall-ivory px-4 text-xs font-semibold text-mall-forest shadow-sm ring-1 ring-mall-forest/10 transition hover:bg-white"
              >
                <X size={13} aria-hidden /> Clear
              </button>
            </div>

            {searchResults.length === 0 ? (
              <div className={`flex flex-col items-center justify-center rounded-2xl bg-mall-ivory px-4 py-20 text-center ${CARD_SHADOW}`}>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mall-bone text-mall-forest/40">
                  <Search size={22} />
                </div>
                <h3 className="font-serif text-lg font-semibold text-mall-forest">No exact matches found</h3>
                <p className="mt-2 max-w-sm text-sm text-mall-forest/60">
                  Nothing matched that search. Try another, or browse a category.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {visibleShelves.map((shelf) => (
                    <button
                      key={shelf.id}
                      onClick={() => handleSearchSubmit(shelf.title)}
                      className="h-10 rounded-full bg-mall-bone px-4 text-sm font-medium text-mall-forest ring-1 ring-mall-forest/10 transition hover:bg-white"
                    >
                      {shelf.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <p className="mb-4 text-xs text-mall-forest/50">
                  {searchResults.length} item{searchResults.length !== 1 ? 's' : ''} found
                  {searchRelated && ' — no exact category or title matches, showing the closest pieces instead'}
                </p>
                <motion.div
                  className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 md:gap-x-4 lg:grid-cols-5 xl:grid-cols-6"
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

          /* ── THE MALL: hero · The Houses · Browse by category
             PlaybackCoordinator enforces the one-playing-video rule for the
             hero film (and every chapter film Step B adds). */
          <PlaybackCoordinator>
          <div className="pb-2">
            {/* ── FEATURED HOUSE — edge-to-edge, fixed height; the ONE anchor
                enters the resolved storefront (classic → /site → domain). ── */}
            {featuredHouse && featuredHouseTile ? (
              <CinematicTile
                variant="hero"
                data={featuredHouseTile}
                kicker="The Featured House"
                headline={featuredHouse.shop_name}
                ctaLabel="Enter the house"
                href={shopHref(featuredHouse)}
                priority
              />
            ) : (
              /* Brand plate — the floor has nothing photographed yet. Same
                 fixed heights as the hero so the page never reflows. */
              <section className="relative flex h-[188px] w-full items-end overflow-hidden bg-mall-forest px-4 pb-5 sm:h-[232px] md:h-[300px] md:px-10 md:pb-8 lg:h-[340px]">
                <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full bg-mall-gold/15 blur-3xl" />
                <div className="relative">
                  <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-mall-gold">Sanndikaa</p>
                  <p className="mt-2 max-w-md font-serif text-2xl font-semibold leading-tight text-mall-bone md:text-4xl">
                    Africa&apos;s finest boutiques, under one roof.
                  </p>
                </div>
              </section>
            )}

            {/* ── THE HOUSES — one editorial chapter per ranked shop, with
                1–3 pieces as evidence (MarketplaceBoutiqueCard). ── */}
            {shops.length === 0 ? (
              /* Curation, never an apology: the empty boutique floor is a
                 designed invitation (conversion surface, Law 1). */
              <section className="px-4 py-6 md:px-10 md:py-10">
                <div className={`flex flex-col items-center justify-center rounded-2xl bg-mall-ivory px-6 py-14 text-center ${CARD_SHADOW}`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-mall-gold">Opening Soon</p>
                  <h2 className="mt-3 max-w-md font-serif text-xl font-semibold text-mall-forest md:text-2xl">
                    The first boutiques are being fitted. Yours could open the floor.
                  </h2>
                  <Link
                    href="/pricing"
                    className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-mall-forest px-7 text-sm font-semibold text-mall-bone transition hover:bg-black"
                  >
                    Open your boutique <ArrowRight size={14} aria-hidden />
                  </Link>
                </div>
              </section>
            ) : (
              <section id="the-houses" aria-label="The Houses" className="px-4 pt-10 pb-6 md:px-10 md:pt-16 md:pb-10">
                <h2 className="font-serif text-3xl font-semibold tracking-tight text-mall-forest text-balance md:text-4xl">
                  The Houses
                </h2>
                <div className="mx-auto mt-8 flex max-w-2xl flex-col gap-12 md:mt-12 md:gap-16">
                  {houseChapters.map((shop, index) => (
                    <MarketplaceBoutiqueCard key={shop.id} shop={shop} href={shopHref(shop)} number={index + 1} />
                  ))}
                </div>
              </section>
            )}

            {/* ── BROWSE BY CATEGORY — one compact text-link row; each link
                runs the existing search for its category. ── */}
            {visibleShelves.length > 0 && (
              <nav aria-label="Browse by category" className="px-4 pb-10 md:px-10 md:pb-16">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-mall-gold">Browse by category</p>
                <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                  {visibleShelves.map((shelf) => (
                    <li key={shelf.id}>
                      <button
                        type="button"
                        onClick={() => handleSearchSubmit(shelf.title)}
                        className="relative py-2 text-sm font-medium text-mall-forest underline-offset-4 transition hover:underline before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']"
                      >
                        {shelf.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
          </PlaybackCoordinator>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════ */}
      <footer className="bg-mall-ivory pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-10">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-4">

            <div className="col-span-2 lg:col-span-2">
              <Link href="/" aria-label="Sanndikaa home">
                <img src="/logo.png" alt="Sanndikaa" className="h-12 w-auto flex-shrink-0 object-contain" />
              </Link>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-mall-forest/65">
                Where African design meets global discovery. A premium marketplace connecting buyers with Africa&apos;s finest boutiques.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg bg-mall-bone px-3 py-1.5 text-[10px] font-semibold text-mall-forest/80">
                  <Shield size={11} className="text-mall-gold" aria-hidden /> Secure Checkout
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-mall-bone px-3 py-1.5 text-[10px] font-semibold text-mall-forest/80">
                  <MessageCircle size={11} className="text-mall-gold" aria-hidden /> Direct WhatsApp Checkout
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-mall-forest">Shop</h4>
              <ul className="space-y-3">
                <li>
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="text-sm text-mall-forest/60 transition hover:text-mall-forest"
                  >
                    Homepage
                  </button>
                </li>
                {visibleShelves.map((shelf) => (
                  <li key={shelf.id}>
                    <button
                      onClick={() => handleSearchSubmit(shelf.title)}
                      className="text-left text-sm text-mall-forest/60 transition hover:text-mall-forest"
                    >
                      {shelf.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-mall-forest">Sell</h4>
              <ul className="space-y-3">
                <li><Link href="/sell" className="text-sm text-mall-forest/60 transition hover:text-mall-forest">Why Sell on Sanndikaa</Link></li>
                <li><Link href="/pricing" className="text-sm text-mall-forest/60 transition hover:text-mall-forest">Open Boutique</Link></li>
                <li><Link href="/login" className="text-sm text-mall-forest/60 transition hover:text-mall-forest">Seller Login</Link></li>
                <li><Link href="/pricing" className="text-sm text-mall-forest/60 transition hover:text-mall-forest">Pricing &amp; Plans</Link></li>
                <li><Link href="/dashboard" className="text-sm text-mall-forest/60 transition hover:text-mall-forest">Seller Dashboard</Link></li>
              </ul>
            </div>

            {/* Support column (Help Center · How Ordering Works · Contact Us)
                is suppressed until those routes exist — no dead navigation
                paths ship to the public floor. Launch Hardening P0. */}

          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-mall-forest/10 pt-6 md:flex-row">
            <p className="text-xs text-mall-forest/50">
              © {new Date().getFullYear()} Sanndikaa. All rights reserved.
            </p>
            <div className="flex items-center gap-5">
              <Link href="/legal/privacy" className="text-xs text-mall-forest/50 transition hover:text-mall-forest">Privacy Policy</Link>
              <Link href="/legal/terms" className="text-xs text-mall-forest/50 transition hover:text-mall-forest">Terms of Service</Link>
              <Link href="/legal/cookies" className="text-xs text-mall-forest/50 transition hover:text-mall-forest">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
