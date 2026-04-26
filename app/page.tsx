'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight, Search, ShoppingBag, Sparkles, Store, X, Menu,
  BadgeCheck, Shield, Truck, RotateCcw, Award, Mail,
} from 'lucide-react';
import { useCart } from '../components/CartProvider';
import type { Product } from '@/lib/types';

type Shop = {
  id: string;
  shop_name: string;
  shop_slug: string;
  logo_url: string | null;
  theme_color: string | null;
  subscription_tier: string;
  status?: string;
  products: Product[];
};

const WORLDS = [
  'All', 'Fashion', 'Sneakers', 'Beauty & Wellness',
  'Home & Artisan', 'Tech Accessories', 'Food & Culinary',
];

type ProductWithShop = Product & {
  shop: {
    shop_name: string;
    shop_slug: string;
    subscription_tier: string;
  };
};

const TIER_RANK = { advanced: 3, pro: 2, starter: 1 } as const;

function getTierRank(tier?: string): number {
  return TIER_RANK[(tier?.toLowerCase().trim() as keyof typeof TIER_RANK)] || 1;
}

function ProductCardSkeleton() {
  return (
    <div className="flex flex-col animate-pulse">
      <div className="aspect-[4/5] rounded-2xl bg-gray-200" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-3/4 rounded-full bg-gray-200" />
        <div className="h-3 w-1/3 rounded-full bg-gray-200" />
        <div className="h-3 w-1/2 rounded-full bg-gray-200" />
      </div>
    </div>
  );
}

export default function GlobalHomepage() {
  const [activeWorld, setActiveWorld] = useState('All');
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);
  const [isAnnouncementVisible, setIsAnnouncementVisible] = useState(true);

  const { cartCount, setIsCartOpen } = useCart();

  // ─── SUPABASE CLIENT ─── unchanged
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ─── DATA FETCH ─── unchanged
  useEffect(() => {
    async function fetchCuratedMall() {
      const { data, error } = await supabase
        .from('shops')
        .select(`id, shop_name, shop_slug, logo_url, theme_color, subscription_tier, status, products (id, name, price, image_url, image_urls, category)`)
        .eq('status', 'active');

      if (!error && data) {
        const activeShops = (data as unknown as Shop[]).filter(
          (shop) => shop.products && shop.products.length > 0
        );
        const sortedShops = activeShops.sort(
          (a, b) => getTierRank(b.subscription_tier) - getTierRank(a.subscription_tier)
        );
        setShops(sortedShops);
      }
      setLoading(false);
    }
    fetchCuratedMall();
  }, [supabase]);

  // ─── FILTER LOGIC ─── unchanged
  const displayedShops = useMemo(() => {
    if (activeWorld === 'All') return shops;
    const searchKey = activeWorld.split(' ')[0].toLowerCase();
    return shops
      .map((shop) => ({
        ...shop,
        products: shop.products.filter(
          (p) => p.category && p.category.toLowerCase().includes(searchKey)
        ),
      }))
      .filter((shop) => shop.products.length > 0);
  }, [shops, activeWorld]);

  // ─── SEARCH LOGIC ─── unchanged
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const allProducts: Product[] = [];
    shops.forEach((shop) => {
      shop.products.forEach((product) => {
        if (
          product.name.toLowerCase().includes(query) ||
          (product.category && product.category.toLowerCase().includes(query)) ||
          shop.shop_name.toLowerCase().includes(query)
        ) {
          allProducts.push({
            ...product,
            shop: { shop_name: shop.shop_name, shop_slug: shop.shop_slug, subscription_tier: shop.subscription_tier },
          } as any);
        }
      });
    });
    return allProducts.sort(
      (a, b) => getTierRank((b as any).shop?.subscription_tier) - getTierRank((a as any).shop?.subscription_tier)
    );
  }, [shops, searchQuery]);

  const marketplaceProducts = useMemo(() => {
    const allProducts: ProductWithShop[] = [];
    displayedShops.forEach((shop) => {
      shop.products.forEach((product) => {
        allProducts.push({
          ...(product as Product),
          shop: { shop_name: shop.shop_name, shop_slug: shop.shop_slug, subscription_tier: shop.subscription_tier },
        } as ProductWithShop);
      });
    });
    return allProducts.sort(
      (a, b) => getTierRank(b.shop?.subscription_tier) - getTierRank(a.shop?.subscription_tier)
    );
  }, [displayedShops]);

  const spotlightProduct = useMemo(() => {
    const topShop = shops[0];
    if (!topShop) return null;
    const topProduct = topShop.products.find(
      (p) => p.image_url || (p.image_urls && p.image_urls.length > 0)
    );
    if (!topProduct) return null;
    return {
      ...topProduct,
      shop: { shop_name: topShop.shop_name, shop_slug: topShop.shop_slug, subscription_tier: topShop.subscription_tier },
    } as ProductWithShop;
  }, [shops]);

  const totalProducts = useMemo(
    () => shops.reduce((acc, shop) => acc + shop.products.length, 0),
    [shops]
  );

  // ─── PRODUCT CARD ───
  const renderProductCard = (product: ProductWithShop) => {
    const imgUrl = product.image_urls?.[0] || product.image_url;
    const tier = (product.shop?.subscription_tier || 'starter').toLowerCase().trim();
    const isAdvanced = tier === 'advanced';
    const isPro = tier === 'pro';

    return (
      <Link
        href={`/product/${product.id}`}
        key={`${product.id}-${product.shop?.shop_slug || 'shop'}`}
        className="group flex flex-col"
      >
        <div className={`relative aspect-[4/5] overflow-hidden rounded-2xl border bg-neutral-100 ${isAdvanced ? 'border-yellow-300' : isPro ? 'border-purple-300' : 'border-black/5'}`}>
          {imgUrl ? (
            <Image
              src={imgUrl}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-300">
              <ShoppingBag size={22} />
            </div>
          )}

          {(isAdvanced || isPro) && (
            <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 shadow-sm backdrop-blur text-[10px] font-semibold">
              {isAdvanced ? (
                <><BadgeCheck size={11} className="text-yellow-500" /><span className="text-yellow-700">Featured</span></>
              ) : (
                <><BadgeCheck size={11} className="text-purple-500" /><span className="text-purple-700">Pro Seller</span></>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 space-y-0.5">
          <h4 className="truncate text-sm font-medium text-gray-900 group-hover:underline">{product.name}</h4>
          <p className="text-sm font-semibold text-gray-900">D{product.price}</p>
          <p className="truncate text-xs font-medium text-gray-500">{product.shop?.shop_name}</p>
        </div>
      </Link>
    );
  };

  // ─── SKELETON LOADER ───
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 font-sans text-gray-900">
        <div className="h-10 w-full bg-[#1a2e1a]" />
        <div className="h-[72px] w-full border-b border-black/5 bg-white" />
        <div className="border-b border-black/5 bg-white">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 md:grid-cols-2 md:px-10 md:py-12 animate-pulse">
            <div className="space-y-4">
              <div className="h-4 w-40 rounded-full bg-gray-200" />
              <div className="h-12 w-4/5 rounded-xl bg-gray-200" />
              <div className="h-4 w-3/5 rounded-full bg-gray-200" />
              <div className="h-12 w-full rounded-full bg-gray-200" />
            </div>
            <div className="aspect-[4/3] rounded-2xl bg-gray-200" />
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-10">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-gray-900 selection:bg-gray-900 selection:text-white">

      {/* ═══════════════════════════════════════════
          ANNOUNCEMENT BAR
      ═══════════════════════════════════════════ */}
      {isAnnouncementVisible && (
        <div className="relative flex items-center justify-center bg-[#1a2e1a] px-10 py-2.5 text-center">
          <p className="text-xs font-medium tracking-wide text-white/90">
            ✨ Free delivery on orders over D500 &nbsp;·&nbsp; Secure checkout &nbsp;·&nbsp; Buyer protection on every order
          </p>
          <button
            onClick={() => setIsAnnouncementVisible(false)}
            className="absolute right-4 text-white/50 transition hover:text-white"
            aria-label="Dismiss announcement"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          NAVIGATION
      ═══════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 w-full border-b border-black/5 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-10">
          {/* Left */}
          <div className="flex flex-1 items-center justify-start gap-4">
            <button
              onClick={() => { setIsMobileMenuOpen(!isMobileMenuOpen); setIsSearchOpen(false); }}
              className="-ml-2 flex items-center justify-center p-2 text-gray-900 transition hover:opacity-70 md:hidden"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X size={24} strokeWidth={1.5} /> : <Menu size={24} strokeWidth={1.5} />}
            </button>
            <div className="hidden items-center gap-6 md:flex">
              <Link href="/login" className="text-sm font-medium text-gray-500 transition hover:text-gray-900">
                Seller Login
              </Link>
              <Link href="/pricing" className="rounded-full bg-[#1a2e1a] px-5 py-2 text-sm font-medium text-white transition hover:bg-black">
                Open Boutique
              </Link>
            </div>
          </div>

          {/* Center — Logo */}
          <div className="flex items-center justify-center">
            <Link href="/" className="flex-shrink-0 transition-transform hover:scale-105 active:scale-95">
              <img src="/logo.png" alt="Sanndikaa" className="h-16 w-auto origin-center object-contain scale-[1.8] md:h-20 md:scale-[2.2]" />
            </Link>
          </div>

          {/* Right */}
          <div className="flex flex-1 items-center justify-end gap-2 md:gap-4">
            <button
              onClick={() => { setIsSearchOpen(!isSearchOpen); setIsMobileMenuOpen(false); }}
              className="-mr-1 flex items-center justify-center p-2 text-gray-900 transition hover:opacity-70 md:mr-0"
              aria-label="Toggle search"
            >
              <Search size={22} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setIsCartOpen(true)}
              className="-mr-2 relative flex items-center justify-center p-2 text-gray-900 transition hover:opacity-70 md:mr-0"
              aria-label="Open cart"
            >
              <ShoppingBag size={22} strokeWidth={1.5} />
              {cartCount > 0 && (
                <span className="absolute right-0 top-0 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Panel */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out md:hidden ${isMobileMenuOpen ? 'max-h-[32rem] border-t border-black/5 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="flex flex-col gap-1 bg-white px-4 py-4">
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
            <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Browse Categories</p>
            {WORLDS.filter((w) => w !== 'All').map((world) => (
              <button
                key={world}
                onClick={() => { setActiveWorld(world); setIsMobileMenuOpen(false); }}
                className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-neutral-50 text-left"
              >
                {world}
                <ArrowRight size={14} className="text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Search Dropdown */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isSearchOpen ? 'max-h-24 border-t border-black/5 bg-neutral-50 opacity-100' : 'max-h-0 bg-neutral-50 opacity-0'}`}>
          <div className="mx-auto max-w-3xl px-4 py-4 md:px-10">
            <div className="flex w-full items-center overflow-hidden rounded-full border border-black/5 bg-white px-4 py-3 shadow-sm">
              <Search size={18} className="text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setIsSearching(e.target.value.length > 0); }}
                placeholder="Search boutiques, products, categories..."
                className="w-full bg-transparent px-3 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
                autoFocus={isSearchOpen}
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setIsSearching(false); }} className="text-gray-400 hover:text-gray-900 transition">
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════ */}
      <header className="relative border-b border-black/5 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 md:grid-cols-2 md:items-center md:gap-10 md:px-10 md:py-12">
          <div className="order-2 md:order-1 space-y-5">
            <p className="inline-flex items-center rounded-full border border-black/5 bg-neutral-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-gray-600">
              Premium Marketplace
            </p>

            <h1 className="text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
              Discover Global Design,{' '}
              <span className="text-[#1a2e1a]">African Soul.</span>
            </h1>

            <p className="text-sm font-medium text-gray-600 md:text-base">
              Curated finds from standout boutiques. Search first, discover faster.
            </p>

            {/* Live Stats */}
            {shops.length > 0 && (
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{shops.length}+</p>
                  <p className="text-xs font-medium text-gray-500">Boutiques</p>
                </div>
                <div className="h-8 w-px bg-black/10" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totalProducts}+</p>
                  <p className="text-xs font-medium text-gray-500">Products</p>
                </div>
                <div className="h-8 w-px bg-black/10" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">100%</p>
                  <p className="text-xs font-medium text-gray-500">Verified Sellers</p>
                </div>
              </div>
            )}

            {/* Hero Search */}
            <div className="w-full max-w-xl">
              <div className="flex w-full items-center overflow-hidden rounded-full border border-black/5 bg-white px-4 py-3 shadow-sm">
                <Search size={18} className="text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setIsSearching(e.target.value.length > 0); }}
                  placeholder="Search products, categories, boutiques..."
                  className="w-full bg-transparent px-3 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setIsSearching(false); }} className="text-gray-400 hover:text-gray-900 transition">
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#products"
                className="inline-flex items-center gap-2 rounded-full bg-[#1a2e1a] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-black"
              >
                Shop Now <ArrowRight size={14} />
              </a>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-neutral-50"
              >
                Sell with Us
              </Link>
            </div>
          </div>

          {/* Spotlight Product */}
          <div className="order-1 md:order-2">
            {spotlightProduct ? (
              <Link href={`/product/${spotlightProduct.id}`} className="group block overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
                <div className="relative aspect-[4/3] bg-neutral-100">
                  {(spotlightProduct.image_urls?.[0] || spotlightProduct.image_url) ? (
                    <Image
                      src={spotlightProduct.image_urls?.[0] || spotlightProduct.image_url || ''}
                      alt={spotlightProduct.name}
                      fill
                      priority
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-300">
                      <ShoppingBag size={32} />
                    </div>
                  )}
                  <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 shadow-sm backdrop-blur">
                    <Sparkles size={12} /> Featured Product
                  </div>
                </div>
                <div className="space-y-1 p-4">
                  <h2 className="truncate text-lg font-semibold text-gray-900">{spotlightProduct.name}</h2>
                  <p className="text-sm font-medium text-gray-600">{spotlightProduct.shop?.shop_name}</p>
                  <p className="text-base font-semibold text-gray-900">D{spotlightProduct.price}</p>
                </div>
              </Link>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-black/5 bg-white shadow-sm">
                <p className="text-sm font-medium text-gray-500">Featured product coming soon</p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════
          TRUST STRIP
      ═══════════════════════════════════════════ */}
      <section className="border-b border-black/5 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 md:px-10">
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            {[
              { icon: <Truck size={18} className="text-[#1a2e1a]" />, label: 'Free Delivery', sub: 'On orders over D500' },
              { icon: <Shield size={18} className="text-[#1a2e1a]" />, label: 'Secure Checkout', sub: '256-bit SSL encryption' },
              { icon: <Award size={18} className="text-[#1a2e1a]" />, label: 'Buyer Protection', sub: 'On every order' },
              { icon: <RotateCcw size={18} className="text-[#1a2e1a]" />, label: 'Easy Returns', sub: 'Hassle-free policy' },
            ].map(({ icon, label, sub }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-50">
                  {icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900">{label}</p>
                  <p className="text-[11px] text-gray-500">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          CATEGORY FILTER
      ═══════════════════════════════════════════ */}
      {!isSearching && (
        <section className="border-b border-black/5 bg-neutral-50 px-4 py-4 md:px-10">
          <div className="hide-scrollbar flex w-full overflow-x-auto">
            <div className="flex gap-2 pb-1.5 md:gap-3">
              {WORLDS.map((world) => {
                const count =
                  world === 'All'
                    ? marketplaceProducts.length
                    : marketplaceProducts.filter((p) =>
                        p.category?.toLowerCase().includes(world.split(' ')[0].toLowerCase())
                      ).length;
                return (
                  <button
                    key={world}
                    onClick={() => setActiveWorld(world)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      activeWorld === world
                        ? 'bg-[#1a2e1a] text-white shadow-sm'
                        : 'border border-black/10 bg-white text-gray-600 hover:border-black/20 hover:text-gray-900'
                    }`}
                  >
                    {world}{count > 0 ? ` (${count})` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════════ */}
      <main className="mx-auto max-w-7xl px-4 pb-0 pt-8 md:px-10" id="products">
        {isSearching ? (
          /* ── SEARCH RESULTS ── */
          <div className="animate-in fade-in duration-300 pb-20">
            <h2 className="mb-6 text-xl font-semibold tracking-tight text-gray-900">
              Search Results for{' '}
              <span className="font-semibold text-gray-500">&ldquo;{searchQuery}&rdquo;</span>
            </h2>

            {searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white px-4 py-24 text-center shadow-sm">
                <Search className="mb-4 h-10 w-10 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900">No items found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try a different keyword or browse a category below
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {WORLDS.filter((w) => w !== 'All').map((w) => (
                    <button
                      key={w}
                      onClick={() => { setSearchQuery(''); setIsSearching(false); setActiveWorld(w); }}
                      className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-neutral-50"
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {searchResults.map((product) => renderProductCard(product as ProductWithShop))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-16 pb-0">

            {/* ── FEATURED PRODUCTS GRID ── */}
            <section>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-gray-900">
                    {activeWorld === 'All' ? 'Featured Products' : activeWorld}
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-gray-500">
                    {marketplaceProducts.length} product{marketplaceProducts.length !== 1 ? 's' : ''} · Sorted by seller tier
                  </p>
                </div>
                {activeWorld !== 'All' && (
                  <button
                    onClick={() => setActiveWorld('All')}
                    className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-900"
                  >
                    View all <ArrowRight size={13} />
                  </button>
                )}
              </div>

              {marketplaceProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white px-4 py-24 text-center shadow-sm">
                  <Store className="mb-4 h-10 w-10 text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-900">No products in this category yet</h3>
                  <button
                    onClick={() => setActiveWorld('All')}
                    className="mt-4 rounded-full bg-[#1a2e1a] px-5 py-2 text-sm font-medium text-white transition hover:bg-black"
                  >
                    Browse All Products
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {marketplaceProducts.map((product) => renderProductCard(product))}
                </div>
              )}
            </section>

            {/* ── SHOP BY BOUTIQUE ── */}
            <section>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-gray-900">Shop by Boutique</h2>
                  <p className="mt-0.5 text-xs font-medium text-gray-500">
                    Discover curated boutiques from our verified seller network
                  </p>
                </div>
              </div>

              {displayedShops.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white px-4 py-24 text-center shadow-sm">
                  <Store className="mb-3 h-8 w-8 text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-900">No boutiques found.</h3>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
                  {displayedShops.map((shop) => {
                    const tier = (shop.subscription_tier || 'starter').toLowerCase().trim();
                    const isAdvanced = tier === 'advanced';
                    const isPro = tier === 'pro';

                    return (
                      <div
                        key={shop.id}
                        className={`group flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                          isAdvanced ? 'border-yellow-300' : isPro ? 'border-purple-300' : 'border-black/5'
                        }`}
                      >
                        {/* Shop Header */}
                        <div className="mb-5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`relative h-11 w-11 overflow-hidden rounded-full border bg-gray-50 flex-shrink-0 ${isAdvanced ? 'border-yellow-400' : isPro ? 'border-purple-400' : 'border-black/10'}`}>
                              {shop.logo_url ? (
                                <Image
                                  src={shop.logo_url}
                                  alt={shop.shop_name}
                                  fill
                                  className="rounded-full object-cover"
                                  sizes="44px"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-gray-300">
                                  <Store size={18} />
                                </div>
                              )}
                            </div>
                            <div>
                              <h3 className="flex items-center gap-1.5 text-base font-medium text-gray-900">
                                {shop.shop_name}
                                {isAdvanced && <BadgeCheck size={15} className="text-yellow-500" />}
                                {isPro && <BadgeCheck size={15} className="text-purple-500" />}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {shop.products.length} product{shop.products.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>

                          <Link
                            href={`/shop/${shop.shop_slug}`}
                            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
                              isAdvanced
                                ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                                : isPro
                                  ? 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            Visit <ArrowRight size={12} />
                          </Link>
                        </div>

                        {/* Shop Products */}
                        <div className="grid grid-cols-3 gap-3">
                          {shop.products.slice(0, 3).map((product) => {
                            const imgUrl = product.image_urls?.[0] || product.image_url;
                            return (
                              <Link href={`/product/${product.id}`} key={product.id} className="group/item flex flex-col gap-2">
                                <div className={`relative aspect-[4/5] overflow-hidden rounded-xl border bg-gray-50 ${isAdvanced ? 'border-yellow-100' : isPro ? 'border-purple-100' : 'border-black/5'}`}>
                                  {imgUrl ? (
                                    <Image
                                      src={imgUrl}
                                      alt={product.name}
                                      fill
                                      className="object-cover transition-transform duration-700 group-hover/item:scale-105"
                                      sizes="(max-width: 768px) 33vw, 16vw"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center text-gray-200">
                                      <ShoppingBag size={20} />
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
        )}
      </main>

      {/* ═══════════════════════════════════════════
          NEWSLETTER
      ═══════════════════════════════════════════ */}
      <section className="mt-16 border-t border-black/5 bg-[#1a2e1a]">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-10">
          <div className="mx-auto max-w-xl text-center">
            <div className="mb-3 flex items-center justify-center">
              <Mail size={22} className="text-white/50" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Stay in the loop
            </h2>
            <p className="mt-2 text-sm text-white/60">
              New boutiques, exclusive drops, and curated edits — straight to your inbox.
            </p>
            {newsletterSubmitted ? (
              <div className="mt-6 rounded-2xl bg-white/10 px-6 py-4 text-sm font-medium text-white">
                ✓ You&apos;re on the list. Welcome to the Sanndikaa community.
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); if (newsletterEmail.trim()) setNewsletterSubmitted(true); }}
                className="mt-6 flex w-full flex-col gap-3 sm:flex-row"
              >
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="w-full rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm font-medium text-white outline-none placeholder:text-white/40 transition focus:border-white/30 focus:bg-white/15"
                />
                <button
                  type="submit"
                  className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-[#1a2e1a] transition hover:bg-neutral-100 whitespace-nowrap"
                >
                  Subscribe
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════ */}
      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-10">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-4 lg:grid-cols-5">

            {/* Brand Column */}
            <div className="col-span-2 lg:col-span-2">
              <Link href="/">
                <img src="/logo.png" alt="Sanndikaa" className="h-10 w-auto object-contain" />
              </Link>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-gray-500">
                Where African design meets global discovery. A premium marketplace connecting the world&apos;s buyers with Africa&apos;s finest boutiques.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-black/5 bg-neutral-50 px-3 py-1.5 text-[10px] font-semibold text-gray-600">
                  <Shield size={11} className="text-green-600" /> Secure Payments
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-black/5 bg-neutral-50 px-3 py-1.5 text-[10px] font-semibold text-gray-600">
                  <Award size={11} className="text-blue-500" /> Buyer Protected
                </div>
              </div>
            </div>

            {/* Shop Column */}
            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-900">Shop</h4>
              <ul className="space-y-3">
                <li>
                  <button
                    onClick={() => { setActiveWorld('All'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="text-sm text-gray-500 transition hover:text-gray-900"
                  >
                    All Products
                  </button>
                </li>
                {WORLDS.filter((w) => w !== 'All').map((w) => (
                  <li key={w}>
                    <button
                      onClick={() => { setActiveWorld(w); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="text-sm text-gray-500 transition hover:text-gray-900 text-left"
                    >
                      {w}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sell Column */}
            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-900">Sell</h4>
              <ul className="space-y-3">
                <li><Link href="/pricing" className="text-sm text-gray-500 transition hover:text-gray-900">Open Boutique</Link></li>
                <li><Link href="/login" className="text-sm text-gray-500 transition hover:text-gray-900">Seller Login</Link></li>
                <li><Link href="/pricing" className="text-sm text-gray-500 transition hover:text-gray-900">Pricing &amp; Plans</Link></li>
                <li><Link href="/dashboard" className="text-sm text-gray-500 transition hover:text-gray-900">Seller Dashboard</Link></li>
              </ul>
            </div>

            {/* Support Column */}
            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-900">Support</h4>
              <ul className="space-y-3">
                <li><Link href="/" className="text-sm text-gray-500 transition hover:text-gray-900">Help Center</Link></li>
                <li><Link href="/" className="text-sm text-gray-500 transition hover:text-gray-900">Buyer Protection</Link></li>
                <li><Link href="/" className="text-sm text-gray-500 transition hover:text-gray-900">Returns Policy</Link></li>
                <li><Link href="/" className="text-sm text-gray-500 transition hover:text-gray-900">Contact Us</Link></li>
              </ul>
            </div>

          </div>

          {/* Bottom Bar */}
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
