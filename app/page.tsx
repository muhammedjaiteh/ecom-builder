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
      // Fetch all public shops that have a slug and a name
      const { data, error } = await supabase
        .from('shops')
        .select('id, shop_name, shop_slug, banner_url, logo_url, bio, subscription_tier, offers_delivery')
        .not('shop_slug', 'is', null)
        .not('shop_name', 'is', null);

      if (error) {
        console.error('Error fetching shops:', error);
      } else {
        setShops(data as Shop[]);
      }
      setLoading(false);
    }
    fetchDirectory();
  }, [supabase]);

  // 🚀 THE ALGORITHM: Sort Flagship first, then Pro, then Standard. Then filter by search.
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

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]"><Loader2 className="animate-spin text-gray-900" /></div>;

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      
      {/* HEADER */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-md px-4 py-4 md:px-10">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="text-xl font-black tracking-tighter text-[#1a2e1a]">SANNDIKAA</div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition">
              Seller Login
            </Link>
            <Link href="/dashboard" className="rounded-full bg-[#1a2e1a] px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-black transition">
              Open a Boutique
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-12 md:py-20 md:px-10">
        
        {/* HERO SECTION */}
        <div className="text-center max-w-3xl mx-auto mb-16 animate-in slide-in-from-bottom-4 duration-700">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-6 border border-emerald-100">
            <Sparkles size={12} /> The Premier African Marketplace
          </span>
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-gray-900 mb-6 leading-tight">
            Discover independent luxury and emerging boutiques.
          </h1>
          
          {/* SEARCH BAR */}
          <div className="relative max-w-xl mx-auto mt-8 shadow-xl rounded-full">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full w-full pl-12 pr-4 py-4 rounded-full border-0 ring-1 ring-inset ring-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6 outline-none transition-all"
              placeholder="Search for boutiques, fashion, or sneakers..."
            />
          </div>
        </div>

        {/* DIRECTORY GRID */}
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-lg font-serif font-bold text-gray-900">The Directory</h2>
          <span className="text-xs font-bold text-gray-400">{displayedShops.length} Boutiques</span>
        </div>

        {displayedShops.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-gray-100 shadow-sm">
            <Store className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-serif text-gray-900">No boutiques found</h3>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your search terms.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedShops.map((shop) => {
              const isFlagship = shop.subscription_tier === 'flagship';
              const isPro = shop.subscription_tier === 'pro';

              return (
                <Link 
                  href={`/shop/${shop.shop_slug}`} 
                  key={shop.id}
                  className="group flex flex-col rounded-[2rem] bg-white overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                >
                  {/* BANNER */}
                  <div className="relative h-32 w-full bg-gray-100">
                    {shop.banner_url ? (
                      <img src={shop.banner_url} alt="Cover" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200" />
                    )}
                    
                    {/* VIP BADGES */}
                    <div className="absolute top-3 right-3 flex gap-2">
                      {isFlagship && (
                        <span className="flex items-center gap-1 rounded-full bg-gray-900/90 backdrop-blur-sm px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-yellow-400 shadow-sm border border-yellow-500/30">
                          <Crown size={10} /> Spotlight
                        </span>
                      )}
                      {isPro && !isFlagship && (
                        <span className="flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-600 shadow-sm">
                          <Sparkles size={10} /> Verified
                        </span>
                      )}
                    </div>
                  </div>

                  {/* INFO */}
                  <div className="px-6 pb-6 pt-0 relative flex-1 flex flex-col">
                    <div className="flex justify-between items-end -mt-8 mb-4">
                      {/* LOGO */}
                      <div className="h-16 w-16 rounded-2xl border-4 border-white bg-white shadow-sm overflow-hidden relative z-10">
                        {shop.logo_url ? (
                          <img src={shop.logo_url} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gray-50 text-gray-300"><Store size={20} /></div>
                        )}
                      </div>
                      
                      <div className="mb-1 h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                        <ArrowRight size={14} />
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 truncate">{shop.shop_name}</h3>
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2 flex-1">
                      {shop.bio || 'Welcome to our digital storefront on Sanndikaa.'}
                    </p>

                    {shop.offers_delivery && (
                      <div className="mt-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                        <MapPin size={12} /> Delivery Available
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}