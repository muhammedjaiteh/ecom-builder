'use client';

import { useEffect, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { AnimatePresence, motion } from 'framer-motion';
import { Banknote, Check, Copy, Minus, Plus, ShoppingBag, Smartphone, X } from 'lucide-react';
import { buildCartLineId, useCart } from '@/components/CartProvider';
import {
  DEFAULT_ORDER_PHONE,
  buildDirectOrderMessage,
  buildWhatsAppLink,
  recordLead,
  type DirectOrderMethod,
} from '@/lib/orderFlow';
import type { SiteTone } from '@/components/site-templates/chrome';

// The on-site checkout island — the SAME order mechanics as the marketplace
// PDP, composed from the shared pieces instead of forked:
//   - Add to Bag  → useCart (components/CartProvider): the global drawer
//     records customers/orders/order_items, decrements stock, and hands off
//     to WhatsApp — the buyer never navigates away from the branded site.
//   - Order via WhatsApp → lib/orderFlow: lead capture + the platform's
//     direct-order message + sanitized wa.me link (Cash / Wave two-step).

export type PurchaseProduct = {
  id: string;
  name: string;
  price: number | null;
  image_url: string | null;
  stock_quantity: number | null;
  colors: string[] | null;
  sizes: string[] | null;
  /** products.user_id — the seller the lead is recorded against. */
  sellerId: string | null;
};

type PurchaseStyles = {
  label: string;
  pill: string;
  pillActive: string;
  stepper: string;
  stepperButton: string;
  stepperValue: string;
  primaryButton: string;
  secondaryButton: string;
  hint: string;
  soldOut: string;
  soldOutTitle: string;
  soldOutBody: string;
  /** Sticky mobile buy bar (Phase 5) — tone-matched shell + CTA. */
  buyBar: string;
  buyBarPrice: string;
  buyBarButton: string;
};

const PURCHASE_STYLES: Record<SiteTone, PurchaseStyles> = {
  ritual: {
    label: 'text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400',
    pill: 'rounded-full border border-stone-300 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-stone-600 transition hover:border-stone-900',
    pillActive: 'rounded-full border border-stone-900 bg-stone-900 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white',
    stepper: 'inline-flex items-center rounded-full border border-stone-300 bg-white',
    stepperButton: 'flex h-11 w-11 items-center justify-center text-stone-500 transition hover:text-stone-900 disabled:opacity-30',
    stepperValue: 'w-10 text-center text-sm font-bold text-stone-900',
    primaryButton: 'flex w-full items-center justify-center gap-3 rounded-[var(--site-radius,9999px)] bg-[var(--site-primary,oklch(21.6%_0.006_56.043))] px-8 py-4 text-[10px] font-bold uppercase tracking-[0.25em] text-white shadow-lg transition hover:bg-[var(--site-primary,oklch(37.4%_0.01_67.558))] active:scale-95 sm:w-auto',
    secondaryButton: 'flex w-full items-center justify-center gap-3 rounded-full border border-stone-900 bg-white px-8 py-4 text-[10px] font-bold uppercase tracking-[0.25em] text-stone-900 transition hover:bg-stone-900 hover:text-white active:scale-95 sm:w-auto',
    hint: 'text-xs font-medium text-amber-700',
    soldOut: 'rounded-2xl border border-stone-300 bg-white px-6 py-5 text-center',
    soldOutTitle: 'text-sm font-bold uppercase tracking-widest text-stone-900',
    soldOutBody: 'mt-1 text-xs text-stone-500',
    buyBar: 'border-t border-stone-200 bg-white/95 backdrop-blur',
    buyBarPrice: 'text-lg font-light text-stone-900',
    buyBarButton: 'flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[var(--site-radius,9999px)] bg-[var(--site-primary,oklch(21.6%_0.006_56.043))] px-6 text-[10px] font-bold uppercase tracking-[0.25em] text-white shadow-lg transition active:scale-95',
  },
  editorial: {
    label: 'text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400',
    pill: 'border border-neutral-300 bg-[#F7F5F0] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-neutral-600 transition hover:border-neutral-900',
    pillActive: 'border border-neutral-900 bg-neutral-900 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#F7F5F0]',
    stepper: 'inline-flex items-center border border-neutral-900 bg-[#F7F5F0]',
    stepperButton: 'flex h-11 w-11 items-center justify-center text-neutral-500 transition hover:text-neutral-900 disabled:opacity-30',
    stepperValue: 'w-10 text-center text-sm font-bold text-neutral-900',
    primaryButton: 'flex w-full items-center justify-center gap-3 rounded-[var(--site-radius,0px)] bg-[var(--site-primary,oklch(20.5%_0_0))] px-9 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-[#F7F5F0] transition hover:bg-[var(--site-primary,#1a2e1a)] active:scale-95 sm:w-auto',
    secondaryButton: 'flex w-full items-center justify-center gap-3 border border-neutral-900 px-9 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-900 transition hover:bg-neutral-900 hover:text-[#F7F5F0] active:scale-95 sm:w-auto',
    hint: 'text-xs font-medium text-amber-800',
    soldOut: 'border border-neutral-900 bg-[#F7F5F0] px-6 py-5 text-center',
    soldOutTitle: 'font-serif text-lg italic text-neutral-900',
    soldOutBody: 'mt-1 text-xs text-neutral-500',
    buyBar: 'border-t border-neutral-900 bg-[#F7F5F0]/95 backdrop-blur',
    buyBarPrice: 'font-serif text-lg italic text-neutral-900',
    buyBarButton: 'flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[var(--site-radius,0px)] bg-[var(--site-primary,oklch(20.5%_0_0))] px-6 text-[10px] font-bold uppercase tracking-[0.3em] text-[#F7F5F0] transition active:scale-95',
  },
  neutral: {
    label: 'text-[10px] font-black uppercase tracking-[0.25em] text-white/50',
    pill: 'rounded-full border border-white/20 bg-[#111] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/70 transition hover:border-[var(--site-accent,#f0a500)]',
    pillActive: 'rounded-full border border-[var(--site-accent,#f0a500)] bg-[var(--site-accent,#f0a500)] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black',
    stepper: 'inline-flex items-center rounded-full border border-white/20 bg-[#111]',
    stepperButton: 'flex h-11 w-11 items-center justify-center text-white/60 transition hover:text-white disabled:opacity-30',
    stepperValue: 'w-10 text-center text-sm font-black text-white',
    primaryButton: 'flex w-full items-center justify-center gap-3 rounded-[var(--site-radius,9999px)] bg-[var(--site-accent,#f0a500)] px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-lg transition hover:bg-[var(--site-accent,oklch(82.8%_0.189_84.429))] active:scale-95 sm:w-auto',
    secondaryButton: 'flex w-full items-center justify-center gap-3 rounded-[var(--site-radius,9999px)] border border-[var(--site-accent,#f0a500)] px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--site-accent,#f0a500)] transition hover:bg-[var(--site-accent,#f0a500)] hover:text-black active:scale-95 sm:w-auto',
    hint: 'text-xs font-bold text-[var(--site-accent,#f0a500)]',
    soldOut: 'rounded-2xl border border-white/15 bg-[#111] px-6 py-5 text-center',
    soldOutTitle: 'text-sm font-black uppercase tracking-widest text-white',
    soldOutBody: 'mt-1 text-xs text-white/50',
    buyBar: 'border-t border-white/10 bg-[#0C0C0C]/95 backdrop-blur',
    buyBarPrice: 'text-lg font-black text-[var(--site-accent,#f0a500)]',
    buyBarButton: 'flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[var(--site-radius,9999px)] bg-[var(--site-accent,#f0a500)] px-6 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-lg transition active:scale-95',
  },
};

export default function SiteProductPurchase({
  product,
  shopId,
  shopName,
  shopPhone,
  tone,
}: {
  product: PurchaseProduct;
  shopId: string;
  shopName: string;
  shopPhone: string | null;
  tone: SiteTone;
}) {
  const styles = PURCHASE_STYLES[tone];
  const { addToCart } = useCart();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [variantHint, setVariantHint] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'SELECT' | 'WAVE_INFO'>('SELECT');
  const [copied, setCopied] = useState(false);

  // STICKY MOBILE BUY BAR (Phase 5): observe the primary CTA row — when it
  // scrolls out of view the bottom bar slides in. Rendering is gated to
  // <768px via md:hidden; the observer itself is viewport-agnostic and cheap.
  const purchaseRootRef = useRef<HTMLDivElement | null>(null);
  const ctaRowRef = useRef<HTMLDivElement | null>(null);
  const [ctaInView, setCtaInView] = useState(true);
  useEffect(() => {
    const el = ctaRowRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setCtaInView(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // OVERSELL GUARD: the /site PDP is served from the 5-minute data cache, so
  // the server-rendered stock figure can be stale. Refresh it on mount via
  // the anon browser client (products has a public read policy) and re-clamp
  // the stepper — cached catalog, live purchase truth. The atomic
  // decrement_stock RPC remains the final authority at checkout.
  const [liveStock, setLiveStock] = useState<number | null>(product.stock_quantity);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', product.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const fresh = typeof data.stock_quantity === 'number' ? data.stock_quantity : null;
        setLiveStock(fresh);
        if (fresh != null && fresh > 0) {
          setQuantity((q) => Math.min(q, Math.min(fresh, 99)));
        }
      });
    return () => { cancelled = true; };
    // supabase is a per-render client instance; product.id is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const colors = Array.isArray(product.colors) ? product.colors : [];
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const stock = liveStock;
  const isOutOfStock = stock != null && stock <= 0;
  const maxQuantity = stock != null && stock > 0 ? Math.min(stock, 99) : 99;
  const sellerPhone = shopPhone?.trim() || DEFAULT_ORDER_PHONE;

  const variantParts = [selectedColor, selectedSize].filter(Boolean);
  const variantDetails = variantParts.length > 0 ? variantParts.join(' / ') : 'None';

  const requireVariants = (): boolean => {
    if (colors.length > 0 && !selectedColor) {
      setVariantHint('Please choose a color first.');
      return false;
    }
    if (sizes.length > 0 && !selectedSize) {
      setVariantHint('Please choose a size first.');
      return false;
    }
    setVariantHint(null);
    return true;
  };

  const handleAddToBag = () => {
    if (!requireVariants()) return;
    addToCart({
      // Composite line id: each color/size combination is its own cart line
      // (variantless products keep the bare product id — legacy-compatible).
      id: buildCartLineId(product.id, { color: selectedColor, size: selectedSize }),
      productId: product.id,
      name: product.name,
      price: product.price ?? 0,
      quantity,
      stock_quantity: stock,
      image_url: product.image_url || '',
      shop_id: shopId,
      shop_name: shopName,
      shop_whatsapp: sellerPhone,
      variant_details: variantDetails,
    });
  };

  const handleDirectOrder = (method: DirectOrderMethod) => {
    if (method === 'Wave' && paymentStep === 'SELECT') {
      setPaymentStep('WAVE_INFO');
      return;
    }

    recordLead(supabase, {
      sellerId: product.sellerId ?? shopId,
      productId: product.id,
      productName: product.name,
      productPrice: product.price,
    });

    const message = buildDirectOrderMessage({
      shopName,
      productName: product.name,
      price: product.price,
      method,
      sellerPhone,
      quantity,
      variant: variantDetails,
    });
    const waLink = buildWhatsAppLink(sellerPhone, message) ?? buildWhatsAppLink(DEFAULT_ORDER_PHONE, message)!;
    window.open(waLink, '_blank');

    setShowTerminal(false);
    setPaymentStep('SELECT');
  };

  const copyNumber = () => {
    navigator.clipboard.writeText(sellerPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openTerminal = () => {
    if (!requireVariants()) return;
    setShowTerminal(true);
  };

  /** Buy-bar CTA — the SAME purchase flow as the in-page button (no forked
   *  order logic): requireVariants gates it identically, and when a variant
   *  is still unpicked we scroll the purchase block back into view so the
   *  hint and the pills are visible instead of opening a doomed terminal. */
  const orderFromBuyBar = () => {
    if (!requireVariants()) {
      purchaseRootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setShowTerminal(true);
  };

  if (isOutOfStock) {
    return (
      <div className={styles.soldOut}>
        <p className={styles.soldOutTitle}>Sold Out</p>
        <p className={styles.soldOutBody}>Check back soon — the boutique restocks regularly.</p>
      </div>
    );
  }

  const priceLabel =
    product.price == null ? 'Price on request' : `D${(product.price * quantity).toLocaleString()}`;
  // Slide the bar in only while the real CTA row is off-screen and no
  // checkout terminal is up (the terminal carries its own WhatsApp buttons).
  const showBuyBar = !ctaInView && !showTerminal;

  return (
    <div ref={purchaseRootRef} className="space-y-7">
      {colors.length > 0 && (
        <div>
          <p className={styles.label}>Color</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => { setSelectedColor(color); setVariantHint(null); }}
                className={selectedColor === color ? styles.pillActive : styles.pill}
              >
                {color}
              </button>
            ))}
          </div>
        </div>
      )}

      {sizes.length > 0 && (
        <div>
          <p className={styles.label}>Size</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => { setSelectedSize(size); setVariantHint(null); }}
                className={selectedSize === size ? styles.pillActive : styles.pill}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className={styles.label}>Quantity</p>
        <div className="mt-3 flex items-center gap-4">
          <div className={styles.stepper}>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className={styles.stepperButton}
            >
              <Minus size={14} />
            </button>
            <span className={styles.stepperValue}>{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
              disabled={quantity >= maxQuantity}
              aria-label="Increase quantity"
              className={styles.stepperButton}
            >
              <Plus size={14} />
            </button>
          </div>
          {stock != null && stock > 0 && stock <= 5 && (
            <span className={styles.hint}>Only {stock} left</span>
          )}
        </div>
      </div>

      {variantHint && <p className={styles.hint}>{variantHint}</p>}

      <div ref={ctaRowRef} className="flex flex-col gap-3 pt-1 sm:flex-row">
        <button type="button" onClick={handleAddToBag} className={styles.secondaryButton}>
          <ShoppingBag size={16} />
          Add to Bag
        </button>
        <button type="button" onClick={openTerminal} className={styles.primaryButton}>
          <Smartphone size={16} />
          Order via WhatsApp
        </button>
      </div>

      {/* STICKY MOBILE BUY BAR — mobile only (md:hidden), slides in when the
          CTA row above leaves the viewport. Z-ORDER CONTRACT: z-[60] sits
          BELOW the checkout terminal (z-[70], which carries the WhatsApp
          payment buttons — the bar also unmounts while it is open) and BELOW
          the global cart drawer + overlay (z-[110]/z-[100] in
          components/Cart.tsx), so it can never overlap either. Safe-area
          padded for home-indicator phones; CTA ≥48px. */}
      <AnimatePresence>
        {showBuyBar && (
          <motion.div
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
            className={`fixed inset-x-0 bottom-0 z-[60] px-4 pt-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] md:hidden ${styles.buyBar}`}
          >
            <div className="mx-auto flex max-w-md items-center gap-4">
              <div className="min-w-0">
                <p className={`truncate ${styles.buyBarPrice}`}>{priceLabel}</p>
                {quantity > 1 && product.price != null && (
                  <p className={styles.label}>{quantity} × D{Number(product.price).toLocaleString()}</p>
                )}
              </div>
              <button type="button" onClick={orderFromBuyBar} className={styles.buyBarButton}>
                <Smartphone size={15} />
                Order Now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Secure order terminal — same Cash / Wave mechanics as the marketplace */}
      {showTerminal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-[#F9F8F6] shadow-2xl">
            <div className="relative bg-[var(--site-primary,#1a2e1a)] p-6 text-center">
              <button
                type="button"
                onClick={() => { setShowTerminal(false); setPaymentStep('SELECT'); }}
                aria-label="Close checkout"
                className="absolute right-4 top-4 text-white/50 transition hover:text-white"
              >
                <X size={20} />
              </button>
              <h2 className="font-serif text-xl text-white">Checkout</h2>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-white/60">{shopName} · Sanndikaa Secure</p>
            </div>

            <div className="p-7">
              {paymentStep === 'SELECT' ? (
                <div className="space-y-4">
                  <p className="text-center text-xs font-bold uppercase tracking-widest text-gray-400">Select Payment Method</p>
                  <button
                    type="button"
                    onClick={() => handleDirectOrder('Cash')}
                    className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-[#1a2e1a]"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-[#1a2e1a]"><Banknote size={20} /></span>
                    <span className="text-left">
                      <span className="block text-sm font-bold text-[#1a2e1a]">Cash on Delivery</span>
                      <span className="block text-[10px] text-gray-400">Pay when you receive it</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDirectOrder('Wave')}
                    className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-[#1DA1F2]"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#1DA1F2]"><Smartphone size={20} /></span>
                    <span className="text-left">
                      <span className="block text-sm font-bold text-[#1a2e1a]">Wave / Sadam</span>
                      <span className="block text-[10px] text-gray-400">Mobile Money Transfer</span>
                    </span>
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#1DA1F2]">
                    <Smartphone size={24} />
                  </span>
                  <p className="mt-4 px-2 text-xs text-gray-500">
                    Send <span className="font-bold text-black">{product.price == null ? 'the agreed amount' : `D${(product.price * quantity).toLocaleString()}`}</span> to this verified number:
                  </p>
                  <div className="relative mt-5 overflow-hidden rounded-xl bg-gradient-to-br from-[#2C3E2C] to-[#1a2e1a] p-6 text-white shadow-lg">
                    <div className="flex items-end justify-between">
                      <div className="text-left">
                        <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-white/60">Merchant Number</p>
                        <p className="font-mono text-xl tracking-widest">{sellerPhone}</p>
                      </div>
                      <button
                        type="button"
                        onClick={copyNumber}
                        aria-label="Copy merchant number"
                        className="rounded-lg bg-white/20 p-2 backdrop-blur-sm transition hover:bg-white/30"
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDirectOrder('Wave')}
                    className="mt-5 w-full rounded-lg bg-[#1DA1F2] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#1a94da]"
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
