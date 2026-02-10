'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Search, Menu, X, ArrowRight, Instagram, Facebook, Twitter } from 'lucide-react';

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const supabase = createClientComponentClient();

  const CATEGORIES = ["All", "Food", "Fashion", "Beauty", "Home", "Electronics"];

  useEffect(() => {
    async function fetchProducts() {
      let query = supabase
        .from('products')
        .select(`
          *,
          shops (
            shop_name
          )
        `)
        .order('created_at', { ascending: false });

      if (selectedCategory !== 'All') {
        query = query.eq('category', selectedCategory);
      }

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) console.error("Error loading items:", error);
      setProducts(data || []);
      setLoading(false);
    }

    fetchProducts();
  }, [search, selectedCategory]);

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-[#2C3E2C] flex flex-col">
      
      {/* 💎 COMPACT GLASS NAVBAR */}
      <nav className="fixed top-0 w-full bg-[#F9F8F6]/90 backdrop-blur-md z-50 border-b border-[#E6E4DC] transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="text-xl font-black tracking-tighter flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            SANNDI<span className="text-green-800">KAA</span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-[10px] font-bold tracking-[0.2em] uppercase">
            <button onClick={() => setSelectedCategory('All')} className="hover:text-green-800 transition-colors">Marketplace</button>
            <a href="#footer" className="hover:text-green-800 transition-colors">Contact</a>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden md:block px-5 py-2 bg-[#2C3E2C] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#1a2e1a] transition-all shadow-sm rounded-sm">
              Seller Portal
            </Link>
          </div>
        </div>
      </nav>

      {/* 🖼️ REFINED HERO SECTION */}
      <header className="relative pt-32 pb-12 px-6 text-center overflow-hidden">
        {/* Subtle Background */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-green-900 blur-[100px]"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-orange-200 blur-[80px]"></div>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
            <span className="inline-block py-1 px-3 border border-[#2C3E2C]/20 rounded-full text-[9px] font-bold tracking-widest uppercase mb-4 text-[#2C3E2C]/80">
                The Gambia's Premium Marketplace
            </span>
            
            {/* Tighter Typography */}
            <h1 className="text-4xl md:text-6xl font-serif font-medium mb-4 text-[#1a2e1a] leading-tight tracking-tight">
              Curated <i className="font-light font-serif text-green-900">Excellence.</i>
            </h1>
            
            <p className="text-sm md:text-base text-[#5F6F5F] mb-8 max-w-md mx-auto leading-relaxed font-light">
              Authentic products, verified sellers, and luxury service.
            </p>
            
            {/* 🔍 Sleeker Search Bar */}
            <div className="relative max-w-sm mx-auto mb-10 shadow-xl shadow-green-900/5 rounded-full group focus-within:shadow-2xl transition-all">
                <input 
                  type="text" 
                  placeholder="What are you looking for?" 
                  className="w-full pl-12 pr-6 py-3.5 bg-white border border-transparent group-focus-within:border-[#E6E4DC] rounded-full text-sm focus:outline-none transition-all placeholder:text-gray-400 font-medium"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#2C3E2C]" size={16} />
            </div>

            {/* 🏷️ Smaller Filter Pills */}
            <div className="flex flex-wrap justify-center gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all duration-300 ${
                    selectedCategory === cat 
                    ? 'bg-[#2C3E2C] text-white shadow-md' 
                    : 'bg-white border border-[#F0EFE9] text-gray-400 hover:border-[#2C3E2C] hover:text-[#2C3E2C]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
        </div>
      </header>

      {/* 🛍️ PRODUCT GRID */}
      <main className="px-6 pb-24 max-w-7xl mx-auto flex-grow w-full">
        {loading ? (
           <div className="text-center py-20 opacity-50 font-serif text-sm animate-pulse">Loading Collection...</div>
        ) : products.length === 0 ? (
           <div className="text-center py-16 bg-white rounded-2xl border border-[#E6E4DC] max-w-lg mx-auto">
             <div className="text-4xl mb-3 opacity-50">🍂</div>
             <p className="text-sm font-serif text-gray-400">No items found.</p>
             <button onClick={() => {setSelectedCategory('All'); setSearch('')}} className="mt-4 text-green-800 font-bold text-[10px] uppercase tracking-widest border-b border-green-800">View All</button>
           </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
            {products.map((product) => (
              <Link href={`/product/${product.id}`} key={product.id} className="group cursor-pointer block">
                {/* Image Card */}
                <div className="relative aspect-[4/5] bg-[#E6E4DC] overflow-hidden mb-4 rounded-sm shadow-sm group-hover:shadow-xl transition-all duration-500 ease-out">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" 
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[#2C3E2C]/10">
                      <ShoppingBag size={32} />
                    </div>
                  )}
                  {/* Category Tag */}
                  <div className="absolute bottom-0 left-0 bg-[#2C3E2C]/90 backdrop-blur-md text-white px-3 py-2 text-[8px] font-bold tracking-widest uppercase">
                     {product.category || 'Item'}
                  </div>
                </div>

                {/* Details */}
                <div className="px-1">
                   {/* 🏢 Shop Name */}
                   <p className="text-[9px] font-bold tracking-widest text-gray-400 uppercase mb-1 group-hover:text-[#2C3E2C] transition-colors truncate">
                     {product.shops?.shop_name || 'Verified Seller'}
                   </p>
                   
                   <div className="flex justify-between items-start gap-2">
                      <h3 className="text-base font-serif text-[#1a2e1a] leading-tight group-hover:underline decoration-1 underline-offset-4 decoration-gray-300 line-clamp-2">
                        {product.name}
                      </h3>
                      <p className="text-sm font-bold text-[#2C3E2C] whitespace-nowrap">D{product.price}</p>
                   </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* 🦶 COMPACT FOOTER */}
      <footer id="footer" className="bg-[#1a2e1a] text-white/80 py-12 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
                <div className="text-xl font-black tracking-tighter text-white mb-2">SANNDI<span className="text-green-500">KAA</span></div>
                <p className="text-[10px] font-light opacity-60 uppercase tracking-widest">Banjul, The Gambia</p>
            </div>
            
            <div className="flex gap-6 opacity-60">
               <Instagram size={16} className="hover:text-white cursor-pointer transition-colors"/>
               <Facebook size={16} className="hover:text-white cursor-pointer transition-colors"/>
               <Twitter size={16} className="hover:text-white cursor-pointer transition-colors"/>
            </div>

            <div className="text-[10px] font-bold uppercase tracking-widest opacity-30">
                &copy; 2026 Sanndikaa Inc.
            </div>
        </div>
      </footer>

    </div>
  );
}