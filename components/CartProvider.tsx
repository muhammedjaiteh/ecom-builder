'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { X, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  stock_quantity?: number | null;
  image_url: string;
  shop_id: string;
  shop_name: string;
  shop_whatsapp: string;
  variant_details: string;
};

type CartContextType = {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  cartCount: number;
  fulfillmentMethod: 'delivery' | 'pickup';
  setFulfillmentMethod: (method: 'delivery' | 'pickup') => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'delivery' | 'pickup'>('delivery');

  useEffect(() => {
    const savedCart = localStorage.getItem('sanndikaa_cart');
    const savedFulfillment = localStorage.getItem('sanndikaa_fulfillment');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to parse cart');
      }
    }
    if (savedFulfillment) {
      try {
        setFulfillmentMethod(JSON.parse(savedFulfillment));
      } catch (e) {
        console.error('Failed to parse fulfillment method');
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('sanndikaa_cart', JSON.stringify(cartItems));
    }
  }, [cartItems, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('sanndikaa_fulfillment', JSON.stringify(fulfillmentMethod));
    }
  }, [fulfillmentMethod, isLoaded]);

  const addToCart = (item: CartItem) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      const maxStock = typeof item.stock_quantity === 'number' ? item.stock_quantity : null;

      if (existing) {
        return prev.map((i) => {
          if (i.id !== item.id) return i;
          const nextQuantity = i.quantity + item.quantity;
          const quantity = maxStock !== null ? Math.min(nextQuantity, maxStock) : nextQuantity;
          return { ...i, quantity };
        });
      }

      const nextQuantity = item.quantity < 1 ? 1 : item.quantity;
      const quantity = maxStock !== null ? Math.min(nextQuantity, maxStock) : nextQuantity;
      return [...prev, { ...item, quantity }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (id: string) => setCartItems((prev) => prev.filter((i) => i.id !== id));
  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return;
    setCartItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const maxStock = typeof i.stock_quantity === 'number' ? i.stock_quantity : null;
        const nextQuantity = maxStock !== null ? Math.min(quantity, maxStock) : quantity;
        return { ...i, quantity: nextQuantity };
      })
    );
  };
  const clearCart = () => setCartItems([]);

  const cartTotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const cartCount = cartItems.reduce((count, item) => count + item.quantity, 0);

  // 🚀 THE MONEY MAKER: Cart-to-WhatsApp Bridge + Silent DB Save
  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      alert('Your bag is empty. Add at least one item before checkout.');
      return;
    }

    const targetShopName = cartItems[0].shop_name || 'Boutique';
    const targetShopPhone = cartItems[0].shop_whatsapp;
    const targetShopId = cartItems[0].shop_id;

    if (!targetShopPhone) {
      alert("This seller hasn't linked their WhatsApp number yet.");
      return;
    }

    // 1. SILENTLY SAVE TO SUPABASE (The Ghost Order Catcher)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    try {
      // Create the main order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          shop_id: targetShopId,
          total_amount: cartTotal,
          status: 'pending',
          fulfillment_method: fulfillmentMethod
        })
        .select()
        .single();

      if (orderData && !orderError) {
        // Create the individual items
        const orderItemsToInsert = cartItems.map(item => ({
          order_id: orderData.id,
          product_id: item.productId,
          product_name: item.name,
          quantity: item.quantity,
          price: item.price,
          variant_details: item.variant_details
        }));
        await supabase.from('order_items').insert(orderItemsToInsert);
      }
    } catch (err) {
      console.error("Non-fatal error saving silent order", err);
      // We DO NOT block the user here. Even if DB fails, we want them to send the WhatsApp message so the seller still gets paid.
    }

    // 2. LAUNCH WHATSAPP (The Buyer Experience)
    const itemsList = cartItems
      .map((item, index) => {
        const variantText = item.variant_details && item.variant_details !== 'None' ? ` (${item.variant_details})` : '';
        return `${index + 1}. ${item.name}${variantText}\n   - Qty: ${item.quantity}\n   - Price: D${item.price.toLocaleString()}`;
      })
      .join("\n\n");

    const fulfillmentText = `\nFulfillment Method: ${fulfillmentMethod.charAt(0).toUpperCase() + fulfillmentMethod.slice(1)}`;

    const message = `Hello ${targetShopName},\n\nI would like to place an order via Sanndikaa:\n\n${itemsList}\n\n-------------------------\nTotal: D${cartTotal.toLocaleString()}\n-------------------------\n${fulfillmentText}\n\nMy Details:\nName: [Type your name]\nLocation: [Type your location]\n\nPreferred Payment Method:\n[Cash on Delivery / Mobile Money]\n\nPlease confirm availability. Thank you.`;

    const encodedMessage = encodeURIComponent(message);
    const formattedPhone = targetShopPhone.replace(/\D/g, "");
    
    window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, "_blank");
  };

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart, isCartOpen, setIsCartOpen, cartCount, fulfillmentMethod, setFulfillmentMethod }}>
      {children}

      {/* Cart Sidebar */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsCartOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right-full duration-300">
            
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-serif font-bold text-gray-900 flex items-center gap-2">
                <ShoppingBag size={20} /> Your Bag ({cartCount})
              </h2>
              <button onClick={() => setIsCartOpen(false)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {cartItems.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center space-y-4">
                  <div className="rounded-full bg-gray-50 p-6"><ShoppingBag size={40} className="text-gray-300" /></div>
                  <p className="text-sm font-medium text-gray-500">Your bag is empty.</p>
                  <button onClick={() => setIsCartOpen(false)} className="rounded-full bg-gray-900 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800">Continue Shopping</button>
                </div>
              ) : (
                <div className="space-y-6">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="h-24 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 border border-gray-200">
                        {item.image_url ? <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ShoppingBag size={20} className="text-gray-300" /></div>}
                      </div>
                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <div className="flex justify-between">
                            <h3 className="text-sm font-bold text-gray-900 line-clamp-1 pr-4">{item.name}</h3>
                            <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 transition"><Trash2 size={16} /></button>
                          </div>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                            {item.shop_name} {item.variant_details !== 'None' && `• ${item.variant_details}`}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white">
                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center text-gray-500 hover:text-gray-900"><Minus size={12} /></button>
                            <span className="w-8 text-center text-xs font-bold text-gray-900">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={typeof item.stock_quantity === 'number' && item.quantity >= item.stock_quantity}
                              className="flex h-8 w-8 items-center justify-center text-gray-500 hover:text-gray-900"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <p className="text-sm font-black text-gray-900">D{(item.price * item.quantity).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50/50 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">Subtotal</span>
                  <span className="text-xl font-black text-gray-900">D{cartTotal.toLocaleString()}</span>
                </div>
                <p className="mb-6 text-xs text-gray-500">Shipping and taxes calculated at checkout.</p>
                <button
                  onClick={handleCheckout}
                  className="flex w-full items-center justify-center rounded-2xl bg-[#1a2e1a] py-4 text-xs font-bold uppercase tracking-widest text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-transform hover:scale-[1.01] hover:bg-black active:scale-[0.98]"
                >
                  Checkout via WhatsApp
                </button>
              </div>
            )}
            
          </div>
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) throw new Error('useCart must be used within a CartProvider');
  return context;
}