import type { SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared order-flow business logic — the ONE implementation of the platform's
// buyer → seller mechanics, consumed by every checkout surface:
//   - app/product/[id]/ProductClient.tsx          (marketplace PDP direct order)
//   - components/CheckoutForm.tsx                  (cart checkout: /checkout + /site/[slug]/checkout)
//   - app/site/[slug]/products/[id]/SiteProductPurchase.tsx (premium site PDP)
// Extracted (not forked) from the marketplace PDP and cart so the generated
// /site storefronts run the exact same lead capture + WhatsApp handoff.
// ─────────────────────────────────────────────────────────────────────────────

/** Platform fallback when a seller has not linked a WhatsApp number. */
export const DEFAULT_ORDER_PHONE = '2207470187';

/**
 * Normalize a stored phone into wa.me-safe digits. Strips every non-digit
 * (spaces, "+", dashes) and auto-prefixes bare 7-digit Gambian numbers with
 * the 220 country code. Returns null when nothing usable remains.
 */
export function sanitizePhoneNumber(rawNumber?: string | null): string | null {
  if (!rawNumber) return null;
  let cleanNumber = rawNumber.replace(/\D/g, '');
  if (!cleanNumber) return null;
  // If it's a 7-digit Gambian number, add the 220 country code automatically
  if (cleanNumber.length === 7) cleanNumber = `220${cleanNumber}`;
  return cleanNumber;
}

/**
 * Canonical MATCHING key for a phone number — the one phone brain shared by
 * checkout (which stores customers.phone_number RAW) and the review
 * verification route (which must match a buyer's re-typed number against it).
 * Builds on sanitizePhoneNumber (digits only, bare 7-digit Gambian numbers
 * gain the 220 prefix), then strips the 220 country code back OFF so
 * '+220 747 0187', '2207470187' and '7470187' all collapse to the same
 * 7-digit local key. Non-Gambian numbers keep their full digit string.
 * Returns null when nothing usable remains.
 */
export function canonicalPhoneKey(rawNumber?: string | null): string | null {
  const clean = sanitizePhoneNumber(rawNumber);
  if (!clean) return null;
  if (clean.length === 10 && clean.startsWith('220')) return clean.slice(3);
  return clean;
}

/**
 * WhatsApp deep link with the message pre-filled, or null if the number is
 * unusable.
 *
 * iOS gets the native `whatsapp://send` URI instead of https://wa.me. Safari
 * only lets a Universal Link open the app from a live user gesture, and the
 * checkout's awaited /api/checkout round-trip spends that gesture before we
 * navigate, so the https form silently degrades to WhatsApp's desktop web
 * fallback. The custom scheme needs no gesture and launches the app directly.
 * iPadOS 13+ masquerades as a Mac, hence the MacIntel + touch-points check.
 * Android (App Links) and desktop keep the https://wa.me form. During SSR
 * there is no window, so the server always renders the https form.
 */
export function buildWhatsAppLink(number: string | null | undefined, message: string): string | null {
  const cleanNumber = sanitizePhoneNumber(number);
  if (!cleanNumber) return null;
  const encodedText = encodeURIComponent(message);
  const isIOS =
    typeof window !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  if (isIOS) {
    return `whatsapp://send?phone=${cleanNumber}&text=${encodedText}`;
  }
  return `https://wa.me/${cleanNumber}?text=${encodedText}`;
}

export type DirectOrderMethod = 'Cash' | 'Wave';
export type FulfillmentKind = 'delivery' | 'pickup';

/**
 * The payment-method footer EVERY WhatsApp order carries — the single-product
 * direct order and the cart receipt share this one implementation, so the
 * seller reads identical lines whichever surface the buyer used. `fulfillment`
 * only reshapes the Cash line (a pickup buyer does not "pay when you deliver");
 * the default keeps the PDP output byte-identical to its historical message.
 */
export function buildPaymentMethodLines(
  method: DirectOrderMethod,
  sellerPhone: string,
  fulfillment: FulfillmentKind = 'delivery'
): string {
  if (method === 'Wave') {
    return `💳 Payment Method: *Wave / Sadam* \n✅ I have copied your number (${sellerPhone}) and I am sending the money now. \n\nPlease confirm receipt.`;
  }
  if (fulfillment === 'pickup') {
    return `💵 Payment Method: *Cash on Pickup* \n📍 I will pay when I collect the order.`;
  }
  return `💵 Payment Method: *Cash on Delivery* \n📍 I will pay when you deliver.`;
}

/**
 * The direct-order WhatsApp message, exactly as the marketplace PDP has always
 * sent it. `variant` and `quantity` are additive: when omitted (or quantity 1)
 * the output is byte-identical to the legacy marketplace message.
 */
export function buildDirectOrderMessage(opts: {
  shopName: string | null | undefined;
  productName: string;
  price: number | null | undefined;
  method: DirectOrderMethod;
  sellerPhone: string;
  quantity?: number;
  variant?: string | null;
}): string {
  const { shopName, productName, price, method, sellerPhone, quantity, variant } = opts;

  // Null-safe money line: a priceless product must never read "Price: Dnull",
  // and real amounts always carry thousands separators (D12,500 not D12500).
  const priceLine = price == null
    ? '💰 Price on request'
    : `💰 Price: D${Number(price).toLocaleString()}`;

  let message = `👋 Hello ${shopName || 'Seller'}! \n\nI want to buy: *${productName}* \n${priceLine}`;

  if (variant && variant !== 'None') {
    message += ` \n🎨 Options: ${variant}`;
  }
  if (quantity != null && quantity > 1) {
    message += ` \n🔢 Quantity: ${quantity}`;
    if (price != null) {
      message += ` — Total: D${(Number(price) * quantity).toLocaleString()}`;
    }
  }

  message += `\n\n${buildPaymentMethodLines(method, sellerPhone)}`;

  return message;
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp handoff (client-only) — SAME-TAB navigation, on purpose.
//
// window.open(url, '_blank') / target="_blank" strands mobile buyers on
// api.whatsapp.com inside a Chrome Custom Tab or an in-app browser (Instagram,
// Facebook) instead of launching WhatsApp. A top-level navigation of the
// current tab to https://wa.me/… is what Android App Links intercept, so the
// OS opens the WhatsApp app directly and the page stays put; without the app
// installed the tab falls through to WhatsApp's web page. On iOS
// buildWhatsAppLink() hands us a whatsapp:// URI instead, because Safari only
// honours the wa.me Universal Link from a live user gesture (see its docblock).
// Same-tab navigation also needs no user activation, so it is
// popup-block-proof even after the cart's awaited /api/checkout round-trip.
// Callers MUST commit any state they need persisted (bag, receipt) BEFORE
// calling this — the tab may leave.
// ─────────────────────────────────────────────────────────────────────────────

/** Hand the buyer to WhatsApp via the current tab. `url` is a buildWhatsAppLink() result. */
export function launchWhatsApp(url: string): void {
  window.location.href = url;
}

/**
 * Fire-and-forget lead capture (the marketplace PDP contract): one row per
 * order intent so the seller's CRM sees the buyer even if WhatsApp is
 * abandoned. Never blocks the buyer — failures are logged, not surfaced.
 */
export function recordLead(
  supabase: SupabaseClient,
  lead: {
    sellerId: string | null | undefined;
    productId: string;
    productName: string;
    productPrice: number | null;
  }
): void {
  if (!lead.sellerId) return;
  supabase
    .from('leads')
    .insert({
      seller_id: lead.sellerId,
      product_id: lead.productId,
      product_name: lead.productName,
      product_price: lead.productPrice,
      created_at: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) console.error('[leads] insert failed:', error.message);
    });
}
