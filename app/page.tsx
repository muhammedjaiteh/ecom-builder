'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Search, Menu, X } from 'lucide-react';

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const supabase = createClientComponentClient();

  const CATEGORIES = ["All", "Food", "Fashion", "Beauty", "Home", "Electronics"];

  useEffect(() => {
    async function fetchProducts() {
      // 1. SIMPLE QUERY (No Joins) - Guaranteed to work
      let query = supabase
        .from('products')
        .select('*') // Just get the products!
        .order('created_at', { ascending: false });

      if (selectedCategory !== 'All') {
        query = query.eq('category', selectedCategory);
      }

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error("Home Page Error:", error);
      } else {
        setProducts(data || []);
      }
      setLoading(false);
    }

    fetchProducts();
  }, [search, selectedCategory]);

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-[#2C3E2C]">
      
      {/* 🧭 Navbar */}
      <nav className="fixed top-0 w-full bg-[#F9F8F6]/80 backdrop-blur-md z-50 border-b border-[#E6E4DC]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="text-2xl font-black tracking-tighter flex items-center gap-2">
            SANNDI<span className="text-green-700">KAA</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="px-6 py-2 bg-[#2C3E2C] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#1a2e1a] transition-colors">
              Seller Login
            </Link>
          </div>
        </div>
      </nav>

      {/* 🏡 Hero Section */}
      <header className="pt-32 pb-16 px-6 text-center max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-serif font-medium mb-6 text-[#1a2e1a] leading-tight">
          The Gambia’s <br/> <i className="font-light">Finest Collection</i>
        </h1>
        
        {/* 🔍 Search Bar */}
        <div className="relative max-w-md mx-auto mb-12">
            <input 
              type="text" 
              placeholder="Search for items..." 
              className="w-full pl-12 pr-4 py-4 bg-white border border-[#E6E4DC] rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2C3E2C] transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        </div>

        {/* 🏷️ CATEGORY FILTERS */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                selectedCategory === cat 
                ? 'bg-[#2C3E2C] text-white shadow-lg scale-105' 
                : 'bg-white border border-[#E6E4DC] text-gray-500 hover:border-[#2C3E2C] hover:text-[#2C3E2C]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* 🛍️ Product Grid */}
      <main className="px-6 pb-24 max-w-7xl mx-auto">
        {loading ? (
           <div className="text-center py-20 opacity-50">Loading Collections...</div>
        ) : products.length === 0 ? (
           <div className="text-center py-20">
             <div className="text-6xl mb-4">🍂</div>
             <p className="text-xl font-serif text-gray-400">No products found.</p>
             <button onClick={() => {setSelectedCategory('All'); setSearch('')}} className="mt-4 text-green-700 font-bold underline">Clear Filters</button>
           </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {products.map((product) => (
              <Link href={`/product/${product.id}`} key={product.id} className="group cursor-pointer block">
                {/* Image Card */}
                <div className="relative aspect-[4/5] bg-[#E6E4DC] overflow-hidden mb-6 shadow-sm group-hover:shadow-md transition-all duration-500">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[#2C3E2C]/20"><ShoppingBag size={48} /></div>
                  )}
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 text-[10px] font-bold tracking-widest uppercase text-black">
                     {product.category || 'Authentic'}
                  </div>
                </div>

                {/* Details */}
                <div className="text-center space-y-2 px-4">
                  <p className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase group-hover:text-[#2C3E2C] transition-colors">
                    Verified Seller
                  </p>
                  <h3 className="text-2xl font-serif text-[#1a2e1a] group-hover:underline decoration-1 underline-offset-4 decoration-gray-300">
                    {product.name}
                  </h3>
                  <p className="text-lg font-light text-[#5F6F5F]">D{product.price}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}