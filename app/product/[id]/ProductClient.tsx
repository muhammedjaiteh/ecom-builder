'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Phone, ArrowLeft, ShoppingBag, Share2, X, Smartphone, Banknote, Copy, Check, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function ProductClient() {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // 🟢 TERMINAL STATE
  const [showTerminal, setShowTerminal] = useState(false);
  const [paymentStep, setPaymentStep] = useState('SELECT'); // 'SELECT' or 'WAVE_INFO'
  const [copied, setCopied] = useState(false);
  
  const params = useParams();
  const supabase = createClientComponentClient();
  const DEFAULT_PHONE = "2207470187"; 

  useEffect(() => {
    async function loadProduct() {
      if (!params?.id) return;
      const rawId = String(params.id);
      const cleanId = rawId.replace(/[^a-zA-Z0-9-]/g, '');

      const { data: productData, error } = await supabase
        .from('products')
        .select(`*, shops (phone, shop_name, shop_slug, logo_url)`)
        .eq('id', cleanId)
        .single();

      if (error || !productData) { setLoading(false); return; }
      setProduct(productData);
      setLoading(false);
    }
    loadProduct();
  }, [params]);

  // 📋 COPY FUNCTION
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 🚀 ORDER LOGIC
  const handleOrder = (method: string) => {
    // 1. If Wave, Interrupt the flow to show the number
    if (method === 'Wave' && paymentStep === 'SELECT') {
        setPaymentStep('WAVE_INFO');
        return;
    }

    // 2. Capture the Lead (Analytics)
    if (product.user_id) {
        supabase.from('leads').insert({
            seller_id: product.user_id,
            product_id: product.id,
            product_name: product.name,
            product_price: product.price,
            created_at: new Date().toISOString()
        });
    }

    // 3. Build the WhatsApp Message
    const sellerPhone = product.shops?.phone || DEFAULT_PHONE;
    let message = `👋 Hello ${product.shops?.shop_name || 'Seller'}! \n\nI want to buy: *${product.name}* \n💰 Price: D${product.price}`;

    if (method === 'Wave') {
        message += `\n\n💳 Payment Method: *Wave / Sadam* \n✅ I have copied your number (${sellerPhone}) and I am sending the money now. \n\nPlease confirm receipt.`;
    } else {
        message += `\n\n💵 Payment Method: *Cash on Delivery* \n📍 I will pay when you deliver.`;
    }
    
    // 4. Launch WhatsApp
    const waLink = `https://wa.me/${sellerPhone}?text=${encodeURIComponent(message)}`;
    window.open(waLink, '_blank');
    
    // 5. Close Terminal
    setShowTerminal(false);
    setPaymentStep('SELECT');
  };

  if (loading) return <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center text-[#2C3E2C] animate-pulse">Loading Luxury...</div>;
  if (!product) return <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center text-[#2C3E2C]">Item Unavailable</div>;

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-[#2C3E2C] relative">
      
      {/* 🧭 Navbar */}
      <nav className="fixed top-0 w-full bg-[#F9F8F6]/80 backdrop-blur-md z-40 border-b border-[#E6E4DC]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase hover:opacity-70 transition-opacity">
            <ArrowLeft size={16} /> Back
          </Link>
          <div className="text-xl font-black tracking-tighter">SANNDI<span className="text-green-800">KAA</span></div>
          <button className="p-2 rounded-full hover:bg-gray-100"><ShoppingBag size={20} /></button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-start">
          
          {/* Product Image */}
          <div className="relative aspect-[4/5] lg:aspect-square bg-white rounded-3xl overflow-hidden shadow-sm">
            {product.image_url ? (
               <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
               <div className="absolute inset-0 flex items-center justify-center text-gray-200"><ShoppingBag size={64} /></div>
            )}
            <div className="absolute top-6 left-6 bg-white px-4 py-1 text-[10px] font-bold tracking-widest uppercase text-black">Authentic</div>
          </div>

          {/* Product Details */}
          <div className="flex flex-col h-full justify-center space-y-8 pt-4">
            <Link href={`/shop/${product.shops?.shop_slug || 'famwise'}`} className="inline-flex items-center gap-4 group cursor-pointer w-max">
              <div className="w-14 h-14 rounded-full overflow-hidden shadow-md group-hover:scale-110 transition-transform bg-gray-100 flex items-center justify-center border border-gray-200">
                {product.shops?.logo_url ? (
                   <img src={product.shops.logo_url} alt="Shop Logo" className="w-full h-full object-cover" />
                ) : (
                   <span className="text-[#2C3E2C] font-bold text-lg font-serif">{product.shops?.shop_name?.charAt(0) || 'S'}</span>
                )}
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-1">Sold By</p>
                <p className="text-xl font-serif text-[#2C3E2C] group-hover:underline decoration-1 underline-offset-4">
                  {product.shops?.shop_name || 'Famwise Store'}
                </p>
              </div>
            </Link>

            <div>
              <h1 className="text-4xl md:text-6xl font-serif font-medium leading-tight mb-4 text-[#1a2e1a]">{product.name}</h1>
              <p className="text-3xl font-light text-[#2C3E2C] flex items-center gap-4">
                D{product.price}
                <span className="text-[10px] font-bold bg-green-100 text-green-800 px-3 py-1 rounded-full uppercase tracking-wider">In Stock</span>
              </p>
            </div>

            <p className="text-lg text-[#5F6F5F] leading-relaxed font-light">{product.description || "Authentic quality from trusted sellers."}</p>

            {/* 🟢 THE TRIGGER BUTTON */}
            <button 
                onClick={() => setShowTerminal(true)} 
                className="flex-1 bg-[#2C3E2C] hover:bg-[#1a2e1a] text-white py-5 px-8 rounded-full font-bold text-lg flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition-all transform active:scale-98"
            >
                <Phone size={20} /> Order via WhatsApp
            </button>
          </div>
        </div>
      </main>

      {/* 💳 THE SMART PAYMENT TERMINAL (Modal) */}
      {showTerminal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 relative overflow-hidden">
              
              {/* Close Button */}
              <button 
                onClick={() => { setShowTerminal(false); setPaymentStep('SELECT'); }}
                className="absolute top-6 right-6 p-2 bg-gray-50 rounded-full hover:bg-gray-200 transition-colors z-10"
              >
                <X size={20} />
              </button>

              {/* STEP 1: SELECT PAYMENT */}
              {paymentStep === 'SELECT' ? (
                <>
                  <div className="text-center mb-8 mt-2">
                     <h2 className="text-2xl font-serif font-bold mb-2 text-[#2C3E2C]">Checkout</h2>
                     <p className="text-gray-500 text-sm">Select your preferred payment method</p>
                  </div>

                  <div className="space-y-4">
                     {/* 💵 CASH OPTION */}
                     <button 
                       onClick={() => handleOrder('Cash')}
                       className="w-full flex items-center justify-between p-5 bg-white border-2 border-gray-100 hover:border-green-500 hover:bg-green-50/50 rounded-2xl transition-all group shadow-sm hover:shadow-md"
                     >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Banknote size={24} /></div>
                            <div className="text-left">
                                <p className="font-bold text-[#2C3E2C] text-lg">Cash on Delivery</p>
                                <p className="text-xs text-gray-400 font-medium tracking-wide">PAY UPON RECEIPT</p>
                            </div>
                        </div>
                     </button>

                     {/* 🌊 WAVE OPTION */}
                     <button 
                       onClick={() => handleOrder('Wave')}
                       className="w-full flex items-center justify-between p-5 bg-white border-2 border-gray-100 hover:border-[#1DA1F2] hover:bg-blue-50/50 rounded-2xl transition-all group shadow-sm hover:shadow-md"
                     >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#E8F5FE] text-[#1DA1F2] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Smartphone size={24} /></div>
                            <div className="text-left">
                                <p className="font-bold text-[#2C3E2C] text-lg">Wave / Sadam</p>
                                <p className="text-xs text-gray-400 font-medium tracking-wide">MOBILE MONEY TRANSFER</p>
                            </div>
                        </div>
                     </button>
                  </div>
                </>
              ) : (
                // 🌊 STEP 2: WAVE DETAILS (The Innovative Part)
                <div className="text-center pt-4">
                   <div className="w-16 h-16 bg-[#E8F5FE] text-[#1DA1F2] rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                      <Smartphone size={32} />
                   </div>
                   
                   <h2 className="text-xl font-serif font-bold mb-1 text-[#2C3E2C]">Send Payment</h2>
                   <div className="flex items-center justify-center gap-1 text-xs font-bold text-green-600 mb-6 bg-green-50 py-1 px-3 rounded-full w-max mx-auto">
                      <ShieldCheck size={12} /> VERIFIED SELLER
                   </div>
                   
                   <p className="text-gray-500 text-sm mb-6 px-4">
                      Please send <span className="text-black font-bold">D{product.price}</span> to the number below via Wave or Sadam.
                   </p>
                   
                   {/* 🔢 THE NUMBER BOX */}
                   <div className="bg-gray-900 p-5 rounded-2xl flex items-center justify-between mb-8 shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
                      
                      <div className="text-left relative z-10">
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Merchant Number</p>
                          <p className="text-2xl font-mono font-bold text-white tracking-wider">{product.shops?.phone || DEFAULT_PHONE}</p>
                      </div>
                      
                      <button 
                        onClick={() => copyToClipboard(product.shops?.phone || DEFAULT_PHONE)}
                        className="relative z-10 p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-all active:scale-90"
                      >
                         {copied ? <Check size={20} className="text-green-400"/> : <Copy size={20}/>}
                      </button>
                   </div>

                   {/* CONFIRM BUTTON */}
                   <button 
                     onClick={() => handleOrder('Wave')}
                     className="w-full bg-[#1DA1F2] hover:bg-[#1a94da] text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                   >
                      <span>Open WhatsApp to Confirm</span>
                      <Share2 size={16} />
                   </button>
                </div>
              )}
              
              <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                 <p className="text-[9px] text-gray-300 uppercase tracking-widest font-bold">Secured by Sanndikaa</p>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}