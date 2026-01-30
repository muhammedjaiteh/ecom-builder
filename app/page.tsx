'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShoppingBag, Package } from 'lucide-react';
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
    const message = `Hi! I want to buy ${product.name} for D${product.price}`;
    const whatsappUrl = `https://wa.me/2200000000?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (loading) return <div className="p-10 text-center">Loading Store... 🛒</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white border-b p-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black flex items-center gap-2">
            🛍️ GAMBIA STORE
          </h1>
          <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-black">
            Admin Login
          </Link>
        </div>
      </nav>

      {/* Product Grid */}
      <main className="max-w-5xl mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
              
              {/* IMAGE SECTION */}
              <div className="h-48 bg-gray-100 flex items-center justify-center overflow-hidden relative">
                {product.image_url ? (
                  // If image exists, show it
                  <img 
                    src={product.image_url} 
                    alt={product.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  // If no image, show the Box Icon
                  <Package className="w-16 h-16 text-gray-300" />
                )}
              </div>

              {/* DETAILS SECTION */}
              <div className="p-5">
                <h3 className="font-bold text-lg mb-1">{product.name}</h3>
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                  {product.description || "No description available."}
                </p>
                
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-green-700">
                    D{product.price}
                  </span>
                  <button 
                    onClick={() => handleBuy(product)}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                  >
                    👉 Buy
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}