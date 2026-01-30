'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShoppingBag, Package, Star, Search, Menu, Phone, Facebook, Instagram, Twitter } from 'lucide-react';
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
    const { data, error } = await supabase
      .from('products')
      .select('*');

    if (error) console.error('Error:', error);
    else setProducts(data || []);
    setLoading(false);
  };

  const handleBuy = async (product: any) => {
    // 1. Save the order to Supabase
    try {
      await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          productName: product.name, 
          price: product.price 
        }),
      });
    } catch (e) {
      console.error("Tracking error", e);
    }

    // 2. Open WhatsApp
    const message = `Hi! I saw your store online. I want to buy ${product.name} for D${product.price}`;
    const whatsappUrl = `https://wa.me/2200000000?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      
      {/* 🟢 NAVIGATION BAR */}
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="bg-green-600 text-white p-2 rounded-lg">
                <ShoppingBag size={20} />
              </div>
              <span className="text-xl font-black tracking-tight text-green-900">
                GAMBIA<span className="text-green-600">STORE</span>
              </span>
            </div>
            
            {/* Links */}
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
              <a href="#" className="hover:text-green-600 transition-colors">Shop</a>
              <a href="#" className="hover:text-green-600 transition-colors">Best Sellers</a>
              <a href="#" className="hover:text-green-600 transition-colors">About</a>
            </div>

            {/* Admin Button */}
            <Link 
              href="/dashboard" 
              className="px-4 py-2 text-sm font-bold text-green-700 border border-green-200 rounded-full hover:bg-green-50 transition-colors"
            >
              Seller Login
            </Link>
          </div>
        </div>
      </nav>

      {/* 🖼️ HERO SECTION (Banner) */}
      <div className="relative bg-green-900 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
            {/* Pattern overlay could go here */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-green-400 rounded-full blur-3xl opacity-30"></div>
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-yellow-400 rounded-full blur-3xl opacity-20"></div>
        </div>
        
        <div className="relative max-w-6xl mx-auto px-4 py-20 sm:px-6 lg:px-8 flex flex-col items-center text-center">
          <span className="text-green-300 font-bold tracking-wider text-sm mb-4 uppercase">The #1 Marketplace in The Gambia</span>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
            Discover Local <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-yellow-300">
              Treasures & Deals
            </span>
          </h1>
          <p className="text-green-100 text-lg md:text-xl max-w-2xl mb-8">
            Shop the best products from local sellers, delivered straight to you via WhatsApp. Simple, fast, and secure.
          </p>
          <div className="flex gap-4">
            <button className="bg-white text-green-900 px-8 py-3 rounded-full font-bold hover:bg-green-50 transition-all transform hover:scale-105 shadow-lg">
              Start Shopping
            </button>
          </div>
        </div>
      </div>

      {/* 🛍️ PRODUCT GRID */}
      <main className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold flex items-center gap-2">
                🔥 Trending Now
            </h2>
            <div className="text-sm text-gray-500">Showing all items</div>
        </div>

        {loading ? (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
             {[1,2,3].map(i => <div key={i} className="h-64 bg-gray-200 rounded-2xl"></div>)}
           </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <div key={product.id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col">
                
                {/* Image Area */}
                <div className="h-56 bg-gray-100 relative overflow-hidden flex items-center justify-center">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <Package className="w-16 h-16 text-gray-300" />
                  )}
                  {/* Price Tag Overlay */}
                  <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur text-green-800 px-3 py-1 rounded-full font-black text-sm shadow-sm">
                    D{product.price}
                  </div>
                </div>

                {/* Content Area */}
                <div className="p-6 flex flex-col flex-grow">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-xl text-gray-800 leading-tight">{product.name}</h3>
                  </div>
                  
                  <p className="text-gray-500 text-sm mb-6 line-clamp-2 flex-grow">
                    {product.description || "A high-quality local product."}
                  </p>
                  
                  <button 
                    onClick={() => handleBuy(product)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-green-200 shadow-lg"
                  >
                    <ShoppingBag size={18} />
                    Buy on WhatsApp
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 🦶 FOOTER */}
      <footer className="bg-white border-t border-gray-100 mt-20">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="col-span-1 md:col-span-2">
                    <span className="text-xl font-black text-green-900">GAMBIA<span className="text-green-600">STORE</span></span>
                    <p className="mt-4 text-gray-500 text-sm max-w-xs">
                        Empowering Gambian businesses with simple, effective e-commerce tools. Built for the future of local trade.
                    </p>
                </div>
                <div>
                    <h4 className="font-bold mb-4">Support</h4>
                    <ul className="space-y-2 text-sm text-gray-500">
                        <li><a href="#" className="hover:text-green-600">Help Center</a></li>
                        <li><a href="#" className="hover:text-green-600">Safety Tips</a></li>
                        <li><a href="#" className="hover:text-green-600">Contact Us</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold mb-4">Legal</h4>
                    <ul className="space-y-2 text-sm text-gray-500">
                        <li><a href="#" className="hover:text-green-600">Privacy Policy</a></li>
                        <li><a href="#" className="hover:text-green-600">Terms of Service</a></li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-gray-100 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
                <p>&copy; 2024 Gambia Store Inc. All rights reserved.</p>
                <div className="flex gap-4 mt-4 md:mt-0">
                    <Facebook size={20} className="hover:text-green-600 cursor-pointer" />
                    <Instagram size={20} className="hover:text-green-600 cursor-pointer" />
                    <Twitter size={20} className="hover:text-green-600 cursor-pointer" />
                </div>
            </div>
        </div>
      </footer>
    </div>
  );
}