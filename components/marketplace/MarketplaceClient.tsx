'use client';

import { useMemo, useRef, useState } from 'react';
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
import MarketplaceProductCard, {
  CARD_SHADOW,
  RAIL_CARD_WIDTH,
  type RailProduct,
} from '@/components/marketplace/MarketplaceProductCard';
import RailSection, { type RailItem } from '@/components/marketplace/RailSection';
import { tierFamily } from '@/components/marketplace/format';
import { SaleBadge } from '@/components/SaleBadge';
import {
  compareTierThenReviewScore,
  getTierRank,
  reviewScoreOf,
  type ReviewStats,
} from '@/lib/feedRanking';
import { saleOf } from '@/lib/pricing';
import { fetchJSON } from '@/lib/transport';
import type { Product } from '@/lib/types';
import type { MarketplaceShop, ReviewScoreEntry } from '@/app/marketplaceData';

// ─────────────────────────────────────────────────────────────────────────────
// MarketplaceClient — the mall's interactive shell (Amazon-mobile density,
// luxury finish).
//
// app/page.tsx is a SERVER component: it runs the bounded cached reads
// (app/marketplaceData.ts — shops ≤40, products ≤96 lean, review aggregates
// over a 5k window, all unstable_cache'd under the 'marketplace' tag) and
// hands the RANKED result here as props. Nothing in this file fetches feed
// data: every surface below is a pure re-slicing of that one payload —
//
//   header (forest, two-row on mobile: burger · logo · cart / search)
//   browse chips      — horizontal snap rail of jump targets (rails + categories)
//   HERO              — edge-to-edge featured banner, fixed heights (188→340px)
//   trust marquee     — one thin ivory line
//   DISCOVERY RAILS   — "Trending Today" (or the honest "Top Picks"),
//                       "New Store Drops", "Featured Flagships"
//   CATEGORY SHELVES  — one rail per populated category, a double-width
//                       cinematic feature tile in slot 0 when a film exists,
//                       cadence-capped full-bleed interludes between them
//   BOUTIQUE RAIL     — compact boutique cards (logo · tier · 3 thumbs · Visit)
//   newsletter · footer
//
// Every rail is a scroll-snap track (CarouselTrack via RailSection): no
// vertical grid anywhere on the home surface — the only grid left is the
// search-results view, where a dense 2-up grid IS the right scan pattern.
// The first paint is real server HTML with the hero + first rail above the
// fold on 2G, zero CLS (fixed hero heights, fixed card widths, fixed media
// aspects). Interactivity — semantic search, playback election, storefront
// link upgrades, cart — is unchanged in behavior.
// ─────────────────────────────────────────────────────────────────────────────

type Shop = MarketplaceShop;
type ProductWithShop = RailProduct;

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

type DiscoveryRail = {
  id: string;
  kicker: string;
  title: string;
  description: string;
  products: ProductWithShop[];
};

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

// ── Layout constants ──────────────────────────────────────────────────────────
// Discovery rails are capped so a single prolific seller can't turn a feed
// into a wall; the category shelves below still carry every product.
const RAIL_LIMIT = 12;
// "Trending Today" is a claim — it needs at least this many REVIEWED pieces
// behind it, otherwise the lead rail labels itself "Top Picks" honestly.
const MIN_TRENDING_REVIEWED = 2;
// LCP budget: the leading cards of the topmost rail carry Next/Image
// `priority` (preload + fetchpriority=high) alongside the hero poster.
const LCP_PRIORITY_CARDS = 2;

// ── Cinematic curation ────────────────────────────────────────────────────────
// CADENCE CAP (enforced in code, not taste): at most ONE interlude banner per
// INTERLUDE_EVERY_N_SHELVES category shelves — two shelves ≈ one viewport of
// content — and at most ONE feature tile per shelf (the selector takes only
// the first film-bearing product per shelf). The hero consumes the top
// candidate FIRST so it never reappears as the first shelf's feature tile.
const INTERLUDE_EVERY_N_SHELVES = 2;

// The mobile menu drawer collapses via a `duration-300` max-height transition
// (see MOBILE MENU PANEL). Category jumps wait this long before scrolling so
// the target is measured AFTER the drawer has released its layout height.
const MOBILE_MENU_COLLAPSE_MS = 300;

// scroll-mt clears the sticky header on jumps with breathing room so a rail
// heading is never covered or clipped: mobile header is 124px (68px logo row +
// 56px search row) plus the safe-area inset → 9rem (144px) + inset; desktop
// header is 72px → 6rem (96px).
const SECTION_SCROLL_MT = 'scroll-mt-[calc(9rem_+_env(safe-area-inset-top))] md:scroll-mt-24';

// Feature tile = two cards + one gap wide, so the shelf row stays continuous.
const FEATURE_TILE_WIDTH = 'w-[312px] sm:w-[348px] md:w-[384px] lg:w-[416px]';
const BOUTIQUE_CARD_WIDTH = 'w-[264px] sm:w-[300px]';

function toCinematicTile(p: ProductWithShop, withVideo: boolean): CinematicTileData {
  return {
    id: p.id,
    name: p.name,
    price: p.price ?? null,
    shopName: p.shop?.shop_name || 'Sanndikaa boutique',
    // The seller's best pixels: Ad Studio hero still first, then the photo.
    // (image_url IS image_urls[0] by the insert contract, so the fallback
    // chain renders the same pixel whether or not the feed carried the array.)
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

  // ── HERO — the top-ranked product with the richest media ─────────────────
  // Film first (the living banner), then an Ad Studio hero still, then any
  // photographed piece. marketplaceProducts is tier-ranked, so the paid
  // placement law (flagship first) governs who opens the mall. null → the
  // brand plate renders instead (never an empty dark slab).
  const hero = useMemo<ProductWithShop | null>(
    () =>
      marketplaceProducts.find((p) => p.ad_video_url) ??
      marketplaceProducts.find((p) => p.ad_hero_image_url) ??
      marketplaceProducts.find((p) => p.image_urls?.[0] || p.image_url) ??
      null,
    [marketplaceProducts]
  );

  // ── DISCOVERY RAILS — pure re-slices of the ranked payload ───────────────
  const discoveryRails = useMemo<DiscoveryRail[]>(() => {
    if (marketplaceProducts.length === 0) return [];
    const rails: DiscoveryRail[] = [];

    // 1. Trending Today. Reviewed pieces lead, unreviewed fill; BOTH
    //    partitions keep the canonical tier-then-score order, so a paid tier
    //    is never outranked inside the rail (lib/feedRanking law). The hero
    //    product is skipped here only — it already opens the page directly
    //    above this rail. Fewer than MIN_TRENDING_REVIEWED reviewed pieces →
    //    the rail is "Top Picks": no trend claim a buyer never made.
    const pool = hero ? marketplaceProducts.filter((p) => p.id !== hero.id) : marketplaceProducts;
    const reviewed = pool.filter((p) => (reviewStats.get(p.id)?.count ?? 0) > 0);
    const unreviewed = pool.filter((p) => (reviewStats.get(p.id)?.count ?? 0) === 0);
    const lead = [...reviewed, ...unreviewed].slice(0, RAIL_LIMIT);
    if (lead.length > 0) {
      rails.push(
        reviewed.length >= MIN_TRENDING_REVIEWED
          ? {
              id: 'trending-today',
              kicker: 'Most loved right now',
              title: 'Trending Today',
              description: 'The pieces buyers are rating highest across the floor.',
              products: lead,
            }
          : {
              id: 'top-picks',
              kicker: 'Curated from the floor',
              title: 'Top Picks',
              description: 'Leading pieces from our highest-ranked boutiques.',
              products: lead,
            }
      );
    }

    // 2. New Store Drops. Each boutique's list arrives newest-first
    //    (app/marketplaceData reads products created_at DESC and groups in
    //    order), so a round-robin over the RANKED shops yields every
    //    boutique's latest listing before anyone's second — one prolific
    //    seller never monopolises the rail.
    const drops: ProductWithShop[] = [];
    const depth = shops.reduce((max, shop) => Math.max(max, shop.products.length), 0);
    outer: for (let i = 0; i < depth; i++) {
      for (const shop of shops) {
        const product = shop.products[i];
        if (!product) continue;
        drops.push(withShop(product, shop));
        if (drops.length >= RAIL_LIMIT) break outer;
      }
    }
    if (drops.length >= 2) {
      rails.push({
        id: 'new-store-drops',
        kicker: 'Fresh on the floor',
        title: 'New Store Drops',
        description: 'The newest listing from every boutique, flagships first.',
        products: drops,
      });
    }

    // 3. Featured Flagships — the gold family (flagship + legacy advanced),
    //    already first in the ranked order. Absent entirely when no paid
    //    tier is live: the rail is a placement, never a placeholder.
    const flagships = marketplaceProducts
      .filter((p) => tierFamily(p.shop?.subscription_tier) === 'featured')
      .slice(0, RAIL_LIMIT);
    if (flagships.length > 0) {
      rails.push({
        id: 'featured-flagships',
        kicker: 'Flagship boutiques',
        title: 'Featured Flagships',
        description: 'Pieces from the boutiques leading the Sanndikaa floor.',
        products: flagships,
      });
    }

    return rails;
  }, [marketplaceProducts, reviewStats, shops, hero]);

  // Only shelves with live products exist on the page. An empty category
  // renders NOTHING — no section, no placeholder boutique cards — and is
  // likewise absent from every category nav (drawer, chips, footer) so a
  // jump never targets a section that isn't in the DOM.
  const visibleShelves = useMemo(
    () => CATEGORY_SHELVES
      .map((shelf) => ({
        ...shelf,
        products: marketplaceProducts.filter((p) => categoryMatchesShelf(p.category, shelf.keywords)),
      }))
      .filter((shelf) => shelf.products.length > 0),
    [marketplaceProducts]
  );

  // Cinematic curation — tier-ranked by construction (marketplaceProducts is
  // already flagship/advanced-first). One pass assigns every living slot so a
  // product never appears in two curation surfaces at once:
  //   0. the hero (already chosen above) is marked used;
  //   1. feature tiles: first film-bearing product per shelf (max 1/section);
  //   2. interludes: cadence-capped queue between VISIBLE shelves — films
  //      first, still-life editions (ad hero stills) fill when no film remains.
  const curation = useMemo(() => {
    const used = new Set<string>();
    if (hero) used.add(hero.id);

    const featureByShelf = new Map<string, ProductWithShop>();
    for (const shelf of visibleShelves) {
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
    visibleShelves.forEach((_, i) => {
      if ((i + 1) % INTERLUDE_EVERY_N_SHELVES !== 0) return;
      const pick = next();
      if (pick) interludeByIndex.set(i, pick);
    });

    return { featureByShelf, interludeByIndex };
  }, [visibleShelves, marketplaceProducts, hero]);

  // Browse chips: every jump target on the page, rails first, in page order.
  const browseChips = useMemo(
    () => [
      ...discoveryRails.map((rail) => ({ id: rail.id, label: rail.title })),
      ...visibleShelves.map((shelf) => ({ id: shelf.id, label: shelf.title })),
    ],
    [discoveryRails, visibleShelves]
  );

  // Pending jump timer — a second tap cancels the first so two smooth
  // scrolls never fight over the viewport.
  const jumpTimerRef = useRef<number | null>(null);

  const handleCategoryJump = (sectionId: string) => {
    // Captured BEFORE the state update: the drawer is about to collapse, and
    // its 300ms max-height transition shifts everything below the header.
    const drawerWasOpen = isMobileMenuOpen;

    setSearchQuery('');
    setIsSearching(false);
    setSearchResults(null);
    setSearchRelated(false);
    setIsMobileMenuOpen(false); // close immediately — never wait on the scroll

    if (typeof window === 'undefined') return;
    if (jumpTimerRef.current !== null) window.clearTimeout(jumpTimerRef.current);

    // Wait for layout to settle before measuring the target: the full drawer
    // collapse when it was open (plus one frame of slack), otherwise just the
    // next frame so React has committed the shelves (e.g. after clearing a
    // search). Measuring mid-collapse is what produced the overshoot.
    const settleMs = drawerWasOpen ? MOBILE_MENU_COLLAPSE_MS + 50 : 0;
    jumpTimerRef.current = window.setTimeout(() => {
      jumpTimerRef.current = null;
      window.requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }, settleMs);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Clear results when the input is emptied so the rails reappear
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

  // ── Card renderers ───────────────────────────────────────────────────────
  const renderProductCard = (product: ProductWithShop, options: { priority?: boolean } = {}) => (
    <MarketplaceProductCard
      product={product}
      stats={reviewStats.get(product.id)}
      priority={options.priority === true}
    />
  );

  const railItems = (railId: string, products: ProductWithShop[], priorityCount = 0): RailItem[] =>
    products.map((product, index) => ({
      key: `${railId}-${product.id}-${product.shop.shop_slug}`,
      node: (
        <div className={RAIL_CARD_WIDTH}>
          {renderProductCard(product, { priority: index < priorityCount })}
        </div>
      ),
    }));

  // Boutique card — logo · name · tier mark · count · Visit, then the three
  // newest pieces as square thumbs. Whole card is an ivory plate on the bone
  // canvas; tier is a mark next to the name, never an outline.
  const renderBoutiqueCard = (shop: Shop) => {
    const family = tierFamily(shop.subscription_tier);
    const thumbs = shop.products.slice(0, 3);
    return (
      <article className={`flex h-full flex-col rounded-xl bg-mall-ivory p-3 ${CARD_SHADOW}`}>
        <div className="flex items-center gap-2.5">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-mall-bone ring-1 ring-mall-forest/10">
            {shop.logo_url ? (
              <SmartImage
                src={shop.logo_url}
                alt={shop.shop_name}
                fill
                blurTone="none"
                className="object-cover"
                sizes="36px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-mall-forest/30">
                <Store size={15} strokeWidth={1.75} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-1 text-[13px] font-semibold leading-tight text-mall-forest">
              <span className="truncate">{shop.shop_name}</span>
              {family === 'featured' && <BadgeCheck size={13} className="shrink-0 text-mall-gold" aria-label="Featured boutique" />}
              {family === 'pro' && <BadgeCheck size={13} className="shrink-0 text-mall-sage" aria-label="Pro boutique" />}
            </h3>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mall-forest/50">
              {shop.products.length} piece{shop.products.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href={shopHref(shop)}
            className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-[11px] font-bold uppercase tracking-[0.12em] transition ${
              family === 'featured'
                ? 'bg-mall-gold text-mall-forest hover:brightness-105'
                : 'bg-mall-forest text-mall-bone hover:bg-black'
            }`}
          >
            Visit <ArrowRight size={11} aria-hidden />
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {thumbs.map((product) => {
            const imgUrl = product.image_urls?.[0] || product.image_url || null;
            const sale = saleOf(product.price, product.compare_at_price);
            return (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                aria-label={product.name}
                className="group/thumb relative aspect-square overflow-hidden rounded-md bg-mall-bone"
              >
                {imgUrl ? (
                  <SmartImage
                    src={imgUrl}
                    alt=""
                    fill
                    blurTone="none"
                    className="object-cover transition-transform duration-700 ease-out group-hover/thumb:scale-[1.05]"
                    sizes="(max-width: 640px) 80px, 92px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-mall-forest/20">
                    <ShoppingBag size={16} strokeWidth={1.5} />
                  </div>
                )}
                {sale && <SaleBadge className="absolute left-1 top-1 z-[2]" />}
              </Link>
            );
          })}
        </div>
      </article>
    );
  };

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
              <Link href="/" className="flex-shrink-0" aria-label="Sanndikaa home">
                <img
                  src="/logo.png"
                  alt="Sanndikaa"
                  className="h-12 w-auto flex-shrink-0 object-contain brightness-0 invert"
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
                  onClick={handleSearchSubmit}
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
            <Link href="/" className="flex-shrink-0" aria-label="Sanndikaa home">
              <img
                src="/logo.png"
                alt="Sanndikaa"
                className="h-12 w-auto flex-shrink-0 object-contain brightness-0 invert"
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
                  onClick={handleSearchSubmit}
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
            {browseChips.length > 0 && (
              <>
                <div className="my-2 border-t border-mall-forest/10" />
                <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-[0.28em] text-mall-gold">
                  Browse
                </p>
                {browseChips.map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => handleCategoryJump(chip.id)}
                    className="flex min-h-[44px] items-center justify-between rounded-xl px-4 text-left text-sm font-medium text-mall-forest transition active:bg-mall-bone"
                  >
                    {chip.label}
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

          /* ── AI LOADING STATE ────────────────────────────── */
          <motion.div
            className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <div className="relative mb-6 flex h-16 w-16 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mall-forest/20" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-mall-forest text-mall-gold shadow-lg">
                <Sparkles size={22} />
              </div>
            </div>
            <h2 className="font-serif text-lg font-semibold text-mall-forest">Your Personal Stylist is curating matches...</h2>
            <p className="mt-2 text-sm text-mall-forest/60">Searching across every boutique for &ldquo;{searchQuery}&rdquo;</p>
            <div className="mt-6 flex items-center gap-1.5">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-2 w-2 animate-bounce rounded-full bg-mall-forest/40"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </motion.div>

        ) : searchResults !== null ? (

          /* ── SEMANTIC SEARCH RESULTS — the one dense grid on the page ── */
          <div className="animate-in fade-in mx-auto max-w-[1600px] px-4 pb-20 pt-5 duration-300 md:px-10 md:pt-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-mall-gold" aria-hidden />
                  <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-mall-gold">
                    {searchRelated ? 'AI Stylist — Closest Matches' : 'Marketplace Results'}
                  </span>
                </div>
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
                  We couldn&apos;t find an exact match for that vibe. Try another search, or browse a feed below.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {browseChips.map((chip) => (
                    <button
                      key={chip.id}
                      onClick={() => handleCategoryJump(chip.id)}
                      className="h-10 rounded-full bg-mall-bone px-4 text-sm font-medium text-mall-forest ring-1 ring-mall-forest/10 transition hover:bg-white"
                    >
                      {chip.label}
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

          /* ── THE MALL: chips · hero · marquee · rails · shelves · boutiques
             PlaybackCoordinator enforces the one-playing-video rule across
             the hero, every interlude, and every feature tile below. */
          <PlaybackCoordinator>
          <div className="pb-2">

            {/* ── BROWSE CHIPS — jump rail, 36px pills with a ≥44px hit area ── */}
            {browseChips.length > 0 && (
              <nav aria-label="Browse the mall" className="hide-scrollbar flex snap-x gap-2 overflow-x-auto px-4 py-2.5 scroll-px-4 md:px-10 md:py-3 md:scroll-px-10">
                {browseChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => handleCategoryJump(chip.id)}
                    className="relative h-9 shrink-0 snap-start whitespace-nowrap rounded-full bg-mall-ivory px-3.5 text-[12px] font-semibold text-mall-forest shadow-[0_1px_2px_rgba(27,58,45,0.08)] ring-1 ring-mall-forest/[0.08] transition active:bg-mall-forest active:text-mall-bone before:absolute before:-inset-y-2 before:inset-x-0 before:content-['']"
                  >
                    {chip.label}
                  </button>
                ))}
                <div aria-hidden className="w-1 shrink-0 md:w-4" />
              </nav>
            )}

            {/* ── HERO — edge-to-edge, fixed height, the top-ranked living piece ── */}
            {hero ? (
              <CinematicTile variant="hero" data={toCinematicTile(hero, true)} kicker="Featured drop" priority />
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

            {/* ── TRUST MARQUEE — every claim feature-verified (Pillar 3) ── */}
            <MarketplaceMarquee />

            {/* ── DISCOVERY RAILS ── */}
            {discoveryRails.map((rail, railIndex) => (
              <RailSection
                key={rail.id}
                id={rail.id}
                kicker={rail.kicker}
                title={rail.title}
                description={rail.description}
                ariaLabel={rail.title}
                className={SECTION_SCROLL_MT}
                paddingClassName={railIndex === 0 ? 'pt-5 pb-3 md:pt-7 md:pb-4' : 'py-3 md:py-4'}
                items={railItems(rail.id, rail.products, railIndex === 0 ? LCP_PRIORITY_CARDS : 0)}
              />
            ))}

            {/* ── CATEGORY SHELVES + CINEMATIC CURATION ──
                visibleShelves is pre-filtered to products.length > 0: an empty
                category renders no section and no placeholder cards. */}
            {visibleShelves.map((shelf, shelfIndex) => {
              const featured = curation.featureByShelf.get(shelf.id) ?? null;
              const shelfProducts = featured
                ? shelf.products.filter((p) => p.id !== featured.id)
                : shelf.products;
              const interlude = curation.interludeByIndex.get(shelfIndex) ?? null;
              const items: RailItem[] = [
                // Feature tile — max ONE per shelf (cadence cap): double-width,
                // same card anatomy, living media box, carousel slot 0.
                ...(featured
                  ? [{
                      key: `${shelf.id}-feature-${featured.id}`,
                      node: (
                        <div className={FEATURE_TILE_WIDTH}>
                          <CinematicTile variant="feature" data={toCinematicTile(featured, true)} />
                        </div>
                      ),
                    }]
                  : []),
                ...railItems(shelf.id, shelfProducts),
              ];
              return (
                <div key={shelf.id}>
                  <RailSection
                    id={shelf.id}
                    title={shelf.title}
                    description={shelf.description}
                    ariaLabel={shelf.title}
                    className={SECTION_SCROLL_MT}
                    paddingClassName="py-3 md:py-4"
                    trailing={
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mall-forest/45 tabular-nums">
                        {shelf.products.length} piece{shelf.products.length !== 1 ? 's' : ''}
                      </span>
                    }
                    items={items}
                  />

                  {/* Full-bleed interlude — cadence-capped to one per
                      ~viewport of shelf content (every second visible shelf). */}
                  {interlude && (
                    <div className="py-3 md:py-5">
                      <CinematicTile variant="interlude" data={toCinematicTile(interlude, true)} />
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── SHOP BY BOUTIQUE ── */}
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
              <RailSection
                id="shop-by-boutique"
                kicker="Independent sellers"
                title="Shop by Boutique"
                description="Discover curated boutiques from independent sellers."
                ariaLabel="Boutiques"
                className={SECTION_SCROLL_MT}
                paddingClassName="pt-4 pb-6 md:pt-6 md:pb-10"
                items={shops.map((shop) => ({
                  key: shop.id,
                  node: <div className={`${BOUTIQUE_CARD_WIDTH} h-full`}>{renderBoutiqueCard(shop)}</div>,
                }))}
              />
            )}

          </div>
          </PlaybackCoordinator>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════
          NEWSLETTER
      ═══════════════════════════════════════════════════════ */}
      <section className="bg-mall-forest">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-10">
          <div className="mx-auto max-w-xl text-center">
            <div className="mb-3 flex items-center justify-center">
              <Mail size={22} className="text-mall-gold" aria-hidden />
            </div>
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-mall-bone">Stay in the loop</h2>
            <p className="mt-2 text-sm text-mall-bone/60">
              New boutiques, exclusive drops, and curated edits — straight to your inbox.
            </p>
            {newsletterSubmitted ? (
              <div
                role="status"
                aria-live="polite"
                className="mt-6 rounded-2xl bg-white/10 px-6 py-4 text-sm font-medium text-mall-bone"
              >
                ✓ Subscribed successfully. Welcome to the Sanndikaa community.
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newsletterEmail.trim()) return;
                  setNewsletterEmail('');
                  setNewsletterSubmitted(true);
                }}
                className="mt-6 flex w-full flex-col gap-3 sm:flex-row"
              >
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="h-12 w-full rounded-full bg-white/10 px-5 text-base font-medium text-mall-bone outline-none ring-1 ring-white/10 transition placeholder:text-mall-bone/40 focus:ring-mall-gold/60"
                />
                <button
                  type="submit"
                  className="h-12 whitespace-nowrap rounded-full bg-mall-gold px-7 text-sm font-semibold text-mall-forest transition hover:brightness-105"
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
      <footer className="bg-mall-ivory pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-10">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-4 lg:grid-cols-5">

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
                {browseChips.map((chip) => (
                  <li key={chip.id}>
                    <button
                      onClick={() => handleCategoryJump(chip.id)}
                      className="text-left text-sm text-mall-forest/60 transition hover:text-mall-forest"
                    >
                      {chip.label}
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

            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-mall-forest">Support</h4>
              <ul className="space-y-3">
                <li><Link href="/support" className="text-sm text-mall-forest/60 transition hover:text-mall-forest">Help Center</Link></li>
                <li><Link href="/support/how-ordering-works" className="text-sm text-mall-forest/60 transition hover:text-mall-forest">How Ordering Works</Link></li>
                <li><Link href="/contact" className="text-sm text-mall-forest/60 transition hover:text-mall-forest">Contact Us</Link></li>
              </ul>
            </div>

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
