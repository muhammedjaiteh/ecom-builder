'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Phone, CheckCircle, Loader2, PackageX } from 'lucide-react';

export default function ProductPage() {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const params = useParams();
  const supabase = createClientComponentClient();

  const SHOP_PHONE = "2207470187"; 

  useEffect(() => {
    async function loadProduct() {
      try {
        let rawId = params?.id;
        if (!rawId) return;

        // Force it to be a string
        const idString = String(rawId);

        console.log("🛑 Raw ID from URL:", idString);

        // ☢️ NUCLEAR CLEANER: 
        // This regex deletes ANYTHING that is not a Letter (a-z), Number (0-9), or Dash (-).
        // It guarantees no quotes, slashes, or spaces can survive.
        const cleanId = idString.replace(/[^a-zA-Z0-9-]/g, '');

        console.log("✅ Clean ID sent to DB:", cleanId);

        // 3. Ask Database
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', cleanId)
          .single();

        if (error) throw error;
        setProduct(data);
      
      } catch (err: any) {
        console.error("❌ Error loading product:", err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [params]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center animate-pulse">
          <Loader2 className="w-10 h-10 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md bg-white p-8 rounded-2xl shadow-lg">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <PackageX size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
          <p className="text-gray-500 mb-4">We couldn't locate this item.</p>
          {error && <p className="text-xs text-red-400 bg-red-50 p-2 rounded">{error}</p>}
        </div>
      </div>
    );
  }

  // --- BUY BUTTON ---
  const handleBuy = () => {
    const message = `👋 Hello! I want to buy *${product.name}* for *D${product.price}*.`;
    const waLink = `https://wa.me/${SHOP_PHONE}?text=${encodeURIComponent(message)}`;
    window.open(waLink, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        <div className="h-64 bg-green-900 flex items-center justify-center text-8xl">📦</div>
        <div className="p-8">
          <h1 className="text-3xl font-black text-gray-900 mb-2">{product.name}</h1>
          <p className="text-3xl font-black text-green-700 mb-4">D{product.price}</p>
          <p className="text-gray-600 mb-8">{product.description}</p>
          <button onClick={handleBuy} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3">
            <Phone size={24} /> Order on WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}