'use client';

import { useEffect, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Banknote, Check, Copy, Minus, Plus, ShoppingBag, Smartphone, X } from 'lucide-react';
import { buildCartLineId, useCart } from '@/components/CartProvider';
import SmartImage from '@/components/SmartImage';
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
//
// PDP OVERHAUL (Phase 2):
//   • Both CTAs are prominent, equal-width, ≥48px: "Order via WhatsApp" is
//     the solid --site-accent fill (the committed Micro-Homepage recipe —
//     same token + hover as the chrome "Shop Now" button); "Add to Bag" is
//     the accent outline that inverts on hover.
//   • BEAT 5 — STICKY BUY BAR on EVERY viewport: fixed to the bottom of the
//     PDP viewport, safe-area padded (pb-[env(safe-area-inset-bottom)]),
//     revealed the moment the in-page CTA row leaves the viewport and kept
//     there while the buyer scrolls the rest of the page. It carries the
//     product thumb, name, live price and BOTH CTAs, wired to the exact same
//     handlers (no forked order logic). Motion is CSS-only (transform
//     transition + motion-reduce) — framer-motion is no longer loaded on the
//     PDP at all. While hidden the bar is `inert` (React 19) so it is
//     unfocusable and invisible to assistive tech.

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
  /** "Order via WhatsApp" — solid --site-accent fill. */
  primaryButton: string;
  /** "Add to Bag" — --site-accent outline, inverts on hover. */
  secondaryButton: string;
  hint: string;
  soldOut: string;
  soldOutTitle: string;
  soldOutBody: string;
  /** Beat 5 sticky buy bar — shell + parts. */
  buyBar: string;
  buyBarThumb: string;
  buyBarName: string;
  buyBarPrice: string;
  buyBarQty: string;
  buyBarBag: string;
  buyBarButton: string;
};

const PURCHASE_STYLES: Record<SiteTone, PurchaseStyles> = {
  ritual: {
    label: 'text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(70.9%_0.01_56.259))]',
    pill: 'rounded-full border border-stone-300 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-stone-600 transition hover:border-[var(--site-accent,#1c1917)]',
    pillActive: 'rounded-full border border-[var(--site-accent,#1c1917)] bg-[var(--site-accent,#1c1917)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white',
    stepper: 'inline-flex items-center rounded-full border border-stone-300 bg-white',
    stepperButton: 'flex h-11 w-11 items-center justify-center text-stone-500 transition hover:text-stone-900 disabled:opacity-30',
    stepperValue: 'w-10 text-center text-sm font-bold text-[var(--site-text,oklch(21.6%_0.006_56.043))]',
    primaryButton: 'flex min-h-12 w-full flex-1 items-center justify-center gap-3 rounded-[var(--site-radius,9999px)] bg-[var(--site-accent,#1c1917)] px-8 text-[10px] font-bold uppercase tracking-[0.25em] text-white shadow-lg transition hover:brightness-125 active:scale-95',
    secondaryButton: 'flex min-h-12 w-full flex-1 items-center justify-center gap-3 rounded-[var(--site-radius,9999px)] border-2 border-[var(--site-accent,#1c1917)] px-8 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--site-accent,#1c1917)] transition hover:bg-[var(--site-accent,#1c1917)] hover:text-white active:scale-95',
    hint: 'text-xs font-medium text-amber-700',
    soldOut: 'rounded-2xl border border-stone-300 bg-white px-6 py-5 text-center',
    soldOutTitle: 'text-sm font-bold uppercase tracking-widest text-stone-900',
    soldOutBody: 'mt-1 text-xs text-stone-500',
    buyBar: 'border-t border-stone-200 bg-[color-mix(in_srgb,var(--site-bg,#FBFAF7)_92%,transparent)] shadow-[0_-12px_32px_rgba(28,25,23,0.08)] backdrop-blur-md',
    buyBarThumb: 'relative hidden h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200 sm:block',
    buyBarName: 'truncate text-xs font-medium text-[var(--site-text,oklch(21.6%_0.006_56.043))]',
    buyBarPrice: 'truncate text-base font-light text-[var(--site-text,oklch(21.6%_0.006_56.043))]',
    buyBarQty: 'text-[10px] text-[var(--site-muted,oklch(55.3%_0.013_58.071))]',
    buyBarBag: 'flex h-12 w-12 shrink-0 items-center justify-center gap-2 rounded-[var(--site-radius,9999px)] border-2 border-[var(--site-accent,#1c1917)] text-[var(--site-accent,#1c1917)] transition hover:bg-[var(--site-accent,#1c1917)] hover:text-white active:scale-95 sm:w-auto sm:px-6 sm:text-[10px] sm:font-bold sm:uppercase sm:tracking-[0.25em]',
    buyBarButton: 'flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[var(--site-radius,9999px)] bg-[var(--site-accent,#1c1917)] px-5 text-[10px] font-bold uppercase tracking-[0.25em] text-white shadow-lg transition hover:brightness-125 active:scale-95 sm:flex-none sm:px-8',
  },
  editorial: {
    label: 'text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--site-muted,oklch(55.6%_0_0))]',
    pill: 'border border-neutral-300 bg-[#F7F5F0] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-neutral-600 transition hover:border-neutral-900',
    pillActive: 'border border-[var(--site-accent,#171717)] bg-[var(--site-accent,#171717)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#F7F5F0]',
    stepper: 'inline-flex items-center border border-neutral-900 bg-[#F7F5F0]',
    stepperButton: 'flex h-11 w-11 items-center justify-center text-neutral-500 transition hover:text-neutral-900 disabled:opacity-30',
    stepperValue: 'w-10 text-center text-sm font-bold text-[var(--site-text,oklch(20.5%_0_0))]',
    primaryButton: 'flex min-h-12 w-full flex-1 items-center justify-center gap-3 rounded-[var(--site-radius,0px)] bg-[var(--site-accent,#171717)] px-9 text-[10px] font-bold uppercase tracking-[0.3em] text-[#F7F5F0] transition hover:brightness-125 active:scale-95',
    secondaryButton: 'flex min-h-12 w-full flex-1 items-center justify-center gap-3 rounded-[var(--site-radius,0px)] border-2 border-[var(--site-accent,#171717)] px-9 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-accent,#171717)] transition hover:bg-[var(--site-accent,#171717)] hover:text-[#F7F5F0] active:scale-95',
    hint: 'text-xs font-medium text-amber-800',
    soldOut: 'border border-neutral-900 bg-[#F7F5F0] px-6 py-5 text-center',
    soldOutTitle: 'font-serif text-lg italic text-neutral-900',
    soldOutBody: 'mt-1 text-xs text-neutral-500',
    buyBar: 'border-t border-neutral-900 bg-[color-mix(in_srgb,var(--site-bg,#F7F5F0)_94%,transparent)] backdrop-blur-md',
    buyBarThumb: 'relative hidden h-12 w-12 shrink-0 overflow-hidden border border-neutral-900 bg-[#EDEAE2] sm:block',
    buyBarName: 'truncate font-serif text-sm italic text-[var(--site-text,oklch(20.5%_0_0))]',
    buyBarPrice: 'truncate text-sm text-[var(--site-text,oklch(20.5%_0_0))]',
    buyBarQty: 'text-[10px] text-[var(--site-muted,oklch(55.6%_0_0))]',
    buyBarBag: 'flex h-12 w-12 shrink-0 items-center justify-center gap-2 rounded-[var(--site-radius,0px)] border-2 border-[var(--site-accent,#171717)] text-[var(--site-accent,#171717)] transition hover:bg-[var(--site-accent,#171717)] hover:text-[#F7F5F0] active:scale-95 sm:w-auto sm:px-6 sm:text-[10px] sm:font-bold sm:uppercase sm:tracking-[0.3em]',
    buyBarButton: 'flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[var(--site-radius,0px)] bg-[var(--site-accent,#171717)] px-5 text-[10px] font-bold uppercase tracking-[0.3em] text-[#F7F5F0] transition hover:brightness-125 active:scale-95 sm:flex-none sm:px-8',
  },
  neutral: {
    label: 'text-[10px] font-black uppercase tracking-[0.25em] text-white/50',
    pill: 'rounded-full border border-white/20 bg-[#111] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/70 transition hover:border-[var(--site-accent,#f0a500)]',
    pillActive: 'rounded-full border border-[var(--site-accent,#f0a500)] bg-[var(--site-accent,#f0a500)] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black',
    stepper: 'inline-flex items-center rounded-full border border-white/20 bg-[#111]',
    stepperButton: 'flex h-11 w-11 items-center justify-center text-white/60 transition hover:text-white disabled:opacity-30',
    stepperValue: 'w-10 text-center text-sm font-black text-white',
    primaryButton: 'flex min-h-12 w-full flex-1 items-center justify-center gap-3 rounded-[var(--site-radius,9999px)] bg-[var(--site-accent,#f0a500)] px-8 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-lg transition hover:brightness-110 active:scale-95',
    secondaryButton: 'flex min-h-12 w-full flex-1 items-center justify-center gap-3 rounded-[var(--site-radius,9999px)] border-2 border-[var(--site-accent,#f0a500)] px-8 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--site-accent,#f0a500)] transition hover:bg-[var(--site-accent,#f0a500)] hover:text-black active:scale-95',
    hint: 'text-xs font-bold text-[var(--site-accent,#f0a500)]',
    soldOut: 'rounded-2xl border border-white/15 bg-[#111] px-6 py-5 text-center',
    soldOutTitle: 'text-sm font-black uppercase tracking-widest text-white',
    soldOutBody: 'mt-1 text-xs text-white/50',
    buyBar: 'border-t border-white/10 bg-[color-mix(in_srgb,var(--site-bg,#0C0C0C)_92%,transparent)] backdrop-blur-md',
    buyBarThumb: 'relative hidden h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black ring-1 ring-white/15 sm:block',
    buyBarName: 'truncate text-xs font-bold uppercase tracking-wider text-white',
    buyBarPrice: 'truncate text-base font-black text-[var(--site-accent,#f0a500)]',
    buyBarQty: 'text-[10px] text-white/50',
    buyBarBag: 'flex h-12 w-12 shrink-0 items-center justify-center gap-2 rounded-[var(--site-radius,9999px)] border-2 border-[var(--site-accent,#f0a500)] text-[var(--site-accent,#f0a500)] transition hover:bg-[var(--site-accent,#f0a500)] hover:text-black active:scale-95 sm:w-auto sm:px-6 sm:text-[10px] sm:font-black sm:uppercase sm:tracking-[0.2em]',
    buyBarButton: 'flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[var(--site-radius,9999px)] bg-[var(--site-accent,#f0a500)] px-5 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-lg transition hover:brightness-110 active:scale-95 sm:flex-none sm:px-8',
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

  // BEAT 5 — STICKY BUY BAR: observe the in-page CTA row; whenever it is out
  // of the viewport (above OR below — on a phone the gallery fills the first
  // screen, so the bar is present from the first scroll) the fixed bar is
  // revealed. Every viewport; the observer is cheap and viewport-agnostic.
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

  /** Buy-bar gate: same requireVariants; when a variant is still unpicked we
   *  scroll the purchase block back into view so the hint and the pills are
   *  visible instead of failing silently from the bottom of the screen. */
  const requireVariantsOrReveal = (): boolean => {
    if (requireVariants()) return true;
    purchaseRootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return false;
  };

  const addToBag = () => {
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

  const handleAddToBag = () => {
    if (!requireVariants()) return;
    addToBag();
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

  // Buy-bar CTAs — the SAME purchase flows as the in-page buttons.
  const addFromBuyBar = () => {
    if (!requireVariantsOrReveal()) return;
    addToBag();
  };
  const orderFromBuyBar = () => {
    if (!requireVariantsOrReveal()) return;
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

  const unitLabel = product.price == null ? null : `D${Number(product.price).toLocaleString()}`;
  const priceLabel =
    product.price == null ? 'Price on request' : `D${(product.price * quantity).toLocaleString()}`;
  // Show the bar only while the real CTA row is off-screen and no checkout
  // terminal is up (the terminal carries its own WhatsApp buttons).
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

      {/* Primary CTA row — both prominent, equal width, ≥48px. */}
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

      {/* BEAT 5 — STICKY BUY BAR (every viewport). Fixed to the PDP viewport
          bottom, safe-area padded, CSS transform reveal. Z-ORDER CONTRACT:
          z-[60] sits BELOW the checkout terminal (z-[70], which carries the
          WhatsApp payment buttons — the bar also hides while it is open) and
          BELOW the global cart drawer + overlay (z-[110]/z-[100] in
          components/Cart.tsx), so it can never overlap either. `inert` while
          hidden: no stray tab stops, nothing announced. */}
      <div
        role="region"
        aria-label="Quick purchase"
        inert={!showBuyBar}
        className={`fixed inset-x-0 bottom-0 z-[60] pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
          showBuyBar ? 'translate-y-0' : 'translate-y-full'
        } ${styles.buyBar}`}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:gap-5 md:px-10">
          {product.image_url && (
            <div className={styles.buyBarThumb}>
              <SmartImage src={product.image_url} alt="" fill sizes="48px" blurTone="none" className="object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className={styles.buyBarName}>{product.name}</p>
            <p className={styles.buyBarPrice}>
              {priceLabel}
              {quantity > 1 && unitLabel && (
                <span className={styles.buyBarQty}> · {quantity} × {unitLabel}</span>
              )}
            </p>
          </div>
          <button type="button" onClick={addFromBuyBar} aria-label="Add to bag" className={styles.buyBarBag}>
            <ShoppingBag size={16} />
            <span className="hidden sm:inline">Add to Bag</span>
          </button>
          <button type="button" onClick={orderFromBuyBar} className={styles.buyBarButton}>
            <Smartphone size={15} />
            <span className="sm:hidden">Order</span>
            <span className="hidden sm:inline">Order via WhatsApp</span>
          </button>
        </div>
      </div>

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
