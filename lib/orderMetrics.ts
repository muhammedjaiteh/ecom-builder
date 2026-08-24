// ─────────────────────────────────────────────────────────────────────────────
// Order money + status vocabulary — the ONE implementation shared by the
// command center, /dashboard/orders, /dashboard/analytics, and the shared
// AnalyticsDashboard component.
//
// STATUS VOCABULARY (sql/analytics.sql header is the canonical doc — no
// renames, zero-migration):
//   'pending'   → recorded at checkout, buyer handed to WhatsApp, unpaid.
//   'completed' → the terminal PAID state. Existing rows/flows already mean
//                 it; the UI labels it 'Paid'.
//   'cancelled' → the terminal FLAKE state (seller-cancelled, stock restored).
//   Legacy 'new' / 'processing' / 'shipped' rows remain renderable.
// ─────────────────────────────────────────────────────────────────────────────

/** UI labels for the raw status vocabulary — 'completed' reads 'Paid'. */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  completed: 'Paid',
  cancelled: 'Cancelled',
  new: 'New',
  processing: 'Processing',
  shipped: 'Shipped',
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

type OrderTotalCarrier = {
  total_amount?: number | null;
  order_items?: { quantity: number; price_at_time?: number | null }[] | null;
};

/**
 * The honest order total. Prefers the stored orders.total_amount (written by
 * Cart.tsx on every current checkout, backfilled for legacy rows by
 * sql/analytics.sql); for any pre-backfill row still carrying NULL, computes
 * the same figure client-side from order_items (qty × price_at_time — the
 * prices frozen at checkout). An order with neither yields 0, never NaN.
 */
export function orderTotal(order: OrderTotalCarrier): number {
  if (order.total_amount != null) {
    const direct = Number(order.total_amount);
    if (Number.isFinite(direct)) return direct;
  }
  return (order.order_items ?? []).reduce(
    (acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.price_at_time ?? 0) || 0),
    0
  );
}
