import type { SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared order-flow business logic — the ONE implementation of the platform's
// buyer → seller mechanics, consumed by every checkout surface:
//   - app/product/[id]/ProductClient.tsx          (marketplace PDP direct order)
//   - components/Cart.tsx                          (cart drawer checkout)
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

/** wa.me deep link with the message pre-filled, or null if the number is unusable. */
export function buildWhatsAppLink(number: string | null | undefined, message: string): string | null {
  const cleanNumber = sanitizePhoneNumber(number);
  if (!cleanNumber) return null;
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}

export type DirectOrderMethod = 'Cash' | 'Wave';

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

  if (method === 'Wave') {
    message += `\n\n💳 Payment Method: *Wave / Sadam* \n✅ I have copied your number (${sellerPhone}) and I am sending the money now. \n\nPlease confirm receipt.`;
  } else {
    message += `\n\n💵 Payment Method: *Cash on Delivery* \n📍 I will pay when you deliver.`;
  }

  return message;
}

// ─────────────────────────────────────────────────────────────────────────────
// Popup-safe WhatsApp handoff (client-only).
//
// The cart checkout awaits several database writes BEFORE opening WhatsApp.
// On slow networks the browser's transient user activation expires during
// those awaits, so a later window.open() is popup-blocked — the order row
// exists but the buyer never reaches the seller. The fix: open the window
// SYNCHRONOUSLY inside the click handler (while activation is alive) with a
// tiny branded interstitial, run the writes, then point the already-open
// window at wa.me. On failure the tab closes and the caller shows an honest
// error. If even the synchronous open is blocked (some in-app webviews),
// navigate() falls back to a same-tab redirect — same-tab navigation never
// needs activation.
// ─────────────────────────────────────────────────────────────────────────────

export type OrderHandoff = {
  /** Point the handoff window (or, as a fallback, the current tab) at the wa.me link. */
  navigate: (url: string) => void;
  /** Abort: close the interstitial tab after a failed write. */
  close: () => void;
};

const HANDOFF_INTERSTITIAL = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preparing your order… · Sanndikaa</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1a2e1a;color:#F9F8F6;font-family:Georgia,'Times New Roman',serif;text-align:center}
  .card{padding:32px}
  .ring{width:44px;height:44px;margin:0 auto 20px;border-radius:50%;border:3px solid rgba(249,248,246,.2);border-top-color:#F9F8F6;animation:spin 0.9s linear infinite}
  h1{font-size:20px;font-weight:600;margin:0 0 8px;letter-spacing:.02em}
  p{font-size:13px;margin:0;color:rgba(249,248,246,.65);font-family:-apple-system,'Segoe UI',sans-serif}
  .brand{margin-top:28px;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:rgba(249,248,246,.4);font-family:-apple-system,'Segoe UI',sans-serif}
  @keyframes spin{to{transform:rotate(360deg)}}
</style></head>
<body><div class="card"><div class="ring"></div><h1>Preparing your order…</h1><p>You&rsquo;ll be taken to WhatsApp in a moment.</p><div class="brand">Sanndikaa Secure</div></div></body></html>`;

/**
 * MUST be called synchronously inside the click handler, BEFORE any await.
 * Returns a handle whose navigate/close are safe to call after async work.
 */
export function openOrderHandoff(): OrderHandoff {
  let win: Window | null = null;
  try {
    win = window.open('about:blank', '_blank');
    if (win) {
      win.document.write(HANDOFF_INTERSTITIAL);
      win.document.close();
    }
  } catch {
    win = null;
  }

  return {
    navigate: (url: string) => {
      if (win && !win.closed) {
        win.location.href = url;
        win.focus();
      } else {
        // Popup denied even synchronously (strict in-app webviews): same-tab
        // navigation needs no user activation and still reaches WhatsApp.
        window.location.href = url;
      }
    },
    close: () => {
      try {
        win?.close();
      } catch {
        // Already closed / cross-origin — nothing to clean up.
      }
    },
  };
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
