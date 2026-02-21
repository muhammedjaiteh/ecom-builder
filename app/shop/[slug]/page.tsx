'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { MessageCircle, Share2, ShoppingBag } from 'lucide-react';

export default function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchShopData() {
      // 1. Fetch Shop Details
      const { data: shopData } = await supabase
        .from('shops')
        .select('*')
        .eq('shop_slug', slug)
        .single();
        
      if (shopData) {
        setShop(shopData);
        
        // 🚀 THE FIX: We are now searching by 'user_id' instead of 'shop_id'
        const { data: productData, error } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', shopData.id);
          
        if (error) console.error("Database Error:", error);
        setProducts(productData || []);
      }
    }
    fetchShopData();
  }, [slug, supabase]);

  // 🚀 THE WHATSAPP SHARE ENGINE
  const handleShareStore = () => {
    const storeUrl = window.location.href;
    const message = encodeURIComponent(`🛍️ Check out my store, *${shop.shop_name}* on Sanndikaa!\n\nShop our latest products here:\n${storeUrl}`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleChat = () => {
    if (!shop?.whatsapp_number) return;
    let cleanNumber = shop.whatsapp_number.replace(/\D/g, '');
    if (cleanNumber.length === 7) cleanNumber = '220' + cleanNumber;
    window.location.href = `https://wa.me/${cleanNumber}`;
  };

  if (!shop) return <div className="p-10 text-center text-gray-500">Loading Shop...</div>;

  const brandColor = shop.theme_color || '#1a2e1a'; 

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      
      {/* Dynamic Header */}
      <div 
        className="w-full py-16 px-4 text-center text-white flex flex-col items-center justify-center relative"
        style={{ backgroundColor: brandColor }}
      >
        <h1 className="text-4xl md:text-5xl font-serif font-medium mb-2">{shop.shop_name}</h1>
        <p className="text-sm font-light opacity-80 mb-6">Verified Seller on Sanndikaa</p>
        
        <div className="flex flex-wrap justify-center items-center gap-3">
          <button onClick={handleChat} className="bg-green-500 hover:bg-green-400 text-white font-bold py-2.5 px-6 rounded-full flex items-center gap-2 transition-all shadow-md">
            <MessageCircle size={18} /> Chat
          </button>
          
          {/* 🚀 New Native Share Button */}
          <button onClick={handleShareStore} className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-bold py-2.5 px-6 rounded-full flex items-center gap-2 transition-all shadow-md border border-white/30">
            <Share2 size={18} /> Share Store
          </button>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-6xl mx-auto px-4 mt-8">
        <p className="text-xs font-bold text-gray-400 mb-6 uppercase tracking-widest">
           {products.length} Products Available
        </p>
        
        {products.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
             <ShoppingBag size={48} className="mx-auto text-gray-200 mb-4" />
             <p className="text-gray-500 font-medium">This shop hasn't added any products yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products.map((p) => (
               <Link href={`/product/${p.id}`} key={p.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden border border-gray-100 block group">
                  <div className="aspect-square bg-gray-100 relative overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><ShoppingBag size={32} /></div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-800 text-sm truncate">{p.name}</h3>
                    <p className="text-green-700 font-bold mt-1">D{p.price}</p>
                  </div>
               </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}