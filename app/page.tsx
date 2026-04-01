'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, ShoppingBag, Sparkles, Store, TrendingUp, X, Crown, Menu, BadgeCheck } from 'lucide-react';
import { useCart } from '../components/CartProvider';

type Product = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  image_urls: string[] | null;
  category: string | null; 
  shop?: { shop_name: string; shop_slug: string; subscription_tier?: string };
};

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

const WORLDS = ['All', 'Fashion', 'Sneakers', 'Beauty & Wellness', 'Home & Artisan', 'Tech Accessories', 'Food & Culinary'];

export default function GlobalHomepage() {
  const [activeWorld, setActiveWorld] = useState('All');
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const [isSearchOpen, setIsSearchOpen] = useState(false); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { cartCount, setIsCartOpen } = useCart();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchCuratedMall() {
      // 🚨 THE VAULT LOCK: Makes suspended shops invisible. Live and direct.
      const { data, error } = await supabase
        .from('shops')
        .select(`id, shop_name, shop_slug, logo_url, theme_color, subscription_tier, status, products (id, name, price, image_url, image_urls, category)`)
        .eq('status', 'active'); 
      
      if (!error && data) {
        const activeShops = (data as unknown as Shop[]).filter((shop) => shop.products && shop.products.length > 0);
        
        // 🚀 THE ALGORITHM: Advanced (Flagship) > Pro > Starter. .trim() fixes ghost spaces.
        const sortedShops = activeShops.sort((a, b) => {
          const tierRank = { advanced: 3, pro: 2, starter: 1 };
          const rankA = tierRank[a.subscription_tier?.toLowerCase().trim() as keyof typeof tierRank] || 1;
          const rankB = tierRank[b.subscription_tier?.toLowerCase().trim() as keyof typeof tierRank] || 1;
          return rankB - rankA;
        });

        setShops(sortedShops);
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
          allProducts.push({ ...product, shop: { shop_name: shop.shop_name, shop_slug: shop.shop_slug, subscription_tier: shop.subscription_tier } });
        }
      });
    });

    return allProducts.sort((a, b) => {
      const tierRank = { advanced: 3, pro: 2, starter: 1 };
      const rankA = tierRank[a.shop?.subscription_tier?.toLowerCase().trim() as keyof typeof tierRank] || 1;
      const rankB = tierRank[b.shop?.subscription_tier?.toLowerCase().trim() as keyof typeof tierRank] || 1;
      return rankB - rankA;
    });
  }, [shops, searchQuery]);

  // 🚀 OPTIMIZED SPOTLIGHT LOGIC: Forces a new JS bundle to clear production cache
  const spotlightProduct = useMemo(() => {
    // Since shops are already sorted by tier, the first shop with a product image is our target.
    const topShop = shops[0];
    if (!topShop) return null;
    
    const topProduct = topShop.products.find((p) => p.image_url || (p.image_urls && p.image_urls.length > 0));
    if (!topProduct) return null;

    return { ...topProduct, shop: { shop_name: topShop.shop_name, shop_slug: topShop.shop_slug, subscription_tier: topShop.subscription_tier } };
  }, [shops]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] text-gray-900"><div className="animate-pulse font-serif text-2xl tracking-widest">SANNDIKAA</div></div>;

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      
      {/* 🚀 1. THE HEADER */}
      <nav className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-10">
          <div className="flex flex-1 items-center justify-start gap-4">
            <button 
              onClick={() => {
                setIsMobileMenuOpen(!isMobileMenuOpen);
                setIsSearchOpen(false); 
              }} 
              className="flex items-center justify-center p-2 text-gray-900 transition hover:opacity-70 md:hidden -ml-2"
            >
              {isMobileMenuOpen ? <X size={24} strokeWidth={1.5} /> : <Menu size={24} strokeWidth={1.5} />}
            </button>
            <div className="hidden items-center gap-6 md:flex">
              <Link href="/login" className="text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900">
                Seller Login
              </Link>
              <Link href="/pricing" className="rounded-full bg-[#1a2e1a] px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-black">
                Open Boutique
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <Link href="/" className="flex-shrink-0 transition-transform hover:scale-105 active:scale-95">
              <img 
                src="/logo.png" 
                alt="Sanndikaa Logo" 
                className="h-16 w-auto object-contain scale-[1.8] md:h-20 md:scale-[2.2] origin-center" 
              />
            </Link>
          </div>
          
          <div className="flex flex-1 items-center justify-end gap-2 md:gap-4">
            <button 
              onClick={() => {
                setIsSearchOpen(!isSearchOpen);
                setIsMobileMenuOpen(false);
              }} 
              className="flex items-center justify-center p-2 text-gray-900 transition hover:opacity-70 -mr-1 md:mr-0"
            >
              <Search size={22} strokeWidth={1.5} />
            </button>
            
            <button 
              onClick={() => setIsCartOpen(true)} 
              className="relative flex items-center justify-center p-2 text-gray-900 transition hover:opacity-70 -mr-2 md:mr-0"
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

        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isSearchOpen ? 'max-h-24 border-t border-gray-100 opacity-100 bg-gray-50' : 'max-h-0 opacity-0 bg-gray-50'}`}>
          <div className="mx-auto max-w-3xl px-4 py-4 md:px-10">
            <div className="flex w-full items-center overflow-hidden rounded-full bg-white px-4 py-3 shadow-sm ring-1 ring-gray-200 focus-within:ring-2 focus-within:ring-[#1a2e1a]">
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
                <button onClick={() => { setSearchQuery(''); setIsSearching(false); }} className="text-gray-400 hover:text-gray-900">
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* 🚀 2. THE PAN-AFRICAN CINEMATIC HERO */}
      <header className="relative flex flex-col items-center justify-center bg-[#0a120a] px-4 py-12 md:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-30 mix-blend-luminosity" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a2e1a] via-[#1a2e1a]/80 to-transparent" />
        
        <div className="relative z-10 flex flex-col items-center text-center w-full max-w-4xl mx-auto">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-300">Sanndikaa: The Gathering Place</span>
          </div>
          
          <h1 className="text-4xl font-serif tracking-tight text-white md:text-5xl lg:text-6xl">
            The Spirit of the African Market. <br className="hidden sm:block"/> Elevated for the World.
          </h1>
        </div>
      </header>

      {!isSearching && (
        <section className="bg-[#F9F8F6] px-4 py-6 md:px-10">
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
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {searchResults.map((product) => {
                  const imgUrl = product.image_urls?.[0] || product.image_url;
                  
                  // 🚀 MATCH THE BADGES IN SEARCH RESULTS with .trim() safety
                  const tier = (product.shop?.subscription_tier || 'starter').toLowerCase().trim();
                  const isAdvanced = tier === 'advanced';
                  const isPro = tier === 'pro';

                  return (
                    <Link href={`/product/${product.id}`} key={product.id} className="group flex flex-col">
                      <div className={`relative aspect-[4/5] overflow-hidden rounded-2xl bg-gray-100 border ${isAdvanced ? 'border-yellow-300' : isPro ? 'border-purple-300' : 'border-gray-100'}`}>
                        {imgUrl ? <img src={imgUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-gray-300"><ShoppingBag size={24} /></div>}
                        
                        {(isAdvanced || isPro) && (
                          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-white/95 backdrop-blur px-2 py-1 shadow-sm">
                            {isAdvanced && <BadgeCheck size={12} className="text-yellow-500" />}
                            {isPro && <BadgeCheck size={12} className="text-purple-500" />}
                          </div>
                        )}
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
                {activeWorld === 'All' ? 'Trending Boutiques' : `Curated ${activeWorld}`}
              </h2>
            </div>

            {spotlightProduct && activeWorld === 'All' && (
              <div className="mb-14 overflow-hidden rounded-[2rem] bg-[#1a2e1a] shadow-xl ring-1 ring-yellow-500/30">
                <div className="grid grid-cols-1 md:grid-cols-2 items-center">
                  <div className="aspect-[4/3] md:aspect-auto md:h-[450px] w-full overflow-hidden bg-gray-900">
                    <img src={spotlightProduct.image_urls?.[0] || spotlightProduct.image_url!} alt={spotlightProduct.name} className="h-full w-full object-cover opacity-90 transition duration-700 hover:opacity-100 hover:scale-105" />
                  </div>
                  <div className="flex flex-col justify-center p-8 md:p-14 text-center md:text-left relative">
                    <Crown className="absolute top-8 right-8 h-20 w-20 text-yellow-500/10" />
                    <p className="mb-3 flex items-center justify-center md:justify-start gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400">
                      <TrendingUp size={14} /> Spotlight Boutique
                    </p>
                    <h2 className="text-3xl font-serif text-white md:text-4xl leading-tight">{spotlightProduct.name}</h2>
                    <p className="mt-3 text-xs font-medium text-gray-400 uppercase tracking-widest flex items-center justify-center md:justify-start gap-1">
                      Curated by {spotlightProduct.shop?.shop_name}
                    </p>
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
                <Store className="h-8 w-8 text-gray-300" />
                <h3 className="text-xl font-serif text-gray-900">No boutiques found.</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
                {displayedShops.map((shop) => {
                  
                  // 🚀 MATCH THE BADGES ON THE MAIN CARDS with .trim() safety
                  const tier = (shop.subscription_tier || 'starter').toLowerCase().trim();
                  const isAdvanced = tier === 'advanced';
                  const isPro = tier === 'pro';

                  return (
                    <div key={shop.id} className={`group flex flex-col rounded-[2rem] bg-white p-5 shadow-sm border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isAdvanced ? 'border-yellow-300 ring-1 ring-yellow-500/20' : isPro ? 'border-purple-300 ring-1 ring-purple-500/20' : 'border-gray-100'}`}>
                      <div className="mb-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-12 w-12 overflow-hidden rounded-full border bg-gray-50 ${isAdvanced ? 'border-yellow-400' : isPro ? 'border-purple-400' : 'border-gray-100'}`}>
                            {shop.logo_url ? <img src={shop.logo_url} alt={shop.shop_name} className="h-full w-full object-cover rounded-full" /> : <div className="flex h-full items-center justify-center text-gray-300"><Store size={18} /></div>}
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                              {shop.shop_name} 
                              {isAdvanced && <BadgeCheck size={16} className="text-yellow-500" />}
                              {isPro && <BadgeCheck size={16} className="text-purple-500" />}
                            </h3>
                          </div>
                        </div>
                        <Link href={`/shop/${shop.shop_slug}`} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition ${isAdvanced ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' : isPro ? 'bg-purple-50 text-purple-700 hover:bg-purple-100' : 'bg-gray-50 text-gray-900 hover:bg-gray-100'}`}>
                          Visit <ArrowRight size={12} />
                        </Link>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {shop.products.slice(0, 3).map((product) => {
                          const imgUrl = product.image_urls?.[0] || product.image_url;
                          return (
                            <Link href={`/product/${product.id}`} key={product.id} className="group/item flex flex-col gap-2">
                              <div className={`relative aspect-[4/5] overflow-hidden rounded-xl bg-gray-50 border ${isAdvanced ? 'border-yellow-100' : isPro ? 'border-purple-100' : 'border-gray-100'}`}>
                                {imgUrl ? <img src={imgUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 group-hover/item:scale-105" /> : <div className="flex h-full items-center justify-center text-gray-200"><ShoppingBag size={20} /></div>}
                              </div>
                              <div>
                                <p className="truncate text-[11px] font-semibold text-gray-900">{product.name}</p>
                                <p className="text-[11px] font-bold text-gray-500">D{product.price}</p>
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
          </div>
        )}
      </main>
    </div>
  );
}