'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, ShoppingBag, Sparkles, Store, TrendingUp } from 'lucide-react';

type Product = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  image_urls: string[] | null;
  category: string | null; 
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
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchCuratedMall() {
      const { data, error } = await supabase
        .from('shops')
        .select(`
          id, shop_name, shop_slug, logo_url, theme_color,
          products (id, name, price, image_url, image_urls, category)
        `)
        .limit(10); 

      if (error) {
        console.error('Error fetching mall data:', error);
      } else {
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
      const matchingProducts = shop.products.filter(p => 
        p.category && p.category.toLowerCase().includes(searchKey)
      );
      return { ...shop, products: matchingProducts };
    }).filter(shop => shop.products.length > 0); 
  }, [shops, activeWorld]);

  const spotlightProduct = shops
    .flatMap((shop) => shop.products.map(p => ({ ...p, shop })))
    .find((p) => p.image_url || (p.image_urls && p.image_urls.length > 0));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] text-gray-900">
        <div className="animate-pulse font-serif text-2xl tracking-widest">SANNDIKAA</div>
      </div>
    );
  }

  const getGridClass = () => {
    if (displayedShops.length === 1) return 'grid grid-cols-1 max-w-2xl mx-auto';
    return 'grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16';
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      {/* 1. MINIMAL NAVIGATION - Links updated to /auth */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-200 bg-white/80 px-4 py-4 backdrop-blur-md md:px-10">
        <div className="text-xl font-black tracking-tighter text-gray-950 md:text-2xl">SANNDIKAA</div>
        <div className="flex items-center gap-4">
          <Link href="/auth" className="text-sm font-semibold text-gray-600 transition hover:text-gray-900">
            Seller Login
          </Link>
          <Link
            href="/auth"
            className="rounded-full bg-gray-900 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-black"
          >
            Open Boutique
          </Link>
        </div>
      </nav>

      {/* 2. THE EDITORIAL HERO */}
      <header className="relative flex h-[35vh] min-h-[350px] w-full items-center justify-center overflow-hidden bg-gray-900 md:min-h-[400px]">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay grayscale" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />
        
        <div className="relative z-10 flex flex-col items-center text-center px-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-gray-300 md:text-sm">The Discovery Edit</p>
          <h1 className="max-w-4xl text-4xl font-serif leading-tight text-white md:text-6xl">
            Gambia's Premier <br /> Digital Shopping District.
          </h1>
          <p className="mt-4 max-w-xl text-xs font-medium leading-relaxed text-gray-300 md:text-sm">
            Explore curated collections from the finest independent boutiques, sneaker resellers, and artisans.
          </p>
        </div>
      </header>

      {/* 3. CURATED WORLDS (THE PORTALS) */}
      <section className="border-b border-gray-200 bg-white px-4 py-4 md:px-10">
        <div className="hide-scrollbar flex w-full overflow-x-auto">
          <div className="flex gap-2 pb-2 md:gap-4">
            {WORLDS.map((world) => (
              <button
                key={world}
                onClick={() => setActiveWorld(world)}
                className={`whitespace-nowrap rounded-full px-6 py-2.5 text-sm font-semibold transition-all ${
                  activeWorld === world
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {world}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-16 md:px-10">
        
        <div className="mb-12 flex items-center justify-between">
          <h2 className="flex items-center gap-3 text-2xl font-serif text-gray-900 md:text-3xl">
            <Sparkles className="h-6 w-6 text-yellow-600" /> 
            {activeWorld === 'All' 
              ? (shops.length <= 2 ? 'Exclusive Founding Boutiques' : 'Trending Boutiques')
              : `Curated ${activeWorld}`}
          </h2>
        </div>

        {displayedShops.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-24 text-center px-4 shadow-sm">
            <div className="h-16 w-16 mb-6 rounded-full bg-gray-50 flex items-center justify-center">
              <Store className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-2xl font-serif text-gray-900">
              {shops.length === 0 ? 'The District is Preparing to Launch.' : `No boutiques found in ${activeWorld}.`}
            </h3>
            <p className="mt-3 max-w-md text-sm text-gray-500 leading-relaxed">
              {shops.length === 0 
                ? 'We are currently onboarding our founding sellers. Sanndikaa will soon feature the best curated products in the Gambia.' 
                : 'Our curators are currently sourcing the best sellers for this category. Check back soon!'}
            </p>
            {/* Empty State Link also updated to /auth */}
            {shops.length === 0 && (
              <Link href="/auth" className="mt-8 rounded-full bg-gray-900 px-8 py-3 text-sm font-bold uppercase tracking-widest text-white hover:bg-black transition-colors">
                Claim Your Storefront
              </Link>
            )}
          </div>
        ) : (
          <div className={getGridClass()}>
            {displayedShops.map((shop) => (
              <div key={shop.id} className="flex flex-col">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-full border border-gray-200 bg-white shadow-sm">
                      {shop.logo_url ? (
                        <img src={shop.logo_url} alt={shop.shop_name} className="h-full w-full object-cover p-0.5 rounded-full" />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gray-50 text-gray-400">
                          <Store size={20} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{shop.shop_name}</h3>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Verified Seller</p>
                    </div>
                  </div>
                  <Link
                    href={`/shop/${shop.shop_slug}`}
                    className="group flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-gray-900 transition hover:text-gray-500"
                  >
                    Visit <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-2 md:gap-4">
                  {shop.products.slice(0, 3).map((product) => {
                    const imgUrl = product.image_urls?.[0] || product.image_url;
                    return (
                      <Link href={`/product/${product.id}`} key={product.id} className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-gray-100 border border-gray-100">
                        {imgUrl ? (
                          <img src={imgUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-gray-300">
                            <ShoppingBag size={24} />
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <p className="truncate text-xs font-medium text-white">{product.name}</p>
                          <p className="text-xs font-bold text-white">D{product.price}</p>
                        </div>
                      </Link>
                    );
                  })}
                  {Array.from({ length: Math.max(0, 3 - shop.products.length) }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-[4/5] rounded-xl bg-gray-50 border border-dashed border-gray-200" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {spotlightProduct && activeWorld === 'All' && (
          <div className="mt-24 overflow-hidden rounded-3xl bg-gray-900 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 items-center">
              <div className="aspect-square md:aspect-auto md:h-[600px] w-full overflow-hidden bg-gray-800">
                <img 
                  src={spotlightProduct.image_urls?.[0] || spotlightProduct.image_url!} 
                  alt={spotlightProduct.name}
                  className="h-full w-full object-cover opacity-90 transition duration-700 hover:opacity-100 hover:scale-[1.02]"
                />
              </div>
              <div className="flex flex-col justify-center p-10 md:p-16 text-center md:text-left">
                <p className="mb-4 flex items-center justify-center md:justify-start gap-2 text-xs font-bold uppercase tracking-[0.2em] text-yellow-500">
                  <TrendingUp size={16} /> District Spotlight
                </p>
                <h2 className="text-4xl font-serif text-white md:text-5xl leading-tight">{spotlightProduct.name}</h2>
                <p className="mt-4 text-sm font-medium text-gray-400 uppercase tracking-widest">
                  Curated by {spotlightProduct.shop.shop_name}
                </p>
                <div className="mt-8">
                  <Link 
                    href={`/product/${spotlightProduct.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold uppercase tracking-widest text-gray-900 transition hover:bg-gray-200"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-20 border-t border-gray-200 bg-white py-12 text-center">
        <div className="text-2xl font-black tracking-tighter text-gray-900">SANNDIKAA</div>
        <p className="mt-2 text-sm text-gray-500">The premier digital shopping district.</p>
        <p className="mt-8 text-xs text-gray-400">© 2026 Sanndikaa. All rights reserved.</p>
      </footer>
    </div>
  );
}