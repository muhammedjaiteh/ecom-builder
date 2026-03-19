'use client';

import { useCart } from './CartProvider';
import { X, ShoppingBag, Plus, Minus, Trash2, Store, ArrowRight, Loader2, User, Phone, Truck, MapPin, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

function sanitizePhoneNumber(rawNumber?: string | null) {
  if (!rawNumber) return null;
  let cleanNumber = rawNumber.replace(/\D/g, '');
  if (!cleanNumber) return null;
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
    if (!customerName.trim() || !customerPhone.trim()) return alert('Please enter your Name and Phone Number.');
    if (fulfillmentMethod === 'delivery' && !deliveryAddress.trim()) return alert('Please provide a delivery address.');

    setIsProcessing(true);

    try {
      const { data: customerData, error: customerError } = await supabase.from('customers').insert({ name: customerName, phone_number: customerPhone, location: fulfillmentMethod === 'delivery' ? deliveryAddress : 'Pickup' }).select().single();
      if (customerError) throw customerError;

      const { data: orderData, error: orderError } = await supabase.from('orders').insert({ shop_id: shopId, customer_id: customerData.id, total_amount: shopData.total, fulfillment_method: fulfillmentMethod, status: 'pending' }).select().single();
      if (orderError) throw orderError;

      const orderItemsToInsert = shopData.items.map((item) => ({ order_id: orderData.id, product_id: item.productId, quantity: item.quantity, price_at_time: item.price, variant_details: item.variant_details }));
      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsToInsert);
      if (itemsError) throw itemsError;

      const orderRef = orderData.id.split('-')[0].toUpperCase(); 
      let message = `🥂 *New Sanndikaa Order!* (Ref: #${orderRef})\n\nHi ${shopData.shopName}! I would like to order:\n\n`;
      shopData.items.forEach(item => {
        message += `🛍️ *${item.quantity}x ${item.name}*\n`;
        if (item.variant_details && item.variant_details !== 'None') message += `   └ ${item.variant_details}\n`;
        message += `   └ D${item.price * item.quantity}\n\n`;
      });
      message += `👤 *Customer:* ${customerName}\n📞 *Phone:* ${customerPhone}\n🏷️ *Total Price:* D${shopData.total}\n🚚 *Fulfillment:* ${fulfillmentMethod === 'delivery' ? `Delivery to ${deliveryAddress.trim()}` : 'Store Pickup'}\n\nPlease let me know how to proceed!`;

      const whatsappLink = generateWhatsAppLink(shopData.shopWhatsapp, message);
      if (!whatsappLink) { alert('Seller has no valid WhatsApp.'); setIsProcessing(false); return; }

      shopData.items.forEach(item => removeFromCart(item.id));
      setActiveCheckoutShop(null);
      setIsCartOpen(false);
      window.location.href = whatsappLink;
    } catch (error) {
      console.error("Vault Error:", error);
      alert("Issue processing order. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* OVERLAY */}
      {isCartOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-gray-900/30 backdrop-blur-sm transition-opacity" 
          onClick={() => setIsCartOpen(false)} 
        />
      )}

      {/* DRAWER */}
      <div className={`fixed inset-y-0 right-0 z-[110] flex w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5 bg-white">
          <h2 className="text-lg font-serif font-bold tracking-wide text-gray-900">Your Bag</h2>
          <button onClick={() => setIsCartOpen(false)} className="rounded-full bg-gray-50 p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-900">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 hide-scrollbar bg-gray-50/30">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center opacity-70">
              <ShoppingBag size={48} strokeWidth={1} className="mb-4 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">Your bag is empty.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(itemsByShop).map(([shopId, shopData]) => (
                <div key={shopId} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition-colors">
                  <div className="mb-4 flex items-center gap-2 border-b border-gray-50 pb-3">
                    <Store size={14} className="text-gray-400" />
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{shopData.shopName}</h3>
                  </div>

                  <div className="space-y-5">
                    {shopData.items.map((item) => (
                      <div key={item.id} className="flex gap-4">
                        <div className="h-20 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex flex-1 flex-col justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">{item.name}</h4>
                            {item.variant_details !== 'None' && <p className="mt-0.5 text-[10px] uppercase tracking-wider text-gray-400">{item.variant_details}</p>}
                            <p className="mt-1 text-sm font-bold text-gray-900">D{item.price}</p>
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
                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-900">Delivery Details</h4>
                        <button onClick={() => setActiveCheckoutShop(null)} className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900">Cancel</button>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="relative">
                          <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full Name" className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 pl-10 pr-4 text-xs font-medium outline-none focus:border-gray-900 focus:bg-white transition-all" />
                        </div>
                        <div className="relative">
                          <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone Number" className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 pl-10 pr-4 text-xs font-medium outline-none focus:border-gray-900 focus:bg-white transition-all" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button type="button" onClick={() => setFulfillmentMethod('delivery')} className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[10px] font-bold uppercase tracking-widest transition ${fulfillmentMethod === 'delivery' ? 'border-gray-900 bg-gray-900 text-white shadow-md' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}><Truck size={14} /> Delivery</button>
                          <button type="button" onClick={() => setFulfillmentMethod('pickup')} className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[10px] font-bold uppercase tracking-widest transition ${fulfillmentMethod === 'pickup' ? 'border-gray-900 bg-gray-900 text-white shadow-md' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}><MapPin size={14} /> Pickup</button>
                        </div>
                        
                        {fulfillmentMethod === 'delivery' && (
                          <textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} placeholder="Delivery Address" className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 text-xs font-medium outline-none focus:border-gray-900 focus:bg-white transition-all mt-1" />
                        )}
                        
                        <button onClick={() => handleProcessCheckout(shopId, shopData)} disabled={isProcessing} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a2e1a] py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg transition hover:bg-black disabled:opacity-70">
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} {isProcessing ? 'Processing...' : `Confirm • D${shopData.total}`}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 border-t border-gray-50 pt-4">
                      <div className="mb-4 flex justify-between text-sm font-black text-gray-900">
                        <span>Subtotal</span><span>D{shopData.total}</span>
                      </div>
                      <button onClick={() => setActiveCheckoutShop(shopId)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black hover:shadow-lg">
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