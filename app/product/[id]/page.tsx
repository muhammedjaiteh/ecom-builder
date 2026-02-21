'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState, use } from 'react';
import { ArrowLeft, MessageCircle, ShoppingBag, Share2, ShieldCheck } from 'lucide-react';
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
    whatsapp_number: string | null;
  };
};

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  // 🚀 FIXED: Properly unwrapping the Next.js 15 asynchronous params
  const { id: productId } = use(params); 
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchProduct() {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          shops (
            shop_name,
            whatsapp_number
          )
        `)
        .eq('id', productId)
        .single();

      if (error) {
        console.error("Error fetching product:", error);
      } else {
        setProduct(data as Product);
      }
      setLoading(false);
    }

    fetchProduct();
  }, [productId, supabase]);

  const handleOrderClick = async () => {
    if (!product) return;
    await supabase.from('leads').insert({ product_id: product.id, shop_id: product.shops?.shop_name });

    const rawNumber = product.shops?.whatsapp_number;
    if (!rawNumber) {
      alert("This seller has not updated their WhatsApp number yet!");
      return;
    }

    let cleanNumber = rawNumber.replace(/\D/g, '');
    if (cleanNumber.length === 7) cleanNumber = '220' + cleanNumber;

    const message = encodeURIComponent(
      `Hello ${product.shops?.shop_name}! 👋\n\nI want to buy this from your Sanndikaa store:\n🛍️ *${product.name}*\n💰 *D${product.price}*\n\nIs this available?`
    );
    window.location.href = `https://wa.me/${cleanNumber}?text=${message}`;
  };
const handleShareProduct = () => {
    if (!product) return;
    const url = window.location.href;
    const message = encodeURIComponent(`🔥 Check out what I am selling on Sanndikaa:\n\n*${product.name}* for D${product.price}\n\nTap the link to buy it now:\n${url}`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F8F6]">
      <ShoppingBag size={32} className="animate-pulse text-[#2C3E2C] mb-4" />
      <p className="text-xs font-bold uppercase text-gray-500">Loading Product...</p>
    </div>
  );

  if (!product) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F8F6]">
      <div className="text-center">
        <h1 className="text-2xl font-serif text-gray-800 mb-4">Product Not Found</h1>
        <Link href="/" className="text-sm font-bold text-green-700 hover:underline">Back to Marketplace</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F9F8F6] pb-24 font-sans text-[#2C3E2C]">
      <nav className="p-6">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase text-gray-500 hover:text-[#2C3E2C]">
          <ArrowLeft size={16} /> Back
        </Link>
      </nav>
      <main className="max-w-4xl mx-auto px-6 grid md:grid-cols-2 gap-12 mt-4">
        <div className="aspect-[4/5] bg-gray-100 rounded-2xl overflow-hidden shadow-sm border border-gray-200">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
             <div className="w-full h-full flex items-center justify-center text-gray-300"><ShoppingBag size={48} /></div>
          )}
        </div>
        <div className="flex flex-col justify-center">
          <div className="mb-2"><span className="text-[10px] font-bold uppercase text-gray-400">{product.category || 'General'}</span></div>
          <h1 className="text-4xl md:text-5xl font-serif font-medium text-[#1a2e1a] mb-4">{product.name}</h1>
          <p className="text-3xl font-bold text-green-800 mb-6">D{product.price}</p>
          <div className="bg-white p-4 rounded-xl border border-gray-100 mb-8 shadow-sm">
            <p className="text-sm text-gray-600 font-light whitespace-pre-wrap">{product.description || 'No description provided.'}</p>
          </div>
          <div className="mb-8 flex items-center gap-3 border-t border-b border-gray-200 py-4">
            <div className="w-10 h-10 bg-[#1a2e1a] rounded-full flex items-center justify-center text-white font-serif font-bold text-sm shadow-md">
               {product.shops?.shop_name.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Sold By</p>
              <p className="text-sm font-bold text-[#1a2e1a]">{product.shops?.shop_name}</p>
            </div>
          </div>
          <button onClick={handleOrderClick} className="w-full bg-[#2C3E2C] hover:bg-black text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 shadow-xl transition-all">
            <MessageCircle size={20} /> Order via WhatsApp
          </button><button onClick={handleShareProduct} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-4 mt-3 rounded-xl font-bold flex items-center justify-center gap-3 transition-all">
    <Share2 size={20} /> Share Product
  </button>
        </div>
      </main>
    </div>
  );
}