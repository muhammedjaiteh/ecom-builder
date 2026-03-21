'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Store, Sparkles, MapPin, ArrowRight, Loader2, Crown } from 'lucide-react';

type Shop = {
  id: string;
  shop_name: string | null;
  shop_slug: string | null;
  banner_url: string | null;
  logo_url: string | null;
  bio: string | null;
  subscription_tier: string;
  offers_delivery: boolean | null;
};

export default function GlobalDirectory() {
  const supabase = createClientComponentClient();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchDirectory() {
      const { data, error } = await supabase
        .from('shops')
        .select('id, shop_name, shop_slug, banner_url, logo_url, bio, subscription_tier, offers_delivery')
        .not('shop_slug', 'is', null)
        .not('shop_name', 'is', null);

      if (error) {
        if (error.message?.includes('AbortError')) return; 
        console.error('Error fetching shops:', error);
      } else {
        setShops(data as Shop[]);
      }
      setLoading(false);
    }
    fetchDirectory();
  }, [supabase]);

  const displayedShops = useMemo(() => {
    let filtered = shops;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => s.shop_name?.toLowerCase().includes(query) || s.bio?.toLowerCase().includes(query));
    }
    return filtered.sort((a, b) => {
      const tierRank = { flagship: 3, pro: 2, standard: 1 };
      const rankA = tierRank[a.subscription_tier as keyof typeof tierRank] || 1;
      const rankB = tierRank[b.subscription_tier as keyof typeof tierRank] || 1;
      return rankB - rankA;
    });
  }, [shops, searchQuery]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]"><Loader2 className="animate-spin text-[#1a2e1a]" /></div>;

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      
      {/* LUXURY NAVIGATION */}
      <nav className="fixed top-0 w-full z-50 border-b border-gray-200/50 bg-white/90 backdrop-blur-md transition-all">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-10 md:py-4 flex items-center justify-between">
          <div className="text-lg md:text-xl font-black tracking-tighter text-[#1a2e1a]">SANNDIKAA</div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden sm:block text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition">
              Seller Login
            </Link>
            <Link href="/dashboard" className="rounded-full bg-[#1a2e1a] px-4 py-2 md:px-5 md:py-2.5 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-white hover:bg-black transition shadow-sm">
              Open Boutique
            </Link>
          </div>
        </div>
      </nav>

      {/* EDITORIAL HERO SECTION - MOBILE TIGHTENED */}
      <main className="relative pt-24 pb-12 md:pt-40 md:pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-900/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 md:px-10 text-center animate-in slide-in-from-bottom-8 duration-1000">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 md:px-4 md:py-1.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-emerald-800 mb-6 border border-gray-200 shadow-sm">
            <Sparkles size={10} className="text-emerald-500" /> The Premier Marketplace
          </span>
          
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-serif font-bold text-gray-900 mb-4 md:mb-6 leading-[1.1] tracking-tight max-w-4xl mx-auto">
            Discover independent luxury <span className="text-gray-400 italic font-light">&</span> emerging boutiques.
          </h1>
          
          <p className="text-gray-500 text-xs sm:text-sm md:text-base max-w-xl mx-auto mb-8 leading-relaxed px-4">
            Shop curated collections from the finest verified sellers, designers, and curators in the district.
          </p>
          
          {/* SLEEK SEARCH BAR */}
          <div className="relative max-w-2xl mx-auto group px-2 sm:px-0">
            <div className="absolute inset-y-0 left-2 sm:left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 md:h-5 md:w-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-12 pr-4 py-3.5 md:pl-14 md:pr-6 md:py-5 rounded-full border border-gray-200 bg-white/90 backdrop-blur-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-sm md:text-base outline-none transition-all shadow-lg shadow-gray-200/50"
              placeholder="Search boutiques..."
            />
          </div>
        </div>
      </main>

      {/* DIRECTORY GRID */}
      <section className="mx-auto max-w-7xl px-4 md:px-10 pb-24 md:pb-32">
        <div className="mb-8 md:mb-10 flex items-end justify-between border-b border-gray-200 pb-3 md:pb-4">
          <h2 className="text-xl md:text-2xl font-serif font-bold text-gray-900">The Directory</h2>
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-gray-400">{displayedShops.length} Boutiques</span>
        </div>

        {displayedShops.length === 0 ? (
          <div className="text-center py-20 md:py-32 bg-white rounded-[2rem] border border-gray-100 shadow-sm">
            <Store className="mx-auto h-10 w-10 md:h-12 md:w-12 text-gray-200 mb-4" />
            <h3 className="text-base md:text-lg font-serif text-gray-900">No boutiques found</h3>
            <p className="text-xs md:text-sm text-gray-500 mt-1">Try adjusting your search terms.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {displayedShops.map((shop, index) => {
              const isFlagship = shop.subscription_tier === 'flagship';
              const isPro = shop.subscription_tier === 'pro';

              return (
                <Link 
                  href={`/shop/${shop.shop_slug}`} 
                  key={shop.id}
                  className="group flex flex-col rounded-[2rem] md:rounded-[2.5rem] bg-white overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-500 hover:-translate-y-1 animate-in fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* CINEMATIC BANNER */}
                  <div className="relative aspect-[16/9] w-full bg-gray-100 overflow-hidden">
                    {shop.banner_url ? (
                      <img src={shop.banner_url} alt={shop.shop_name || 'Boutique'} className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200" />
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    {/* VIP BADGES */}
                    <div className="absolute top-3 right-3 md:top-4 md:right-4 flex gap-2">
                      {isFlagship && (
                        <span className="flex items-center gap-1 md:gap-1.5 rounded-full bg-black/40 backdrop-blur-md px-2.5 py-1 md:px-3 md:py-1.5 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-yellow-400 border border-white/10 shadow-sm">
                          <Crown size={10} className="md:w-3 md:h-3" /> Spotlight
                        </span>
                      )}
                      {isPro && !isFlagship && (
                        <span className="flex items-center gap-1 md:gap-1.5 rounded-full bg-white/80 backdrop-blur-md px-2.5 py-1 md:px-3 md:py-1.5 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-emerald-700 border border-white/50 shadow-sm">
                          <Sparkles size={10} className="md:w-3 md:h-3" /> Verified
                        </span>
                      )}
                    </div>
                  </div>

                  {/* BOUTIQUE INFO */}
                  <div className="px-5 pb-6 md:px-8 md:pb-8 relative flex-1 flex flex-col">
                    <div className="flex justify-between items-end -mt-8 md:-mt-10 mb-4 md:mb-5">
                      {/* LUXURY LOGO */}
                      <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl border-[3px] md:border-[4px] border-white bg-white shadow-md overflow-hidden relative z-10">
                        {shop.logo_url ? (
                          <img src={shop.logo_url} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gray-50 text-gray-300"><Store size={20} className="md:w-6 md:h-6" /></div>
                        )}
                      </div>
                      
                      <div className="mb-1 md:mb-2 h-8 w-8 md:h-10 md:w-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-[#1a2e1a] group-hover:text-white transition-colors duration-300">
                        <ArrowRight size={14} className="md:w-4 md:h-4 group-hover:-rotate-45 transition-transform duration-300" />
                      </div>
                    </div>

                    <h3 className="text-lg md:text-2xl font-bold text-gray-900 truncate tracking-tight">{shop.shop_name}</h3>
                    <p className="mt-1.5 md:mt-2 text-xs md:text-sm text-gray-500 line-clamp-2 leading-relaxed flex-1">
                      {shop.bio || 'Welcome to our digital storefront on Sanndikaa. Discover our curated collection.'}
                    </p>

                    {shop.offers_delivery && (
                      <div className="mt-4 md:mt-6 flex items-center gap-1 md:gap-1.5 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 w-fit px-2.5 py-1 md:px-3 md:py-1.5 rounded-md md:rounded-lg">
                        <MapPin size={10} className="md:w-3 md:h-3" /> Delivery Available
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}