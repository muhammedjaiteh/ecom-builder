'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { ShoppingBag, Search, Menu, MessageCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      
      {/* 🟢 HEADER */}
      <header className="bg-white sticky top-0 z-50 border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-green-600 text-white p-2 rounded-lg">
              <ShoppingBag size={20} />
            </div>
            <span className="font-black text-xl tracking-tight text-green-900">GAMBIA<span className="text-green-600">STORE</span></span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="hidden md:block text-sm font-medium text-gray-500 hover:text-green-600 transition-colors">
              Admin Login
            </Link>
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Search size={20} className="text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Menu size={20} className="text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* 🖼 HERO SECTION */}
      <div className="bg-green-900 text-white py-16 px-4">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter">
            Fresh from the <span className="text-green-400">Smile Coast</span>
          </h1>
          <p className="text-green-100 text-lg md:text-xl max-w-2xl mx-auto">
            The easiest way to buy authentic Gambian products. Order on WhatsApp, delivered to your door.
          </p>
        </div>
      </div>

      {/* 📦 PRODUCT GRID */}
      <main className="max-w-6xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Trending Now</h2>
          <span className="text-sm font-medium text-green-600">View All</span>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 animate-pulse">Loading amazing products...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <Link href={`/product/${product.id}`} key={product.id} className="group block">
                <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 duration-300">
                  
                  {/* Image Area */}
                  <div className="aspect-square bg-gray-100 relative overflow-hidden">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ShoppingBag size={48} />
                      </div>
                    )}
                    
                    {/* Floating Price Tag */}
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full font-bold text-sm shadow-sm text-gray-900">
                      D{product.price}
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="p-5">
                    <h3 className="font-bold text-lg text-gray-900 mb-1 group-hover:text-green-600 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2 h-10">
                      {product.description || "Click to see more details about this product..."}
                    </p>
                    
                    <div className="mt-4 flex items-center text-green-600 font-bold text-sm">
                      View Details <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                </div>
              </Link>
            ))}
          </div>
        )}

        {products.length === 0 && !loading && (
           <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
             <p className="text-gray-500">No products yet. Visit the Admin Dashboard to add some!</p>
           </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t py-12 text-center text-gray-500 text-sm">
        <p>&copy; 2026 Gambia Store. Built with Next.js & Supabase.</p>
      </footer>
    </div>
  );
}