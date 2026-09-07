'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageCircle,
  PencilLine,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  User,
} from 'lucide-react';
import { useCart, type CartItem } from './CartProvider';
// Shared order-flow helpers (lib/orderFlow) — one phone sanitizer + wa.me
// builder across the cart, the marketplace PDP, and the /site storefront PDP.
// openOrderHandoff: popup-safe WhatsApp handoff (window opened synchronously
// inside the submit, BEFORE the awaited checkout round-trip — see lib/orderFlow).
import { buildWhatsAppLink, openOrderHandoff } from '@/lib/orderFlow';

// ─────────────────────────────────────────────────────────────────────────────
// CheckoutForm — THE dedicated checkout surface, shared by two routes:
//   • /checkout                 (global marketplace shell, tone 'marketplace')
//   • /site/[slug]/checkout     (boutique shell, inside the seller's Chrome +
//                                SiteThemeCascade, tone = the chrome's tone)
//
// It owns everything the cart drawer used to inline: the buyer fields (name,
// phone, delivery/pickup + address), the server-authoritative POST to
// /api/checkout, the verified WhatsApp receipt, and the popup-safe handoff.
// The drawer (components/Cart.tsx) is now a pure bag: it routes here.
//
// TONE CONTRACT: every ink/surface/accent spot is either a tone literal (the
// PDP's established per-tone class-map pattern) or var(--site-*, <literal>),
// so a themed boutique recolors the page through the cascade while the
// marketplace renders its exact historical Sanndikaa palette. The PRIMARY
// submit button is always bg-[var(--site-accent, …)] as mandated.
//
// MOBILE: a fixed, safe-area-padded summary bar (pb-[env(safe-area-inset-
// bottom)]) carries the live total and the submit button on every viewport
// below lg. It submits the same <form> via the `form` attribute — no forked
// order logic. Desktop shows the sticky summary column instead.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Server contract — mirrors app/api/checkout/route.ts ─────────────────────
// The browser never touches `customers`, `orders`, `order_items` or the stock
// RPCs. It sends identities + quantities only; the route re-prices every line
// from `products.price` with the service-role key, reserves stock atomically,
// writes the order, and returns the VERIFIED numbers the WhatsApp receipt is
// built from. Cart prices are never trusted for money.

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
  /** What the buyer saw on screen — drift detection only, never used for money. */
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

const STOCK_CHANGED_FAILURE =
  'Prices or stock changed while you were checking out. Please review your bag and try again.';

// ─── Public props ────────────────────────────────────────────────────────────

/** Styling dialect: the marketplace shell, or one of the site chrome tones. */
export type CheckoutTone = 'marketplace' | 'ritual' | 'editorial' | 'neutral';

/** Validated shop facts the boutique route already holds (siteData SHOP_COLUMNS). */
export type CheckoutShopFacts = {
  id: string;
  name: string;
  /** Seller WhatsApp — fallback when a bag line lacks shop_whatsapp. */
  whatsapp?: string | null;
  offersDelivery?: boolean | null;
  offersPickup?: boolean | null;
  pickupInstructions?: string | null;
};

type CheckoutFormProps = {
  tone?: CheckoutTone;
  /**
   * Pin the checkout to ONE shop (the boutique route). Only that shop's bag
   * lines are shown; other sellers' items never surface inside a boutique.
   * Omit on the marketplace route — the form resolves the shop from
   * `initialShopId`, the bag (single seller), or an on-page picker.
   */
  pinnedShop?: CheckoutShopFacts;
  /** `?shop=` carried over from the drawer's "Checkout with …" link. */
  initialShopId?: string | null;
  /** Where "continue shopping" links route (the mall, or the boutique's collection). */
  continueHref: string;
  continueLabel?: string;
};

type FulfillmentMethod = 'delivery' | 'pickup';

type ShopGroup = {
  shopId: string;
  shopName: string;
  shopWhatsapp: string;
  items: CartItem[];
  total: number;
};

type FieldErrors = Partial<Record<'name' | 'phone' | 'address', string>>;

type OrderSuccess = {
  orderRef: string;
  shopName: string;
  total: number;
  /** null when WhatsApp could not be opened — the order IS still recorded. */
  whatsappLink: string | null;
  priceChanged: boolean;
};

// ─── Tone class maps ─────────────────────────────────────────────────────────

type CheckoutStyles = {
  eyebrow: string;
  title: string;
  body: string;
  card: string;
  cardTitle: string;
  divider: string;
  label: string;
  input: string;
  textarea: string;
  inputIcon: string;
  fieldError: string;
  segment: string;
  segmentActive: string;
  hint: string;
  thumb: string;
  thumbEmpty: string;
  lineName: string;
  lineMeta: string;
  linePrice: string;
  totalLabel: string;
  total: string;
  primaryButton: string;
  ghostButton: string;
  link: string;
  stickyBar: string;
  stickyPrice: string;
  alert: string;
  successIcon: string;
  pickerButton: string;
  skeleton: string;
};

const STYLES: Record<CheckoutTone, CheckoutStyles> = {
  // The marketplace's exact historical palette: Sanndikaa green ink, warm
  // white paper, Playfair headlines. Accent fallback = the drawer's #1a2e1a.
  marketplace: {
    eyebrow: 'text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--site-accent,#1a2e1a)]',
    title: 'mt-3 font-serif text-3xl font-bold tracking-tight text-gray-900 md:text-5xl',
    body: 'text-sm leading-relaxed text-gray-500',
    card: 'rounded-3xl border border-gray-100 bg-white p-6 shadow-sm md:p-8',
    cardTitle: 'text-[11px] font-bold uppercase tracking-widest text-gray-900',
    divider: 'border-gray-100',
    label: 'text-[10px] font-bold uppercase tracking-widest text-gray-500',
    input: 'w-full rounded-xl border border-black/10 bg-gray-50/50 py-3.5 pl-11 pr-4 text-base font-medium text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-gray-900 focus:bg-white',
    textarea: 'w-full rounded-xl border border-black/10 bg-gray-50/50 p-3.5 text-base font-medium text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-gray-900 focus:bg-white',
    inputIcon: 'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400',
    fieldError: 'mt-1.5 text-xs font-medium text-red-600',
    segment: 'flex min-h-12 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white text-[10px] font-bold uppercase tracking-widest text-gray-500 transition hover:bg-gray-50',
    segmentActive: 'flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--site-accent,#1a2e1a)] bg-[var(--site-accent,#1a2e1a)] text-[10px] font-bold uppercase tracking-widest text-white shadow-md',
    hint: 'rounded-xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-600',
    thumb: 'h-16 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50',
    thumbEmpty: 'flex h-full w-full items-center justify-center text-gray-300',
    lineName: 'text-sm font-semibold text-gray-900',
    lineMeta: 'mt-0.5 text-[10px] uppercase tracking-wider text-gray-400',
    linePrice: 'text-sm font-bold text-gray-900',
    totalLabel: 'text-[11px] font-bold uppercase tracking-widest text-gray-500',
    total: 'font-serif text-2xl font-bold text-gray-900',
    primaryButton: 'flex min-h-14 w-full items-center justify-center gap-2 rounded-[var(--site-radius,0.75rem)] bg-[var(--site-accent,#1a2e1a)] px-6 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.08),0_10px_24px_rgba(16,24,40,0.18)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0',
    ghostButton: 'inline-flex min-h-11 items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition hover:text-gray-900',
    link: 'inline-flex min-h-11 items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--site-accent,#1a2e1a)] underline underline-offset-4 transition hover:opacity-70',
    stickyBar: 'border-t border-gray-100 bg-white/92 shadow-[0_-12px_32px_rgba(16,24,40,0.08)] backdrop-blur-md',
    stickyPrice: 'truncate font-serif text-xl font-bold text-gray-900',
    alert: 'rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium leading-relaxed text-red-700',
    successIcon: 'flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--site-accent,#1a2e1a)_10%,transparent)] text-[var(--site-accent,#1a2e1a)]',
    pickerButton: 'flex w-full items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:border-gray-900',
    skeleton: 'animate-pulse rounded-2xl bg-gray-100',
  },
  // Ritual: stone paper, rounded-full pills, near-black accent.
  ritual: {
    eyebrow: 'text-[10px] font-bold uppercase tracking-[0.35em] text-stone-400',
    title: 'mt-3 font-serif text-3xl font-bold tracking-tight text-stone-900 md:text-5xl',
    body: 'text-sm leading-relaxed text-stone-500',
    card: 'rounded-3xl border border-stone-200 bg-white/70 p-6 shadow-sm md:p-8',
    cardTitle: 'text-[11px] font-bold uppercase tracking-[0.3em] text-stone-900',
    divider: 'border-stone-200',
    label: 'text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500',
    input: 'w-full rounded-full border border-stone-300 bg-white py-3.5 pl-11 pr-5 text-base font-medium text-stone-900 outline-none transition-all placeholder:text-stone-400 focus:border-stone-900',
    textarea: 'w-full rounded-2xl border border-stone-300 bg-white p-4 text-base font-medium text-stone-900 outline-none transition-all placeholder:text-stone-400 focus:border-stone-900',
    inputIcon: 'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400',
    fieldError: 'mt-1.5 text-xs font-medium text-red-700',
    segment: 'flex min-h-12 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white text-[10px] font-bold uppercase tracking-widest text-stone-600 transition hover:border-[var(--site-accent,#1c1917)]',
    segmentActive: 'flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--site-accent,#1c1917)] bg-[var(--site-accent,#1c1917)] text-[10px] font-bold uppercase tracking-widest text-white',
    hint: 'rounded-2xl bg-stone-100 p-4 text-sm leading-relaxed text-stone-600',
    thumb: 'h-16 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100',
    thumbEmpty: 'flex h-full w-full items-center justify-center text-stone-300',
    lineName: 'text-sm font-semibold text-stone-900',
    lineMeta: 'mt-0.5 text-[10px] uppercase tracking-wider text-stone-400',
    linePrice: 'text-sm font-bold text-stone-900',
    totalLabel: 'text-[11px] font-bold uppercase tracking-[0.3em] text-stone-500',
    total: 'font-serif text-2xl font-bold text-stone-900',
    primaryButton: 'flex min-h-14 w-full items-center justify-center gap-3 rounded-[var(--site-radius,9999px)] bg-[var(--site-accent,#1c1917)] px-8 text-[10px] font-bold uppercase tracking-[0.25em] text-white shadow-lg transition hover:brightness-125 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
    ghostButton: 'inline-flex min-h-11 items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500 transition hover:text-stone-900',
    link: 'inline-flex min-h-11 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--site-accent,#1c1917)] underline underline-offset-4 transition hover:opacity-70',
    stickyBar: 'border-t border-stone-200 bg-[color-mix(in_srgb,var(--site-bg,#FBFAF7)_92%,transparent)] shadow-[0_-12px_32px_rgba(28,25,23,0.08)] backdrop-blur-md',
    stickyPrice: 'truncate font-serif text-xl font-bold text-stone-900',
    alert: 'rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium leading-relaxed text-red-700',
    successIcon: 'flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--site-accent,#1c1917)_8%,transparent)] text-[var(--site-accent,#1c1917)]',
    pickerButton: 'flex w-full items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white/70 p-5 text-left transition hover:border-stone-900',
    skeleton: 'animate-pulse rounded-2xl bg-stone-200/60',
  },
  // Editorial: print-magazine paper, hairline neutral-900 rules, zero radius.
  editorial: {
    eyebrow: 'text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--site-accent,#1a2e1a)]',
    title: 'mt-3 font-serif text-3xl font-black tracking-tight text-neutral-900 md:text-5xl',
    body: 'text-sm leading-relaxed text-neutral-500',
    card: 'border border-neutral-900 bg-[#F7F5F0] p-6 md:p-8',
    cardTitle: 'text-[11px] font-bold uppercase tracking-[0.3em] text-neutral-900',
    divider: 'border-neutral-900',
    label: 'text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500',
    input: 'w-full border border-neutral-900 bg-white py-3.5 pl-11 pr-4 text-base font-medium text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:bg-[#F7F5F0]',
    textarea: 'w-full border border-neutral-900 bg-white p-4 text-base font-medium text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:bg-[#F7F5F0]',
    inputIcon: 'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400',
    fieldError: 'mt-1.5 text-xs font-medium text-red-700',
    segment: 'flex min-h-12 items-center justify-center gap-2 border border-neutral-900 bg-transparent text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-900 transition hover:bg-neutral-900 hover:text-[#F7F5F0]',
    segmentActive: 'flex min-h-12 items-center justify-center gap-2 border border-[var(--site-accent,#171717)] bg-[var(--site-accent,#171717)] text-[10px] font-bold uppercase tracking-[0.3em] text-[#F7F5F0]',
    hint: 'border border-neutral-900 p-4 text-sm leading-relaxed text-neutral-600',
    thumb: 'h-16 w-14 flex-shrink-0 overflow-hidden border border-neutral-900 bg-white',
    thumbEmpty: 'flex h-full w-full items-center justify-center text-neutral-300',
    lineName: 'text-sm font-semibold text-neutral-900',
    lineMeta: 'mt-0.5 text-[10px] uppercase tracking-wider text-neutral-500',
    linePrice: 'font-serif text-sm font-bold italic text-neutral-900',
    totalLabel: 'text-[11px] font-bold uppercase tracking-[0.3em] text-neutral-500',
    total: 'font-serif text-2xl font-black italic text-neutral-900',
    primaryButton: 'flex min-h-14 w-full items-center justify-center gap-3 rounded-[var(--site-radius,0px)] bg-[var(--site-accent,#171717)] px-9 text-[10px] font-bold uppercase tracking-[0.3em] text-[#F7F5F0] transition hover:brightness-125 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
    ghostButton: 'inline-flex min-h-11 items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500 transition hover:text-neutral-900',
    link: 'inline-flex min-h-11 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-900 underline underline-offset-4 transition hover:text-[var(--site-accent,#1a2e1a)]',
    stickyBar: 'border-t border-neutral-900 bg-[color-mix(in_srgb,var(--site-bg,#F7F5F0)_94%,transparent)] backdrop-blur-md',
    stickyPrice: 'truncate font-serif text-xl font-black italic text-neutral-900',
    alert: 'border border-red-700 bg-red-50 p-4 text-sm font-medium leading-relaxed text-red-700',
    successIcon: 'flex h-14 w-14 items-center justify-center border border-neutral-900 text-[var(--site-accent,#1a2e1a)]',
    pickerButton: 'flex w-full items-center justify-between gap-4 border border-neutral-900 bg-white p-5 text-left transition hover:bg-[#F7F5F0]',
    skeleton: 'animate-pulse bg-neutral-200/70',
  },
  // Neutral (Vitality): near-black stage, amber accent, black type on accent.
  neutral: {
    eyebrow: 'text-[10px] font-black uppercase tracking-[0.25em] text-[var(--site-accent,#f0a500)]',
    title: 'mt-3 text-3xl font-black uppercase tracking-tighter text-white md:text-5xl',
    body: 'text-sm leading-relaxed text-white/60',
    card: 'rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8',
    cardTitle: 'text-[11px] font-black uppercase tracking-widest text-white',
    divider: 'border-white/10',
    label: 'text-[10px] font-black uppercase tracking-widest text-white/50',
    input: 'w-full rounded-xl border border-white/15 bg-[#111] py-3.5 pl-11 pr-4 text-base font-medium text-white outline-none transition-all placeholder:text-white/40 focus:border-[var(--site-accent,#f0a500)]',
    textarea: 'w-full rounded-xl border border-white/15 bg-[#111] p-4 text-base font-medium text-white outline-none transition-all placeholder:text-white/40 focus:border-[var(--site-accent,#f0a500)]',
    inputIcon: 'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40',
    fieldError: 'mt-1.5 text-xs font-medium text-red-400',
    segment: 'flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-[#111] text-[10px] font-black uppercase tracking-widest text-white/70 transition hover:border-[var(--site-accent,#f0a500)]',
    segmentActive: 'flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--site-accent,#f0a500)] bg-[var(--site-accent,#f0a500)] text-[10px] font-black uppercase tracking-widest text-black',
    hint: 'rounded-xl border border-white/10 bg-[#111] p-4 text-sm leading-relaxed text-white/70',
    thumb: 'h-16 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#111]',
    thumbEmpty: 'flex h-full w-full items-center justify-center text-white/20',
    lineName: 'text-sm font-semibold text-white',
    lineMeta: 'mt-0.5 text-[10px] uppercase tracking-wider text-white/40',
    linePrice: 'text-sm font-black text-[var(--site-accent,#f0a500)]',
    totalLabel: 'text-[11px] font-black uppercase tracking-widest text-white/50',
    total: 'text-2xl font-black text-[var(--site-accent,#f0a500)]',
    primaryButton: 'flex min-h-14 w-full items-center justify-center gap-3 rounded-[var(--site-radius,9999px)] bg-[var(--site-accent,#f0a500)] px-8 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
    ghostButton: 'inline-flex min-h-11 items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/50 transition hover:text-white',
    link: 'inline-flex min-h-11 items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--site-accent,#f0a500)] underline underline-offset-4 transition hover:opacity-70',
    stickyBar: 'border-t border-white/10 bg-[color-mix(in_srgb,var(--site-bg,#0C0C0C)_92%,transparent)] backdrop-blur-md',
    stickyPrice: 'truncate text-xl font-black text-[var(--site-accent,#f0a500)]',
    alert: 'rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm font-medium leading-relaxed text-red-300',
    successIcon: 'flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--site-accent,#f0a500)_12%,transparent)] text-[var(--site-accent,#f0a500)]',
    pickerButton: 'flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:border-[var(--site-accent,#f0a500)]',
    skeleton: 'animate-pulse rounded-2xl bg-white/[0.06]',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FORM_ID = 'sanndikaa-checkout-form';

const noopSubscribe = () => () => {};
/**
 * The cart hydrates from localStorage in a post-mount effect (CartProvider),
 * so the first client render always sees an EMPTY bag. Gating the body on
 * hydration renders a quiet skeleton for that one frame instead of flashing
 * "Your bag is empty" at a buyer whose bag is full.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function groupByShop(items: CartItem[]): ShopGroup[] {
  const byShop = new Map<string, ShopGroup>();
  for (const item of items) {
    const existing = byShop.get(item.shop_id);
    if (existing) {
      existing.items.push(item);
      existing.total += item.price * item.quantity;
    } else {
      byShop.set(item.shop_id, {
        shopId: item.shop_id,
        shopName: item.shop_name,
        shopWhatsapp: item.shop_whatsapp,
        items: [item],
        total: item.price * item.quantity,
      });
    }
  }
  return [...byShop.values()];
}

function formatMoney(amount: number): string {
  return `D${amount.toLocaleString()}`;
}

function hasVariant(details: string | null | undefined): details is string {
  return typeof details === 'string' && details.length > 0 && details !== 'None';
}

/** The tone's primary button as an inline (content-width) variant. */
function inlinePrimary(primaryButton: string): string {
  return primaryButton.replace('w-full', 'w-auto');
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CheckoutForm({
  tone = 'marketplace',
  pinnedShop,
  initialShopId = null,
  continueHref,
  continueLabel = 'Continue shopping',
}: CheckoutFormProps) {
  const styles = STYLES[tone];
  const hydrated = useHydrated();
  const { cartItems, removeFromCart, setIsCartOpen, fulfillmentMethod, setFulfillmentMethod } = useCart();

  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState<OrderSuccess | null>(null);

  // Which seller this checkout is for: the boutique pin wins, then an on-page
  // pick, then the drawer's ?shop= hint, then the only seller in the bag.
  const groups = groupByShop(cartItems ?? []);
  const hintedShopId = initialShopId && groups.some((g) => g.shopId === initialShopId) ? initialShopId : null;
  const targetShopId =
    pinnedShop?.id ?? selectedShopId ?? hintedShopId ?? (groups.length === 1 ? groups[0].shopId : null);
  const group = groups.find((g) => g.shopId === targetShopId) ?? null;

  const shopName = pinnedShop?.name || group?.shopName || 'the seller';
  const shopWhatsapp = group?.shopWhatsapp || pinnedShop?.whatsapp || '';

  // Fulfillment gating from the boutique's validated facts. Both-false is a
  // data glitch, not a closed shop — offer both rather than strand the buyer.
  const allowDelivery = pinnedShop?.offersDelivery !== false;
  const allowPickup = pinnedShop?.offersPickup !== false;
  const canDeliver = allowDelivery || !allowPickup;
  const canPickup = allowPickup || !allowDelivery;
  const method: FulfillmentMethod =
    fulfillmentMethod === 'delivery' ? (canDeliver ? 'delivery' : 'pickup') : canPickup ? 'pickup' : 'delivery';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!group || isProcessing) return;

    const name = customerName.trim();
    const phone = customerPhone.trim();
    const address = deliveryAddress.trim();

    const errors: FieldErrors = {};
    if (!name) errors.name = 'Please enter your full name.';
    if (!phone) errors.phone = 'Please enter your phone or WhatsApp number.';
    if (method === 'delivery' && !address) errors.address = 'Please provide a delivery address.';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(null);
      return;
    }
    setFieldErrors({});

    // Pre-flight the seller's number BEFORE the server reserves stock or
    // writes an order nobody could be handed to. Link validity depends only
    // on the phone; the real receipt is rebuilt from verified numbers below.
    if (!buildWhatsAppLink(shopWhatsapp, 'preflight')) {
      setFormError(`Sorry, ${group.shopName} has not provided a valid WhatsApp number.`);
      return;
    }

    // Hoisted so the outer catch can always close the interstitial tab.
    let handoff: ReturnType<typeof openOrderHandoff> | null = null;
    const shopId = group.shopId;
    const lines = group.items;

    try {
      // 1. OPEN THE HANDOFF WINDOW *SYNCHRONOUSLY* — no await has run yet, so
      // the submit's transient activation is still alive and the tab opens
      // popup-block-free. It shows a branded "Preparing your order…"
      // interstitial while the server works; only after a 200 does it
      // navigate to WhatsApp.
      handoff = openOrderHandoff();
      setIsProcessing(true);
      setFormError(null);

      // 2. SERVER-AUTHORITATIVE CHECKOUT. Identities + quantities only — the
      // route re-prices, reserves stock atomically and writes customers →
      // orders → order_items with the service-role key. `expectedTotal` is
      // the on-screen total, sent purely so the server can flag price drift.
      const payload: CheckoutRequestPayload = {
        shopId,
        customer: { name, phone },
        fulfillmentMethod: method,
        ...(method === 'delivery' ? { deliveryAddress: address } : {}),
        items: lines.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          variantDetails: item.variant_details ?? null,
        })),
        expectedTotal: group.total,
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
        setFormError(reason ?? STOCK_CHANGED_FAILURE);
        return;
      }

      // 4. Anything else that is not a clean 200 (400 bad payload, 500 write
      // failure, 503 service unavailable, unparseable body) — generic failure.
      // The server has already released any reserved stock in these cases.
      if (!response.ok || !result || !result.ok) {
        handoff.close();
        setFormError(GENERIC_CHECKOUT_FAILURE);
        return;
      }

      // 5. BUILD THE LUXURY DIGITAL RECEIPT FROM SERVER-VERIFIED NUMBERS ONLY.
      // Line names, unit prices, line totals, the grand total and the order
      // reference all come from the response — never from cart state.
      const verifiedTotal = result.total;
      const orderRef = result.orderRef || result.orderId.replace(/-/g, '').slice(-6).toUpperCase();

      let message = `🛍️ *NEW ORDER via SANNDIKAA*\n`;
      message += `Order Ref: #${orderRef}\n`;
      message += `──────────────────\n\n`;
      message += `Hi *${group.shopName}*! I would like to place an order for:\n\n`;

      result.lines.forEach((line) => {
        message += `🔹 *${line.quantity}x ${line.name}*\n`;
        if (hasVariant(line.variantDetails)) {
          message += `   Options: ${line.variantDetails}\n`;
        }
        message += `   Price: ${formatMoney(line.lineTotal)}\n\n`;
      });

      message += `──────────────────\n`;
      message += `💰 *TOTAL AMOUNT: ${formatMoney(verifiedTotal)}*\n`;
      message += `──────────────────\n\n`;

      if (result.priceChanged) {
        message += `ℹ️ Prices changed since these items were added to the bag; this total reflects the shop's current prices.\n\n`;
      }

      message += `👤 *CUSTOMER DETAILS:*\n`;
      message += `Name: ${name}\n`;
      message += `Phone: ${phone}\n`;
      message += `Fulfillment: ${method === 'delivery' ? '🚚 Delivery' : '🏪 Store Pickup'}\n`;
      if (method === 'delivery') {
        message += `Address: ${address}\n`;
      }
      message += `\n*Please let me know how to pay and confirm this order!*`;

      const whatsappLink = buildWhatsAppLink(shopWhatsapp, message);
      const receipt: OrderSuccess = {
        orderRef,
        shopName: group.shopName,
        total: verifiedTotal,
        whatsappLink,
        priceChanged: result.priceChanged,
      };

      if (!whatsappLink) {
        // Unreachable after the pre-flight (validity depends only on the
        // number), but the order IS recorded now — say so rather than "not sent".
        handoff.close();
        lines.forEach((item) => removeFromCart(item.id));
        setSuccess(receipt);
        return;
      }

      // 6. HANDOFF: the order is fully recorded — point the already-open tab
      // at WhatsApp, clear this shop's lines and show the confirmation.
      handoff.navigate(whatsappLink);
      lines.forEach((item) => removeFromCart(item.id));
      setSuccess(receipt);

      // 7. Fire-and-forget: bust the shop's cached /site catalog so stock
      // badges reflect this purchase before the 5-minute backstop.
      fetch('/api/site-revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId }),
      }).catch(() => {});
    } catch (error) {
      handoff?.close();
      console.error('Checkout Error:', error);
      setFormError(GENERIC_CHECKOUT_FAILURE);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Pre-hydration skeleton ─────────────────────────────────────────────────
  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-10 md:py-16" aria-busy="true" aria-label="Loading your bag">
        <div className={`h-3 w-32 ${styles.skeleton}`} />
        <div className={`mt-4 h-10 w-72 max-w-full ${styles.skeleton}`} />
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className={`h-96 ${styles.skeleton}`} />
          <div className={`h-72 ${styles.skeleton}`} />
        </div>
      </div>
    );
  }

  // ── Confirmation ───────────────────────────────────────────────────────────
  if (success) {
    return (
      <section className="mx-auto w-full max-w-2xl px-5 py-16 md:px-10 md:py-24">
        <div className={styles.card}>
          <div className={styles.successIcon}>
            <CheckCircle2 size={28} strokeWidth={1.75} />
          </div>
          <p className={`mt-6 ${styles.eyebrow}`}>Order #{success.orderRef}</p>
          <h1 className={styles.title}>
            {success.whatsappLink ? 'Your order is on its way' : 'Your order is recorded'}
          </h1>
          <p className={`mt-4 ${styles.body}`}>
            {success.whatsappLink
              ? `WhatsApp opened in a new tab with your order for ${success.shopName}. Send the message to confirm and arrange payment.`
              : `We saved your order, but WhatsApp could not be opened. Please contact ${success.shopName} directly and quote your order reference.`}
          </p>
          {success.priceChanged && (
            <p className={`mt-3 ${styles.body}`}>
              Some prices changed since you added these pieces; the total reflects the shop&rsquo;s current prices.
            </p>
          )}

          <div className={`mt-8 flex items-baseline justify-between border-t pt-6 ${styles.divider}`}>
            <span className={styles.totalLabel}>Total</span>
            <span className={styles.total}>{formatMoney(success.total)}</span>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            {success.whatsappLink && (
              <a href={success.whatsappLink} target="_blank" rel="noopener noreferrer" className={styles.primaryButton}>
                <MessageCircle size={16} /> Open WhatsApp again
              </a>
            )}
            <Link href={continueHref} className={`${styles.link} justify-center`}>
              {continueLabel} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // ── Empty bag / multi-seller picker ────────────────────────────────────────
  if (!group) {
    const pickable = pinnedShop ? [] : groups;
    return (
      <section className="mx-auto w-full max-w-2xl px-5 py-16 md:px-10 md:py-24">
        <p className={styles.eyebrow}>Secure checkout</p>
        {pickable.length > 1 ? (
          <>
            <h1 className={styles.title}>Which boutique first?</h1>
            <p className={`mt-4 ${styles.body}`}>
              Your bag holds pieces from {pickable.length} sellers. Each order is confirmed with its seller on WhatsApp,
              so we check out one boutique at a time.
            </p>
            <ul className="mt-10 space-y-3">
              {pickable.map((g) => (
                <li key={g.shopId}>
                  <button type="button" onClick={() => setSelectedShopId(g.shopId)} className={styles.pickerButton}>
                    <span className="flex min-w-0 items-center gap-3">
                      <Store size={16} className="shrink-0 opacity-60" />
                      <span className="min-w-0">
                        <span className={`block truncate ${styles.lineName}`}>{g.shopName || 'Boutique'}</span>
                        <span className={styles.lineMeta}>
                          {g.items.length} {g.items.length === 1 ? 'piece' : 'pieces'}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className={styles.linePrice}>{formatMoney(g.total)}</span>
                      <ArrowRight size={16} className="opacity-60" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h1 className={styles.title}>
              {pinnedShop ? `Nothing from ${pinnedShop.name} yet` : 'Your bag is empty'}
            </h1>
            <p className={`mt-4 ${styles.body}`}>
              {pinnedShop
                ? 'Add a piece from the collection and it will appear here, ready to send to the boutique.'
                : 'Discover authentic Gambian products and add something you love.'}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <Link href={continueHref} className={inlinePrimary(styles.primaryButton)}>
                {continueLabel} <ArrowRight size={16} />
              </Link>
              {pinnedShop && groups.length > 0 && (
                <Link href="/checkout" className={styles.link}>
                  Check out your other items <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </>
        )}
      </section>
    );
  }

  // ── The checkout ───────────────────────────────────────────────────────────
  const submitLabel = isProcessing ? 'Processing…' : `Send order · ${formatMoney(group.total)}`;

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-5 pb-40 pt-10 md:px-10 md:pt-16 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14 lg:pb-24">
        {/* ── Left: headline + buyer details ─────────────────────────────── */}
        <div className="min-w-0">
          <p className={styles.eyebrow}>Secure checkout</p>
          <h1 className={styles.title}>Complete your order</h1>
          <p className={`mt-4 max-w-xl ${styles.body}`}>
            Your details go straight to {group.shopName || shopName} on WhatsApp. Confirm and pay with the seller —
            nothing is charged here.
          </p>

          <form id={FORM_ID} onSubmit={handleSubmit} noValidate className={`mt-10 ${styles.card}`}>
            <h2 className={styles.cardTitle}>Your details</h2>

            <div className="mt-6 space-y-5">
              <div>
                <label htmlFor="checkout-name" className={styles.label}>Full name</label>
                <div className="relative mt-2">
                  <User size={16} className={styles.inputIcon} />
                  {/* text-base (16px): anything smaller triggers iOS auto-zoom on focus */}
                  <input
                    id="checkout-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Fatou Ceesay"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? 'checkout-name-error' : undefined}
                    className={styles.input}
                  />
                </div>
                {fieldErrors.name && <p id="checkout-name-error" className={styles.fieldError}>{fieldErrors.name}</p>}
              </div>

              <div>
                <label htmlFor="checkout-phone" className={styles.label}>Phone / WhatsApp number</label>
                <div className="relative mt-2">
                  <Phone size={16} className={styles.inputIcon} />
                  <input
                    id="checkout-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+220 …"
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? 'checkout-phone-error' : undefined}
                    className={styles.input}
                  />
                </div>
                {fieldErrors.phone && <p id="checkout-phone-error" className={styles.fieldError}>{fieldErrors.phone}</p>}
              </div>
            </div>

            <h2 className={`mt-10 ${styles.cardTitle}`}>Fulfillment</h2>
            <div className="mt-4 grid grid-cols-2 gap-3" role="group" aria-label="Fulfillment method">
              {canDeliver && (
                <button
                  type="button"
                  aria-pressed={method === 'delivery'}
                  onClick={() => setFulfillmentMethod('delivery')}
                  className={method === 'delivery' ? styles.segmentActive : styles.segment}
                >
                  <Truck size={14} /> Delivery
                </button>
              )}
              {canPickup && (
                <button
                  type="button"
                  aria-pressed={method === 'pickup'}
                  onClick={() => setFulfillmentMethod('pickup')}
                  className={method === 'pickup' ? styles.segmentActive : styles.segment}
                >
                  <MapPin size={14} /> Pickup
                </button>
              )}
            </div>

            {method === 'delivery' ? (
              <div className="mt-5">
                <label htmlFor="checkout-address" className={styles.label}>Delivery address</label>
                <textarea
                  id="checkout-address"
                  name="address"
                  rows={3}
                  autoComplete="street-address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Street, neighborhood, landmarks"
                  aria-invalid={Boolean(fieldErrors.address)}
                  aria-describedby={fieldErrors.address ? 'checkout-address-error' : undefined}
                  className={`mt-2 ${styles.textarea}`}
                />
                {fieldErrors.address && (
                  <p id="checkout-address-error" className={styles.fieldError}>{fieldErrors.address}</p>
                )}
              </div>
            ) : (
              pinnedShop?.pickupInstructions && (
                <p className={`mt-5 ${styles.hint}`}>{pinnedShop.pickupInstructions}</p>
              )
            )}

            {formError && (
              <p role="alert" className={`mt-6 ${styles.alert}`}>
                {formError}
              </p>
            )}
          </form>
        </div>

        {/* ── Right: order summary (sticky on desktop) ───────────────────── */}
        <aside className="mt-10 min-w-0 lg:mt-0 lg:sticky lg:top-8 lg:self-start" aria-label="Order summary">
          <div className={styles.card}>
            <div className={`flex items-center justify-between gap-4 border-b pb-4 ${styles.divider}`}>
              <div className="flex min-w-0 items-center gap-2">
                <Store size={14} className="shrink-0 opacity-60" />
                <h2 className={`truncate ${styles.cardTitle}`}>{group.shopName || shopName}</h2>
              </div>
              <button type="button" onClick={() => setIsCartOpen(true)} className={styles.ghostButton}>
                <PencilLine size={12} /> Edit bag
              </button>
            </div>

            <ul className="mt-5 space-y-5">
              {group.items.map((item) => (
                <li key={item.id} className="flex gap-4">
                  <div className={styles.thumb}>
                    {item.image_url ? (
                      // Seller UGC from arbitrary hosts — same direct render as the drawer.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <div className={styles.thumbEmpty}><ShoppingBag size={16} /></div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`line-clamp-2 ${styles.lineName}`}>{item.name}</p>
                      {hasVariant(item.variant_details) && <p className={styles.lineMeta}>{item.variant_details}</p>}
                      <p className={styles.lineMeta}>
                        {item.quantity} × {formatMoney(item.price)}
                      </p>
                    </div>
                    <p className={`shrink-0 ${styles.linePrice}`}>{formatMoney(item.price * item.quantity)}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className={`mt-6 flex items-baseline justify-between border-t pt-5 ${styles.divider}`}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.total}>{formatMoney(group.total)}</span>
            </div>
            <p className={`mt-2 ${styles.body}`}>Verified against the seller&rsquo;s live prices when you send.</p>

            {/* Desktop submit — the mobile sticky bar carries this below lg. */}
            <button type="submit" form={FORM_ID} disabled={isProcessing} className={`mt-6 hidden lg:flex ${styles.primaryButton}`}>
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {submitLabel}
            </button>

            <p className={`mt-5 flex items-center justify-center gap-2 ${styles.lineMeta}`}>
              <ShieldCheck size={12} /> Secure server-side checkout · Pay on WhatsApp
            </p>

            <div className="mt-5 flex justify-center">
              <Link href={continueHref} className={styles.ghostButton}>
                {continueLabel}
              </Link>
            </div>
          </div>
        </aside>
      </section>

      {/* ── Mobile sticky summary bar ─────────────────────────────────────────
          Fixed to the viewport bottom, safe-area padded so the home indicator
          never covers the button. Submits the SAME form via `form=`. Sits
          below the cart drawer (z-100/110) so "Edit bag" still layers over. */}
      <div className={`fixed inset-x-0 bottom-0 z-[60] pb-[env(safe-area-inset-bottom)] lg:hidden ${styles.stickyBar}`}>
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className={styles.totalLabel}>Total</p>
            <p className={styles.stickyPrice}>{formatMoney(group.total)}</p>
          </div>
          <button type="submit" form={FORM_ID} disabled={isProcessing} className={`${inlinePrimary(styles.primaryButton)} min-w-[11rem] flex-none`}>
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {isProcessing ? 'Processing…' : 'Send order'}
          </button>
        </div>
      </div>
    </>
  );
}
