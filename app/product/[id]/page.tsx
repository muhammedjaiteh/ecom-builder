'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Phone, ArrowLeft, ShoppingBag, Share2 } from 'lucide-react';
import Link from 'next/link';

export default function ProductPage() {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const params = useParams();
  const supabase = createClientComponentClient();
  const DEFAULT_PHONE = "2207470187"; 

  useEffect(() => {
    async function loadProduct() {
      if (!params?.id) return;
      const rawId = String(params.id);
      const cleanId = rawId.replace(/[^a-zA-Z0-9-]/g, '');

      // STEP 1: Get the Product
      const { data: productData, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', cleanId)
        .single();

      if (error || !productData) {
        setLoading(false);
        return;
      }

      // STEP 2: Get the Seller's Shop Details
      const { data: shopData } = await supabase
        .from('shops')
        .select('phone, shop_name, shop_slug, logo_url')
        .eq('id', productData.user_id)
        .single();

      setProduct({ ...productData, shops: shopData });
      setLoading(false);
    }
    loadProduct();
  }, [params]);

  // 🕵️‍♂️ THE SILENT SPY (Professional Mode)
  const handleBuy = async () => {
    // 1. Silently Record the Lead (Fire and Forget)
    if (product.user_id) {
        supabase.from('leads').insert({
            seller_id: product.user_id,
            product_id: product.id,
            product_name: product.name,
            product_price: product.price
        }).then(() => console.log("Lead captured"));
    }

    // 2. Open WhatsApp Immediately
    const sellerPhone = product.shops?.phone || DEFAULT_PHONE;
    const message = `👋 Hello! I would like to order *${product.name}* (Price: D${product.price}). Please confirm availability.`;
    const waLink = `https://wa.me/${sellerPhone}?text=${encodeURIComponent(message)}`;
    
    window.open(waLink, '_blank');
  };

  if (loading) return <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center text-[#2C3E2C]">Loading Luxury...</div>;
  
  if (!product) return (
    <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-serif text-[#2C3E2C] mb-4">Item Unavailable</h1>
        <Link href="/" className="text-gray-500 underline">Return to Shop</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-[#2C3E2C]">
      {/* 🧭 Navbar */}
      <nav className="fixed top-0 w-full bg-[#F9F8F6]/80 backdrop-blur-md z-50 border-b border-[#E6E4DC]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase hover:opacity-70 transition-opacity">
            <ArrowLeft size={16} /> Back
          </Link>
          <div className="text-xl font-black tracking-tighter">SANNDI<span className="text-green-700">KAA</span></div>
          <button className="p-2 rounded-full hover:bg-gray-100">
            <ShoppingBag size={20} />
          </button>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-start">
          {/* Left: Image */}
          <div className="relative aspect-[4/5] lg:aspect-square bg-[#E6E4DC] rounded-none lg:rounded-3xl overflow-hidden shadow-sm group">
            {product.image_url ? (
               <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
               <div className="absolute inset-0 flex items-center justify-center"><span className="text-6xl">📦</span></div>
            )}
            <div className="absolute top-6 left-6 bg-white px-4 py-1 text-xs font-bold tracking-widest uppercase text-black">Authentic</div>
          </div>

          {/* Right: Details */}
          <div className="flex flex-col h-full justify-center space-y-8 pt-4">
            <Link href={`/shop/${product.shops?.shop_slug || 'famwise'}`} className="inline-flex items-center gap-3 group cursor-pointer w-max">
              <div className="w-12 h-12 rounded-full overflow-hidden shadow-md group-hover:scale-110 transition-transform bg-gray-100 flex items-center justify-center border border-gray-200">
  {product.shops?.logo_url ? (
     <img src={product.shops.logo_url} alt="Shop Logo" className="w-full h-full object-cover" />
  ) : (
     <span className="text-[#2C3E2C] font-bold text-lg font-serif">
       {product.shops?.shop_name?.charAt(0) || 'S'}
     </span>
  )}
</div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-0.5">Sold By</p>
                <p className="text-xl font-serif text-[#2C3E2C] group-hover:underline decoration-1 underline-offset-4">
                  {product.shops?.shop_name || 'Famwise Store'}
                </p>
              </div>
            </Link>

            <div>
              <h1 className="text-4xl md:text-6xl font-serif font-medium leading-tight mb-4 text-[#1a2e1a]">{product.name}</h1>
              <p className="text-3xl font-light text-[#2C3E2C] flex items-center gap-4">
                D{product.price}
                <span className="text-sm font-bold bg-green-100 text-green-800 px-3 py-1 rounded-full uppercase tracking-wider">In Stock</span>
              </p>
            </div>

            <div className="w-12 h-0.5 bg-[#2C3E2C]/20"></div>
            <p className="text-lg text-[#5F6F5F] leading-relaxed font-light">
              {product.description || "Experience the finest quality from The Gambia. Hand-selected, authentically sourced."}
            </p>

            <div className="flex gap-4 items-center">
              <button onClick={handleBuy} className="flex-1 bg-[#2C3E2C] hover:bg-[#1a2e1a] text-white py-5 px-8 rounded-full font-bold text-lg flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition-all transform active:scale-98">
                <Phone size={20} /> Order via WhatsApp
              </button>
              <button className="p-5 border border-[#2C3E2C] rounded-full hover:bg-[#2C3E2C] hover:text-white transition-colors" title="Share">
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}