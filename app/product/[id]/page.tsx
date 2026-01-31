'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useParams } from 'next/navigation';
import { ArrowLeft, MessageCircle, ShoppingBag } from 'lucide-react';
import Link from 'next/link';

export default function ProductPage() {
  const params = useParams(); // Get the ID from the URL
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function loadProduct() {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.id) // Find the ONE product with this ID
        .single();
      
      setProduct(data);
      setLoading(false);
    }
    loadProduct();
  }, []);

  if (loading) return <div className="p-10 text-center text-gray-400">Loading Product...</div>;
  if (!product) return <div className="p-10 text-center text-red-500">Product not found.</div>;

  // WhatsApp Logic
  const whatsappMessage = `Hello! I want to buy ${product.name} for D${product.price}.`;
  const whatsappLink = `https://wa.me/2209999999?text=${encodeURIComponent(whatsappMessage)}`;

  // Record Order Logic (The same one we built earlier!)
  const handleBuy = async () => {
    await fetch('/api/create-order', {
      method: 'POST',
      body: JSON.stringify({ productName: product.name, price: product.price }),
    });
    window.open(whatsappLink, '_blank');
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      
      {/* Header */}
      <nav className="p-6 flex items-center gap-4 border-b sticky top-0 bg-white/80 backdrop-blur-md z-10">
        <Link href="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <span className="font-bold text-lg">Back to Store</span>
      </nav>

      <div className="max-w-5xl mx-auto p-6 md:p-12 grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
        
        {/* Left: Image */}
        <div className="bg-gray-50 rounded-3xl overflow-hidden shadow-sm border aspect-square flex items-center justify-center">
            {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
                <ShoppingBag size={64} className="text-gray-200" />
            )}
        </div>

        {/* Right: Details */}
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">{product.name}</h1>
            <div className="text-3xl font-medium text-green-600">D{product.price}</div>
          </div>

          <div className="prose text-gray-500 leading-relaxed text-lg">
            {product.description || "No description available for this amazing product."}
          </div>

          <button 
            onClick={handleBuy}
            className="w-full bg-green-600 hover:bg-green-700 text-white text-xl font-bold py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-green-200 active:scale-95"
          >
            <MessageCircle size={28} />
            Buy on WhatsApp
          </button>

          <p className="text-center text-sm text-gray-400">
            Secure checkout powered by Gambia Store
          </p>
        </div>
      </div>
    </div>
  );
}