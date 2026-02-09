'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ShoppingBag, MessageCircle } from 'lucide-react';

export default function ShopPage() {
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const params = useParams();
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function loadShop() {
      if (!params?.slug) return;
      
      // 1. Get the Shop Details
      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('shop_slug', params.slug)
        .single();

      if (shopError || !shopData) {
        console.error("Shop error:", shopError);
        setLoading(false);
        return;
      }

      setShop(shopData);

      // 2. Get THAT Shop's Products
      const { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', shopData.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      setProducts(productData || []);
      setLoading(false);
    }

    loadShop();
  }, [params]);

  if (loading) return <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center">Loading Shop...</div>;
  
  if (!shop) return (
    <div className="min-h-screen bg-[#F9F8F6] flex flex-col items-center justify-center text-center p-10">
      <h1 className="text-4xl font-serif text-[#2C3E2C] mb-4">Shop Not Found</h1>
      <p className="text-gray-500 mb-8">This store link is invalid or has been removed.</p>
      <Link href="/" className="bg-[#2C3E2C] text-white px-6 py-3 rounded-full font-bold">Return to Market</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-[#2C3E2C]">
      
      {/* 🏪 Shop Header */}
      <div className="bg-[#2C3E2C] text-white pt-20 pb-16 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10 text-center">
            
            <div className="w-24 h-24 bg-white text-[#2C3E2C] rounded-full mx-auto mb-6 flex items-center justify-center text-3xl font-serif font-bold shadow-xl">
                {shop.shop_name.charAt(0)}
            </div>

            <h1 className="text-4xl md:text-6xl font-serif font-medium mb-4">{shop.shop_name}</h1>
            <p className="text-green-100/80 text-lg max-w-lg mx-auto mb-8">
               Verified Seller on Sanndikaa
            </p>

            <div className="flex justify-center gap-4">
                <a 
                  href={`https://wa.me/${shop.phone}`} 
                  target="_blank"
                  className="bg-green-500 hover:bg-green-400 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-all"
                >
                    <MessageCircle size={18} /> Chat on WhatsApp
                </a>
            </div>
        </div>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      </div>

      {/* 📦 Product Grid */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8 border-b border-[#E6E4DC] pb-4">
            <span className="font-bold text-gray-400 uppercase tracking-widest text-xs">{products.length} Products Available</span>
        </div>

        {products.length === 0 ? (
           <div className="text-center py-20 opacity-50">
             <ShoppingBag size={48} className="mx-auto mb-4" />
             <p>This shop hasn't added any products yet.</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {products.map((product) => (
              <Link key={product.id} href={`/product/${product.id}`} className="group block">
                <div className="bg-white aspect-[4/5] relative overflow-hidden mb-6 rounded-2xl shadow-sm border border-[#E6E4DC]">
                   {product.image_url ? (
                       <img 
                         src={product.image_url} 
                         alt={product.name} 
                         className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                       />
                   ) : (
                       <div className="absolute inset-0 flex items-center justify-center bg-[#E6E4DC]">
                          <span className="text-5xl filter drop-shadow-sm">📦</span>
                       </div>
                   )}
                </div>
                <div className="text-center">
                   <h3 className="text-xl font-serif text-[#2C3E2C] group-hover:text-green-700 transition-colors">
                     {product.name}
                   </h3>
                   <p className="text-[#5F6F5F] font-bold mt-1">D{product.price}</p>
                </div>
              </Link>
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