'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, ShoppingBag, Sparkles, Store, TrendingUp, X } from 'lucide-react';
import { useCart } from '../components/CartProvider'; // 🚀 Added Cart Hook

type Product = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  image_urls: string[] | null;
  category: string | null; 
  shop?: { shop_name: string; shop_slug: string };
};

type Shop = {
  id: string;
  shop_name: string;
  shop_slug: string;
  logo_url: string | null;
  theme_color: string | null;
  products: Product[]; 
};

const WORLDS = ['All', 'Fashion', 'Sneakers', 'Beauty & Wellness', 'Home & Artisan', 'Tech Accessories', 'Food & Culinary'];

export default function GlobalHomepage() {
  const [activeWorld, setActiveWorld] = useState('All');
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // 🚀 Connect to Global Cart
  const { cartCount, setIsCartOpen } = useCart();
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchCuratedMall() {
      const { data, error } = await supabase.from('shops').select(`id, shop_name, shop_slug, logo_url, theme_color, products (id, name, price, image_url, image_urls, category)`).limit(20);
      if (!error) {
        const activeShops = (data as unknown as Shop[]).filter((shop) => shop.products && shop.products.length > 0);
        setShops(activeShops);
      }
      setLoading(false);
    }
    fetchCuratedMall();
  }, [supabase]);

  const displayedShops = useMemo(() => {
    if (activeWorld === 'All') return shops;
    const searchKey = activeWorld.split(' ')[0].toLowerCase(); 
    return shops.map(shop => {
      const matchingProducts = shop.products.filter(p => p.category && p.category.toLowerCase().includes(searchKey));
      return { ...shop, products: matchingProducts };
    }).filter(shop => shop.products.length > 0); 
  }, [shops, activeWorld]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const allProducts: Product[] = [];
    shops.forEach(shop => {
      shop.products.forEach(product => {
        if (product.name.toLowerCase().includes(query) || (product.category && product.category.toLowerCase().includes(query)) || shop.shop_name.toLowerCase().includes(query)) {
          allProducts.push({ ...product, shop: { shop_name: shop.shop_name, shop_slug: shop.shop_slug } });
        }
      });
    });
    return allProducts;
  }, [shops, searchQuery]);

  const spotlightProduct = shops.flatMap((shop) => shop.products.map(p => ({ ...p, shop }))).find((p) => p.image_url || (p.image_urls && p.image_urls.length > 0));

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] text-gray-900"><div className="animate-pulse font-serif text-2xl tracking-widest">SANNDIKAA</div></div>;

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      
      {/* 🚀 1. THE REDESIGNED NAVIGATION */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-100 bg-white/95 px-4 py-3.5 backdrop-blur-md md:px-10">
        <div className="text-xl font-black tracking-tighter text-[#1a2e1a] md:text-2xl">SANNDIKAA</div>
        
        <div className="flex items-center gap-5 md:gap-6">
          <Link href="/login" className="hidden text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900 md:block">
            Seller Login
          </Link>
          <Link href="/register" className="hidden rounded-full bg-[#1a2e1a] px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-black md:block">
            Open Boutique
          </Link>
          
          {/* 🚀 THE NATIVE CART BUTTON */}
          <button 
            onClick={() => setIsCartOpen(true)} 
            className="relative flex items-center justify-center text-gray-900 transition hover:opacity-70"
          >
            <ShoppingBag size={24} strokeWidth={1.5} />
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* 🚀 2. THE CONDENSED HERO BANNER & FLOATING SEARCH */}
      <header className="relative flex flex-col items-center justify-center bg-[#1a2e1a] px-4 pt-12 pb-20 md:pt-16 md:pb-24">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a2e1a]/80 via-transparent to-[#1a2e1a]" />
        
        <div className="relative z-10 flex flex-col items-center text-center">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400">The Discovery Edit</p>
          <h1 className="max-w-3xl text-3xl font-serif leading-tight text-white md:text-5xl">
            Gambia's Premier <br className="md:hidden"/> Shopping District.
          </h1>
        </div>

        {/* FLOATING AIRBNB-STYLE SEARCH BAR */}
        <div className="absolute -bottom-7 z-20 w-full max-w-2xl px-4">
          <div className="flex w-full items-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-black/5 transition-all focus-within:shadow-2xl focus-within:ring-gray-300">
            <div className="pl-4 pr-2 text-gray-400"><Search size={20} /></div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setIsSearching(e.target.value.length > 0); }}
              placeholder="Search Boutiques & Products..."
              className="w-full bg-transparent py-3.5 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setIsSearching(false); }} className="px-4 text-gray-400 hover:text-gray-900 transition-colors">
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* SPACER FOR FLOATING BAR */}
      <div className="h-12 w-full bg-[#F9F8F6]"></div>

      {/* 3. CURATED WORLDS PILLS */}
      {!isSearching && (
        <section className="bg-[#F9F8F6] px-4 pb-8 md:px-10">
          <div className="hide-scrollbar flex w-full overflow-x-auto">
            <div className="flex gap-2.5 pb-2 md:gap-4">
              {WORLDS.map((world) => (
                <button
                  key={world}
                  onClick={() => setActiveWorld(world)}
                  className={`whitespace-nowrap rounded-full px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all ${
                    activeWorld === world ? 'bg-[#1a2e1a] text-white shadow-md' : 'border border-gray-200 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-900'
                  }`}
                >
                  {world}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 4. MAIN CONTENT AREA */}
      <main className="mx-auto max-w-7xl px-4 pb-20 md:px-10">
        
        {isSearching ? (
          <div className="animate-in fade-in duration-300">
            <h2 className="mb-6 text-xl font-serif text-gray-900">
              Search Results for <span className="font-bold text-gray-500">"{searchQuery}"</span>
            </h2>

            {searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-white py-24 text-center px-4">
                <Search className="h-10 w-10 text-gray-200 mb-4" />
                <h3 className="text-lg font-serif text-gray-900">No items found</h3>
                <p className="mt-2 text-xs text-gray-500">Try searching for a different product or category.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {searchResults.map((product) => {
                  const imgUrl = product.image_urls?.[0] || product.image_url;
                  return (
                    <Link href={`/product/${product.id}`} key={product.id} className="group flex flex-col">
                      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-gray-100 border border-gray-100">
                        {imgUrl ? <img src={imgUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-gray-300"><ShoppingBag size={24} /></div>}
                        <div className="absolute top-2 left-2 rounded-md bg-white/90 backdrop-blur px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-gray-900 shadow-sm">
                          {product.shop?.shop_name}
                        </div>
                      </div>
                      <div className="mt-3">
                        <h4 className="truncate text-sm font-semibold text-gray-900 group-hover:underline">{product.name}</h4>
                        <p className="text-xs font-bold text-gray-500">D{product.price}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="flex items-center gap-2.5 text-xl font-serif text-gray-900 md:text-2xl">
                <Sparkles className="h-5 w-5 text-yellow-600" /> 
                {activeWorld === 'All' ? (shops.length <= 2 ? 'Exclusive Founding Boutiques' : 'Trending Boutiques') : `Curated ${activeWorld}`}
              </h2>
            </div>

            {spotlightProduct && activeWorld === 'All' && (
              <div className="mb-14 overflow-hidden rounded-[2rem] bg-[#1a2e1a] shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 items-center">
                  <div className="aspect-[4/3] md:aspect-auto md:h-[450px] w-full overflow-hidden bg-gray-900">
                    <img src={spotlightProduct.image_urls?.[0] || spotlightProduct.image_url!} alt={spotlightProduct.name} className="h-full w-full object-cover opacity-90 transition duration-700 hover:opacity-100 hover:scale-105" />
                  </div>
                  <div className="flex flex-col justify-center p-8 md:p-14 text-center md:text-left">
                    <p className="mb-3 flex items-center justify-center md:justify-start gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                      <TrendingUp size={14} /> District Spotlight
                    </p>
                    <h2 className="text-3xl font-serif text-white md:text-4xl leading-tight">{spotlightProduct.name}</h2>
                    <p className="mt-3 text-xs font-medium text-gray-400 uppercase tracking-widest">Curated by {spotlightProduct.shop.shop_name}</p>
                    <div className="mt-8">
                      <Link href={`/product/${spotlightProduct.id}`} className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-xs font-bold uppercase tracking-widest text-[#1a2e1a] shadow-md transition hover:bg-gray-200">
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {displayedShops.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-white py-24 text-center px-4 shadow-sm">
                <div className="h-16 w-16 mb-5 rounded-full bg-gray-50 flex items-center justify-center"><Store className="h-8 w-8 text-gray-300" /></div>
                <h3 className="text-xl font-serif text-gray-900">{shops.length === 0 ? 'The District is Preparing to Launch.' : `No boutiques found in ${activeWorld}.`}</h3>
                <p className="mt-2 max-w-sm text-xs text-gray-500 leading-relaxed">{shops.length === 0 ? 'We are onboarding our founding sellers. Check back soon.' : 'Our curators are sourcing the best sellers for this category.'}</p>
              </div>
            ) : (
              <div className={displayedShops.length === 1 ? 'grid grid-cols-1 max-w-2xl mx-auto' : 'grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16'}>
                {displayedShops.map((shop) => (
                  <div key={shop.id} className="flex flex-col rounded-3xl bg-white p-5 shadow-sm border border-gray-100">
                    <div className="mb-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-full border border-gray-100 bg-gray-50">
                          {shop.logo_url ? <img src={shop.logo_url} alt={shop.shop_name} className="h-full w-full object-cover rounded-full" /> : <div className="flex h-full items-center justify-center text-gray-300"><Store size={18} /></div>}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900">{shop.shop_name}</h3>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Verified Seller</p>
                        </div>
                      </div>
                      <Link href={`/shop/${shop.shop_slug}`} className="group flex items-center gap-1.5 rounded-full bg-gray-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-900 transition hover:bg-gray-100">
                        Visit <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {shop.products.slice(0, 3).map((product) => {
                        const imgUrl = product.image_urls?.[0] || product.image_url;
                        return (
                          <Link href={`/product/${product.id}`} key={product.id} className="group flex flex-col gap-2">
                            <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-gray-50 border border-gray-100">
                              {imgUrl ? <img src={imgUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-gray-200"><ShoppingBag size={20} /></div>}
                            </div>
                            <div>
                              <p className="truncate text-[11px] font-semibold text-gray-900">{product.name}</p>
                              <p className="text-[11px] font-bold text-gray-500">D{product.price}</p>
                            </div>
                          </Link>
                        );
                      })}
                      {Array.from({ length: Math.max(0, 3 - shop.products.length) }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-[4/5] rounded-xl bg-gray-50/50 border border-dashed border-gray-200" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-10 border-t border-gray-200 bg-white py-12 text-center">
        <div className="text-xl font-black tracking-tighter text-gray-900">SANNDIKAA</div>
        <p className="mt-2 text-xs text-gray-500">The premier digital shopping district.</p>
        <p className="mt-8 text-[10px] font-bold uppercase tracking-widest text-gray-400">© 2026 Sanndikaa. All rights reserved.</p>
      </footer>
    </div>
  );
}