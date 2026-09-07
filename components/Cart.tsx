'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart, CartItem } from './CartProvider';
import { X, ShoppingBag, Plus, Minus, Trash2, Store, ArrowRight } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Cart — the BAG drawer, and only the bag. Mounted once in app/layout.tsx.
//
// Checkout no longer lives here. The buyer fields, the server-authoritative
// POST to /api/checkout and the verified WhatsApp receipt all moved to the
// shared components/CheckoutForm.tsx, hosted on two dedicated routes:
//   • /checkout                 — the global marketplace shell
//   • /site/[slug]/checkout     — the boutique, inside its chrome + cascade
// The per-seller "Checkout with …" button below simply routes to the right
// one. On a /site page the boutique route is used (its ownership gate sends a
// foreign seller's bag on to /checkout); everywhere else, the marketplace
// route. ?shop=<id> tells the form which seller's lines to check out.
// ─────────────────────────────────────────────────────────────────────────────

const SITE_SLUG_PATTERN = /^\/site\/([^/]+)/;

export default function Cart() {
  const { cartItems, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart } = useCart();
  const pathname = usePathname();

  // The path segment is already URL-encoded (legacy slugs with spaces survive
  // the round trip untouched), so it is reused verbatim in the href.
  const siteSlug = pathname?.match(SITE_SLUG_PATTERN)?.[1] ?? null;
  const checkoutHref = (shopId: string) => {
    const query = `?shop=${encodeURIComponent(shopId)}`;
    return siteSlug ? `/site/${siteSlug}/checkout${query}` : `/checkout${query}`;
  };

  // 🛡️ SAFETY LOCK: Ensure we only reduce if items exists, otherwise use an empty array
  const itemsByShop = (cartItems || []).reduce((acc, item: CartItem) => {
    if (!acc[item.shop_id]) {
      acc[item.shop_id] = { shopName: item.shop_name, shopWhatsapp: item.shop_whatsapp, items: [], total: 0 };
    }
    acc[item.shop_id].items.push(item);
    acc[item.shop_id].total += (item.price * item.quantity);
    return acc;
  }, {} as Record<string, { shopName: string, shopWhatsapp: string, items: CartItem[], total: number }>);

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
          {cartItems.length === 0 ? (
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
                            <div className="flex items-center rounded-lg border border-black/10 bg-gray-50/50">
                              <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2.5 py-1 text-gray-400 hover:text-gray-900"><Minus size={12} /></button>
                              <span className="w-5 text-center text-xs font-bold text-gray-700">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                disabled={typeof item.stock_quantity === 'number' && item.quantity >= item.stock_quantity}
                                className="px-2.5 py-1 text-gray-400 hover:text-gray-900"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                            <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 border-t border-gray-50 pt-4">
                    <div className="mb-4 flex justify-between text-sm font-black text-gray-900">
                      <span>Subtotal</span><span className="text-emerald-700">D{shopData.total.toLocaleString()}</span>
                    </div>
                    {/* Token cascade (Pillar 4): on a /site page the
                        SiteThemeCascade island puts the boutique tokens on the
                        document root, so this PRIMARY button wears the boutique
                        primary + radius; everywhere else the oklch fallback IS
                        Tailwind v4 gray-900, so themeless rendering is
                        byte-identical. Routes to the dedicated checkout page
                        and closes the drawer on the way out. */}
                    <Link
                      href={checkoutHref(shopId)}
                      onClick={() => setIsCartOpen(false)}
                      className="flex w-full items-center justify-center gap-2 rounded-[var(--site-radius,0.75rem)] bg-[var(--site-primary,oklch(21%_0.034_264.665))] py-3.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-[var(--site-primary,black)] hover:shadow-lg hover:-translate-y-0.5"
                    >
                      Checkout with {shopData.shopName} <ArrowRight size={14} />
                    </Link>
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
