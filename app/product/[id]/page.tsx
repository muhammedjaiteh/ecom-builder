'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { use, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, MessageCircle, Share2, ShoppingBag } from 'lucide-react';
import Link from 'next/link';

type Product = {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string | null;
  category: string;
  shops: {
    shop_name: string;
    shop_slug: string;
    whatsapp_number: string | null;
    theme_color: 'emerald' | 'midnight' | 'terracotta' | 'ocean' | 'rose' | null;
  };
};

const themeColors = {
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', ring: 'ring-emerald-600' },
  midnight: { bg: 'bg-slate-900', text: 'text-slate-900', ring: 'ring-slate-900' },
  terracotta: { bg: 'bg-orange-700', text: 'text-orange-700', ring: 'ring-orange-700' },
  ocean: { bg: 'bg-blue-600', text: 'text-blue-600', ring: 'ring-blue-600' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-500', ring: 'ring-rose-500' },
} as const;

const PAYMENT_OPTIONS = ['Cash on Delivery', 'Wave'] as const;

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = use(params);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery');
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchProduct() {
      const { data, error } = await supabase
        .from('products')
        .select('*, shops(shop_name, shop_slug, whatsapp_number, theme_color)')
        .eq('id', productId)
        .single();

      if (error) {
        console.error('Error fetching product:', error);
      } else {
        setProduct(data as Product);
      }
      setLoading(false);
    }

    fetchProduct();
  }, [productId, supabase]);

  const shopData = product?.shops as
    | Product['shops']
    | Product['shops'][]
    | null
    | undefined;
  const themeColor = Array.isArray(shopData) ? shopData[0]?.theme_color : shopData?.theme_color;
  const activeColor = themeColor ? themeColors[themeColor] || themeColors.emerald : themeColors.emerald;

  const handleOrderClick = async () => {
    if (!product) return;

    await supabase.from('leads').insert({ product_id: product.id, shop_id: product.shops?.shop_name });

    const rawNumber = product.shops?.whatsapp_number;
    if (!rawNumber) {
      alert('This seller has not updated their WhatsApp number yet!');
      return;
    }

    let cleanNumber = rawNumber.replace(/\D/g, '');
    if (cleanNumber.length === 7) cleanNumber = `220${cleanNumber}`;

    const message = encodeURIComponent(
      `Hello ${product.shops?.shop_name}! 👋\n\nI want to buy ${product.name} for D${product.price}.\nMy payment method is: ${paymentMethod}.\n\nIs this available?`
    );
    window.location.href = `https://wa.me/${cleanNumber}?text=${message}`;
  };

  const handleShareProduct = () => {
    if (!product) return;
    const url = window.location.href;
    const message = encodeURIComponent(
      `🔥 Check out this product on Sanndikaa:\n\n*${product.name}* for D${product.price}\n\nTap the link to buy now:\n${url}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  if (loading)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F8F6]">
        <ShoppingBag size={32} className="mb-4 animate-pulse text-[#2C3E2C]" />
        <p className="text-xs font-bold uppercase text-gray-500">Loading Product...</p>
      </div>
    );

  if (!product)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F6]">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-serif text-gray-800">Product Not Found</h1>
          <Link href="/" className="text-sm font-bold text-green-700 hover:underline">
            Back to Marketplace
          </Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#F9F8F6] pb-24 font-sans text-[#2C3E2C]">
      <nav className="p-6">
        <Link
          href={`/shop/${product.shops?.shop_slug || ''}`}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase text-gray-500 hover:text-[#2C3E2C]"
        >
          <ArrowLeft size={16} /> Back
        </Link>
      </nav>

      <main className="mx-auto mt-4 grid max-w-4xl gap-8 px-4 md:grid-cols-2 md:gap-12 md:px-6">
        <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-300">
              <ShoppingBag size={48} />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center">
          <div className="mb-2">
            <span className="text-[10px] font-bold uppercase text-gray-400">{product.category || 'General'}</span>
          </div>
          <h1 className="mb-4 text-3xl font-semibold text-[#1a2e1a] md:text-5xl">{product.name}</h1>
          <p className="mb-6 text-3xl font-bold text-green-800">D{product.price}</p>

          <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="whitespace-pre-wrap text-sm text-gray-600">
              {product.description || 'No description provided.'}
            </p>
          </div>
          <div className="mb-8 border-t border-gray-100 pt-6">
            <Link
              href={`/shop/${product.shops?.shop_slug}`}
              className="hover:opacity-70 transition-opacity cursor-pointer inline-block"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Sold By</p>
              <p className="text-base font-bold text-green-800 underline decoration-1 underline-offset-4">
                {product.shops?.shop_name}
              </p>
            </Link>
          </div>
          <div className="mb-6 border-y border-gray-200 py-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Payment Method</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PAYMENT_OPTIONS.map((option) => {
                const selected = paymentMethod === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPaymentMethod(option)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      selected
                        ? 'border-[#2C3E2C] bg-[#2C3E2C]/5 text-[#2C3E2C]'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <span>{option}</span>
                    {selected ? <CheckCircle2 size={18} /> : <span className="h-[18px] w-[18px] rounded-full border border-gray-300" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleOrderClick}
            className={`flex w-full items-center justify-center gap-3 rounded-xl py-4 font-bold text-white shadow-xl transition-all hover:opacity-90 ${activeColor.bg}`}
          >
            <MessageCircle size={20} /> Order via WhatsApp
          </button>
          <button
            onClick={handleShareProduct}
            className="mt-3 flex w-full items-center justify-center gap-3 rounded-xl bg-gray-100 py-4 font-bold text-gray-800 transition-all hover:bg-gray-200"
          >
            <Share2 size={20} /> Share Product
          </button>
        </div>
      </main>
    </div>
  );
}
