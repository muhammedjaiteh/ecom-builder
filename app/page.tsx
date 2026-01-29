'use client';

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Define the shape of our product data
interface Product {
  id: string;
  name: string;
  price: string; 
  description: string;
  image_url: string;
}

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*');
    if (error) console.error('Error fetching products:', error);
    else setProducts(data || []);
    setLoading(false);
  };

  const handleBuy = async (product: Product) => {
    setPurchasing(product.id); 

    try {
      // 1. Save Order to Database
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          productName: product.name, 
          price: product.price 
        }),
      });

      if (!res.ok) throw new Error("Failed to record order");

      // 2. Launch WhatsApp
      // REPLACE '2201234567' with your real WhatsApp number!
      const phone = "2201234567"; 
      const message = `Hello! I want to buy *${product.name}* for D${product.price}. Is it available?`;
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

      window.open(url, '_blank');

    } catch (err) {
      alert("Could not connect to server, but opening WhatsApp anyway!");
      const phone = "2201234567"; 
      const message = `Hello! I want to buy *${product.name}* (System Error)`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-xl font-bold">Loading Store... 🛒</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-black tracking-tighter text-black">🛍️ GAMBIA STORE</h1>
          <a href="/login" className="text-sm font-medium text-gray-500 hover:text-black">
            Admin Login
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-blue-600 text-white py-16 px-4 text-center">
        <h2 className="text-4xl font-bold mb-4">The Best Products in Town</h2>
        <p className="text-blue-100 text-lg max-w-2xl mx-auto">
          Shop the latest trends with instant delivery. Click to buy on WhatsApp!
        </p>
      </div>

      {/* Product Grid */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        {products.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed">
            <p className="text-xl text-gray-500">No products found.</p>
            <p className="text-sm text-gray-400 mt-2">Go to your Admin Dashboard to add some!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-shadow border overflow-hidden flex flex-col">
                {/* Product Image Area */}
                <div className="h-48 bg-gray-100 relative flex items-center justify-center">
                   <div className="text-6xl">📦</div>
                </div>

                {/* Details */}
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{product.description}</p>
                  
                  <div className="mt-auto flex items-center justify-between pt-4 border-t">
                    <span className="text-2xl font-bold text-green-600">D{product.price}</span>
                    <button 
                      onClick={() => handleBuy(product)}
                      disabled={purchasing === product.id}
                      className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2"
                    >
                      {purchasing === product.id ? (
                        <span>Processing...</span>
                      ) : (
                        <>
                          <span>👉 Buy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}