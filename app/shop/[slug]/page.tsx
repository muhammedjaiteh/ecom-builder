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
  theme_color: 'emerald' | 'midnight' | 'terracotta' | 'ocean' | 'rose' | null;
};

type Product = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  image_urls?: string[] | null;
  category: string | null;
};

const themeColors = {
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', ring: 'ring-emerald-600' },
  midnight: { bg: 'bg-slate-900', text: 'text-slate-900', ring: 'ring-slate-900' },
  terracotta: { bg: 'bg-orange-700', text: 'text-orange-700', ring: 'ring-orange-700' },
  ocean: { bg: 'bg-blue-600', text: 'text-blue-600', ring: 'ring-blue-600' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-500', ring: 'ring-rose-500' },
} as const;

const fallbackThemeColor: keyof typeof themeColors = 'emerald';

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

  // Light, airy backgrounds for all layouts
  const getPageBg = () => {
    if (matchedLayout === 'jollof') return 'bg-[#FDFBF7]'; // Premium Off-White
    if (matchedLayout === 'bantaba') return 'bg-[#F9F8F6]'; // Softer sand
    return 'bg-white'; // Senegambia, Serrekunda, Kairaba
  };

  const getGridClasses = () => {
    switch (matchedLayout) {
      case 'serrekunda':
        return 'mt-10 grid grid-cols-2 gap-x-4 gap-y-12 px-4 md:px-8 md:grid-cols-3 lg:grid-cols-3 mx-auto max-w-6xl';
      case 'bantaba':
        return 'mt-10 grid grid-cols-2 gap-x-5 gap-y-12 px-4 md:px-8 md:grid-cols-3 lg:grid-cols-4 mx-auto max-w-7xl';
      case 'kairaba':
        return 'mt-12 w-full';
      case 'jollof':
        return 'mt-12 grid items-start grid-cols-2 gap-x-6 gap-y-16 px-4 md:px-8 md:grid-cols-3 lg:grid-cols-4 mx-auto max-w-7xl';
      case 'senegambia':
        return 'mt-12 grid grid-cols-1 gap-10 px-4 md:px-8 md:grid-cols-2 mx-auto max-w-6xl';
      default:
        return 'mt-10 grid grid-cols-2 gap-x-4 gap-y-10 px-4 md:px-8 md:grid-cols-3 lg:grid-cols-4 mx-auto max-w-7xl';
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
                  <div className="flex h-full min-h-[220px] items-center justify-center text-slate-300"><ShoppingBag size={34} /></div>
                )}
              </div>
              <div className="mt-4 flex flex-col items-center text-center text-neutral-900">
                <h2 className="text-sm font-medium">{product.name}</h2>
                <p className="mt-1 text-sm font-bold">D{product.price}</p>
              </div>
            </Link>
          );
        });

      case 'bantaba':
        return filteredProducts.map((product) => {
          const productImage = product.image_urls?.[0] || product.image_url;
          return (
            <Link href={`/product/${product.id}`} key={product.id} className="group block rounded-xl bg-white p-3 shadow-sm border border-neutral-100 transition-shadow hover:shadow-md">
              <div className="aspect-[4/5] w-full overflow-hidden rounded-lg bg-[#F9F8F6]">
                {productImage ? (
                  <img src={productImage} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                ) : (
                  <div className="flex h-full min-h-[220px] items-center justify-center text-slate-400"><ShoppingBag size={34} /></div>
                )}
              </div>
              <div className="mt-4 flex flex-col items-center text-center text-gray-900">
                <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[9px] font-bold tracking-widest text-emerald-700 uppercase">
                  <BadgeCheck size={12} strokeWidth={2.5} /> Verified
                </div>
                <h2 className="w-full truncate px-2 text-sm font-medium">{product.name}</h2>
                <p className="mt-1 text-sm font-bold">D{product.price}</p>
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
              <div className="aspect-[4/5] w-full overflow-hidden bg-[#F0EBE1]">
                {productImage ? (
                  <img src={productImage} alt={product.name} className="h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.03] opacity-95 group-hover:opacity-100" />
                ) : (
                  <div className="flex h-full min-h-[220px] items-center justify-center text-neutral-300"><ShoppingBag size={34} /></div>
                )}
              </div>
              <div className="mt-5 flex flex-col px-2 text-neutral-900">
                <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">Gallery Item</p>
                <h2 className="text-sm font-semibold uppercase tracking-wide">{product.name}</h2>
                <p className="mt-1.5 text-sm font-medium text-neutral-600">D{product.price}</p>
              </div>
            </Link>
          );
        });

      case 'senegambia':
        return filteredProducts.map((product) => {
          const productImage = product.image_urls?.[0] || product.image_url;
          return (
            <Link href={`/product/${product.id}`} key={product.id} className="group flex flex-col text-neutral-900">
              <div className="aspect-[4/5] w-full overflow-hidden bg-neutral-100">
                {productImage ? (
                  <img src={productImage} alt={product.name} className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-[1.03] group-hover:grayscale-0" />
                ) : (
                  <div className="flex h-full min-h-[220px] items-center justify-center text-neutral-300"><ShoppingBag size={36} /></div>
                )}
              </div>
              <div className="mt-6 flex flex-col items-center text-center">
                <h2 className="text-xl font-serif tracking-wide text-neutral-900">{product.name}</h2>
                <p className="mt-2 text-sm font-medium text-neutral-500">D{product.price}</p>
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
        {shop.store_layout === 'kairaba' ? (
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

      <section className="mx-auto max-w-7xl px-4 pt-4 md:px-8">
        <div className="hide-scrollbar overflow-x-auto whitespace-nowrap">
          <div className="inline-flex gap-3 pb-4">
            {categories.map((category) => {
              const active = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${
                    active
                      ? `bg-neutral-900 text-white shadow-md`
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
          <div className="col-span-full flex min-h-[45vh] flex-col items-center justify-center px-6 text-center">
            <div className="mb-6 text-5xl opacity-80" aria-hidden="true">🛍️</div>
            <h2 className="text-2xl font-serif text-neutral-900">Collection Empty</h2>
            <p className="mt-3 max-w-md text-sm text-neutral-500">
              The curator is currently updating this collection. Please return shortly for new arrivals.
            </p>
          </div>
        ) : (
          renderLayout()
        )}
      </main>
    </div>
  );
}