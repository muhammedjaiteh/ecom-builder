'use client';

import { useCart } from './CartProvider';
import { X, ShoppingBag, Plus, Minus, Trash2, Store, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function Cart() {
  const { items, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, cartCount } = useCart();

  // The Enterprise Logic: Grouping items by the Shop
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

  return (
    <>
      {/* 1. The Floating Cart Button (Sticks to the bottom right) */}
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

      {/* 2. The Dark Overlay Background */}
      {isCartOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsCartOpen(false)}
        />
      )}

      {/* 3. The Sliding Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-[#FDFBF7] shadow-2xl transition-transform duration-300 ease-in-out ${
          isCartOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Cart Header */}
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

        {/* Cart Body */}
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
                  {/* Shop Header */}
                  <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                    <Store size={16} className="text-gray-400" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-900">
                      {shopData.shopName}
                    </h3>
                  </div>

                  {/* Shop Items */}
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
                          
                          {/* Quantity Controls */}
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

                  {/* Shop Checkout Button */}
                  <div className="mt-5 border-t border-gray-100 pt-4">
                    <div className="mb-3 flex justify-between text-sm font-bold text-gray-900">
                      <span>Subtotal</span>
                      <span>D{shopData.total}</span>
                    </div>
                    {/* We will wire this button up in the next step! */}
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-black">
                      Checkout with {shopData.shopName} <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}