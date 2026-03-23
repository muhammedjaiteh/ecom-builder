'use client';

import { useCart } from './CartProvider';
import { X, ShoppingBag, Plus, Minus, Trash2, Store, ArrowRight, Loader2, User, Phone, Truck, MapPin, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

function sanitizePhoneNumber(rawNumber?: string | null) {
  if (!rawNumber) return null;
  let cleanNumber = rawNumber.replace(/\D/g, '');
  if (!cleanNumber) return null;
  // If it's a 7-digit Gambian number, add the 220 country code automatically
  if (cleanNumber.length === 7) cleanNumber = `220${cleanNumber}`;
  return cleanNumber;
}

function generateWhatsAppLink(number: string | null | undefined, message: string) {
  const cleanNumber = sanitizePhoneNumber(number);
  if (!cleanNumber) return null;
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}

export default function Cart() {
  const { items, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart } = useCart();
  const supabase = createClientComponentClient();

  const [activeCheckoutShop, setActiveCheckoutShop] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const itemsByShop = items.reduce((acc, item) => {
    if (!acc[item.shop_id]) {
      acc[item.shop_id] = { shopName: item.shop_name, shopWhatsapp: item.shop_whatsapp, items: [], total: 0 };
    }
    acc[item.shop_id].items.push(item);
    acc[item.shop_id].total += (item.price * item.quantity);
    return acc;
  }, {} as Record<string, { shopName: string, shopWhatsapp: string, items: typeof items, total: number }>);

  const handleProcessCheckout = async (shopId: string, shopData: typeof itemsByShop[string]) => {
    if (!customerName.trim() || !customerPhone.trim()) return alert('Please enter your Name and Phone/WhatsApp Number.');
    if (fulfillmentMethod === 'delivery' && !deliveryAddress.trim()) return alert('Please provide a delivery address.');

    setIsProcessing(true);

    try {
      // 1. GENERATE A RANDOM ORDER REF FOR THE RECEIPT
      const orderRef = Math.random().toString(36).substring(2, 8).toUpperCase(); 
      
      // 2. BUILD THE LUXURY DIGITAL RECEIPT
      let message = `🛍️ *NEW ORDER via SANNDIKAA*\n`;
      message += `Order Ref: #${orderRef}\n`;
      message += `──────────────────\n\n`;
      message += `Hi *${shopData.shopName}*! I would like to place an order for:\n\n`;
      
      shopData.items.forEach(item => {
        message += `🔹 *${item.quantity}x ${item.name}*\n`;
        if (item.variant_details && item.variant_details !== 'None') {
          message += `   Options: ${item.variant_details}\n`;
        }
        message += `   Price: D${(item.price * item.quantity).toLocaleString()}\n\n`;
      });
      
      message += `──────────────────\n`;
      message += `💰 *TOTAL AMOUNT: D${shopData.total.toLocaleString()}*\n`;
      message += `──────────────────\n\n`;
      
      message += `👤 *CUSTOMER DETAILS:*\n`;
      message += `Name: ${customerName}\n`;
      message += `Phone: ${customerPhone}\n`;
      message += `Fulfillment: ${fulfillmentMethod === 'delivery' ? '🚚 Delivery' : '🏪 Store Pickup'}\n`;
      if (fulfillmentMethod === 'delivery') {
        message += `Address: ${deliveryAddress.trim()}\n`;
      }
      message += `\n*Please let me know how to pay and confirm this order!*`;

      const whatsappLink = generateWhatsAppLink(shopData.shopWhatsapp, message);
      if (!whatsappLink) { 
        alert(`Sorry, ${shopData.shopName} has not provided a valid WhatsApp number.`); 
        setIsProcessing(false); 
        return; 
      }

      // 3. SILENT DATABASE INSERT (Does not break the checkout if it fails)
      try {
        const { data: customerData } = await supabase.from('customers').insert({ name: customerName, phone_number: customerPhone, location: fulfillmentMethod === 'delivery' ? deliveryAddress : 'Pickup' }).select().single();
        if (customerData) {
          const { data: orderData } = await supabase.from('orders').insert({ shop_id: shopId, customer_id: customerData.id, total_amount: shopData.total, fulfillment_method: fulfillmentMethod, status: 'pending' }).select().single();
          if (orderData) {
            const orderItemsToInsert = shopData.items.map((item) => ({ order_id: orderData.id, product_id: item.productId, quantity: item.quantity, price_at_time: item.price, variant_details: item.variant_details }));
            await supabase.from('order_items').insert(orderItemsToInsert);
          }
        }
      } catch (dbError) {
        console.warn("Silent DB Error (Order still sent to WhatsApp):", dbError);
      }

      // 4. CLEAR CART AND REDIRECT TO WHATSAPP
      shopData.items.forEach(item => removeFromCart(item.id));
      setActiveCheckoutShop(null);
      setIsCartOpen(false);
      setIsProcessing(false);
      
      // Open WhatsApp in a new tab/window
      window.open(whatsappLink, '_blank');

    } catch (error) {
      console.error("Checkout Error:", error);
      alert("Issue processing order. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* OVERLAY */}
      {isCartOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-gray-900/40 backdrop-blur-sm transition-opacity" 
          onClick={() => setIsCartOpen(false)} 
        />
      )}

      {/* DRAWER */}
      <div className={`fixed inset-y-0 right-0 z-[110] flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5 bg-white">
          <h2 className="text-lg font-serif font-bold tracking-wide text-gray-900 flex items-center gap-2">
            <ShoppingBag size={20} /> Your Bag
          </h2>
          <button onClick={() => setIsCartOpen(false)} className="rounded-full bg-gray-50 p-2 text-gray-400 transition hover:bg-gray-200 hover:text-gray-900">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 hide-scrollbar bg-gray-50/50">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center opacity-70">
              <ShoppingBag size={56} strokeWidth={1} className="mb-4 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">Your bag is empty.</p>
              <button onClick={() => setIsCartOpen(false)} className="mt-4 text-xs font-bold uppercase tracking-widest text-[#1a2e1a] hover:underline">Continue Shopping</button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(itemsByShop).map(([shopId, shopData]) => (
                <div key={shopId} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition-colors">
                  <div className="mb-4 flex items-center justify-between border-b border-gray-50 pb-3">
                    <div className="flex items-center gap-2">
                      <Store size={14} className="text-emerald-600" />
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-900">{shopData.shopName}</h3>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {shopData.items.map((item) => (
                      <div key={item.id} className="flex gap-4">
                        <div className="h-20 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                          {item.image_url ? (
                             <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                          ) : (
                             <div className="h-full w-full flex items-center justify-center"><ShoppingBag size={16} className="text-gray-300" /></div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">{item.name}</h4>
                            {item.variant_details && item.variant_details !== 'None' && <p className="mt-0.5 text-[10px] uppercase tracking-wider text-gray-400">{item.variant_details}</p>}
                            <p className="mt-1 text-sm font-bold text-emerald-700">D{item.price.toLocaleString()}</p>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50/50">
                              <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2.5 py-1 text-gray-400 hover:text-gray-900"><Minus size={12} /></button>
                              <span className="w-5 text-center text-xs font-bold text-gray-700">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2.5 py-1 text-gray-400 hover:text-gray-900"><Plus size={12} /></button>
                            </div>
                            <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Refined Checkout UI */}
                  {activeCheckoutShop === shopId ? (
                    <div className="mt-6 border-t border-gray-100 pt-5 animate-in fade-in slide-in-from-top-2">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">Fulfillment Details</h4>
                        <button onClick={() => setActiveCheckoutShop(null)} className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 bg-gray-50 px-2 py-1 rounded-md">Cancel</button>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="relative">
                          <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full Name" className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 pl-10 pr-4 text-xs font-medium outline-none focus:border-gray-900 focus:bg-white transition-all" />
                        </div>
                        <div className="relative">
                          <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone / WhatsApp Number" className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 pl-10 pr-4 text-xs font-medium outline-none focus:border-gray-900 focus:bg-white transition-all" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button type="button" onClick={() => setFulfillmentMethod('delivery')} className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[10px] font-bold uppercase tracking-widest transition ${fulfillmentMethod === 'delivery' ? 'border-emerald-700 bg-emerald-700 text-white shadow-md' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}><Truck size={14} /> Delivery</button>
                          <button type="button" onClick={() => setFulfillmentMethod('pickup')} className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[10px] font-bold uppercase tracking-widest transition ${fulfillmentMethod === 'pickup' ? 'border-emerald-700 bg-emerald-700 text-white shadow-md' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}><MapPin size={14} /> Pickup</button>
                        </div>
                        
                        {fulfillmentMethod === 'delivery' && (
                          <textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} placeholder="Full Delivery Address (Street, Neighborhood)" className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 text-xs font-medium outline-none focus:border-gray-900 focus:bg-white transition-all mt-1" />
                        )}
                        
                        <button 
                          onClick={() => handleProcessCheckout(shopId, shopData)} 
                          disabled={isProcessing} 
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a2e1a] py-4 text-xs font-bold uppercase tracking-widest text-white shadow-xl transition hover:bg-black disabled:opacity-70"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} 
                          {isProcessing ? 'Processing...' : `Send Order to Seller • D${shopData.total.toLocaleString()}`}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 border-t border-gray-50 pt-4">
                      <div className="mb-4 flex justify-between text-sm font-black text-gray-900">
                        <span>Subtotal</span><span className="text-emerald-700">D{shopData.total.toLocaleString()}</span>
                      </div>
                      <button onClick={() => setActiveCheckoutShop(shopId)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black hover:shadow-lg hover:-translate-y-0.5">
                        Checkout with {shopData.shopName} <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}