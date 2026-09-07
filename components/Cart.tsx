'use client';

import { useCart, CartItem } from './CartProvider';
import { X, ShoppingBag, Plus, Minus, Trash2, Store, ArrowRight, Loader2, User, Phone, Truck, MapPin, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
// Shared order-flow helpers (lib/orderFlow) — one phone sanitizer + wa.me
// builder across the cart, the marketplace PDP, and the /site storefront PDP.
// openOrderHandoff: popup-safe WhatsApp handoff (window opened synchronously
// inside the click, BEFORE the awaited checkout round-trip — see lib/orderFlow).
import { buildWhatsAppLink as generateWhatsAppLink, openOrderHandoff } from '@/lib/orderFlow';

// ─── Server contract — mirrors app/api/checkout/route.ts ─────────────────────
// The browser no longer touches `customers`, `orders`, `order_items` or the
// stock RPCs. It sends identities + quantities only; the route re-prices every
// line from `products.price` with the service-role key, reserves stock
// atomically, writes the order, and returns the VERIFIED numbers the WhatsApp
// receipt below is built from. Cart prices are never trusted for money.

interface CheckoutLinePayload {
  productId: string;
  quantity: number;
  variantDetails: string | null;
}

interface CheckoutRequestPayload {
  shopId: string;
  customer: { name: string; phone: string };
  fulfillmentMethod: 'delivery' | 'pickup';
  /** Required by the route when fulfillmentMethod === 'delivery'. */
  deliveryAddress?: string;
  items: CheckoutLinePayload[];
  /** What the buyer saw in the drawer — drift detection only, never used for money. */
  expectedTotal: number;
}

interface VerifiedLine {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  variantDetails: string | null;
}

interface CheckoutSuccessResponse {
  ok: true;
  orderId: string;
  orderRef: string;
  currency: string;
  total: number;
  priceChanged: boolean;
  lines: VerifiedLine[];
}

interface CheckoutFailureResponse {
  ok: false;
  error?: string;
  code?: 'ITEM_UNAVAILABLE' | 'OUT_OF_STOCK';
  productId?: string;
}

type CheckoutResponse = CheckoutSuccessResponse | CheckoutFailureResponse;

const GENERIC_CHECKOUT_FAILURE =
  'Unable to process checkout right now. Your order was not sent. Please try again.';

export default function Cart() {
  const { cartItems, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart } = useCart();

  const [activeCheckoutShop, setActiveCheckoutShop] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 🛡️ SAFETY LOCK: Ensure we only reduce if items exists, otherwise use an empty array
  const itemsByShop = (cartItems || []).reduce((acc, item: CartItem) => {
    if (!acc[item.shop_id]) {
      acc[item.shop_id] = { shopName: item.shop_name, shopWhatsapp: item.shop_whatsapp, items: [], total: 0 };
    }
    acc[item.shop_id].items.push(item);
    acc[item.shop_id].total += (item.price * item.quantity);
    return acc;
  }, {} as Record<string, { shopName: string, shopWhatsapp: string, items: CartItem[], total: number }>);

  // 🛡️ RESTORED FUNCTION DECLARATION WITH STRICT TYPES
  const handleProcessCheckout = async (shopId: string, shopData: { shopName: string, shopWhatsapp: string, items: CartItem[], total: number }) => {
    const name = customerName.trim();
    const phone = customerPhone.trim();
    const address = deliveryAddress.trim();
    if (!name || !phone) return alert('Please enter your Name and Phone/WhatsApp Number.');
    if (fulfillmentMethod === 'delivery' && !address) return alert('Please provide a delivery address.');

    // Pre-flight the seller's number BEFORE the server reserves stock or
    // writes an order nobody could be handed to. Link validity depends only
    // on the phone; the real receipt is rebuilt from verified numbers below.
    if (!generateWhatsAppLink(shopData.shopWhatsapp, 'preflight')) {
      alert(`Sorry, ${shopData.shopName} has not provided a valid WhatsApp number.`);
      return;
    }

    // Hoisted so the outer catch can always close the interstitial tab.
    let handoff: ReturnType<typeof openOrderHandoff> | null = null;

    try {
      // 1. OPEN THE HANDOFF WINDOW *SYNCHRONOUSLY* — no await has run yet, so
      // the browser's transient activation is still alive and the tab opens
      // popup-block-free. It shows a branded "Preparing your order…"
      // interstitial while the server works; only after a 200 does it
      // navigate to WhatsApp. (A delayed window.open after awaited network
      // calls is silently blocked on slow connections.)
      handoff = openOrderHandoff();
      setIsProcessing(true);

      // 2. SERVER-AUTHORITATIVE CHECKOUT. Identities + quantities only — the
      // route re-prices, reserves stock atomically and writes customers →
      // orders → order_items with the service-role key. `expectedTotal` is the
      // drawer total, sent purely so the server can flag price drift.
      const payload: CheckoutRequestPayload = {
        shopId,
        customer: { name, phone },
        fulfillmentMethod,
        ...(fulfillmentMethod === 'delivery' ? { deliveryAddress: address } : {}),
        items: shopData.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          variantDetails: item.variant_details ?? null,
        })),
        expectedTotal: shopData.total,
      };

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // A non-JSON body (proxy error page, connection dropped mid-response)
      // must not throw past the status handling below.
      const result = (await response.json().catch(() => null)) as CheckoutResponse | null;

      // 3. 409 — the server refused honestly: an item vanished or moved shop
      // (ITEM_UNAVAILABLE), or stock can no longer cover the requested
      // quantity (OUT_OF_STOCK). Its message names the product and the fix.
      if (response.status === 409) {
        handoff.close();
        const reason = result && !result.ok && result.error ? result.error : null;
        alert(reason ?? 'Prices or stock changed while you were checking out. Please review your bag and try again.');
        return;
      }

      // 4. Anything else that is not a clean 200 (400 bad payload, 500 write
      // failure, 503 service unavailable, unparseable body) — generic failure.
      // The server has already released any reserved stock in these cases.
      if (!response.ok || !result || !result.ok) {
        handoff.close();
        alert(GENERIC_CHECKOUT_FAILURE);
        return;
      }

      // 5. BUILD THE LUXURY DIGITAL RECEIPT FROM SERVER-VERIFIED NUMBERS ONLY.
      // Line names, unit prices, line totals, the grand total and the order
      // reference all come from the response — never from cart state.
      const verifiedTotal = result.total;
      const orderId = result.orderId;
      const orderRef = result.orderRef || orderId.replace(/-/g, '').slice(-6).toUpperCase();

      let message = `🛍️ *NEW ORDER via SANNDIKAA*\n`;
      message += `Order Ref: #${orderRef}\n`;
      message += `──────────────────\n\n`;
      message += `Hi *${shopData.shopName}*! I would like to place an order for:\n\n`;

      result.lines.forEach((line) => {
        message += `🔹 *${line.quantity}x ${line.name}*\n`;
        if (line.variantDetails && line.variantDetails !== 'None') {
          message += `   Options: ${line.variantDetails}\n`;
        }
        message += `   Price: D${line.lineTotal.toLocaleString()}\n\n`;
      });

      message += `──────────────────\n`;
      message += `💰 *TOTAL AMOUNT: D${verifiedTotal.toLocaleString()}*\n`;
      message += `──────────────────\n\n`;

      if (result.priceChanged) {
        message += `ℹ️ Prices changed since these items were added to the bag; this total reflects the shop's current prices.\n\n`;
      }

      message += `👤 *CUSTOMER DETAILS:*\n`;
      message += `Name: ${name}\n`;
      message += `Phone: ${phone}\n`;
      message += `Fulfillment: ${fulfillmentMethod === 'delivery' ? '🚚 Delivery' : '🏪 Store Pickup'}\n`;
      if (fulfillmentMethod === 'delivery') {
        message += `Address: ${address}\n`;
      }
      message += `\n*Please let me know how to pay and confirm this order!*`;

      const whatsappLink = generateWhatsAppLink(shopData.shopWhatsapp, message);
      if (!whatsappLink) {
        // Unreachable after the pre-flight (validity depends only on the
        // number), but the order IS recorded now — say so rather than "not sent".
        handoff.close();
        shopData.items.forEach(item => removeFromCart(item.id));
        setActiveCheckoutShop(null);
        alert(`Your order #${orderRef} was recorded, but WhatsApp could not be opened. Please contact ${shopData.shopName} directly and quote this reference.`);
        return;
      }

      // 6. HANDOFF: the order is fully recorded — point the already-open tab
      // at WhatsApp, then clear this shop's lines and close the drawer.
      handoff.navigate(whatsappLink);
      shopData.items.forEach(item => removeFromCart(item.id));
      setActiveCheckoutShop(null);
      setIsCartOpen(false);

      // 7. Fire-and-forget: bust the shop's cached /site catalog so stock
      // badges reflect this purchase before the 5-minute backstop.
      fetch('/api/site-revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId }),
      }).catch(() => {});

    } catch (error) {
      handoff?.close();
      console.error("Checkout Error:", error);
      alert(GENERIC_CHECKOUT_FAILURE);
    } finally {
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
                          {/* text-base (16px): anything smaller triggers iOS auto-zoom on focus */}
                          <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full Name" className="w-full rounded-xl border border-black/10 bg-gray-50/50 py-3 pl-10 pr-4 text-base font-medium outline-none focus:border-gray-900 focus:bg-white transition-all" />
                        </div>
                        <div className="relative">
                          <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone / WhatsApp Number" className="w-full rounded-xl border border-black/10 bg-gray-50/50 py-3 pl-10 pr-4 text-base font-medium outline-none focus:border-gray-900 focus:bg-white transition-all" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button type="button" onClick={() => setFulfillmentMethod('delivery')} className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[10px] font-bold uppercase tracking-widest transition ${fulfillmentMethod === 'delivery' ? 'border-emerald-700 bg-emerald-700 text-white shadow-md' : 'border-black/10 bg-white text-gray-500 hover:bg-gray-50'}`}><Truck size={14} /> Delivery</button>
                          <button type="button" onClick={() => setFulfillmentMethod('pickup')} className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[10px] font-bold uppercase tracking-widest transition ${fulfillmentMethod === 'pickup' ? 'border-emerald-700 bg-emerald-700 text-white shadow-md' : 'border-black/10 bg-white text-gray-500 hover:bg-gray-50'}`}><MapPin size={14} /> Pickup</button>
                        </div>
                        
                        {fulfillmentMethod === 'delivery' && (
                          <textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} placeholder="Full Delivery Address (Street, Neighborhood)" className="w-full rounded-xl border border-black/10 bg-gray-50/50 p-3.5 text-base font-medium outline-none focus:border-gray-900 focus:bg-white transition-all mt-1" />
                        )}
                        
                        {/* Token cascade (Pillar 4): on a /site page the
                            SiteThemeCascade island puts the boutique tokens on
                            the document root, so this PRIMARY button wears the
                            boutique primary + radius; everywhere else the
                            fallbacks ARE the exact historical literals. */}
                        <button
                          onClick={() => handleProcessCheckout(shopId, shopData)}
                          disabled={isProcessing}
                          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[var(--site-radius,0.75rem)] bg-[var(--site-primary,#1a2e1a)] px-5 text-sm font-semibold tracking-normal text-white shadow-[0_1px_2px_rgba(16,24,40,0.08),0_10px_24px_rgba(16,24,40,0.18)] transition hover:-translate-y-0.5 hover:bg-[var(--site-primary,black)] disabled:opacity-70"
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
                      {/* Token cascade (Pillar 4): primary button #2 — the
                          oklch fallback IS Tailwind v4 gray-900, so themeless
                          rendering is byte-identical. */}
                      <button onClick={() => setActiveCheckoutShop(shopId)} className="flex w-full items-center justify-center gap-2 rounded-[var(--site-radius,0.75rem)] bg-[var(--site-primary,oklch(21%_0.034_264.665))] py-3.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-[var(--site-primary,black)] hover:shadow-lg hover:-translate-y-0.5">
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