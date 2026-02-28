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
  store_layout: 'bantaba' | 'kairaba' | 'serrekunda' | null;
  theme_color: 'emerald' | 'midnight' | 'terracotta' | 'ocean' | 'rose' | null;
};

type Product = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string | null;
};

const themeColors = {
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', ring: 'ring-emerald-600' },
  midnight: { bg: 'bg-slate-900', text: 'text-slate-900', ring: 'ring-slate-900' },
  terracotta: { bg: 'bg-orange-700', text: 'text-orange-700', ring: 'ring-orange-700' },
  ocean: { bg: 'bg-blue-600', text: 'text-blue-600', ring: 'ring-blue-600' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-500', ring: 'ring-rose-500' },
} as const;

export default function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

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

  const activeColor = shop?.theme_color ? themeColors[shop.theme_color] || themeColors.emerald : themeColors.emerald;

  const handleShareStore = () => {
    if (!shop) return;
    const storeUrl = window.location.href;
    const message = encodeURIComponent(
      `🛍️ Check out *${shop.shop_name}* on Sanndikaa!\n\nShop now: ${storeUrl}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleChat = () => {
    if (!cleanWhatsappNumber) return;
    window.location.href = `https://wa.me/${cleanWhatsappNumber}`;
  };

  const handleOrderProduct = (product: Product) => {
    if (!cleanWhatsappNumber || !shop) return;
    const message = encodeURIComponent(
      `Hi ${shop.shop_name}! I'd like to order:\n\n• ${product.name} - D${product.price}`
    );
    window.open(`https://wa.me/${cleanWhatsappNumber}?text=${message}`, '_blank');
  };

  const getGridClasses = () => {
    switch (shop?.store_layout) {
      case 'kairaba':
        return 'grid grid-cols-1 gap-8 p-4';
      case 'serrekunda':
        return 'grid grid-cols-3 gap-2 p-3';
      case 'bantaba':
      default:
        return 'grid grid-cols-2 gap-4 p-4';
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-500">Loading Shop...</div>;
  }

  if (!shop) {
    return <div className="p-10 text-center text-gray-500">Shop not found.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="w-full">
        <div
          className="relative h-44 w-full overflow-hidden"
          style={
            shop.banner_url
              ? {
                  backgroundImage: `url(${shop.banner_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : { backgroundColor: '#111827' }
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        </div>

        <div className="relative z-10 -mt-12 px-4 pb-2">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-gray-100 shadow-md">
              {shop.logo_url ? (
                <img src={shop.logo_url} alt={`${shop.shop_name} logo`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-400">
                  <Store size={34} />
                </div>
              )}
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">{shop.shop_name}</h1>
            <div className={`mt-2 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold ${activeColor.text}`}>
              <BadgeCheck size={14} />
              Verified Seller
            </div>

            <p className="mt-3 max-w-xs text-center text-sm text-gray-500">{shop.bio || 'Welcome to our store.'}</p>

            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleChat}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${activeColor.bg}`}
              >
                <MessageCircle size={16} />
                Chat
              </button>
              <button
                type="button"
                onClick={handleShareStore}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${activeColor.bg}`}
              >
                <Share2 size={16} />
                Share Store
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="px-4 pt-4">
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
                      ? `bg-white ring-2 ring-offset-1 ${activeColor.ring} ${activeColor.text}`
                      : 'border border-gray-200 bg-white text-gray-700'
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
        {filteredProducts.length === 0 ? (
          <div
            className={`rounded-2xl bg-white p-8 text-center shadow-sm ${
              shop.store_layout === 'serrekunda' ? 'col-span-3' : 'col-span-full'
            }`}
          >
            <ShoppingBag className="mx-auto mb-3 text-gray-300" size={40} />
            <p className="text-sm font-medium text-gray-500">No products found in this category.</p>
          </div>
        ) : shop.store_layout === 'kairaba' ? (
          filteredProducts.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <Link href={`/product/${product.id}`} className="block">
                <div className="aspect-[4/5] w-full bg-gray-100">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-300">
                      <ShoppingBag size={40} />
                    </div>
                  )}
                </div>
              </Link>
              <div className="space-y-4 p-5">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">{product.name}</h2>
                  <p className="mt-1 text-xl font-bold text-gray-700">D{product.price}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOrderProduct(product)}
                  className={`w-full rounded-full px-6 py-3 text-base font-semibold text-white transition hover:opacity-90 ${activeColor.bg}`}
                >
                  Order via WhatsApp
                </button>
              </div>
            </article>
          ))
        ) : shop.store_layout === 'serrekunda' ? (
          filteredProducts.map((product) => (
            <Link
              href={`/product/${product.id}`}
              key={product.id}
              className="overflow-hidden rounded-xl bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
            >
              <div className="aspect-square bg-gray-100">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-300">
                    <ShoppingBag size={20} />
                  </div>
                )}
              </div>
              <div className="p-2">
                <h2 className="truncate text-xs font-medium text-gray-800">{product.name}</h2>
                <p className="mt-0.5 text-xs font-bold text-gray-900">D{product.price}</p>
              </div>
            </Link>
          ))
        ) : (
          filteredProducts.map((product) => (
            <Link
              href={`/product/${product.id}`}
              key={product.id}
              className="overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="aspect-square bg-gray-100">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-300">
                    <ShoppingBag size={32} />
                  </div>
                )}
              </div>
              <div className="p-3">
                <h2 className="truncate text-sm font-medium text-gray-800">{product.name}</h2>
                <p className="mt-1 text-sm font-bold text-gray-900">D{product.price}</p>
              </div>
            </Link>
          ))
        )}
      </main>
    </div>
  );
}
