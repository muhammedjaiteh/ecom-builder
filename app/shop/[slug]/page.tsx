'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, MessageCircle, Share2, ShoppingBag, Store } from 'lucide-react';

type Shop = {
  id: string;
  shop_name: string;
  shop_slug: string;
  whatsapp_number: string | null;
  banner_url: string | null;
  logo_url: string | null;
  bio: string | null;
  store_layout?: string | null;
  theme_color: string | null; // Updated to accept any color string
};

type Product = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  image_urls?: string[] | null;
  category: string | null;
};

// THE FIX: The Storefront now knows all 11 Luxury Colors
const themeColors: Record<string, { bg: string; text: string; ring: string }> = {
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', ring: 'ring-emerald-600' },
  midnight: { bg: 'bg-slate-900', text: 'text-slate-900', ring: 'ring-slate-900' },
  terracotta: { bg: 'bg-orange-700', text: 'text-orange-700', ring: 'ring-orange-700' },
  ocean: { bg: 'bg-blue-600', text: 'text-blue-600', ring: 'ring-blue-600' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-500', ring: 'ring-rose-500' },
  champagne: { bg: 'bg-[#D7C0AE]', text: 'text-[#B89F8A]', ring: 'ring-[#D7C0AE]' },
  sage: { bg: 'bg-[#8A9A86]', text: 'text-[#6B7A68]', ring: 'ring-[#8A9A86]' },
  onyx: { bg: 'bg-[#1A1A1A]', text: 'text-[#1A1A1A]', ring: 'ring-[#1A1A1A]' },
  crimson: { bg: 'bg-[#8B0000]', text: 'text-[#8B0000]', ring: 'ring-[#8B0000]' },
  sand: { bg: 'bg-[#C2B280]', text: 'text-[#A39461]', ring: 'ring-[#C2B280]' },
  stone: { bg: 'bg-[#8B8C89]', text: 'text-[#6C6D6A]', ring: 'ring-[#8B8C89]' },
};

const fallbackThemeColor = 'emerald';

export default function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = decodeURIComponent(resolvedParams.slug);

  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchShopData() {
      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('id, shop_name, shop_slug, whatsapp_number, banner_url, logo_url, bio, store_layout, theme_color')
        .eq('shop_slug', slug)
        .single();

      if (shopError) {
        console.error('Database Error:', shopError);
        setLoading(false);
        return;
      }

      setShop(shopData as Shop);

      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', shopData.id);

      if (productError) console.error('Database Error:', productError);
      setProducts((productData as Product[]) || []);
      setLoading(false);
    }

    fetchShopData();
  }, [slug, supabase]);

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        products
          .map((product) => product.category?.trim())
          .filter((category): category is string => Boolean(category))
      )
    );
    return ['All', ...uniqueCategories];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'All') return products;
    return products.filter((product) => product.category === selectedCategory);
  }, [products, selectedCategory]);

  const cleanWhatsappNumber = (() => {
    if (!shop?.whatsapp_number) return null;
    let cleanNumber = shop.whatsapp_number.replace(/\D/g, '');
    if (cleanNumber.length === 7) cleanNumber = `220${cleanNumber}`;
    return cleanNumber;
  })();

  const activeColor = useMemo(() => {
    const themeKey = shop?.theme_color ?? fallbackThemeColor;
    return themeColors[themeKey] ?? themeColors[fallbackThemeColor];
  }, [shop?.theme_color]);

  const handleShareStore = () => {
    if (!shop) return;
    const storeUrl = window.location.href;
    const message = encodeURIComponent(`🛍️ Check out *${shop.shop_name}* on Sanndikaa!\n\nShop now: ${storeUrl}`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleChat = () => {
    if (!cleanWhatsappNumber) return;
    window.location.href = `https://wa.me/${cleanWhatsappNumber}`;
  };

  const layoutString = (shop?.store_layout || '').toLowerCase();
  const matchedLayout = layoutString.includes('senegambia')
    ? 'senegambia'
    : layoutString.includes('jollof')
      ? 'jollof'
      : layoutString.includes('serrekunda')
        ? 'serrekunda'
        : layoutString.includes('kairaba')
          ? 'kairaba'
          : 'bantaba';

  const isBrightEditorial = matchedLayout === 'senegambia';

  const getPageBg = () => {
    if (isBrightEditorial) return 'bg-white';
    if (matchedLayout === 'jollof') return 'bg-[#050505]';
    if (matchedLayout === 'bantaba') return 'bg-[#F9F8F6]';
    return 'bg-white';
  };

  const getGridClasses = () => {
    switch (matchedLayout) {
      case 'serrekunda':
        return 'mt-8 grid grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-8 md:gap-x-4 md:gap-y-12 px-3 md:px-8 mx-auto max-w-6xl';
      case 'bantaba':
        return 'mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-5 md:gap-y-12 px-4 md:px-8 mx-auto max-w-7xl';
      case 'kairaba':
        return 'mt-12 w-full';
      case 'jollof':
        return 'mt-12 grid items-start grid-cols-2 gap-x-6 gap-y-16 px-4 md:px-8 md:grid-cols-3 lg:grid-cols-4 mx-auto max-w-7xl';
      case 'senegambia':
        return 'mt-16 grid grid-cols-1 gap-12 px-4 md:px-10 md:grid-cols-2 mx-auto max-w-7xl pb-20';
      default:
        return 'mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 px-4 md:px-8 mx-auto max-w-7xl';
    }
  };

  const renderLayout = () => {
    switch (matchedLayout) {
      case 'serrekunda':
        return filteredProducts.map((product) => {
          const productImage = product.image_urls?.[0] || product.image_url;
          return (
            <Link href={`/product/${product.id}`} key={product.id} className="group block">
              <div className="aspect-[4/5] w-full overflow-hidden bg-[#F2F2F2]">
                {productImage ? (
                  <img src={productImage} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                ) : (
                  <div className="flex h-full min-h-[160px] md:min-h-[220px] items-center justify-center text-slate-300"><ShoppingBag className="w-6 h-6 md:w-8 md:h-8" /></div>
                )}
              </div>
              <div className="mt-3 md:mt-4 flex flex-col items-center text-center text-neutral-900">
                <h2 className="text-xs md:text-sm font-medium w-full truncate px-1">{product.name}</h2>
                <p className="mt-0.5 md:mt-1 text-xs md:text-sm font-bold">D{product.price}</p>
              </div>
            </Link>
          );
        });

      case 'bantaba':
        return filteredProducts.map((product) => {
          const productImage = product.image_urls?.[0] || product.image_url;
          return (
            <Link href={`/product/${product.id}`} key={product.id} className="group block rounded-lg md:rounded-xl bg-white p-2.5 md:p-3 shadow-sm border border-neutral-100 transition-all hover:shadow-md hover:-translate-y-0.5">
              <div className="aspect-[4/5] w-full overflow-hidden rounded-md md:rounded-lg bg-[#F9F8F6]">
                {productImage ? (
                  <img src={productImage} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                ) : (
                  <div className="flex h-full min-h-[160px] md:min-h-[220px] items-center justify-center text-slate-400"><ShoppingBag className="w-6 h-6 md:w-8 md:h-8" /></div>
                )}
              </div>
              <div className="mt-3 md:mt-4 flex flex-col items-center text-center text-gray-900">
                <div className="mb-1.5 md:mb-2 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-[10px] font-bold tracking-widest text-emerald-700 uppercase">
                  <BadgeCheck strokeWidth={2.5} className="w-3 h-3 md:w-3.5 md:h-3.5" /> <span>Verified</span>
                </div>
                <h2 className="w-full truncate px-1 md:px-2 text-xs md:text-sm font-medium leading-tight">{product.name}</h2>
                <p className="mt-1 text-xs md:text-sm font-bold">D{product.price}</p>
              </div>
            </Link>
          );
        });

      case 'kairaba':
        if (filteredProducts.length === 0) return null;
        return (
          <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
            {(() => {
              const heroProduct = filteredProducts[0];
              const heroImage = heroProduct.image_urls?.[0] || heroProduct.image_url;
              return (
                <Link href={`/product/${heroProduct.id}`} className="group mb-20 block overflow-hidden rounded-2xl bg-[#F9F9F9] border border-neutral-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 md:items-center">
                    <div className="aspect-[4/5] w-full overflow-hidden bg-neutral-200">
                      {heroImage ? (
                        <img src={heroImage} alt={heroProduct.name} className="h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.03]" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-neutral-300"><ShoppingBag size={56} /></div>
                      )}
                    </div>
                    <div className="flex flex-col justify-center p-8 md:p-16 text-center md:text-left">
                      <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">Exclusively Featured</p>
                      <h2 className="text-3xl md:text-5xl font-serif text-neutral-900 leading-tight">{heroProduct.name}</h2>
                      <p className="mt-6 text-xl font-medium text-neutral-600">D{heroProduct.price}</p>
                      <div className="mt-8 inline-flex items-center justify-center md:justify-start">
                        <span className="border-b border-neutral-900 pb-1 text-sm font-semibold uppercase tracking-widest text-neutral-900 transition-colors group-hover:text-neutral-500 group-hover:border-neutral-500">View Product</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })()}
            <div className="grid grid-cols-2 gap-x-6 gap-y-16 md:grid-cols-3">
              {filteredProducts.slice(1).map((product) => {
                const productImage = product.image_urls?.[0] || product.image_url;
                return (
                  <Link href={`/product/${product.id}`} key={product.id} className="group flex flex-col">
                    <div className="aspect-[4/5] w-full overflow-hidden bg-neutral-100">
                      {productImage ? (
                        <img src={productImage} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-neutral-300"><ShoppingBag size={40} /></div>
                      )}
                    </div>
                    <div className="mt-4 flex flex-col text-neutral-900">
                      <h2 className="text-sm font-medium">{product.name}</h2>
                      <p className="mt-1 text-sm font-bold">D{product.price}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );

      case 'jollof':
        return filteredProducts.map((product, index) => {
          const productImage = product.image_urls?.[0] || product.image_url;
          return (
            <Link href={`/product/${product.id}`} key={product.id} className={`group flex flex-col ${index % 2 !== 0 ? 'md:mt-24' : ''}`}>
              <div className="aspect-[4/5] w-full overflow-hidden bg-[#1A1A1A]">
                {productImage ? (
                  <img src={productImage} alt={product.name} className="h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.07] opacity-90 group-hover:opacity-100" />
                ) : (
                  <div className="flex h-full min-h-[220px] items-center justify-center text-white/10"><ShoppingBag size={34} /></div>
                )}
              </div>
              <div className="mt-5 flex flex-col px-2 text-[#F4F4F4]">
                <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">Gallery Item</p>
                <h2 className="text-sm font-semibold uppercase tracking-wide">{product.name}</h2>
                <p className="mt-1.5 text-sm font-light text-neutral-400">D{product.price}</p>
              </div>
            </Link>
          );
        });

      case 'senegambia':
        return filteredProducts.map((product) => {
          const productImage = product.image_urls?.[0] || product.image_url;
          return (
            <Link href={`/product/${product.id}`} key={product.id} className="group flex flex-col bg-white">
              <div className="aspect-[4/5] w-full overflow-hidden bg-[#F7F7F7]">
                {productImage ? (
                  <img 
                    src={productImage} 
                    alt={product.name} 
                    className="h-full w-full object-cover transition-all duration-1000 ease-out group-hover:scale-[1.03]" 
                  />
                ) : (
                  <div className="flex h-full min-h-[300px] items-center justify-center text-neutral-300 bg-neutral-100">
                    <ShoppingBag size={40} />
                  </div>
                )}
              </div>
              <div className="mt-8 flex flex-col items-center text-center px-4">
                <h2 className="text-2xl font-serif tracking-tight text-gray-950 leading-tight">{product.name}</h2>
                <p className="mt-3 text-base font-medium text-gray-700">D{product.price}</p>
                <div className="mt-5 inline-flex items-center">
                    <span className={`text-xs font-semibold uppercase tracking-widest border-b-2 pb-1 ${activeColor.text} border-current`}>
                        View Details
                    </span>
                </div>
              </div>
            </Link>
          );
        });

      default:
        return null;
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-gray-500">Loading Collection...</div>;
  if (!shop) return <div className="flex min-h-screen items-center justify-center text-gray-500">Store not found.</div>;

  return (
    <div className={`min-h-screen pb-24 ${getPageBg()}`}>
      <header className="w-full">
        {isBrightEditorial ? (
             <div className="px-4 pb-16 pt-20 border-b border-gray-100 bg-white mb-12">
             <div className="mx-auto flex max-w-7xl flex-col items-center text-center">
               <div className="h-32 w-32 overflow-hidden rounded-full border border-gray-100 bg-white shadow-sm p-1">
                 {shop.logo_url ? (
                   <img src={shop.logo_url} alt={`${shop.shop_name} logo`} className="h-full w-full object-cover rounded-full" />
                 ) : (
                   <div className="flex h-full w-full items-center justify-center text-gray-400 bg-gray-50 rounded-full"><Store size={40} /></div>
                 )}
               </div>
               <h1 className="mt-10 text-5xl md:text-6xl font-serif tracking-tighter text-gray-950">{shop.shop_name}</h1>
               <div className={`mt-5 inline-flex items-center gap-2 rounded-full bg-gray-50 border border-gray-100 px-5 py-2 text-sm font-semibold ${activeColor.text}`}>
                 <BadgeCheck size={16} /> Premium Curator
               </div>
               <p className="mt-8 max-w-2xl text-base text-gray-600 leading-relaxed font-normal">{shop.bio || 'Discover our exclusive, handpicked collection.'}</p>
               <div className="mt-12 flex items-center justify-center gap-4">
                 <button type="button" onClick={handleChat} className={`inline-flex items-center gap-2.5 rounded-full px-8 py-3.5 text-base font-semibold text-white shadow-sm transition hover:opacity-90 ${activeColor.bg}`}>
                   <MessageCircle size={18} /> Contact Showroom
                 </button>
                 <button type="button" onClick={handleShareStore} className={`inline-flex items-center gap-2.5 rounded-full px-8 py-3.5 text-base font-semibold text-gray-800 bg-white border border-gray-200 shadow-sm transition hover:bg-gray-50`}>
                   <Share2 size={18} /> Share Collection
                 </button>
               </div>
             </div>
           </div>
        ) : shop.store_layout === 'kairaba' ? (
          <div className="px-4 pb-12 pt-16">
            <div className="mx-auto flex max-w-xl flex-col items-center text-center">
              <div className="h-28 w-28 overflow-hidden rounded-full border border-neutral-200 bg-white shadow-sm">
                {shop.logo_url ? (
                  <img src={shop.logo_url} alt={`${shop.shop_name} logo`} className="h-full w-full object-cover p-1 rounded-full" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400"><Store size={34} /></div>
                )}
              </div>
              <h1 className="mt-8 text-4xl font-serif tracking-tight text-gray-900">{shop.shop_name}</h1>
              <div className={`mt-4 inline-flex items-center gap-1.5 rounded-full bg-neutral-50 px-4 py-1.5 text-xs font-semibold ${activeColor.text}`}>
                <BadgeCheck size={14} /> Official Store
              </div>
              <p className="mt-6 max-w-md text-sm text-gray-500 leading-relaxed">{shop.bio || 'Discover our exclusive collection.'}</p>
              <div className="mt-8 flex items-center justify-center gap-4">
                <button type="button" onClick={handleChat} className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${activeColor.bg}`}>
                  <MessageCircle size={16} /> Contact Stylist
                </button>
                <button type="button" onClick={handleShareStore} className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-neutral-700 bg-white border border-neutral-200 shadow-sm transition hover:bg-neutral-50`}>
                  <Share2 size={16} /> Share
                </button>
              </div>
            </div>
          </div>
        ) : shop.store_layout === 'serrekunda' ? (
          <div className="px-4 py-8">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-2xl bg-[#F9F9F9] p-4 border border-neutral-100">
              <div className="flex min-w-0 items-center gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-white shadow-sm">
                  {shop.logo_url ? (
                    <img src={shop.logo_url} alt={`${shop.shop_name} logo`} className="h-full w-full object-cover p-0.5 rounded-full" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400"><Store size={22} /></div>
                  )}
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-bold text-gray-900">{shop.shop_name}</h1>
                  <p className="truncate text-sm text-gray-500 mt-0.5">{shop.bio || 'Latest fashion arrivals.'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleChat} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${activeColor.bg}`}>
                  <MessageCircle size={16} /> Message
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              className="relative h-56 w-full overflow-hidden"
              style={shop.banner_url ? { backgroundImage: `url(${shop.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { backgroundColor: '#E5E5E5' }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            </div>
            <div className="relative z-10 -mt-16 px-4 pb-8">
              <div className="mx-auto flex max-w-md flex-col items-center text-center">
                <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-white shadow-md">
                  {shop.logo_url ? (
                    <img src={shop.logo_url} alt={`${shop.shop_name} logo`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400"><Store size={34} /></div>
                  )}
                </div>
                <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900">{shop.shop_name}</h1>
                <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full bg-white border border-neutral-100 px-4 py-1.5 text-xs font-semibold ${activeColor.text}`}>
                  <BadgeCheck size={14} /> Verified Seller
                </div>
                <p className="mt-4 max-w-xs text-center text-sm text-neutral-500">{shop.bio || 'Welcome to our premium store.'}</p>
                <div className="mt-6 flex items-center justify-center gap-4">
                  <button type="button" onClick={handleChat} className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${activeColor.bg}`}>
                    <MessageCircle size={16} /> Chat
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </header>

      <section className="mx-auto max-w-7xl px-4 pt-6 md:px-10 mb-6">
        <div className="hide-scrollbar overflow-x-auto whitespace-nowrap">
          <div className="inline-flex gap-3 pb-4">
            {categories.map((category) => {
              const active = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`rounded-full px-6 py-3 text-sm font-semibold transition-all duration-300 ${
                    active
                      ? `${activeColor.bg} text-white shadow-md`
                      : isBrightEditorial
                        ? 'bg-white text-gray-700 border border-gray-200 hover:border-gray-900 hover:text-gray-950'
                        : 'bg-white text-neutral-500 border border-neutral-200 hover:border-neutral-900 hover:text-neutral-900'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <main className={getGridClasses()}>
        {!products || products.length === 0 ? (
          <div className="col-span-full flex min-h-[45vh] flex-col items-center justify-center px-6 text-center bg-gray-50 rounded-2xl border border-gray-100">
            <div className="mb-6 text-5xl opacity-80" aria-hidden="true">🛍️</div>
            <h2 className="text-2xl font-serif text-gray-950">Collection Empty</h2>
            <p className="mt-3 max-w-md text-sm text-gray-600 leading-relaxed">
              The showroom curator is currently finalizing this collection. Please accept our apologies and check back shortly for exclusive arrivals.
            </p>
          </div>
        ) : (
          renderLayout()
        )}
      </main>
    </div>
  );
}