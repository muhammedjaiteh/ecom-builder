'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Phone, ArrowLeft, ShoppingBag, X, Smartphone, Banknote, Copy, Check, ShieldCheck, Truck, HomeIcon } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import ReviewForm from '@/components/ReviewForm';
import ReviewList from '@/components/ReviewList';

export default function ProductClient({ product: initialProduct }: { product?: any }) {
  const [product, setProduct] = useState<any>(initialProduct || null);
  const [loading, setLoading] = useState(!initialProduct);
  const [shopSettings, setShopSettings] = useState<any>(initialProduct?.shops || null);
  
  // 🟢 TERMINAL STATE
  const [showTerminal, setShowTerminal] = useState(false);
  const [paymentStep, setPaymentStep] = useState('SELECT');
  const [copied, setCopied] = useState(false);
  const [isOutOfStock, setIsOutOfStock] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { fulfillmentMethod, setFulfillmentMethod } = useCart();
  
  const params = useParams();
  const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
  const DEFAULT_PHONE = "2207470187"; 

  useEffect(() => {
    async function loadProduct() {
      if (initialProduct) return;
      if (!params?.id) return;
      const rawId = String(params.id);
      const cleanId = rawId.replace(/[^a-zA-Z0-9-]/g, '');

      const { data: productData, error } = await supabase
        .from('products')
        .select(`*, shops (id, phone, shop_name, shop_slug, logo_url, offers_delivery, offers_pickup), stock_quantity`)
        .eq('id', cleanId)
        .maybeSingle();

      if (error || !productData) { setLoading(false); return; }
      setProduct(productData);
      setShopSettings(productData.shops);
      setLoading(false);
    }
    loadProduct();
  }, [params]);

  useEffect(() => {
    if (product?.stock_quantity !== undefined && product?.stock_quantity !== null) {
      setIsOutOfStock(product.stock_quantity === 0);
    }
  }, [product]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReviewSubmitted = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleOrder = (method: string) => {
    if (method === 'Wave' && paymentStep === 'SELECT') {
        setPaymentStep('WAVE_INFO');
        return;
    }

    if (product.user_id) {
        supabase.from('leads').insert({
            seller_id: product.user_id,
            product_id: product.id,
            product_name: product.name,
            product_price: product.price,
            created_at: new Date().toISOString()
        }).then(({ error }) => {
            if (error) console.error('[leads] insert failed:', error.message);
        });
    }

    const sellerPhone = product.shops?.phone || DEFAULT_PHONE;
    let message = `👋 Hello ${product.shops?.shop_name || 'Seller'}! \n\nI want to buy: *${product.name}* \n💰 Price: D${product.price}`;

    if (method === 'Wave') {
        message += `\n\n💳 Payment Method: *Wave / Sadam* \n✅ I have copied your number (${sellerPhone}) and I am sending the money now. \n\nPlease confirm receipt.`;
    } else {
        message += `\n\n💵 Payment Method: *Cash on Delivery* \n📍 I will pay when you deliver.`;
    }
    
    const waLink = `https://wa.me/${sellerPhone}?text=${encodeURIComponent(message)}`;
    window.open(waLink, '_blank');
    
    setShowTerminal(false);
    setPaymentStep('SELECT');
  };

  const FulfillmentSelector = () => (shopSettings?.offers_delivery || shopSettings?.offers_pickup) ? (
    <div className="pt-2 pb-4">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Fulfillment Method</p>
      <div className="flex gap-3">
        {shopSettings?.offers_delivery && (
          <button
            onClick={() => setFulfillmentMethod('delivery')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-bold text-xs transition-all uppercase tracking-wider ${
              fulfillmentMethod === 'delivery'
                ? 'bg-[#2C3E2C] text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Truck size={16} /> Delivery
          </button>
        )}
        {shopSettings?.offers_pickup && (
          <button
            onClick={() => setFulfillmentMethod('pickup')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-bold text-xs transition-all uppercase tracking-wider ${
              fulfillmentMethod === 'pickup'
                ? 'bg-[#2C3E2C] text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <HomeIcon size={16} /> Pickup
          </button>
        )}
      </div>
    </div>
  ) : null;

  if (loading) return <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center text-[#2C3E2C] font-serif animate-pulse">Loading Luxury...</div>;
  if (!product) return <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center text-[#2C3E2C]">Item Unavailable</div>;

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-[#2C3E2C] relative selection:bg-green-100">
      
      {/* 🧭 Navbar */}
      <nav className="fixed top-0 w-full bg-[#F9F8F6]/90 backdrop-blur-md z-40 border-b border-[#E6E4DC]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase hover:text-green-800 transition-colors">
            <ArrowLeft size={14} /> Back to Market
          </Link>
          <div className="text-2xl font-black tracking-tighter">SANNDI<span className="text-green-800">KAA</span></div>
          <button className="p-2 rounded-full hover:bg-white transition-colors"><ShoppingBag size={20} /></button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-32 pb-16 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          
          {/* Product Image (Fixed Aspect Ratio) */}
          <div className="relative aspect-[4/5] bg-white rounded-sm overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-500">
            {product.image_url ? (
               <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
               <div className="absolute inset-0 flex items-center justify-center text-gray-200"><ShoppingBag size={64} /></div>
            )}
            <div className="absolute top-0 left-0 bg-[#2C3E2C] text-white px-5 py-2 text-[10px] font-bold tracking-[0.2em] uppercase">
                Authentic
            </div>
          </div>

          {/* Product Details */}
          <div className="flex flex-col justify-center space-y-8 pt-4">
            
            {/* Shop Badge */}
            <Link href={`/shop/${product.shops?.shop_slug || 'famwise'}`} className="flex items-center gap-4 group w-max p-2 -ml-2 rounded-full hover:bg-white transition-all">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-200 bg-gray-50">
                {product.shops?.logo_url ? (
                   <img src={product.shops.logo_url} alt="Shop Logo" className="w-full h-full object-cover" />
                ) : (
                   <div className="w-full h-full flex items-center justify-center font-serif font-bold text-[#2C3E2C]">{product.shops?.shop_name?.charAt(0) || 'S'}</div>
                )}
              </div>
              <div>
                <p className="text-[9px] text-gray-400 font-bold tracking-widest uppercase mb-0.5">Sold By</p>
                <p className="text-lg font-serif text-[#2C3E2C] group-hover:text-green-800 transition-colors">
                  {product.shops?.shop_name || 'Famwise Store'}
                </p>
              </div>
            </Link>

            {/* Title & Price */}
            <div>
              <h1 className="text-4xl md:text-5xl font-serif font-medium leading-tight mb-6 text-[#1a2e1a]">{product.name}</h1>
              <div className="flex items-center gap-6">
                  <p className="text-3xl font-light text-[#2C3E2C]">D{product.price}</p>
                  <span className="text-[10px] font-bold border border-green-800/30 text-green-800 px-3 py-1 rounded-full uppercase tracking-wider">{isOutOfStock ? 'Out of Stock' : 'In Stock'}</span>
              </div>
            </div>

            <div className="w-16 h-[1px] bg-gray-300"></div>

            <p className="text-base text-[#5F6F5F] leading-relaxed font-light max-w-md">
                {product.description || "Authentic quality from trusted sellers. Verified for excellence."}
            </p>

            {/* Fulfillment Method Selection */}
            <FulfillmentSelector />

            {/* Out of Stock vs Available */}
            {isOutOfStock ? (
              <div className="pt-4">
                <div className="w-full rounded-full bg-red-50 border-2 border-red-200 py-4 px-6 text-center">
                  <p className="text-sm font-bold text-red-700 uppercase tracking-wider">Out of Stock</p>
                  <p className="text-xs text-red-600 mt-1">Check back soon for restocks!</p>
                </div>
              </div>
            ) : (
              <>
                {/* Fulfillment Method Selection */}
                <FulfillmentSelector />

                {/* 🟢 THE FIXED BUTTON */}
                <div className="pt-4">
                  <button 
                    onClick={() => setShowTerminal(true)} 
                    className="w-full md:w-auto bg-[#2C3E2C] hover:bg-[#1a2e1a] text-white py-4 px-10 rounded-full font-bold text-sm tracking-widest uppercase flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition-all transform active:scale-95"
                  >
                    <Phone size={18} /> 
                    <span>Order via WhatsApp</span>
                  </button>
                  <p className="text-[10px] text-gray-400 mt-4 text-center md:text-left flex items-center justify-center md:justify-start gap-1">
                    <ShieldCheck size={12} /> Secure Transaction
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* --- REVIEWS INTEGRATION --- */}
        <div className="mt-24 pt-12 border-t border-black/5">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-3xl font-serif font-medium leading-tight text-[#1a2e1a]">Customer Feedback</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            
            {/* Left Column: Review List & Stats */}
            <div className="lg:col-span-2">
              <ReviewList 
                 productId={product.id} 
                 refreshTrigger={refreshTrigger} 
              />
            </div>
            
            {/* Right Column: Submission Form */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <ReviewForm 
                   productId={product.id} 
                   onReviewSubmitted={handleReviewSubmitted} 
                />
              </div>
            </div>
            
          </div>
        </div>
        {/* --- END REVIEWS INTEGRATION --- */}
      </main>

      {/* 💳 THE VIP TERMINAL (Redesigned) */}
      {showTerminal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1a2e1a]/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-[#F9F8F6] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-300 relative">
              
              {/* Header */}
              <div className="bg-[#2C3E2C] p-6 text-center relative">
                  <button 
                    onClick={() => { setShowTerminal(false); setPaymentStep('SELECT'); }}
                    className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                  <h2 className="text-xl font-serif text-white mb-1">Checkout</h2>
                  <p className="text-[10px] text-white/60 uppercase tracking-widest">Sanndikaa Secure</p>
              </div>

              <div className="p-8">
                  {/* STEP 1: SELECT PAYMENT */}
                  {paymentStep === 'SELECT' ? (
                    <div className="space-y-4">
                         <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Select Payment Method</p>
                         
                         <button 
                           onClick={() => handleOrder('Cash')}
                           className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 hover:border-[#2C3E2C] rounded-xl transition-all group shadow-sm"
                         >
                            <div className="w-10 h-10 bg-green-50 text-[#2C3E2C] rounded-full flex items-center justify-center"><Banknote size={20} /></div>
                            <div className="text-left">
                                <p className="font-bold text-[#2C3E2C] text-sm">Cash on Delivery</p>
                                <p className="text-[10px] text-gray-400">Pay when you receive it</p>
                            </div>
                         </button>

                         <button 
                           onClick={() => handleOrder('Wave')}
                           className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 hover:border-[#1DA1F2] rounded-xl transition-all group shadow-sm"
                         >
                            <div className="w-10 h-10 bg-blue-50 text-[#1DA1F2] rounded-full flex items-center justify-center"><Smartphone size={20} /></div>
                            <div className="text-left">
                                <p className="font-bold text-[#2C3E2C] text-sm">Wave / Sadam</p>
                                <p className="text-[10px] text-gray-400">Mobile Money Transfer</p>
                            </div>
                         </button>
                    </div>
                  ) : (
                    // 🌊 STEP 2: VIP WAVE CARD
                    <div className="text-center">
                       <div className="w-12 h-12 bg-blue-50 text-[#1DA1F2] rounded-full flex items-center justify-center mx-auto mb-4">
                          <Smartphone size={24} />
                       </div>
                       
                       <p className="text-xs text-gray-500 mb-6 px-2">
                          Send <span className="font-bold text-black">D{product.price}</span> to this verified number:
                       </p>
                       
                       {/* 💳 The Premium Card */}
                       <div className="bg-gradient-to-br from-[#2C3E2C] to-[#1a2e1a] p-6 rounded-xl text-white mb-6 shadow-lg relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
                          
                          <div className="flex justify-between items-end">
                              <div className="text-left">
                                  <p className="text-[8px] text-white/60 font-bold uppercase tracking-widest mb-1">Merchant Number</p>
                                  <p className="text-xl font-mono tracking-widest">{product.shops?.phone || DEFAULT_PHONE}</p>
                              </div>
                              <button 
                                onClick={() => copyToClipboard(product.shops?.phone || DEFAULT_PHONE)}
                                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-colors"
                              >
                                 {copied ? <Check size={16}/> : <Copy size={16}/>}
                              </button>
                          </div>
                       </div>

                       <button 
                         onClick={() => handleOrder('Wave')}
                         className="w-full bg-[#1DA1F2] hover:bg-[#1a94da] text-white py-3 rounded-lg font-bold text-sm shadow-md transition-all"
                       >
                          Open WhatsApp to Confirm
                       </button>
                    </div>
                  )}
              </div>
           </div>
        </div>
      )}

    </div>
  );
}