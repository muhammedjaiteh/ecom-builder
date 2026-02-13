'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState, useMemo } from 'react';
import { ShoppingBag, Search, Instagram, Facebook, Twitter } from 'lucide-react';
import Link from 'next/link';

// 🛡️ 1. Define Strict Types (Safety First)
type Product = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  image_url: string | null;
  shops?: {
    shop_name: string;
  } | null;
};

export default function Home() {
  // ⚡ 2. Memoize Supabase Client (Prevents Battery Drain)
  const supabase = useMemo(() => createClientComponentClient(), []);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

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
      
      if (error) {
        console.error("Error loading items:", error);
      } else {
        // 🛡️ 3. Safe Type Casting
        setProducts((data as Product[]) || []);
      }
      setLoading(false);
    }

    fetchProducts();
  }, [search, selectedCategory, supabase]); // ✅ Proper Dependencies added

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

      {/* 🌿 REFINED HERO SECTION */}
      <header className="relative pt-32 pb-12 px-6 text-center overflow-hidden">
        {/* Subtle Background */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
           <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-green-900 blur-[100px]"></div>
           <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-orange-200 blur-[80px]"></div>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
           <span className="inline-block py-1 px-3 border border-[#2C3E2C]/20 rounded-full text-[9px] font-bold tracking-widest uppercase mb-4 text-[#2C3E2C]/80">
              The Gambia&apos;s Premium Marketplace
           </span>
           
           {/* Tighter Typography */}
           <h1 className="text-4xl md:text-6xl font-serif font-medium mb-4 text-[#1a2e1a] leading-tight tracking-tight">
             Curated <i className="font-light font-serif text-green-900">Excellence.</i>
           </h1>
           
           <p className="text-sm md:text-base text-[#5F6F5F] mb-8 max-w-md mx-auto leading-relaxed font-light">
             Discover authentic products from The Gambia&apos;s most trusted sellers. Direct WhatsApp ordering. Verified quality.
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
                 className={`
                   px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all
                   ${selectedCategory === cat 
                     ? 'bg-[#2C3E2C] text-white shadow-lg scale-105' 
                     : 'bg-white border border-[#E6E4DC] text-gray-500 hover:border-[#2C3E2C] hover:text-[#2C3E2C]'}
                 `}
               >
                 {cat}
               </button>
             ))}
           </div>
        </div>
      </header>

      {/* 🛍️ PRODUCT GRID */}
      <main className="flex-1 max-w-7xl mx-auto px-6 w-full pb-20">
        {loading ? (
           <div className="flex flex-col items-center justify-center py-20 opacity-50 animate-pulse">
              <ShoppingBag size={32} className="mb-4 text-[#2C3E2C]" />
              <p className="text-xs font-bold uppercase tracking-widest">Loading Collection...</p>
           </div>
        ) : products.length === 0 ? (
           <div className="text-center py-20">
              <p className="text-gray-400 text-lg font-serif italic">No treasures found.</p>
              <button onClick={() => {setSearch(''); setSelectedCategory('All')}} className="mt-4 text-xs font-bold underline">Clear Filters</button>
           </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
            {products.map((product) => (
              <Link href={`/product/${product.id}`} key={product.id} className="group cursor-pointer">
                <div className="relative aspect-[4/5] bg-gray-100 mb-4 overflow-hidden rounded-sm">
                   {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                      />
                   ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><ShoppingBag size={24} /></div>
                   )}
                   {/* Overlay on hover */}
                   <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300"></div>
                </div>
                
                <div className="text-center">
                   <h3 className="text-sm font-serif text-[#1a2e1a] group-hover:text-green-800 transition-colors truncate px-2">{product.name}</h3>
                   <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-1 mb-1">{product.shops?.shop_name || 'Sanndikaa'}</p>
                   <p className="text-sm font-bold text-[#2C3E2C]">D{product.price}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* 🦶 FOOTER */}
      <footer id="footer" className="bg-[#1a2e1a] text-white pt-16 pb-8 px-6 mt-auto">
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