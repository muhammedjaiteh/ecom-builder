'use client';

import { useSyncExternalStore } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// purchaseMemory — local DEVICE recognition of what this buyer has ordered.
//
// Buyers are not auth users (checkout is a WhatsApp handoff), so the only
// buyer identity a PDP can see is the device itself. Every successful order
// handoff (cart checkout + single-product "Order via WhatsApp") appends the
// product ids to `sanndikaa_purchases`; the PDP unlocks "Write a Review" for
// products found there. Safe under SSR, private mode and full storage: every
// access is try/caught and the list is bounded.
// ─────────────────────────────────────────────────────────────────────────────

export const PURCHASES_STORAGE_KEY = 'sanndikaa_purchases';
const MAX_REMEMBERED = 200;
const CHANGE_EVENT = 'sanndikaa:purchases';

export function readPurchases(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PURCHASES_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Append product ids (deduped, most recent last, bounded). Never throws. */
export function rememberPurchases(productIds: string[]): void {
  if (typeof window === 'undefined') return;
  const fresh = productIds.filter((id) => typeof id === 'string' && id.length > 0);
  if (fresh.length === 0) return;
  try {
    const next = [...readPurchases().filter((id) => !fresh.includes(id)), ...fresh].slice(-MAX_REMEMBERED);
    window.localStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Quota / private mode — recognition is a convenience, never a blocker.
  }
}

export function hasPurchased(productId: string): boolean {
  return readPurchases().includes(productId);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** True once this device is known to have ordered `productId`. Hydration-safe:
 *  the server snapshot is always false, so the form appears post-mount. */
export function usePurchasedProduct(productId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hasPurchased(productId),
    () => false
  );
}
