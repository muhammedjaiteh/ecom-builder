import { NextResponse, type NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/cancel { orderId } — the seller's Cancel & Restock,
// server-authoritative.
//
// WHY: sql/iron-dome-security.sql (P0-1) makes increment_stock /
// decrement_stock EXECUTE-able by service_role ONLY. The browser-side call in
// components/orders/OrderActions.tsx let any signed-in account inflate ANY
// shop's stock by product id. The restock now runs here, after ownership and
// the race guard are proven, with the service role:
//   1. Bearer access token → user (same pattern as PATCH /api/orders).
//   2. orders.shop_id = user.id, else 403. Status must be 'pending', else
//      409 RACED (paid or cancelled elsewhere — restocking would corrupt stock).
//   3. Guarded UPDATE … WHERE status = 'pending' RETURNING id. Zero rows = a
//      concurrent actor won → 409 RACED, nothing restocked. This single
//      transition is what makes the restock replay-safe with no new column.
//   4. increment_stock per order_item. Per-item failures are tolerated and
//      reported honestly: { restocked, lines } — the client renders
//      "X of Y items restocked" exactly as before.
// ─────────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RACED_MESSAGE = 'This order was already updated somewhere else — no stock was changed.';

type CancelResponse = {
  ok: true;
  status: 'cancelled';
  /** order_items rows on the order (restock candidates). */
  lines: number;
  /** Lines whose stock was re-credited (untracked NULL stock counts as ok). */
  restocked: number;
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return json(401, { ok: false, error: 'Sign in to cancel orders.' });

  const body = (await request.json().catch(() => null)) as { orderId?: unknown } | null;
  const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
  if (!UUID_RE.test(orderId)) return json(400, { ok: false, error: 'A valid orderId is required.' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createServiceClient();
  if (!url || !anonKey || !supabase) {
    console.error('[api/orders/cancel] Supabase env is not configured.');
    return json(503, { ok: false, error: 'Order actions are temporarily unavailable. Please try again shortly.' });
  }

  // 1. Who is asking — the token is verified against Supabase Auth, never trusted raw.
  const verifyClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: authError } = await verifyClient.auth.getUser(token);
  if (authError || !user) return json(401, { ok: false, error: 'Your session has expired. Sign in again.' });

  // 2. Ownership + precondition.
  const { data: order, error: readError } = await supabase
    .from('orders')
    .select('id, shop_id, status')
    .eq('id', orderId)
    .maybeSingle();
  if (readError) {
    console.error('[api/orders/cancel] order read failed:', readError.message);
    return json(500, { ok: false, error: 'Could not load this order. Please try again.' });
  }
  if (!order) return json(404, { ok: false, error: 'Order not found.' });
  if (String(order.shop_id) !== user.id) return json(403, { ok: false, error: 'You can only cancel your own orders.' });
  if (order.status !== 'pending') return json(409, { ok: false, code: 'RACED', error: RACED_MESSAGE });

  // 3. The guarded transition — the one write that authorises a restock.
  const { data: flipped, error: updateError } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .eq('shop_id', user.id)
    .eq('status', 'pending')
    .select('id');
  if (updateError) {
    console.error('[api/orders/cancel] cancel update failed:', updateError.message);
    return json(500, { ok: false, error: 'Could not cancel this order — nothing was changed.' });
  }
  if (!flipped || flipped.length === 0) return json(409, { ok: false, code: 'RACED', error: RACED_MESSAGE });

  // 4. Restock per line. Lines whose product row is gone cannot be restocked;
  //    the RPC no-ops NULL stock_quantity (untracked inventory) and re-credits
  //    tracked stock atomically.
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', orderId);
  if (itemsError) {
    // The order IS cancelled; only the restock could not run. Say so.
    console.error('[api/orders/cancel] order_items read failed:', itemsError.message);
    const res: CancelResponse = { ok: true, status: 'cancelled', lines: -1, restocked: 0 };
    return json(200, res);
  }

  const lines = items ?? [];
  let restocked = 0;
  for (const item of lines) {
    const quantity = Number(item.quantity);
    if (!item.product_id || !(quantity > 0)) continue;
    const { data: ok, error: rpcError } = await supabase.rpc('increment_stock', {
      product_id_param: item.product_id,
      quantity_param: quantity,
    });
    if (!rpcError && ok !== false) restocked += 1;
    else console.error(`[api/orders/cancel] restock failed for product ${item.product_id}:`, rpcError?.message ?? 'product not found');
  }

  const res: CancelResponse = { ok: true, status: 'cancelled', lines: lines.length, restocked };
  return json(200, res);
}
