'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Banknote, Check, Copy, Minus, Plus, ShoppingBag, Smartphone, X } from 'lucide-react';
import { useCart } from '@/components/CartProvider';
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
};

const PURCHASE_STYLES: Record<SiteTone, PurchaseStyles> = {
  ritual: {
    label: 'text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400',
    pill: 'rounded-full border border-stone-300 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-stone-600 transition hover:border-stone-900',
    pillActive: 'rounded-full border border-stone-900 bg-stone-900 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white',
    stepper: 'inline-flex items-center rounded-full border border-stone-300 bg-white',
    stepperButton: 'flex h-11 w-11 items-center justify-center text-stone-500 transition hover:text-stone-900 disabled:opacity-30',
    stepperValue: 'w-10 text-center text-sm font-bold text-stone-900',
    primaryButton: 'flex w-full items-center justify-center gap-3 rounded-full bg-stone-900 px-8 py-4 text-[10px] font-bold uppercase tracking-[0.25em] text-white shadow-lg transition hover:bg-stone-700 active:scale-95 sm:w-auto',
    secondaryButton: 'flex w-full items-center justify-center gap-3 rounded-full border border-stone-900 bg-white px-8 py-4 text-[10px] font-bold uppercase tracking-[0.25em] text-stone-900 transition hover:bg-stone-900 hover:text-white active:scale-95 sm:w-auto',
    hint: 'text-xs font-medium text-amber-700',
    soldOut: 'rounded-2xl border border-stone-300 bg-white px-6 py-5 text-center',
    soldOutTitle: 'text-sm font-bold uppercase tracking-widest text-stone-900',
    soldOutBody: 'mt-1 text-xs text-stone-500',
  },
  editorial: {
    label: 'text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400',
    pill: 'border border-neutral-300 bg-[#F7F5F0] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-neutral-600 transition hover:border-neutral-900',
    pillActive: 'border border-neutral-900 bg-neutral-900 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#F7F5F0]',
    stepper: 'inline-flex items-center border border-neutral-900 bg-[#F7F5F0]',
    stepperButton: 'flex h-11 w-11 items-center justify-center text-neutral-500 transition hover:text-neutral-900 disabled:opacity-30',
    stepperValue: 'w-10 text-center text-sm font-bold text-neutral-900',
    primaryButton: 'flex w-full items-center justify-center gap-3 bg-neutral-900 px-9 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-[#F7F5F0] transition hover:bg-[#1a2e1a] active:scale-95 sm:w-auto',
    secondaryButton: 'flex w-full items-center justify-center gap-3 border border-neutral-900 px-9 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-900 transition hover:bg-neutral-900 hover:text-[#F7F5F0] active:scale-95 sm:w-auto',
    hint: 'text-xs font-medium text-amber-800',
    soldOut: 'border border-neutral-900 bg-[#F7F5F0] px-6 py-5 text-center',
    soldOutTitle: 'font-serif text-lg italic text-neutral-900',
    soldOutBody: 'mt-1 text-xs text-neutral-500',
  },
  neutral: {
    label: 'text-[10px] font-black uppercase tracking-[0.25em] text-white/50',
    pill: 'rounded-full border border-white/20 bg-[#111] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/70 transition hover:border-[#f0a500]',
    pillActive: 'rounded-full border border-[#f0a500] bg-[#f0a500] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black',
    stepper: 'inline-flex items-center rounded-full border border-white/20 bg-[#111]',
    stepperButton: 'flex h-11 w-11 items-center justify-center text-white/60 transition hover:text-white disabled:opacity-30',
    stepperValue: 'w-10 text-center text-sm font-black text-white',
    primaryButton: 'flex w-full items-center justify-center gap-3 rounded-full bg-[#f0a500] px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-lg transition hover:bg-amber-400 active:scale-95 sm:w-auto',
    secondaryButton: 'flex w-full items-center justify-center gap-3 rounded-full border border-[#f0a500] px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[#f0a500] transition hover:bg-[#f0a500] hover:text-black active:scale-95 sm:w-auto',
    hint: 'text-xs font-bold text-[#f0a500]',
    soldOut: 'rounded-2xl border border-white/15 bg-[#111] px-6 py-5 text-center',
    soldOutTitle: 'text-sm font-black uppercase tracking-widest text-white',
    soldOutBody: 'mt-1 text-xs text-white/50',
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

  const colors = Array.isArray(product.colors) ? product.colors : [];
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const stock = product.stock_quantity;
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
      id: product.id,
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

  if (isOutOfStock) {
    return (
      <div className={styles.soldOut}>
        <p className={styles.soldOutTitle}>Sold Out</p>
        <p className={styles.soldOutBody}>Check back soon — the boutique restocks regularly.</p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
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

      <div className="flex flex-col gap-3 pt-1 sm:flex-row">
        <button type="button" onClick={handleAddToBag} className={styles.secondaryButton}>
          <ShoppingBag size={16} />
          Add to Bag
        </button>
        <button type="button" onClick={openTerminal} className={styles.primaryButton}>
          <Smartphone size={16} />
          Order via WhatsApp
        </button>
      </div>

      {/* Secure order terminal — same Cash / Wave mechanics as the marketplace */}
      {showTerminal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-[#F9F8F6] shadow-2xl">
            <div className="relative bg-[#1a2e1a] p-6 text-center">
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
                    Send <span className="font-bold text-black">D{((product.price ?? 0) * quantity).toLocaleString()}</span> to this verified number:
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
