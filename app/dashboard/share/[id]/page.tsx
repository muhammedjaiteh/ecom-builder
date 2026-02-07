'use client';

import { useEffect, useState, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Share2, Phone } from 'lucide-react';
import Link from 'next/link';
import html2canvas from 'html2canvas';

export default function ShareStudio() {
  const params = useParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    async function loadProduct() {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.id)
        .single();
      
      if (data) setProduct(data);
      setLoading(false);
    }
    loadProduct();
  }, []);

  // 📸 The Camera Function
  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    // Snap the photo
    const canvas = await html2canvas(cardRef.current, {
      scale: 2, // High resolution
      backgroundColor: null, 
    });

    // Create a fake link to download it
    const image = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = image;
    link.download = `gambia-store-${product.name}.png`;
    link.click();
  };

  if (loading) return <div className="p-10 text-center">Loading Studio...</div>;
  if (!product) return <div className="p-10 text-center">Product not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      
      {/* Header */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-8">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft size={20} /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-black text-gray-900">WhatsApp Status Studio 📸</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-12 items-start justify-center w-full max-w-6xl">
        
        {/* 🖼 PREVIEW AREA (This is what gets photographed) */}
        <div className="flex-1 flex justify-center">
          <div 
            ref={cardRef}
            className="w-[350px] h-[600px] bg-gradient-to-br from-green-800 to-green-950 text-white rounded-3xl p-8 relative shadow-2xl flex flex-col items-center text-center justify-between overflow-hidden border-4 border-yellow-400/20"
          >
            {/* Background Pattern */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

            {/* Top Logo */}
            <div className="z-10 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
              <span className="font-black text-sm tracking-widest text-green-200">GAMBIA STORE 🇬🇲</span>
            </div>

            {/* Product Info */}
            <div className="z-10 flex-1 flex flex-col justify-center items-center w-full gap-6">
              
              {/* Product Image Placeholder */}
              <div className="w-48 h-48 bg-white rounded-full shadow-2xl flex items-center justify-center overflow-hidden border-4 border-yellow-400">
                {product.image_url ? (
                    <img src={product.image_url} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-4xl">🎁</span>
                )}
              </div>

              <div>
                <h2 className="text-3xl font-black leading-tight mb-2 drop-shadow-md">{product.name}</h2>
                <div className="inline-block bg-yellow-400 text-green-900 font-black text-xl px-6 py-2 rounded-full shadow-lg transform -rotate-2">
                  D{product.price}
                </div>
              </div>

              <p className="text-green-100 text-sm opacity-90 font-medium px-4">
                {product.description ? product.description.substring(0, 80) + "..." : "Authentic quality. Best price."}
              </p>
            </div>

            {/* Footer Call to Action */}
            <div className="z-10 w-full bg-white text-green-900 p-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg">
              <Phone size={20} className="fill-green-900" />
              <span className="font-bold text-lg">Order on WhatsApp</span>
            </div>
          </div>
        </div>

        {/* 🎛 CONTROL PANEL */}
        <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
          <div className="mb-6">
            <h3 className="font-bold text-xl text-gray-900 mb-2">Share this Product</h3>
            <p className="text-gray-500 text-sm">Use this generated card to post on your Status or send to customers.</p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={handleDownload}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-200 flex items-center justify-center gap-3 transition-all active:scale-95"
            >
              <Download size={20} /> Download Image
            </button>

            <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100 text-yellow-800 text-sm">
              <strong>💡 Pro Tip:</strong> Download this image and post it to your WhatsApp Status. It includes your store branding automatically!
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}