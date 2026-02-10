'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, ArrowRight, Search, X } from 'lucide-react';

export default function Marketplace() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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

  // 🧠 THE BRAIN: Filter products based on search
  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      {/* 🏛 Hero Section + SEARCH BAR */}
      <header className="pt-32 pb-16 px-6 max-w-7xl mx-auto border-b border-[#E6E4DC]">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-green-700 font-bold tracking-widest uppercase text-xs mb-4 block">
            The Gambia's Finest Marketplace
          </span>
          <h1 className="text-5xl md:text-7xl font-serif leading-[1.1] mb-8 text-[#1a2e1a]">
            Curated. Authentic. <span className="text-gray-400 italic font-light">Yours.</span>
          </h1>
          
          {/* 🔍 THE NEW SEARCH ENGINE */}
          <div className="max-w-xl mx-auto relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="text-gray-400" size={20} />
            </div>
            <input 
                type="text" 
                placeholder="Search for 'Baobab', 'Shoes', 'Fashion'..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-12 py-4 bg-white border border-[#E6E4DC] rounded-full shadow-sm text-lg focus:outline-none focus:ring-2 focus:ring-[#2C3E2C] focus:border-transparent transition-all group-hover:shadow-md"
            />
            {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-red-500"
                >
                    <X size={20} />
                </button>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-4">Try searching for your favorite local products.</p>
        </div>
      </header>

      {/* 📦 The Collection Grid */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        
        <div className="flex items-end justify-between mb-8">
           <h2 className="text-2xl font-serif">
             {searchQuery ? `Results for "${searchQuery}"` : "Latest Arrivals"}
           </h2>
           <span className="text-xs font-bold bg-[#2C3E2C] text-white px-3 py-1 rounded-full">
             {filteredProducts.length} Items
           </span>
        </div>

        {loading ? (
           <div className="text-center py-20 opacity-50">Loading Excellence...</div>
        ) : filteredProducts.length === 0 ? (
           /* 🚫 Empty State */
           <div className="text-center py-20 bg-white border border-[#E6E4DC] rounded-2xl">
              <ShoppingBag size={48} className="mx-auto mb-4 text-gray-300" />
              <h3 className="font-serif text-2xl mb-2 text-gray-400">No matches found</h3>
              <p className="text-gray-400 mb-6">Try searching for something else.</p>
              <button 
                onClick={() => setSearchQuery('')}
                className="text-green-700 font-bold underline"
              >
                Clear Search
              </button>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
            {filteredProducts.map((product) => (
              <Link key={product.id} href={`/product/${product.id}`} className="group block">
                {/* Card Image */}
                <div className="bg-[#E6E4DC] aspect-[4/5] relative overflow-hidden mb-6 rounded-sm shadow-sm">
                   
                   {/* 📸 IMAGE LOGIC */}
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