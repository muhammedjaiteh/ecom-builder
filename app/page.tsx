'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, ArrowRight, Star, ExternalLink } from 'lucide-react';

export default function Marketplace() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function loadMarketplace() {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      setProducts(data || []);
      setLoading(false);
    }
    loadMarketplace();
  }, []);

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-[#2C3E2C]">
      
      {/* 🧭 Elegant Navbar */}
      <nav className="fixed top-0 w-full bg-[#F9F8F6]/80 backdrop-blur-md z-50 border-b border-[#E6E4DC]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="text-2xl font-black tracking-tighter flex items-center gap-2">
            <span className="w-8 h-8 bg-[#2C3E2C] text-[#F9F8F6] rounded-full flex items-center justify-center text-xs font-serif">S</span>
            SANNDI<span className="text-green-700">KAA</span>
          </div>
          <Link href="/login" className="text-xs font-bold tracking-widest uppercase hover:underline underline-offset-4">
            Seller Portal
          </Link>
        </div>
      </nav>

      {/* 🏛 Hero Section */}
      <header className="pt-32 pb-20 px-6 max-w-7xl mx-auto border-b border-[#E6E4DC]">
        <div className="max-w-3xl">
          <span className="text-green-700 font-bold tracking-widest uppercase text-xs mb-4 block">
            The Gambia's Finest Marketplace
          </span>
          <h1 className="text-6xl md:text-8xl font-serif leading-[0.9] mb-8 text-[#1a2e1a]">
            Curated. <br/> Authentic. <br/> <span className="text-gray-400 italic font-light">Yours.</span>
          </h1>
          <p className="text-xl text-[#5F6F5F] max-w-xl leading-relaxed mb-10">
            Discover a collection of premium local products, directly from the sellers who make them. Quality you can trust, delivered to your door.
          </p>
          <div className="flex gap-4">
             <button className="bg-[#2C3E2C] text-white px-8 py-4 rounded-full font-bold shadow-xl hover:shadow-2xl transition-all flex items-center gap-2">
               Shop Collection <ArrowRight size={18} />
             </button>
          </div>
        </div>
      </header>

      {/* 📦 The Collection Grid */}
      <main className="max-w-7xl mx-auto px-6 py-20">
        
        <div className="flex items-end justify-between mb-12">
           <h2 className="text-3xl font-serif">Latest Arrivals</h2>
           <span className="text-sm font-bold border-b border-black pb-1 cursor-pointer">View All</span>
        </div>

        {loading ? (
           <div className="text-center py-20 opacity-50">Loading Excellence...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
            {products.map((product) => (
              <Link key={product.id} href={`/product/${product.id}`} className="group block">
                {/* Card Image */}
                <div className="bg-[#E6E4DC] aspect-[4/5] relative overflow-hidden mb-6 rounded-sm">
                   
                   {/* 📸 IMAGE LOGIC: If image exists, show it. Else show emoji. */}
                   {product.image_url ? (
                       <img 
                         src={product.image_url} 
                         alt={product.name} 
                         className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                       />
                   ) : (
                       <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-5xl filter drop-shadow-sm transform group-hover:scale-110 transition-duration-700 transition-transform">📦</span>
                       </div>
                   )}

                   {/* Badge */}
                   <div className="absolute top-4 right-4 bg-white/90 px-3 py-1 text-[10px] font-bold tracking-widest uppercase">
                     New
                   </div>
                </div>

                {/* Card Text */}
                <div className="space-y-1">
                   <h3 className="text-xl font-serif group-hover:underline decoration-1 underline-offset-4 decoration-[#2C3E2C]">
                     {product.name}
                   </h3>
                   <div className="flex justify-between items-center text-[#5F6F5F] text-sm font-medium">
                      <span>D{product.price}</span>
                      <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-green-700">
                        Shop <ArrowRight size={12} />
                      </span>
                   </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && products.length === 0 && (
           <div className="p-20 text-center bg-white border border-[#E6E4DC]">
              <h3 className="font-serif text-2xl mb-2">The Market is Quiet</h3>
              <p className="text-gray-500 mb-6">Be the first to list a premium product.</p>
              <Link href="/register" className="text-green-700 font-bold underline">Start Selling</Link>
           </div>
        )}

      </main>

      {/* 🦶 Footer */}
      <footer className="bg-[#2C3E2C] text-[#F9F8F6] py-20 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
           <div>
              <div className="text-2xl font-black tracking-tighter mb-6">SANNDI<span className="text-green-400">KAA</span></div>
              <p className="max-w-xs text-green-100/60 font-light">
                 Elevating Gambian commerce through technology and design.
              </p>
           </div>
           <div className="grid grid-cols-2 gap-12 text-sm">
              <div>
                 <h4 className="font-bold tracking-widest uppercase mb-4 text-green-400">Shop</h4>
                 <ul className="space-y-2 opacity-70">
                    <li>New Arrivals</li>
                    <li>Best Sellers</li>
                    <li>Sellers</li>
                 </ul>
              </div>
              <div>
                 <h4 className="font-bold tracking-widest uppercase mb-4 text-green-400">Support</h4>
                 <ul className="space-y-2 opacity-70">
                    <li>Seller Login</li>
                    <li>FAQs</li>
                    <li>Contact</li>
                 </ul>
              </div>
           </div>
        </div>
      </footer>
    </div>
  );
}