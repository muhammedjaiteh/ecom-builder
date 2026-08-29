'use client';

import { createBrowserClient } from '@supabase/ssr';
import useSWR, { type KeyedMutator } from 'swr';
import type { Shop } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// useShopRow — THE shops-row seam (A3), mirroring the website-row seam
// (websiteContentKey + the per-user persisted SWR provider) exactly.
//
// THE BUG THIS KILLS: ~8 dashboard surfaces each fired their own bare
// `.from('shops').select(...).eq('id', user.id)` on mount — two reads per
// route visit (layout + page), zero cache, zero invalidation, so a brand save
// on Themes never reached the sidebar or the studio until a full reload.
//
// Now every surface consumes ONE key:
//   - key:      shopRowKey(userId) — user id embedded (shared-phone law, same
//               as websiteContentKey) so an account switch can never paint
//               another account's row.
//   - provider: the dashboard layout mounts createPersistedSwrProvider(userId)
//               around every dashboard page, so this row paints instantly
//               from localStorage and revalidates in the background.
//   - fetcher:  browser anon client — shops public-read RLS is live-proven
//               (RLS_PRODUCTS_ORDERS_SHOPS.sql; the marketplace reads the
//               same table anonymously). THROWS on error so SWR's retry/
//               backoff owns transient failures; a definitive zero-row result
//               is an honest `null` (the orphan-heal trigger).
//   - writes:   every shops-row WRITE (themes brand save today) pushes the
//               merged row through the hook's bound `mutate` — sidebar,
//               studio identity, and storefront links update instantly.
// ─────────────────────────────────────────────────────────────────────────────

export const shopRowKey = (userId: string) => `shop-row:${userId}`;

/** The full shops row (select *). lib/types Shop plus the columns dashboard
 *  surfaces read that the shared type doesn't carry yet. */
export type ShopRow = Shop & {
  phone?: string | null;
  status?: string | null;
  created_at?: string;
};

async function fetchShopRow(userId: string): Promise<ShopRow | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`shops row read failed: ${error.message}`);
  return (data as ShopRow | null) ?? null;
}

export type UseShopRowResult = {
  /** The row, or null (definitive miss OR no verdict yet — check `verdict`). */
  shop: ShopRow | null;
  /** Raw SWR data: undefined = no verdict yet (neither cache nor network);
   *  null = the DB definitively has no row (the orphan-heal case). */
  verdict: ShopRow | null | undefined;
  error: unknown;
  /** True only while a verdict is still possible: key active, nothing from
   *  cache or network yet, and no terminal error. */
  loading: boolean;
  /** Bound mutate — writers push their merged row through this so every
   *  consumer of shopRowKey(userId) updates instantly. */
  mutate: KeyedMutator<ShopRow | null>;
};

export function useShopRow(userId: string | null): UseShopRowResult {
  const { data, error, mutate } = useSWR<ShopRow | null>(
    userId ? shopRowKey(userId) : null,
    () => fetchShopRow(userId as string),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  return {
    shop: data ?? null,
    verdict: data,
    error,
    loading: userId !== null && data === undefined && error === undefined,
    mutate,
  };
}
