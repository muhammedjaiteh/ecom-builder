'use client';

import { useCart } from './CartProvider';
import { X, ShoppingBag, Plus, Minus, Trash2, Store, ArrowRight, Loader2, User, Phone, Truck, MapPin, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Helper functions for WhatsApp
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
  const { items, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, cartCount } = useCart();
  const supabase = createClientComponentClient();

  // Checkout States
  const [activeCheckoutShop, setActiveCheckoutShop] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Group items by Shop
  const itemsByShop = items.reduce((acc, item) => {
    if (!acc[item.shop_id]) {
      acc[item.shop_id] = { 
        shopName: item.shop_name, 
        shopWhatsapp: item.shop_whatsapp, 
        items: [], 
        total: 0 
      };
    }
    acc[item.shop_id].items.push(item);
    acc[item.shop_id].total += (item.price * item.quantity);
    return acc;
  }, {} as Record<string, { shopName: string, shopWhatsapp: string, items: typeof items, total: number }>);

  // The Enterprise Multi-Item Checkout Logic
  const handleProcessCheckout = async (shopId: string, shopData: typeof itemsByShop[string]) => {
    if (!customerName.trim() || !customerPhone.trim()) {
      alert('Please enter your Name and Phone Number.');
      return;
    }
    if (fulfillmentMethod === 'delivery' && !deliveryAddress.trim()) {
      alert('Please provide a delivery address.');
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Save the Customer to the Vault
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .insert({
          name: customerName,
          phone_number: customerPhone,
          location: fulfillmentMethod === 'delivery' ? deliveryAddress : 'Pickup',
        })
        .select()
        .single();

      if (customerError) throw customerError;

      // 2. Save the Main Order to the Vault
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          shop_id: shopId,
          customer_id: customerData.id,
          total_amount: shopData.total,
          fulfillment_method: fulfillmentMethod,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 3. Loop through the cart and save EACH item to order_items
      const orderItemsToInsert = shopData.items.map((item) => ({
        order_id: orderData.id,
        product_id: item.productId,
        quantity: item.quantity,
        price_at_time: item.price,
        variant_details: item.variant_details,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsToInsert);
      if (itemsError) throw itemsError;

      // 4. Generate the massive WhatsApp Receipt
      const orderRef = orderData.id.split('-')[0].toUpperCase(); 
      let message = `🥂 *New Sanndikaa Order!* (Ref: #${orderRef})\n\nHi ${shopData.shopName}! I would like to order:\n\n`;
      
      shopData.items.forEach(item => {
        message += `🛍️ *${item.quantity}x ${item.name}*\n`;
        if (item.variant_details && item.variant_details !== 'None') {
          message += `   └ ${item.variant_details}\n`;
        }
        message += `   └ D${item.price * item.quantity}\n\n`;
      });

      message += `👤 *Customer:* ${customerName}\n📞 *Phone:* ${customerPhone}\n🏷️ *Total Price:* D${shopData.total}\n🚚 *Fulfillment:* ${fulfillmentMethod === 'delivery' ? `Delivery to ${deliveryAddress.trim()}` : 'Store Pickup'}\n\nPlease let me know how to proceed!`;

      const whatsappLink = generateWhatsAppLink(shopData.shopWhatsapp, message);
      
      if (!whatsappLink) {
        alert('This seller has not set up a valid WhatsApp number yet.');
        setIsProcessing(false);
        return;
      }

      // 5. Success! Clear these specific items from the cart and redirect
      shopData.items.forEach(item => removeFromCart(item.id));
      setActiveCheckoutShop(null); // Close the form
      setIsCartOpen(false); // Close the cart
      
      window.location.href = whatsappLink;

    } catch (error) {
      console.error("Vault Error:", error);
      alert("There was an issue processing your order. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsCartOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-white shadow-2xl transition-transform hover:scale-105 active:scale-95"
      >
        <ShoppingBag size={24} />
        {cartCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm border-2 border-white">
            {cartCount}
          </span>
        )}
      </button>

      {isCartOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsCartOpen(false)}
        />
      )}

      <div 
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-[#FDFBF7] shadow-2xl transition-transform duration-300 ease-in-out ${
          isCartOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5 bg-white">
          <h2 className="flex items-center gap-2 text-xl font-serif font-bold text-gray-900">
            <ShoppingBag size={20} /> Your Shopping Bag
          </h2>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 hide-scrollbar">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
                <ShoppingBag size={32} className="text-gray-300" />
              </div>
              <p className="text-lg font-serif font-bold text-gray-900">Your bag is empty</p>
              <p className="mt-2 text-sm text-gray-500">Looks like you haven't made your choice yet.</p>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="mt-8 rounded-full bg-gray-900 px-8 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-black"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(itemsByShop).map(([shopId, shopData]) => (
                <div key={shopId} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                    <Store size={16} className="text-gray-400" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-900">
                      {shopData.shopName}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {shopData.items.map((item) => (
                      <div key={item.id} className="flex gap-4">
                        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex flex-1 flex-col justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-gray-900 line-clamp-1">{item.name}</h4>
                            {item.variant_details !== 'None' && (
                              <p className="mt-0.5 text-[11px] font-semibold text-gray-500">{item.variant_details}</p>
                            )}
                            <p className="mt-1 text-sm font-bold text-gray-900">D{item.price}</p>
                          </div>
                          
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50">
                              <button 
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="p-1.5 text-gray-500 hover:text-gray-900 transition"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="p-1.5 text-gray-500 hover:text-gray-900 transition"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <button 
                              onClick={() => removeFromCart(item.id)}
                              className="text-gray-400 hover:text-red-500 transition"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* IN-CART CHECKOUT SYSTEM */}
                  {activeCheckoutShop === shopId ? (
                    <div className="mt-5 border-t border-gray-100 pt-4 animate-in fade-in slide-in-from-top-2">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-sm font-bold text-gray-900">Checkout Details</h4>
                        <button 
                          onClick={() => setActiveCheckoutShop(null)}
                          className="text-xs font-bold text-gray-500 hover:text-gray-900"
                        >
                          Cancel
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Full Name</label>
                          <div className="relative">
                            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                              placeholder="e.g. Lamin Jallow"
                              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-gray-900 focus:bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Phone / WhatsApp</label>
                          <div className="relative">
                            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="tel"
                              value={customerPhone}
                              onChange={(e) => setCustomerPhone(e.target.value)}
                              placeholder="e.g. 7000000"
                              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-gray-900 focus:bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Delivery Method</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setFulfillmentMethod('delivery')}
                              className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition ${
                                fulfillmentMethod === 'delivery' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-gray-50 text-gray-500'
                              }`}
                            >
                              <Truck size={14} /> Delivery
                            </button>
                            <button
                              type="button"
                              onClick={() => setFulfillmentMethod('pickup')}
                              className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition ${
                                fulfillmentMethod === 'pickup' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-gray-50 text-gray-500'
                              }`}
                            >
                              <MapPin size={14} /> Pickup
                            </button>
                          </div>
                        </div>

                        {fulfillmentMethod === 'delivery' && (
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Address</label>
                            <textarea
                              value={deliveryAddress}
                              onChange={(e) => setDeliveryAddress(e.target.value)}
                              rows={2}
                              placeholder="e.g. Kairaba Avenue..."
                              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-gray-900 focus:bg-white"
                            />
                          </div>
                        )}

                        <button 
                          onClick={() => handleProcessCheckout(shopId, shopData)}
                          disabled={isProcessing}
                          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg transition hover:bg-green-700 disabled:opacity-70"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} 
                          {isProcessing ? 'Processing...' : `Confirm Order — D${shopData.total}`}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 border-t border-gray-100 pt-4">
                      <div className="mb-3 flex justify-between text-sm font-bold text-gray-900">
                        <span>Subtotal</span>
                        <span>D{shopData.total}</span>
                      </div>
                      <button 
                        onClick={() => setActiveCheckoutShop(shopId)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-black"
                      >
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