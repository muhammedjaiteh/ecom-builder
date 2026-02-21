'use client';

import React, { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { MessageCircle, ShoppingBag } from 'lucide-react';

type Shop = {
  id: string;
  shop_name: string;
  shop_slug: string;
  logo_url: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
  theme_color?: string | null;
};

type Product = {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
};

export default function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const { slug } = React.use(params);
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function loadShop() {
      setLoading(true);

      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('shop_slug', slug)
        .single();

      if (shopError || !shopData) {
        console.error('Shop error:', shopError);
        setShop(null);
        setProducts([]);
        setLoading(false);
        return;
      }

      setShop(shopData);

      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, name, image_url, price')
        .eq('shop_id', shopData.id)
        .order('created_at', { ascending: false });

      if (productError) {
        console.error('Products error:', productError);
      }

      setProducts(productData || []);
      setLoading(false);
    }

    loadShop();
  }, [slug, supabase]);

  if (loading) return <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center">Loading Shop...</div>;

  if (!shop)
    return (
      <div className="min-h-screen bg-[#F9F8F6] flex flex-col items-center justify-center text-center p-10">
        <h1 className="text-4xl font-serif text-[#2C3E2C] mb-4">Shop Not Found</h1>
        <p className="text-gray-500 mb-8">This store link is invalid or has been removed.</p>
        <Link href="/" className="bg-[#2C3E2C] text-white px-6 py-3 rounded-full font-bold">
          Return to Market
        </Link>
      </div>
    );

  const headerTheme = shop.theme_color || '#1a2e1a';
  const whatsappNumber = shop.whatsapp_number || shop.phone || '';

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-[#2C3E2C]">
      <header className="text-white pt-20 pb-16 px-6 relative overflow-hidden" style={{ backgroundColor: headerTheme }}>
        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <div className="w-32 h-32 bg-white text-[#2C3E2C] rounded-full mx-auto mb-6 flex items-center justify-center shadow-xl overflow-hidden border-4 border-white/20">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt={shop.shop_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-serif font-bold">{shop.shop_name.charAt(0)}</span>
            )}
          </div>

          <h1 className="text-4xl md:text-6xl font-serif font-medium mb-4">{shop.shop_name}</h1>
          <p className="text-white/80 text-lg max-w-lg mx-auto mb-8">Verified Seller on Sanndikaa</p>

          {whatsappNumber && (
            <div className="flex justify-center gap-4">
              <a
                href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="bg-green-500 hover:bg-green-400 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-all"
              >
                <MessageCircle size={18} /> Chat on WhatsApp
              </a>
            </div>
          )}
        </div>

        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8 border-b border-[#E6E4DC] pb-4">
          <span className="font-bold text-gray-400 uppercase tracking-widest text-xs">{products.length} Products Available</span>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <ShoppingBag size={48} className="mx-auto mb-4" />
            <p>This shop has not added any products yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <article key={product.id} className="bg-white rounded-2xl shadow-sm border border-[#E6E4DC] overflow-hidden">
                <div className="aspect-[4/3] bg-[#E6E4DC]">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag size={36} className="text-[#5F6F5F]" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-[#2C3E2C]">{product.name}</h3>
                  <p className="text-[#5F6F5F] font-bold mt-2">D{product.price}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center py-8 text-gray-400 text-xs uppercase tracking-widest border-t border-[#E6E4DC]">
        Powered by Sanndikaa
      </footer>
    </div>
  );
}
