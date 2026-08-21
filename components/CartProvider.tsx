'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

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

// ─────────────────────────────────────────────────────────────────────────────
// Composite cart line ids — one line per (product, variant) combination.
//
// Historically every add-to-cart used the bare productId as the line id, so
// "Kaftan / Red / M" and "Kaftan / Blue / L" collapsed into ONE line and the
// first variant's details won. The line id is now
//   `${productId}::${variantKey}`   (variantKey = normalized color|size)
// and a variantless product keeps the bare productId — which is also exactly
// what every persisted pre-migration cart line looks like, so old carts load
// as variantless lines with zero migration writes.
// ─────────────────────────────────────────────────────────────────────────────

/** Lowercased, whitespace-collapsed variant token — '' when unset. */
function normalizeVariantToken(value?: string | null): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Canonical cart line id for a product + selected variant combination. */
export function buildCartLineId(
  productId: string,
  variant?: { color?: string | null; size?: string | null }
): string {
  const parts = [normalizeVariantToken(variant?.color), normalizeVariantToken(variant?.size)].filter(Boolean);
  return parts.length > 0 ? `${productId}::${parts.join('|')}` : productId;
}

// Load-time migration for persisted carts: drop malformed entries (no crash on
// hand-edited or truncated storage) and merge any duplicate line ids by
// summing quantities (no dupes). Bare-id legacy lines pass through untouched —
// they are simply variantless lines under the composite scheme.
function sanitizeStoredCart(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, CartItem>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Partial<CartItem>;
    if (typeof item.id !== 'string' || item.id.length === 0) continue;
    if (typeof item.productId !== 'string' || item.productId.length === 0) continue;
    if (typeof item.name !== 'string' || typeof item.price !== 'number') continue;
    const quantity = typeof item.quantity === 'number' && item.quantity >= 1 ? Math.floor(item.quantity) : 1;
    const line: CartItem = {
      id: item.id,
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity,
      stock_quantity: typeof item.stock_quantity === 'number' ? item.stock_quantity : null,
      image_url: typeof item.image_url === 'string' ? item.image_url : '',
      shop_id: typeof item.shop_id === 'string' ? item.shop_id : '',
      shop_name: typeof item.shop_name === 'string' ? item.shop_name : '',
      shop_whatsapp: typeof item.shop_whatsapp === 'string' ? item.shop_whatsapp : '',
      variant_details: typeof item.variant_details === 'string' ? item.variant_details : 'None',
    };
    const existing = byId.get(line.id);
    if (existing) {
      const merged = existing.quantity + line.quantity;
      const maxStock = typeof existing.stock_quantity === 'number' ? existing.stock_quantity : null;
      existing.quantity = maxStock !== null ? Math.min(merged, Math.max(maxStock, 1)) : merged;
    } else {
      byId.set(line.id, line);
    }
  }
  return [...byId.values()];
}

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

  // One-time localStorage hydration. This MUST be a post-mount effect: this
  // provider server-renders in the root layout, so a useState initializer
  // reading localStorage would crash SSR / mismatch hydration. The single
  // extra render is the intentional, bounded cost of restoring the saved cart
  // — hence the targeted disable of react-hooks/set-state-in-effect.
  useEffect(() => {
    const savedCart = localStorage.getItem('sanndikaa_cart');
    const savedFulfillment = localStorage.getItem('sanndikaa_fulfillment');
    if (savedCart) {
      try {
        // sanitizeStoredCart: back-compat for pre-composite-id carts (bare
        // productId lines load as variantless) + shape validation + dupe merge.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCartItems(sanitizeStoredCart(JSON.parse(savedCart)));
      } catch {
        console.error('Failed to parse cart');
      }
    }
    if (savedFulfillment) {
      try {
        setFulfillmentMethod(JSON.parse(savedFulfillment));
      } catch {
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

  const cartCount = cartItems.reduce((count, item) => count + item.quantity, 0);

  // NOTE: this provider intentionally renders NO drawer UI. The cart drawer is
  // components/Cart.tsx, mounted once in app/layout.tsx — it owns the full
  // checkout (customers + orders + order_items + stock deduction + WhatsApp).
  // The provider previously rendered a second, older sidebar underneath it
  // whenever isCartOpen was true: two stacked drawers, with an unreachable
  // legacy checkout path that wrote orders without customer records. Removed.
  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart, isCartOpen, setIsCartOpen, cartCount, fulfillmentMethod, setFulfillmentMethod }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) throw new Error('useCart must be used within a CartProvider');
  return context;
}