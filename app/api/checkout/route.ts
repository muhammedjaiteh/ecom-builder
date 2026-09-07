/**
 * POST /api/checkout — server-authoritative order placement.
 *
 * Why this exists: the original checkout ran entirely in the browser with the
 * anon key, and the ORDER TOTAL plus every line's `price_at_time` came from the
 * client's cart state. Anyone could edit the payload and buy a D5,000 item for
 * D1. This route closes that hole:
 *
 *   1. The client sends ONLY identities + quantities (product ids, qty, variant
 *      text, customer details). Any price it sends is ignored for money and is
 *      used solely to flag "prices changed since you added this".
 *   2. Every line is re-priced from `products.price` with the service-role key,
 *      and each product is verified to belong to the shop being checked out.
 *   3. Stock is reserved FIRST through the atomic `decrement_stock` RPC so an
 *      oversell is caught before any customer/order rows exist; on any later
 *      failure the reserved units are re-credited via `increment_stock`.
 *   4. customers → orders (verified total) → order_items (verified prices) are
 *      written server-side; an order_items failure best-effort deletes the
 *      orphaned order row.
 *
 * The service-role key NEVER leaves this process: it is read from
 * SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix) and the client is built
 * per request with session persistence disabled.
 */

import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Payload contract ────────────────────────────────────────────────────────

type FulfillmentMethod = 'delivery' | 'pickup';

interface CheckoutLineInput {
  productId: string;
  quantity: number;
  variantDetails: string | null;
}

interface CheckoutPayload {
  shopId: string;
  customer: { name: string; phone: string };
  fulfillmentMethod: FulfillmentMethod;
  deliveryAddress?: string;
  items: CheckoutLineInput[];
  /** What the client displayed. Never trusted for money; only used to flag drift. */
  expectedTotal?: number;
}

interface PricedLine {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  variantDetails: string | null;
}

interface ProductRow {
  id: string | number;
  name: string | null;
  price: number | string | null;
  shop_id: string | number | null;
}

type StockLine = { productId: string; quantity: number };

const MAX_LINES = 50;
const MAX_QTY_PER_LINE = 999;
const MAX_ID_LEN = 64;
const MAX_NAME_LEN = 120;
const MAX_PHONE_LEN = 32;
const MAX_ADDRESS_LEN = 500;
const MAX_VARIANT_LEN = 300;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cleanString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > max) return null;
  return s;
}

/** Two-decimal money rounding (GMD). Avoids 0.1 + 0.2 float artefacts in totals. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Coerce a DB price (numeric may arrive as string) into a validated money value. */
function toMoney(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return round2(n);
}

/** Human-friendly receipt reference derived from the order id — reproducible, no extra column. */
function toOrderRef(orderId: string): string {
  return orderId.replace(/-/g, '').slice(-6).toUpperCase().padStart(6, '0');
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function parsePayload(raw: unknown): ParseResult<CheckoutPayload> {
  if (!isRecord(raw)) return { ok: false, error: 'Request body must be a JSON object.' };

  const shopId = cleanString(raw.shopId, MAX_ID_LEN);
  if (!shopId) return { ok: false, error: 'shopId is required.' };

  if (!isRecord(raw.customer)) return { ok: false, error: 'customer is required.' };
  const name = cleanString(raw.customer.name, MAX_NAME_LEN);
  const phone = cleanString(raw.customer.phone, MAX_PHONE_LEN);
  if (!name || !phone) return { ok: false, error: 'Customer name and phone are required.' };

  const fulfillmentMethod = raw.fulfillmentMethod;
  if (fulfillmentMethod !== 'delivery' && fulfillmentMethod !== 'pickup') {
    return { ok: false, error: 'fulfillmentMethod must be "delivery" or "pickup".' };
  }

  let deliveryAddress: string | undefined;
  if (fulfillmentMethod === 'delivery') {
    const addr = cleanString(raw.deliveryAddress, MAX_ADDRESS_LEN);
    if (!addr) return { ok: false, error: 'A delivery address is required for delivery orders.' };
    deliveryAddress = addr;
  }

  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    return { ok: false, error: 'At least one item is required.' };
  }
  if (raw.items.length > MAX_LINES) {
    return { ok: false, error: `A single order may contain at most ${MAX_LINES} lines.` };
  }

  const items: CheckoutLineInput[] = [];
  for (const entry of raw.items) {
    if (!isRecord(entry)) return { ok: false, error: 'Each item must be an object.' };

    const productId = cleanString(entry.productId, MAX_ID_LEN);
    if (!productId) return { ok: false, error: 'Each item needs a productId.' };

    const quantity = entry.quantity;
    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QTY_PER_LINE
    ) {
      return { ok: false, error: `Item quantities must be whole numbers between 1 and ${MAX_QTY_PER_LINE}.` };
    }

    let variantDetails: string | null = null;
    if (entry.variantDetails !== undefined && entry.variantDetails !== null) {
      if (typeof entry.variantDetails !== 'string' || entry.variantDetails.length > MAX_VARIANT_LEN) {
        return { ok: false, error: 'variantDetails must be a short string.' };
      }
      variantDetails = entry.variantDetails.trim() || null;
    }

    items.push({ productId, quantity, variantDetails });
  }

  let expectedTotal: number | undefined;
  if (typeof raw.expectedTotal === 'number' && Number.isFinite(raw.expectedTotal)) {
    expectedTotal = raw.expectedTotal;
  }

  return {
    ok: true,
    value: { shopId, customer: { name, phone }, fulfillmentMethod, deliveryAddress, items, expectedTotal },
  };
}

function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Compensation for the stock-first flow: re-credit units already deducted when
 * a later step fails. Best-effort — a failed compensation is logged for the
 * seller-support trail; the buyer already receives one honest error.
 */
async function releaseStock(supabase: SupabaseClient, deducted: StockLine[]) {
  for (const { productId, quantity } of deducted) {
    const { error } = await supabase.rpc('increment_stock', {
      product_id_param: productId,
      quantity_param: quantity,
    });
    if (error) {
      console.error(`[api/checkout] stock compensation failed for product ${productId}:`, error.message);
    }
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body.' });
  }

  const parsed = parsePayload(raw);
  if (!parsed.ok) return json(400, { ok: false, error: parsed.error });
  const payload = parsed.value;

  const supabase = createServiceClient();
  if (!supabase) {
    console.error('[api/checkout] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.');
    return json(503, { ok: false, error: 'Checkout is temporarily unavailable. Please try again shortly.' });
  }

  // 1. RE-PRICE FROM THE SOURCE OF TRUTH. Client prices are never read here.
  const productIds = Array.from(new Set(payload.items.map((i) => i.productId)));
  const { data: productRows, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, shop_id')
    .in('id', productIds);

  if (productsError || !productRows) {
    console.error('[api/checkout] product lookup failed:', productsError?.message);
    return json(503, { ok: false, error: 'Unable to verify your items right now. Please try again.' });
  }

  const productsById = new Map<string, ProductRow>();
  for (const row of productRows as ProductRow[]) productsById.set(String(row.id), row);

  const lines: PricedLine[] = [];
  for (const item of payload.items) {
    const product = productsById.get(item.productId);

    // Unknown id, or a product that belongs to a different shop than the one
    // being checked out (cross-shop payload poisoning) — both are rejected.
    if (!product || String(product.shop_id ?? '') !== payload.shopId) {
      return json(409, {
        ok: false,
        code: 'ITEM_UNAVAILABLE',
        error: 'One or more items in your bag are no longer available from this shop.',
        productId: item.productId,
      });
    }

    const unitPrice = toMoney(product.price);
    if (unitPrice === null) {
      console.error(`[api/checkout] product ${item.productId} has an invalid price:`, product.price);
      return json(409, {
        ok: false,
        code: 'ITEM_UNAVAILABLE',
        error: `"${product.name ?? 'An item'}" cannot be purchased right now.`,
        productId: item.productId,
      });
    }

    lines.push({
      productId: item.productId,
      name: product.name ?? 'Item',
      quantity: item.quantity,
      unitPrice,
      lineTotal: round2(unitPrice * item.quantity),
      variantDetails: item.variantDetails,
    });
  }

  const total = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const priceChanged =
    typeof payload.expectedTotal === 'number' && round2(payload.expectedTotal) !== total;

  // 2. INVENTORY FIRST (atomic, honest). Quantities are aggregated per product
  // so two cart lines of the same product (different variants) are checked
  // against stock as one demand. decrement_stock returns false when remaining
  // stock cannot cover the request; on rejection, re-credit what this checkout
  // already deducted and fail with the real reason.
  const demandByProduct = new Map<string, number>();
  for (const l of lines) demandByProduct.set(l.productId, (demandByProduct.get(l.productId) ?? 0) + l.quantity);

  const deducted: StockLine[] = [];
  for (const [productId, quantity] of demandByProduct) {
    const { data: stockOk, error: stockError } = await supabase.rpc('decrement_stock', {
      product_id_param: productId,
      quantity_param: quantity,
    });

    if (stockError || stockOk === false) {
      await releaseStock(supabase, deducted);
      if (stockError) {
        console.error(`[api/checkout] decrement_stock failed for product ${productId}:`, stockError.message);
        return json(503, { ok: false, error: 'Unable to reserve your items right now. Please try again.' });
      }
      const name = productsById.get(productId)?.name ?? 'An item';
      return json(409, {
        ok: false,
        code: 'OUT_OF_STOCK',
        error: `Stock changed while you were checking out: "${name}" no longer has ${quantity} unit${quantity > 1 ? 's' : ''} available. Please adjust the quantity and try again.`,
        productId,
      });
    }
    deducted.push({ productId, quantity });
  }

  // 3. STRICT DATABASE WRITES with the VERIFIED total and VERIFIED unit prices.
  // Any failure re-credits the reserved stock and surfaces an honest error.
  let orderId: string | null = null;
  try {
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        name: payload.customer.name,
        phone_number: payload.customer.phone,
        location: payload.fulfillmentMethod === 'delivery' ? payload.deliveryAddress : 'Pickup',
      })
      .select('id')
      .single();

    if (customerError || !customer) {
      throw new Error(`customers insert failed: ${customerError?.message ?? 'no row returned'}`);
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        shop_id: payload.shopId,
        customer_id: customer.id,
        total_amount: total,
        fulfillment_method: payload.fulfillmentMethod,
        status: 'pending',
      })
      .select('id')
      .single();

    if (orderError || !order) {
      throw new Error(`orders insert failed: ${orderError?.message ?? 'no row returned'}`);
    }
    orderId = String(order.id);

    const { error: itemsError } = await supabase.from('order_items').insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.productId,
        quantity: l.quantity,
        price_at_time: l.unitPrice,
        variant_details: l.variantDetails,
      }))
    );

    if (itemsError) {
      throw new Error(`order_items insert failed: ${itemsError.message}`);
    }
  } catch (writeError) {
    console.error('[api/checkout] order write failed:', writeError);

    // Best-effort: never leave a priced order row with no lines behind.
    if (orderId) {
      const { error: cleanupError } = await supabase.from('orders').delete().eq('id', orderId);
      if (cleanupError) {
        console.error(`[api/checkout] orphan order cleanup failed for ${orderId}:`, cleanupError.message);
      }
    }
    await releaseStock(supabase, deducted);

    return json(500, {
      ok: false,
      error: 'Unable to process checkout right now. Your order was not sent. Please try again.',
    });
  }

  // 4. SUCCESS — return everything the client needs to build the WhatsApp
  // receipt from SERVER-VERIFIED numbers, never from its own cart state.
  return json(200, {
    ok: true,
    orderId,
    orderRef: toOrderRef(orderId as string),
    currency: 'GMD',
    total,
    priceChanged,
    lines,
  });
}
