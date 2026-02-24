'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, MessageCircle, Share2, ShoppingBag } from 'lucide-react';

type Shop = {
  id: string;
  shop_name: string;
  shop_slug: string;
  whatsapp_number: string | null;
  banner_url: string | null;
};

type Product = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string | null;
};

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
        .select('*')
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

  const handleShareStore = () => {
    if (!shop) return;
    const storeUrl = window.location.href;
    const message = encodeURIComponent(
      `🛍️ Check out *${shop.shop_name}* on Sanndikaa!\n\nShop now: ${storeUrl}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleChat = () => {
    if (!shop?.whatsapp_number) return;
    let cleanNumber = shop.whatsapp_number.replace(/\D/g, '');
    if (cleanNumber.length === 7) cleanNumber = `220${cleanNumber}`;
    window.location.href = `https://wa.me/${cleanNumber}`;
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-500">Loading Shop...</div>;
  }

  if (!shop) {
    return <div className="p-10 text-center text-gray-500">Shop not found.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header
        className="relative w-full overflow-hidden"
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
        <div className="bg-gradient-to-t from-black/80 to-transparent px-4 pb-8 pt-14 text-white">
          <div className="mx-auto max-w-md text-center">
            <h1 className="text-3xl font-semibold tracking-tight">{shop.shop_name}</h1>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
              <BadgeCheck size={14} />
              Verified Seller
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleChat}
                className="inline-flex items-center gap-2 rounded-full bg-green-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-400"
              >
                <MessageCircle size={16} />
                Chat
              </button>
              <button
                type="button"
                onClick={handleShareStore}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
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
                      ? 'bg-gray-900 text-white shadow-sm'
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

      <main className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 md:gap-6">
        {filteredProducts.length === 0 ? (
          <div className="col-span-2 rounded-2xl bg-white p-8 text-center shadow-sm md:col-span-3">
            <ShoppingBag className="mx-auto mb-3 text-gray-300" size={40} />
            <p className="text-sm font-medium text-gray-500">No products found in this category.</p>
          </div>
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
