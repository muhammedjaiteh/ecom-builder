'use client';

import { useMemo, type ReactNode } from 'react';
import { Package, ShoppingCart, WifiOff } from 'lucide-react';
import { orderStatusLabel, orderTotal } from '@/lib/orderMetrics';

// ─────────────────────────────────────────────────────────────────────────────
// AnalyticsDashboard — the shared closed-loop WhatsApp analytics surface,
// mounted by BOTH the command center (?tab=analytics) and /dashboard/analytics.
//
// THE THREE HERO METRICS (vocabulary: sql/analytics.sql — 'completed' is the
// terminal paid state, labelled Paid; 'cancelled' the terminal flake state):
//   · Gross Revenue      = Σ total_amount over 'completed' orders, with the
//                          order_items (qty × price_at_time) fallback for
//                          pre-backfill rows whose total_amount is NULL.
//   · Paid Orders        = count('completed').
//   · WhatsApp Conversion = completed / (completed + pending + cancelled),
//                          one decimal, with the honest denominator subline.
//     Legacy 'new'/'processing'/'shipped' rows predate the WhatsApp checkout
//     funnel and are excluded from the conversion denominator by design.
//
// Each card carries a muted 30-day delta vs the PRIOR 30-day window — hidden
// (fixed-height slot stays, zero CLS) whenever the prior window has no
// baseline, because a trend against nothing is a fabricated trend. The Gross
// Revenue card closes with a single pure-SVG 30-day sparkline: no axes, no
// gridlines, muted brand stroke, aria-labelled. No chart library.
//
// Gambia standard: fixed-height cards (h-48) with structurally identical
// skeletons (zero CLS), and an honest load-failure chip — a failed read must
// never render as "D0 revenue".
// ─────────────────────────────────────────────────────────────────────────────

type AnalyticsOrderItem = {
  quantity: number;
  price_at_time?: number | null;
  products: { name: string; image_url: string | null };
};

type AnalyticsOrder = {
  id: string;
  total_amount: number | null;
  status: string;
  created_at: string;
  customers: { name: string };
  order_items: AnalyticsOrderItem[];
};

type AnalyticsProduct = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
};

interface AnalyticsDashboardProps {
  orders: AnalyticsOrder[];
  /** Accepted for surface parity; the current metric set is order-derived. */
  products: AnalyticsProduct[];
  /** Renders fixed-height skeletons in place of every section. */
  loading?: boolean;
  /** The orders read failed — show the honest chip, never zeros-as-data. */
  loadError?: boolean;
}

const DAY_MS = 86_400_000;
const FUNNEL_STATUSES = new Set(['completed', 'pending', 'cancelled']);

// Time anchor at MODULE scope: reading the clock during render violates
// react-hooks/purity (unstable results across re-renders). Both dashboard
// surfaces fetch orders on mount, so a page-load anchor is exactly aligned
// with the data it windows.
const NOW_MS = Date.now();
const TODAY_START_MS = (() => {
  const d = new Date(NOW_MS);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
})();

/** Relative % change against a prior-window baseline; null = no honest baseline. */
function relativeDelta(current: number, prior: number): number | null {
  if (prior <= 0) return null;
  return ((current - prior) / prior) * 100;
}

/** Muted ▲/▼ delta row. The slot keeps its height when hidden — zero CLS. */
function TrendDelta({ delta }: { delta: number | null }) {
  return (
    <div className="flex h-4 items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
      {delta !== null && (
        <>
          <span className={delta >= 0 ? 'text-emerald-600/80' : 'text-red-400'}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
          </span>
          <span className="font-medium normal-case tracking-normal text-gray-300">vs prior 30 days</span>
        </>
      )}
    </div>
  );
}

/** Pure-SVG sparkline — one muted brand-stroke path, no axes, no gridlines. */
function RevenueSparkline({ values }: { values: number[] }) {
  const W = 100;
  const H = 32;
  const PAD = 2;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? W / (values.length - 1) : W;
  const d = `M${values
    .map((v, i) => `${(i * step).toFixed(2)},${(H - PAD - (v / max) * (H - PAD * 2)).toFixed(2)}`)
    .join(' L')}`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-9 w-full"
      role="img"
      aria-label="Daily paid revenue over the last 30 days"
    >
      <path
        d={d}
        fill="none"
        stroke="#1a2e1a"
        strokeOpacity={0.32}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  sub,
  delta,
  footer,
}: {
  label: string;
  value: string;
  sub: string;
  delta: number | null;
  footer?: ReactNode;
}) {
  return (
    <div className="flex h-48 flex-col rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-2 truncate font-serif text-3xl font-medium tabular-nums text-gray-900 md:text-4xl">{value}</p>
      <p className="mt-1 h-4 truncate text-xs text-gray-400">{sub}</p>
      <div className="mt-1.5">
        <TrendDelta delta={delta} />
      </div>
      <div className="mt-auto h-9">{footer}</div>
    </div>
  );
}

function SkeletonState() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
            <div className="h-3 w-24 rounded-full bg-gray-100" />
            <div className="mt-4 h-9 w-32 rounded-xl bg-gray-100" />
            <div className="mt-3 h-3 w-40 rounded-full bg-gray-50" />
          </div>
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-[2rem] border border-gray-100 bg-white shadow-sm" />
      <div className="h-64 animate-pulse rounded-[2rem] border border-gray-100 bg-white shadow-sm" />
    </div>
  );
}

export default function AnalyticsDashboard({ orders, loading = false, loadError = false }: AnalyticsDashboardProps) {
  const analytics = useMemo(() => {
    const now = NOW_MS;
    const cutCurrent = now - 30 * DAY_MS;
    const cutPrior = now - 60 * DAY_MS;
    const createdAt = (o: AnalyticsOrder) => new Date(o.created_at).getTime();

    const completed = orders.filter((o) => o.status === 'completed');
    const funnel = orders.filter((o) => FUNNEL_STATUSES.has(o.status));

    // Hero metrics — all-time.
    const grossRevenue = completed.reduce((acc, o) => acc + orderTotal(o), 0);
    const paidCount = completed.length;
    const funnelCount = funnel.length;
    const conversion = funnelCount > 0 ? (paidCount / funnelCount) * 100 : null;

    // 30-day windows for the trend deltas.
    const curCompleted = completed.filter((o) => createdAt(o) >= cutCurrent);
    const priorCompleted = completed.filter((o) => { const t = createdAt(o); return t >= cutPrior && t < cutCurrent; });
    const curFunnel = funnel.filter((o) => createdAt(o) >= cutCurrent);
    const priorFunnel = funnel.filter((o) => { const t = createdAt(o); return t >= cutPrior && t < cutCurrent; });

    const revenueDelta = relativeDelta(
      curCompleted.reduce((acc, o) => acc + orderTotal(o), 0),
      priorCompleted.reduce((acc, o) => acc + orderTotal(o), 0)
    );
    const paidDelta = relativeDelta(curCompleted.length, priorCompleted.length);
    const curConversion = curFunnel.length > 0 ? (curCompleted.length / curFunnel.length) * 100 : null;
    const priorConversion = priorFunnel.length > 0 ? (priorCompleted.length / priorFunnel.length) * 100 : null;
    const conversionDelta = curConversion !== null && priorConversion !== null
      ? relativeDelta(curConversion, priorConversion)
      : null;

    // 30-day daily paid-revenue buckets for the sparkline.
    const spark = new Array<number>(30).fill(0);
    for (const o of completed) {
      const d = new Date(o.created_at);
      if (Number.isNaN(d.getTime())) continue;
      d.setHours(0, 0, 0, 0);
      const daysAgo = Math.round((TODAY_START_MS - d.getTime()) / DAY_MS);
      if (daysAgo >= 0 && daysAgo < 30) spark[29 - daysAgo] += orderTotal(o);
    }

    // Top products + recent activity — cancelled orders are excluded from
    // sales counts (their stock was returned); the activity log keeps every
    // status and lets the badge tell the truth.
    const activeOrders = orders.filter((o) => o.status !== 'cancelled');
    const productSales: Record<string, { name: string; quantity: number }> = {};
    activeOrders.forEach((order) => {
      order.order_items.forEach((item) => {
        const name = item.products?.name || 'Unknown';
        if (!productSales[name]) productSales[name] = { name, quantity: 0 };
        productSales[name].quantity += item.quantity;
      });
    });
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const sevenDaysAgo = now - 7 * DAY_MS;
    const recentOrders = orders.filter((o) => createdAt(o) > sevenDaysAgo).slice(0, 5);

    return {
      grossRevenue, paidCount, funnelCount, conversion,
      revenueDelta, paidDelta, conversionDelta,
      spark, topProducts, recentOrders,
    };
  }, [orders]);

  if (loading) return <SkeletonState />;

  const maxQuantity = Math.max(...analytics.topProducts.map((p) => p.quantity), 1);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">

      {/* Honest failure chip — cards below show em-dashes, never fake zeros */}
      {loadError && (
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-800">
          <WifiOff size={12} /> Sales data could not load — check your connection and refresh
        </div>
      )}

      {/* THE THREE HERO METRICS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        <MetricCard
          label="Gross Revenue"
          value={loadError ? '—' : `D${analytics.grossRevenue.toLocaleString()}`}
          sub="Paid orders only, all time"
          delta={loadError ? null : analytics.revenueDelta}
          footer={loadError ? undefined : <RevenueSparkline values={analytics.spark} />}
        />
        <MetricCard
          label="Paid Orders"
          value={loadError ? '—' : analytics.paidCount.toLocaleString()}
          sub="Marked paid by you, all time"
          delta={loadError ? null : analytics.paidDelta}
        />
        <MetricCard
          label="WhatsApp Conversion"
          value={loadError || analytics.conversion === null ? '—' : `${analytics.conversion.toFixed(1)}%`}
          sub={
            loadError
              ? 'Unavailable'
              : analytics.funnelCount > 0
                ? `of ${analytics.funnelCount.toLocaleString()} WhatsApp checkout${analytics.funnelCount === 1 ? '' : 's'}`
                : 'No WhatsApp checkouts yet'
          }
          delta={loadError ? null : analytics.conversionDelta}
        />
      </div>

      {/* TOP PERFORMING PRODUCTS */}
      <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Top Performing Products</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Units ordered, cancelled orders excluded</p>
        </div>

        {analytics.topProducts.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="mx-auto mb-3 h-8 w-8 text-gray-200" />
            <p className="text-sm text-gray-500">No sales data yet. Your top products will appear here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {analytics.topProducts.map((product, idx) => {
              const percentage = (product.quantity / maxQuantity) * 100;
              return (
                <div key={idx} className="space-y-2">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-gray-400">#{idx + 1}</span>
                      <p className="truncate text-sm font-bold text-gray-900">{product.name}</p>
                    </div>
                    <span className="ml-2 whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold tabular-nums text-emerald-700">
                      {product.quantity} sold
                    </span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-[#1a2e1a]/70 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RECENT ACTIVITY */}
      <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-6 md:px-8 md:py-8">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Recent Activity</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Last 7 days</p>
        </div>

        {analytics.recentOrders.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="mx-auto mb-3 h-8 w-8 text-gray-200" />
            <p className="text-sm text-gray-500">No orders in the last 7 days. Keep promoting!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {analytics.recentOrders.map((order) => {
              const orderDate = new Date(order.created_at);
              const today = new Date();
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);

              let dateLabel = orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              if (orderDate.toDateString() === today.toDateString()) {
                dateLabel = 'Today';
              } else if (orderDate.toDateString() === yesterday.toDateString()) {
                dateLabel = 'Yesterday';
              }

              const itemCount = order.order_items.reduce((acc, item) => acc + item.quantity, 0);
              return (
                <div key={order.id} className="p-5 transition-colors hover:bg-gray-50 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <h4 className="text-sm font-bold text-gray-900">{order.customers.name}</h4>
                        <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-widest ${
                          order.status === 'completed'
                            ? 'bg-green-50 text-green-700'
                            : order.status === 'cancelled'
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-orange-50 text-orange-700'
                        }`}>
                          {orderStatusLabel(order.status)}
                        </span>
                      </div>
                      <p className="mb-2 text-xs text-gray-500">
                        {order.order_items.map((item) => item.products?.name || 'Unknown').join(', ')}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{dateLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black tabular-nums text-gray-900">D{orderTotal(order).toLocaleString()}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
