'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, MessageCircle, X, Smartphone, Banknote, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ProductPage() {
  const params = useParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('wave');
  const [isRedirecting, setIsRedirecting] = useState(false); // New state for loading animation
  
  const supabase = createClientComponentClient();

  // 🏪 YOUR SHOP PHONE NUMBER
  const SHOP_PHONE = "2207775555"; 

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

  // 🚀 The Silent Recorder + WhatsApp Redirect
  const handleFinalOrder = async () => {
    if (!product) return;
    setIsRedirecting(true); // Start loading spinner

    // 1. Save Order to Database (The Silent Record)
    await supabase.from('orders').insert({
      product_name: product.name,
      price: product.price,
      status: 'new',
      quantity: 1
    });

    // 2. Prepare WhatsApp Message
    const message = `👋 Hi, I want to buy *${product.name}* for *D${product.price}*.
    
📦 *Order Details:*
- Method: ${paymentMethod.toUpperCase()}
- Price: D${product.price}

Please confirm my order!`;

    // 3. Launch WhatsApp
    const url = `https://wa.me/${SHOP_PHONE}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    
    // 4. Close Popup & Stop Loading
    setIsRedirecting(false);
    setShowPayment(false);
  };

  if (loading) return <div className="p-10 text-center text-green-800">Loading Product...</div>;
  if (!product) return <div className="p-10 text-center">Product not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center p-4">
      
      {/* 🛍️ PRODUCT CARD */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 relative">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center gap-4 sticky top-0 bg-white/90 backdrop-blur-sm z-10">
          <Link href="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-gray-600" />
          </Link>
          <span className="font-bold text-gray-900">Back to Store</span>
        </div>

        {/* Product Image */}
        <div className="w-full h-80 bg-gray-100 relative">
           {product.image_url ? (
             <img src={product.image_url} className="w-full h-full object-cover" />
           ) : (
             <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
           )}
        </div>

        {/* Product Details */}
        <div className="p-8 pb-32">
          <h1 className="text-3xl font-black text-gray-900 mb-2 leading-tight">{product.name}</h1>
          <div className="text-2xl font-bold text-green-600 mb-6">D{product.price}</div>
          
          <p className="text-gray-600 leading-relaxed mb-8">
            {product.description || "A high-quality product from our collection. ✨"}
          </p>

          <div className="bg-green-50 p-4 rounded-xl flex items-center gap-3 text-green-800 text-sm font-medium border border-green-100">
            <span>🛡️</span>
            <span>Verified by Gambia Store. Money-back guarantee.</span>
          </div>
        </div>

        {/* Floating Buy Button */}
        <div className="absolute bottom-0 left-0 w-full p-4 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
          <button 
            onClick={() => setShowPayment(true)}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl text-lg shadow-lg shadow-green-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <MessageCircle className="fill-white" /> Buy Now
          </button>
          <div className="text-center text-xs text-gray-400 mt-2">Secure checkout powered by Gambia Store</div>
        </div>

      </div>

      {/* 💸 THE PAYMENT POPUP */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900">How will you pay?</h3>
              <button onClick={() => setShowPayment(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 mb-8">
              {/* WAVE */}
              <button 
                onClick={() => setPaymentMethod('wave')}
                className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                  paymentMethod === 'wave' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-blue-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500 text-white p-2 rounded-lg"><Smartphone size={20} /></div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900">Wave</div>
                    <div className="text-xs text-gray-500">Dial *122#</div>
                  </div>
                </div>
                {paymentMethod === 'wave' && <div className="w-4 h-4 bg-blue-500 rounded-full"></div>}
              </button>

              {/* QMONEY */}
              <button 
                onClick={() => setPaymentMethod('qmoney')}
                className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                  paymentMethod === 'qmoney' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-100 hover:border-yellow-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-500 text-white p-2 rounded-lg"><Smartphone size={20} /></div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900">QMoney</div>
                    <div className="text-xs text-gray-500">Dial *323#</div>
                  </div>
                </div>
                {paymentMethod === 'qmoney' && <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>}
              </button>

              {/* CASH */}
              <button 
                onClick={() => setPaymentMethod('cash')}
                className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                  paymentMethod === 'cash' ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:border-green-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-green-600 text-white p-2 rounded-lg"><Banknote size={20} /></div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900">Cash on Delivery</div>
                    <div className="text-xs text-gray-500">Pay when it arrives</div>
                  </div>
                </div>
                {paymentMethod === 'cash' && <div className="w-4 h-4 bg-green-500 rounded-full"></div>}
              </button>
            </div>

            <button 
              onClick={handleFinalOrder}
              disabled={isRedirecting}
              className="w-full bg-black text-white font-bold py-4 rounded-2xl text-lg hover:bg-gray-900 transition-all flex items-center justify-center gap-2"
            >
              {isRedirecting ? (
                <>Processing <Loader2 className="animate-spin" /></>
              ) : (
                <>Continue to WhatsApp <ArrowLeft className="rotate-180" size={20} /></>
              )}
            </button>

          </div>
        </div>
      )}

    </div>
  );
}