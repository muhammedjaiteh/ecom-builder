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

  let message = `👋 Hello ${shopName || 'Seller'}! \n\nI want to buy: *${productName}* \n💰 Price: D${price}`;

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
