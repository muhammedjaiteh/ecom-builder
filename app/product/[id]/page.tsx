'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { 
  Phone, 
  ShieldCheck, 
  Truck, 
  Star, 
  ArrowLeft, 
  ShoppingBag, 
  Share2 
} from 'lucide-react';
import Link from 'next/link';

export default function ProductPage() {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const params = useParams();
  const supabase = createClientComponentClient();
  const SHOP_PHONE = "2207470187"; 

  useEffect(() => {
    async function loadProduct() {
      if (!params?.id) return;
      const rawId = String(params.id);
      const cleanId = rawId.replace(/[^a-zA-Z0-9-]/g, '');

      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', cleanId)
        .single();

      if (data) setProduct(data);
      setLoading(false);
    }
    loadProduct();
  }, [params]);

  // Handle WhatsApp Order
  const handleBuy = () => {
    const message = `👋 Hello! I would like to order *${product.name}* (Price: D${product.price}). Please confirm availability.`;
    const waLink = `https://wa.me/${SHOP_PHONE}?text=${encodeURIComponent(message)}`;
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
      
      {/* 🧭 Navbar (Minimalist) */}
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
          
          {/* 🖼️ LEFT: The Visual Stage */}
          <div className="relative aspect-[4/5] lg:aspect-square bg-[#E6E4DC] rounded-none lg:rounded-3xl overflow-hidden shadow-sm group">
            
            {/* 📸 IF IMAGE EXISTS */}
            {product.image_url ? (
               <img 
                 src={product.image_url} 
                 alt={product.name} 
                 className="w-full h-full object-cover"
               />
            ) : (
               /* 📦 IF NO IMAGE (Placeholder) */
               <>
                  <div className="absolute inset-0 opacity-20" style={{ 
                      backgroundImage: 'repeating-linear-gradient(45deg, #2C3E2C 0, #2C3E2C 1px, transparent 0, transparent 50%)', 
                      backgroundSize: '20px 20px' 
                  }}></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white/40 backdrop-blur-sm w-32 h-32 rounded-full flex items-center justify-center">
                       <span className="text-6xl filter drop-shadow-md transform group-hover:scale-110 transition-duration-700 transition-transform">📦</span>
                    </div>
                  </div>
               </>
            )}

            {/* Premium Tag */}
            <div className="absolute top-6 left-6 bg-white px-4 py-1 text-xs font-bold tracking-widest uppercase text-black">
              Authentic
            </div>
          </div>

          {/* 📝 RIGHT: The Details Suite */}
          <div className="flex flex-col h-full justify-center space-y-8 pt-4">
            
            {/* 🏪 NEW: Seller Signature (Linked) */}
            <Link 
              href="/shop/famwise" 
              className="inline-flex items-center gap-3 group cursor-pointer w-max"
            >
              <div className="w-12 h-12 bg-[#2C3E2C] text-white rounded-full flex items-center justify-center text-lg font-serif font-bold shadow-md group-hover:scale-110 transition-transform">
                F
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-0.5">Sold By</p>
                <p className="text-xl font-serif text-[#2C3E2C] group-hover:underline decoration-1 underline-offset-4">
                  Famwise Store
                </p>
              </div>
            </Link>

            {/* Title & Price */}
            <div>
              <h1 className="text-4xl md:text-6xl font-serif font-medium leading-tight mb-4 text-[#1a2e1a]">
                {product.name}
              </h1>
              <p className="text-3xl font-light text-[#2C3E2C] flex items-center gap-4">
                D{product.price}
                <span className="text-sm font-bold bg-green-100 text-green-800 px-3 py-1 rounded-full uppercase tracking-wider">In Stock</span>
              </p>
            </div>

            {/* Description Divider */}
            <div className="w-12 h-0.5 bg-[#2C3E2C]/20"></div>

            {/* Description */}
            <p className="text-lg text-[#5F6F5F] leading-relaxed font-light">
              {product.description || "Experience the finest quality from The Gambia. Hand-selected, authentically sourced, and delivered with care directly to your doorstep."}
            </p>

            {/* 🛡️ Trust Signals */}
            <div className="grid grid-cols-2 gap-4 py-6">
              <div className="flex items-center gap-3 p-4 bg-white border border-[#E6E4DC] rounded-xl">
                <ShieldCheck className="text-green-700" size={24} />
                <div className="text-xs">
                  <span className="block font-bold text-gray-900">Secure Payment</span>
                  <span className="text-gray-500">Pay on Delivery</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white border border-[#E6E4DC] rounded-xl">
                <Truck className="text-green-700" size={24} />
                <div className="text-xs">
                  <span className="block font-bold text-gray-900">Fast Delivery</span>
                  <span className="text-gray-500">Within 24 Hours</span>
                </div>
              </div>
            </div>

            {/* 🛒 Action Buttons */}
            <div className="flex gap-4 items-center">
              <button 
                onClick={handleBuy}
                className="flex-1 bg-[#2C3E2C] hover:bg-[#1a2e1a] text-white py-5 px-8 rounded-full font-bold text-lg flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition-all transform active:scale-98"
              >
                <Phone size={20} />
                Order via WhatsApp
              </button>
              
              <button className="p-5 border border-[#2C3E2C] rounded-full hover:bg-[#2C3E2C] hover:text-white transition-colors" title="Share">
                <Share2 size={20} />
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 mt-4">
              Direct connection with seller established upon clicking order.
            </p>

          </div>
        </div>
      </main>
    </div>
  );
}