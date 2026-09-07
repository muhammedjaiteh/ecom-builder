'use client';

import { createBrowserClient } from '@supabase/ssr';
import useSWR, { type KeyedMutator } from 'swr';
import type { Order } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// useOrders — THE seller-orders seam, the orders twin of lib/useShopRow.ts.
//
// THE BUG THIS KILLS: the command center (/dashboard) and /dashboard/orders
// each fired their own bare `.from('orders').select(...)` on mount into a
// private useState, and OrderActions had to prop-drill a `applyStatus`
// setState callback back up into whichever page mounted it. Two caches, zero
// invalidation — a Mark-Paid on one surface never reached the other (or the
// revenue metrics) until a full reload.
//
// Now every surface consumes ONE key:
//   - key:      ordersKey(shopId) — shop id embedded (shared-phone law, same
//               as shopRowKey / websiteContentKey) so an account switch can
//               never paint another seller's orders, even under the
//               per-user persisted SWR provider the dashboard layout mounts.
//   - fetcher:  @supabase/ssr browser client — the cookie-backed session the
//               whole app authenticates with, so the read lands inside
//               RLS_PRODUCTS_ORDERS_SHOPS.sql "orders_owner_read"
//               (SELECT TO authenticated USING shop_id = auth.uid()).
//               THROWS on error so SWR's retry/backoff owns transient
//               failures; a definitive empty result is an honest [].
//   - shape:    the exact relational join both pages already rendered —
//               orders → customers (many-to-one) → order_items → products —
//               so lib/orderMetrics and the Cancel & Restock loop keep their
//               inputs unchanged.
//   - writes:   every orders WRITE (OrderActions' Mark Paid / Undo / Cancel)
//               pushes its status through the hook's bound `mutate`, so list,
//               filter counts, and revenue tiles update in the same frame.
// ─────────────────────────────────────────────────────────────────────────────

export const ordersKey = (shopId: string) => `orders:${shopId}`;

/** The one relational select for a seller's orders. `shop_id` and the
 *  nested ids are included so the rows satisfy lib/types Order outright. */
export const ORDERS_SELECT = [
  'id',
  'shop_id',
  'total_amount',
  'status',
  'fulfillment_method',
  'created_at',
  'customers ( name, phone_number, location )',
  'order_items ( id, quantity, product_id, price_at_time, variant_details, products ( id, name, image_url ) )',
].join(', ');

export async function fetchOrders(shopId: string): Promise<Order[]> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabase
    .from('orders')
    .select(ORDERS_SELECT)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`orders read failed: ${error.message}`);
  return (data as unknown as Order[] | null) ?? [];
}

/** Pure cache patch: the given order with a new status, every other row
 *  untouched (referentially — memoised consumers only re-render for the
 *  changed row). Returns `undefined` unchanged when the cache has no rows
 *  yet, so a caller can tell "nothing to patch" from "patched". */
export function patchOrderStatus(
  orders: Order[] | undefined,
  orderId: string,
  status: Order['status']
): Order[] | undefined {
  if (!orders) return orders;
  return orders.map((o) => (o.id === orderId ? { ...o, status } : o));
}

export type UseOrdersResult = {
  /** The seller's orders, newest first. `[]` while there is no verdict yet —
   *  gate on `isLoading` (and on the caller's own auth resolution) before
   *  painting an empty state. */
  orders: Order[];
  /** True while the first fetch is in flight with nothing from cache or
   *  network yet. False when the key is inactive (shopId undefined) — the
   *  caller owns "auth not resolved yet". */
  isLoading: boolean;
  /** True when the latest fetch failed (SWR keeps retrying in the background). */
  isError: boolean;
  /** Bound mutate — writers push their status changes through this so every
   *  consumer of ordersKey(shopId) updates instantly. */
  mutate: KeyedMutator<Order[]>;
};

export function useOrders(shopId: string | undefined): UseOrdersResult {
  const { data, error, isLoading, mutate } = useSWR<Order[]>(
    shopId ? ordersKey(shopId) : null,
    () => fetchOrders(shopId as string),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  return {
    orders: data ?? [],
    isLoading,
    isError: error !== undefined,
    mutate,
  };
}
