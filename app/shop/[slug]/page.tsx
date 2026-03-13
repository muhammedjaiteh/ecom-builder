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

  const isDark = matchedLayout === 'senegambia';

  // Ensures the entire page background matches the layout theme
  const getPageBg = () => {
    if (matchedLayout === 'senegambia') return 'bg-[#0a0a0a]';
    if (matchedLayout === 'jollof') return 'bg-[#FAFAF8]';
    if (matchedLayout === 'bantaba') return 'bg-[#F5F4F1]';
    return 'bg-white';
  };

  const getGridClasses = () => {
    switch (matchedLayout) {
      case 'serrekunda':
        return 'mt-8 grid grid-cols-2 gap-x-4 gap-y-10 px-4 md:px-8 md:grid-cols-3 lg:grid-cols-3 mx-auto max-w-7xl';
      case 'bantaba':
        return 'mt-8 grid grid-cols-2 gap-x-4 gap-y-10 px-4 md:px-8 md:grid-cols-3 lg:grid-cols-4 mx-auto max-w-7xl';
      case 'kairaba':
        return 'mt-8 w-full';
      case 'jollof':
        return 'mt-8 grid items-start grid-cols-2 gap-x-6 gap-y-12 px-4 md:px-8 md:grid-cols-3 lg:grid-cols-4 mx-auto max-w-7xl';
      case 'senegambia':
        return 'mt-12 grid grid-cols-1 gap-8 px-4 md:px-8 md:grid-cols-2 mx-auto max-w-6xl';
      default:
        return 'mt-8 grid grid-cols-2 gap-x-4 gap-y-10 px-4 md:px-8 md:grid-cols-3 lg:grid-cols-4 mx-auto max-w-7xl';
    }
  };

  const renderLayout = () => {
    switch (matchedLayout) {
      case 'serrekunda':
        return filteredProducts.map((product) => {
          const productImage = product.image_urls?.[0] || product.image_url;
          return (
            <Link href={`/product/${product.id}`} key={product.id} className="group block">
              <div className="aspect-[4/5] w-full overflow-hidden bg-neutral-100">
                {productImage ? (
                  <img src={productImage} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
                ) : (
                  <div className="flex h-full min-h-[220px] items-center justify-center text-slate-300"><ShoppingBag size={34} /></div>
                )}
              </div>
              <div className="mt-3 text-neutral-900">
                <h2 className="truncate text-sm font-medium">{product.name}</h2>
                <p className="mt-0.5 text-sm font-bold">D{product.price}</p>
              </div>
            </Link>
          );
        });

      case 'bantaba':
        return filteredProducts.map((product) => {
          const productImage = product.image_urls?.[0] || product.image_url;
          return (
            <Link href={`/product/${product.id}`} key={product.id} className="group block rounded-xl bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
              <div className="aspect-[4/5] w-full overflow-hidden rounded-lg bg-[#F5F4F1]">
                {productImage ? (
                  <img src={productImage} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
                ) : (
                  <div className="flex h-full min-h-[220px] items-center justify-center text-slate-400"><ShoppingBag size={34} /></div>
                )}
              </div>
              <div className="mt-3 text-gray-900">
                <div className="mb-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold tracking-wider text-emerald-700 uppercase">
                  <BadgeCheck size={12} strokeWidth={2.5} />
                  Verified Seller
                </div>
                <h2 className="truncate text-sm font-medium">{product.name}</h2>
                <p className="mt-0.5 text-sm font-bold">D{product.price}</p>
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
                <Link href={`/product/${heroProduct.id}`} className="group mb-16 block">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="aspect-[4/5] w-full overflow-hidden bg-neutral-100 md:col-span-2 md:aspect-[16/9]">
                      {heroImage ? (
                        <img src={heroImage} alt={heroProduct.name} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                      ) : (
                        <div className="flex h-full min-h-[420px] items-center justify-center text-neutral-300"><ShoppingBag size={56} /></div>
                      )}
                    </div>
                    <div className="flex flex-col justify-end md:pb-8">
                      <div className="w-full border-t border-neutral-200 pt-4 md:border-t-0 md:border-l md:pl-8 md:pt-0">
                        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-400">Featured</p>
                        <h2 className="text-2xl font-serif text-neutral-900">{heroProduct.name}</h2>
                        <p className="mt-2 text-lg font-medium text-neutral-600">D{heroProduct.price}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })()}
            <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3">
              {filteredProducts.slice(1).map((product) => {
                const productImage = product.image_urls?.[0] || product.image_url;
                return (
                  <Link href={`/product/${product.id}`} key={product.id} className="group block">
                    <div className="aspect-[4/5] w-full overflow-hidden bg-neutral-100">
                      {productImage ? (
                        <img src={productImage} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
                      ) : (
                        <div className="flex h-full min-h-[240px] items-center justify-center text-neutral-300"><ShoppingBag size={40} /></div>
                      )}
                    </div>
                    <div className="mt-3 text-neutral-900">
                      <h2 className="truncate text-sm font-medium">{product.name}</h2>
                      <p className="mt-0.5 text-sm font-bold">D{product.price}</p>
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
            <Link href={`/product/${product.id}`} key={product.id} className={`group flex flex-col ${index % 2 !== 0 ? 'md:mt-16' : ''}`}>
              <div className="aspect-[4/5] w-full overflow-hidden bg-[#EAE7E0]">
                {productImage ? (
                  <img src={productImage} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
                ) : (
                  <div className="flex h-full min-h-[220px] items-center justify-center text-[#3A322B]/30"><ShoppingBag size={34} /></div>
                )}
              </div>
              <div className="mt-4 flex flex-col text-[#3A322B]">
                <h2 className="text-xs font-semibold uppercase tracking-widest">{product.name}</h2>
                <p className="mt-1 text-sm font-light">D{product.price}</p>
              </div>
            </Link>
          );
        });

      case 'senegambia':
        return filteredProducts.map((product) => {
          const productImage = product.image_urls?.[0] || product.image_url;
          return (
            <Link href={`/product/${product.id}`} key={product.id} className="group flex flex-col text-white">
              <div className="aspect-[4/5] w-full overflow-hidden bg-[#111]">
                {productImage ? (
                  <img src={productImage} alt={product.name} className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-[1.03] group-hover:grayscale-0" />
                ) : (
                  <div className="flex h-full min-h-[220px] items-center justify-center text-white/30"><ShoppingBag size={36} /></div>
                )}
              </div>
              <div className="mt-5 flex flex-col items-center text-center">
                <h2 className="text-lg font-serif tracking-wide text-white">{product.name}</h2>
                <p className="mt-1 text-sm font-medium text-gray-400">D{product.price}</p>
              </div>
            </Link>
          );
        });

      default:
        return null;
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Loading Shop...</div>;
  if (!shop) return <div className="p-10 text-center text-gray-500">Shop not found.</div>;

  return (
    <div className={`min-h-screen pb-20 ${getPageBg()}`}>
      <header className="w-full">
        {shop.store_layout === 'kairaba' ? (
          <div className="px-4 pb-8 pt-12">
            <div className="mx-auto flex max-w-xl flex-col items-center text-center">
              <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-gray-100 shadow-md">
                {shop.logo_url ? (
                  <img src={shop.logo_url} alt={`${shop.shop_name} logo`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400"><Store size={34} /></div>
                )}
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-gray-900">{shop.shop_name}</h1>
              <div className={`mt-2 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold ${activeColor.text}`}>
                <BadgeCheck size={14} /> Verified Seller
              </div>
              <p className="mt-4 max-w-md text-sm text-gray-500">{shop.bio || 'Welcome to our store.'}</p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button type="button" onClick={handleChat} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${activeColor.bg}`}>
                  <MessageCircle size={16} /> Chat
                </button>
                <button type="button" onClick={handleShareStore} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${activeColor.bg}`}>
                  <Share2 size={16} /> Share Store
                </button>
              </div>
            </div>
          </div>
        ) : shop.store_layout === 'serrekunda' ? (
          <div className="px-4 py-6">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-2xl bg-white p-3 shadow-sm border border-neutral-100">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-white bg-gray-100 shadow-sm">
                  {shop.logo_url ? (
                    <img src={shop.logo_url} alt={`${shop.shop_name} logo`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400"><Store size={22} /></div>
                  )}
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-bold text-gray-900">{shop.shop_name}</h1>
                  <p className="truncate text-xs text-gray-500">{shop.bio || 'Welcome to our store.'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleChat} className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 ${activeColor.bg}`}>
                  <MessageCircle size={14} /> Chat
                </button>
                <button type="button" onClick={handleShareStore} className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 ${activeColor.bg}`}>
                  <Share2 size={14} /> Share
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              className="relative h-48 w-full overflow-hidden"
              style={shop.banner_url ? { backgroundImage: `url(${shop.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { backgroundColor: isDark ? '#000' : '#111827' }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            </div>
            <div className="relative z-10 -mt-12 px-4 pb-2">
              <div className="mx-auto flex max-w-md flex-col items-center text-center">
                <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-gray-100 shadow-md">
                  {shop.logo_url ? (
                    <img src={shop.logo_url} alt={`${shop.shop_name} logo`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400"><Store size={34} /></div>
                  )}
                </div>
                <h1 className={`mt-4 text-3xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{shop.shop_name}</h1>
                <div className={`mt-2 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold ${activeColor.text}`}>
                  <BadgeCheck size={14} /> Verified Seller
                </div>
                <p className={`mt-3 max-w-xs text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{shop.bio || 'Welcome to our store.'}</p>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button type="button" onClick={handleChat} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${activeColor.bg}`}>
                    <MessageCircle size={16} /> Chat
                  </button>
                  <button type="button" onClick={handleShareStore} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${activeColor.bg}`}>
                    <Share2 size={16} /> Share Store
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </header>

      <section className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
        <div className="hide-scrollbar overflow-x-auto whitespace-nowrap">
          <div className="inline-flex gap-2 pb-2">
            {categories.map((category) => {
              const active = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? `bg-white ring-2 ring-offset-1 ${isDark ? 'ring-offset-[#0a0a0a]' : ''} ${activeColor.ring} ${activeColor.text}`
                      : isDark
                        ? 'border border-zinc-800 bg-zinc-900 text-gray-300 hover:bg-zinc-800'
                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
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
            <div className="mb-4 text-5xl" aria-hidden="true">🛍️</div>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>Shelves are empty</h2>
            <p className={`mt-2 max-w-md text-sm ${isDark ? 'text-gray-400' : 'text-neutral-500'}`}>
              This seller is currently updating their inventory. Please check back soon for fresh arrivals.
            </p>
          </div>
        ) : (
          renderLayout()
        )}
      </main>
    </div>
  );
}