'use client';

import { createBrowserClient } from '@supabase/ssr';
import { PostgrestError } from '@supabase/supabase-js';
import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, MapPin, Search, ShoppingBag, Store, Truck, X, Share, BadgeCheck } from 'lucide-react';
import { useCart } from '../../../components/CartProvider';
import type { Product } from '@/lib/types';

type Shop = {
  id: string;
  shop_name: string | null;
  shop_slug: string | null;
  banner_url: string | null;
  logo_url: string | null;
  bio: string | null;
  store_layout: string | null;
  theme_color: string | null;
  offers_delivery: boolean | null;
  offers_pickup: boolean | null;
  pickup_instructions: string | null;
  subscription_tier: string; 
  ai_credits: number;        
  products: Product[];
};

const themeColors: Record<string, { bg: string; text: string; lightBg: string }> = {
  emerald: { bg: 'bg-[#1a2e1a]', text: 'text-[#1a2e1a]', lightBg: 'bg-[#1a2e1a]/10' },
  midnight: { bg: 'bg-slate-900', text: 'text-slate-900', lightBg: 'bg-slate-900/10' },
  terracotta: { bg: 'bg-orange-700', text: 'text-orange-700', lightBg: 'bg-orange-700/10' },
  ocean: { bg: 'bg-blue-600', text: 'text-blue-600', lightBg: 'bg-blue-600/10' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-500', lightBg: 'bg-rose-500/10' },
  champagne: { bg: 'bg-[#D7C0AE]', text: 'text-[#B89F8A]', lightBg: 'bg-[#D7C0AE]/20' },
  sage: { bg: 'bg-[#8A9A86]', text: 'text-[#6B7A68]', lightBg: 'bg-[#8A9A86]/20' },
  onyx: { bg: 'bg-[#1A1A1A]', text: 'text-[#1A1A1A]', lightBg: 'bg-[#1A1A1A]/10' },
  crimson: { bg: 'bg-[#8B0000]', text: 'text-[#8B0000]', lightBg: 'bg-[#8B0000]/10' },
  sand: { bg: 'bg-[#C2B280]', text: 'text-[#A39461]', lightBg: 'bg-[#C2B280]/20' },
  stone: { bg: 'bg-[#8B8C89]', text: 'text-[#6C6D6A]', lightBg: 'bg-[#8B8C89]/10' },
};

export default function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { cartCount, setIsCartOpen } = useCart();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    async function fetchShop() {
      // Next.js params can be URL-encoded (e.g. "jambaba%20boutique09").
      // The DB stores the decoded value, so we must decode before querying.
      const decodedSlug = decodeURIComponent(slug);

      const { data, error } = await supabase
        .from('shops')
        .select(`
          id, shop_name, shop_slug, banner_url, logo_url, bio, theme_color, store_layout, offers_delivery, offers_pickup, pickup_instructions, subscription_tier, ai_credits,
          products (id, name, description, price, image_url, image_urls, category)
        `)
        .eq('shop_slug', decodedSlug)
        .maybeSingle();

      if (error) {
        console.error('Error fetching shop:', (error as PostgrestError).code, (error as PostgrestError).message, (error as PostgrestError).details);
      } else {
        setShop(data as Shop);
      }

      setLoading(false);
    }
    fetchShop();
  }, [slug, supabase]);

  const categories = useMemo(() => {
    if (!shop?.products) return ['All'];
    const uniqueCategories = Array.from(new Set(shop.products.map(p => p.category).filter(Boolean) as string[]));
    return ['All', ...uniqueCategories];
  }, [shop]);

  const displayedProducts = useMemo(() => {
    if (!shop?.products) return [];
    let filtered = shop.products;

    if (activeCategory !== 'All') {
      filtered = filtered.filter(p => p.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(query) || p.category?.toLowerCase().includes(query));
    }
    return filtered;
  }, [shop, activeCategory, searchQuery]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: shop?.shop_name || 'Boutique', text: `Check out ${shop?.shop_name} on Sanndikaa!`, url });
      } catch (err) { console.log('Share canceled', err); }
    } else {
      navigator.clipboard.writeText(url);
      alert('Store link copied to clipboard!');
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6] text-gray-900"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!shop) return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6] text-gray-900"><div className="text-center"><Store className="mx-auto mb-4 h-12 w-12 text-gray-300" /><h1 className="text-2xl font-serif font-bold">Boutique Not Found</h1><Link href="/" className="mt-4 inline-block text-sm font-bold text-gray-500 hover:text-gray-900">Return to Directory</Link></div></div>;

  const theme = shop.theme_color ? themeColors[shop.theme_color] || themeColors.emerald : themeColors.emerald;
  const currentLayout = shop.store_layout || 'bantaba'; 
  
  // 🚀 BULLETPROOF SYNC: Matches Admin Vault and Marketplace exact logic
  const tier = (shop.subscription_tier || 'starter').toLowerCase().trim();
  const isAdvanced = tier === 'advanced';
  const isPro = tier === 'pro';

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      
      {/* GLOBAL HEADER */}
      <nav className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:h-20 md:px-10">
          
          <div className="flex flex-1 items-center justify-start">
            <Link href="/" className="group flex items-center justify-center p-2 text-gray-900 transition -ml-2">
              <ArrowLeft size={26} strokeWidth={1.25} className="transition-transform group-hover:-translate-x-1" />
              <span className="hidden text-xs font-bold uppercase tracking-widest md:block ml-2 text-gray-500 group-hover:text-gray-900 transition">Directory</span>
            </Link>
          </div>

          <div className="flex items-center justify-center h-full">
            <Link href="/" className="flex items-center justify-center transition-transform hover:opacity-80 active:scale-95">
              <img src="/logo.png" alt="Sanndikaa Logo" className="w-24 md:w-32 h-auto object-contain scale-110 md:scale-125 origin-center" />
            </Link>
          </div>
          
          <div className="flex flex-1 items-center justify-end">
            <button onClick={() => setIsCartOpen(true)} className="relative flex items-center justify-center p-2 text-gray-900 transition hover:opacity-70 -mr-2 md:mr-0">
              <ShoppingBag size={22} strokeWidth={1.25} />
              {cartCount > 0 && (
                <span className="absolute right-1 top-1 flex h-[16px] w-[16px] items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* 🚀 THE NEW SHOP PROFILE HERO WITH TEXTLESS BADGES */}
      <div className="relative bg-white border-b border-gray-100 pb-6 md:pb-8">
        {/* Banner Area */}
        <div className="h-32 md:h-56 w-full overflow-hidden relative bg-gray-100">
          {shop.banner_url ? (
            <img src={shop.banner_url} alt={`${shop.shop_name} Banner`} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full ${theme.lightBg}`} />
          )}
        </div>
        
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 relative">
          <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6 -mt-12 md:-mt-16">
            
            {/* Logo Avatar - Premium Halos matching the tiers */}
            <div className={`h-24 w-24 md:h-32 md:w-32 rounded-full border-4 border-white bg-white overflow-hidden shadow-md shrink-0 relative z-10 ${isAdvanced ? 'ring-2 ring-yellow-400 ring-offset-2' : isPro ? 'ring-2 ring-purple-400 ring-offset-2' : ''}`}>
               {shop.logo_url ? (
                 <img src={shop.logo_url} alt={shop.shop_name || 'Logo'} className="w-full h-full object-cover" />
               ) : (
                 <div className={`w-full h-full flex items-center justify-center ${theme.lightBg} ${theme.text}`}>
                   <Store size={32} />
                 </div>
               )}
            </div>
            
            {/* Shop Info & Trust Badges */}
            <div className="flex-1 pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-serif font-bold text-gray-900">
                  {shop.shop_name}
                </h1>
                {/* 👑 THE PREMIUM TEXTLESS VERIFIED BADGES */}
                {isAdvanced && <BadgeCheck size={26} className="text-yellow-500" />}
                {isPro && <BadgeCheck size={26} className="text-purple-500" />}
              </div>
              
              {shop.bio && <p className="mt-2 text-sm text-gray-600 max-w-2xl leading-relaxed">{shop.bio}</p>}
              
              {/* Delivery / Pickup Tags */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                 {shop.offers_delivery && (
                   <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full ring-1 ring-emerald-100">
                     <Truck size={12} /> Delivery
                   </span>
                 )}
                 {shop.offers_pickup && (
                   <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full ring-1 ring-indigo-100">
                     <MapPin size={12} /> Pickup
                   </span>
                 )}
              </div>
            </div>

            {/* Share Button */}
            <div className="md:pb-3 mt-4 md:mt-0">
              <button onClick={handleShare} className="flex items-center justify-center w-full md:w-auto gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-gray-700 shadow-sm transition hover:bg-gray-50 hover:border-gray-300">
                <Share size={14} /> Share Shop
              </button>
            </div>
            
          </div>
        </div>
      </div>

      {/* STORE NAVIGATION & FILTERING */}
      <div className="sticky top-16 md:top-20 z-40 border-b border-gray-100 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full md:max-w-xs items-center overflow-hidden rounded-xl bg-gray-50 px-3 py-2 transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-gray-200">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${shop.shop_name}...`}
                className="w-full bg-transparent px-2 text-xs font-medium text-gray-900 outline-none placeholder:text-gray-400"
              />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-900"><X size={14} /></button>}
            </div>

            <div className="hide-scrollbar -mx-4 flex overflow-x-auto px-4 md:mx-0 md:px-0">
              <div className="flex gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`whitespace-nowrap rounded-lg px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                      activeCategory === category ? `${theme.bg} text-white shadow-sm` : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* THE DYNAMIC LAYOUT ENGINE */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 pb-24">
        {displayedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-white py-20 text-center">
            <ShoppingBag className="mb-4 h-12 w-12 text-gray-200" />
            <h3 className="text-lg font-serif text-gray-900">No items found</h3>
            <p className="mt-1 text-xs text-gray-500">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="w-full">
            
            {/* LAYOUT 1: THE BANTABA (Airy, Premium Floating Cards) */}
            {currentLayout === 'bantaba' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
                {displayedProducts.map((product) => {
                  const imgUrl = product.image_urls?.[0] || product.image_url;
                  return (
                    <Link href={`/product/${product.id}`} key={product.id} className="group flex flex-col rounded-[2rem] bg-white p-4 shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                      <div className="relative aspect-square overflow-hidden rounded-[1.5rem] bg-gray-50">
                        {imgUrl ? <img src={imgUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-gray-300"><ShoppingBag size={24} /></div>}
                      </div>
                      <div className="mt-5 text-center px-2">
                        <h4 className="text-sm font-bold text-gray-900 truncate">{product.name}</h4>
                        <p className={`mt-1.5 text-xs font-black uppercase tracking-widest ${theme.text}`}>D{product.price.toLocaleString()}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* LAYOUT 2: THE SENEGAMBIA (Massive Editorial Lookbook) */}
            {currentLayout === 'senegambia' && (
              <div className="flex flex-col gap-16 max-w-2xl mx-auto">
                {displayedProducts.map((product) => {
                  const imgUrl = product.image_urls?.[0] || product.image_url;
                  return (
                    <Link href={`/product/${product.id}`} key={product.id} className="group flex flex-col">
                      <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-gray-100 shadow-md">
                        {imgUrl ? <img src={imgUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-gray-300"><ShoppingBag size={32} /></div>}
                      </div>
                      <div className="mt-6 text-center">
                        <h4 className="text-xl font-serif text-gray-900">{product.name}</h4>
                        <p className={`mt-2 text-sm font-bold ${theme.text}`}>D{product.price.toLocaleString()}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* LAYOUT 3: THE KAIRABA (Horizontal List View) */}
            {currentLayout === 'kairaba' && (
              <div className="flex flex-col gap-6 max-w-3xl mx-auto">
                {displayedProducts.map((product) => {
                  const imgUrl = product.image_urls?.[0] || product.image_url;
                  return (
                    <Link href={`/product/${product.id}`} key={product.id} className="group flex items-center gap-5 rounded-3xl bg-white p-4 shadow-sm border border-gray-100 hover:shadow-md transition">
                      <div className="relative h-32 w-28 shrink-0 overflow-hidden rounded-2xl bg-gray-50">
                        {imgUrl ? <img src={imgUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-gray-300"><ShoppingBag size={20} /></div>}
                      </div>
                      <div className="flex-1 pr-4">
                        <h4 className="text-lg font-bold text-gray-900 group-hover:underline line-clamp-2">{product.name}</h4>
                        <p className={`mt-2 text-sm font-black ${theme.text}`}>D{product.price.toLocaleString()}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* LAYOUT 4: THE JOLLOF (THE LUXURY FOOTWEAR/SNEAKERHEAD LAYOUT) */}
            {currentLayout === 'jollof' && (
              <div className="grid grid-cols-2 gap-4 md:gap-6">
                {displayedProducts.map((product, index) => {
                  const imgUrl = product.image_urls?.[0] || product.image_url;
                  const isFeatured = index % 3 === 0;

                  return (
                    <Link 
                      href={`/product/${product.id}`} 
                      key={product.id} 
                      className={`group flex flex-col ${isFeatured ? 'col-span-2' : 'col-span-1'}`}
                    >
                      <div className={`relative overflow-hidden rounded-3xl bg-[#F4F4F4] border border-gray-100/50 flex items-center justify-center ${isFeatured ? 'aspect-[4/3] md:aspect-[21/9]' : 'aspect-square'}`}>
                        {imgUrl ? (
                          <img 
                            src={imgUrl} 
                            alt={product.name} 
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" 
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-gray-300">
                            <ShoppingBag size={isFeatured ? 40 : 24} />
                          </div>
                        )}
                      </div>
                      <div className={`mt-4 flex flex-col justify-between px-1 ${isFeatured ? 'md:flex-row md:items-center' : ''}`}>
                        <div>
                          <h4 className={`font-bold text-gray-900 group-hover:underline leading-tight ${isFeatured ? 'text-lg md:text-xl' : 'text-sm'}`}>
                            {product.name}
                          </h4>
                          {isFeatured && <p className="mt-1 text-xs font-semibold text-gray-500 uppercase tracking-widest">Footwear Edit</p>}
                        </div>
                        <p className={`mt-2 font-black tracking-tighter ${theme.text} ${isFeatured ? 'text-xl md:text-2xl md:mt-0' : 'text-base'}`}>
                          D{product.price.toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* LAYOUT 5: THE SERREKUNDA (Dense 2-Column Catalog) */}
            {currentLayout === 'serrekunda' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {displayedProducts.map((product) => {
                  const imgUrl = product.image_urls?.[0] || product.image_url;
                  return (
                    <Link href={`/product/${product.id}`} key={product.id} className="group flex flex-col">
                      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-gray-50 border border-gray-100 shadow-sm">
                        {imgUrl ? <img src={imgUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-gray-300"><ShoppingBag size={20} /></div>}
                      </div>
                      <div className="mt-2.5 px-1">
                        <h4 className="truncate text-[11px] font-semibold text-gray-900 group-hover:underline">{product.name}</h4>
                        <p className={`mt-0.5 text-[11px] font-bold ${theme.text}`}>D{product.price.toLocaleString()}</p>
                      </div>
                    </Link>
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