'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Home — the thin dashboard overview.
//
// Headline metrics (Total Sales, Gross Revenue, Best Seller) and Recent
// Activity, all derived from the shared orders seam (lib/useOrders). Nothing
// else lives here: Customers, Ad Studio, Broadcast, Discounts and Reviews are
// real routes under /dashboard/* (see components/dashboard/DashboardSidebar),
// and Orders / Analytics / Products have owned their pages for a while. The
// ?tab= state machine this page used to host is gone.
//
// Gates that still belong here: the auth read, and the OnboardingInterceptor —
// a definitive owner-channel 'no website' verdict swaps this overview for the
// Magic Storefront Builder. The subscription lock screen is NOT here: the
// layout's VaultDoor gate renders before any /dashboard/* page can.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Ban, BarChart3, CheckCircle2, Clock, DollarSign, Eye, Loader2, LogOut, Plus, TrendingUp,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { OnboardingInterceptor } from '@/components/onboarding/MagicStorefrontBuilder';
import { resolveDashboardUser } from '@/lib/dashboardAuth';
import { orderTotal } from '@/lib/orderMetrics';
import { useOrders } from '@/lib/useOrders';
import { useShopRow } from '@/lib/useShopRow';
import { useStorefrontUrl } from '@/lib/useStorefrontUrl';
import type { Shop } from '@/lib/types';

// Site-aware "View Shop": custom domain → premium /site → classic /shop
// (lib/useStorefrontUrl priority). Rendered INSIDE OnboardingInterceptor's
// SWR scope, so the website-row read is a pure cache dedupe with the
// interceptor's own fetch. Disabled until the shop row (and its slug) loads —
// the raw `/shop/${shop?.shop_slug}` link this replaces minted
// /shop/undefined pre-load and never URL-encoded legacy slugs.
function ViewShopButton({ shop }: { shop: Shop | null }) {
  const url = useStorefrontUrl(shop);
  const className =
    'flex shrink-0 items-center gap-1.5 rounded-full bg-gray-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:bg-gray-100';
  if (!url) {
    return (
      <span aria-disabled="true" className={`${className} cursor-not-allowed opacity-50`}>
        <Eye size={14} /> View Shop
      </span>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
      <Eye size={14} /> View Shop
    </a>
  );
}

export default function DashboardHomePage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [productsCount, setProductsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  // Shops-row seam (lib/useShopRow): the layout's provider scope guarantees a
  // cached verdict before this page renders, so this is a pure cache read —
  // and a brand save on Themes updates the storefront link instantly.
  const { shop } = useShopRow(userId);

  // Orders seam (lib/useOrders): the same shop-keyed cache /dashboard/orders
  // reads and OrderActions commits into. Warm cache → instant paint; every
  // Mark-Paid / Undo / Cancel on the orders page repaints these tiles and
  // Recent Activity in the same frame. `isError` is the honest-failure flag:
  // a failed read must never render as "D0 revenue".
  const { orders, isLoading: ordersLoading, isError: ordersLoadError } = useOrders(userId ?? undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Non-evicting offline auth (lib/dashboardAuth) — transport failure with
      // a local session never redirects; only a genuine no-session does.
      const auth = await resolveDashboardUser(supabase);
      if (cancelled) return;
      if (auth.status === 'unauthenticated') { router.push('/login'); return; }
      setUserId(auth.user.id);

      // Only the COUNT is needed here (OnboardingInterceptor's productsCount);
      // the product lists live on the routes that render them.
      const { count } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', auth.user.id);
      if (cancelled) return;
      setProductsCount(count ?? 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router, supabase]);

  // Vocabulary-aware headline metrics (sql/analytics.sql): a sale is a PAID
  // ('completed') order. Total Sales and Gross Revenue both derive from that
  // set alone, so they can never disagree with the Paid Orders / Gross Revenue
  // cards on /dashboard/analytics. Pending orders are not sales yet, and
  // cancelled ones never were. Best Seller excludes cancelled orders only
  // (their stock was returned), matching Top Performing Products there.
  // orderTotal() covers pre-backfill rows whose total_amount is still NULL.
  // Derived from the cache, so a status commit in OrderActions moves these
  // numbers without any state to keep in sync.
  const { totalOrders, totalRevenue, topProduct } = useMemo(() => {
    const completedOrders = orders.filter((o) => o.status === 'completed');
    const activeOrders = orders.filter((o) => o.status !== 'cancelled');
    const revenue = completedOrders.reduce((acc, order) => acc + orderTotal(order), 0);

    let bestSeller = 'None';
    if (activeOrders.length > 0) {
      const counts: Record<string, number> = {};
      activeOrders.forEach((o) => o.order_items.forEach((i) => { const pName = i.products?.name || 'Unknown Item'; counts[pName] = (counts[pName] || 0) + i.quantity; }));
      bestSeller = Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b), 'None');
    }

    return { totalOrders: completedOrders.length, totalRevenue: revenue, topProduct: bestSeller };
  }, [orders]);

  // Honest-failure notice for the tiles that render order money/counts.
  // SWR keeps retrying in the background; a warm cache stays on screen.
  const ordersLoadNotice = ordersLoadError ? (
    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
      {orders.length > 0
        ? 'Could not refresh your orders — showing the last synced figures. Retrying automatically.'
        : 'Could not load your orders — these figures are not live. Retrying automatically.'}
    </div>
  ) : null;

  // Gate on auth + product count (this effect) AND the seam's first orders
  // verdict. ordersLoading is false on a warm persisted cache, so revisits
  // paint at once; on a cold cache this waits exactly as the inline read did.
  if (loading || ordersLoading) {
    return (
      <DashboardShell title="Home">
        <div role="status" aria-label="Loading" className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </DashboardShell>
    );
  }

  // THE "AHA!" INTERCEPTOR — a definitive owner-channel 'no website' verdict
  // (cached or fresh) swaps the whole overview for the Magic Storefront
  // Builder; any other verdict (row exists, or still unknown) renders the
  // overview below. userId is non-null here: the loading gate above only
  // clears after auth resolves.
  return (
    <OnboardingInterceptor userId={userId!} productsCount={productsCount} tier={shop?.subscription_tier ?? null}>
      <DashboardShell
        title="Home"
        actions={
          <>
            <ViewShopButton shop={shop} />
            <Link href="/dashboard/add" className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#1a2e1a] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black">
              <Plus size={14} /> Add Item
            </Link>
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-600 transition hover:bg-red-100"
            >
              <LogOut size={14} />
            </button>
          </>
        }
      >
        {ordersLoadNotice}

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#1a2e1a] p-6 text-white shadow-lg">
            <div className="absolute -mr-4 -mt-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400"><BarChart3 size={14} /> Total Sales</p>
              <div className="font-serif text-4xl font-medium">{totalOrders}</div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400"><DollarSign size={14} className="text-green-600" /> Gross Revenue</p>
            <div className="font-serif text-3xl font-medium text-gray-900">D{totalRevenue.toLocaleString()}</div>
          </div>

          <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400"><TrendingUp size={14} className="text-orange-500" /> Best Seller</p>
            <div className="truncate text-xl font-bold text-gray-900">{topProduct}</div>
          </div>
        </div>

        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-900">Recent Activity</h2>
        <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
          {orders.slice(0, 3).map((order) => (
            <div key={order.id} className="flex items-center justify-between border-b border-gray-50 p-5 last:border-0">
              <div className="flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${order.status === 'pending' ? 'bg-orange-50 text-orange-500' : order.status === 'cancelled' ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-500'}`}>
                  {order.status === 'pending' ? <Clock size={16} /> : order.status === 'cancelled' ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{order.customers.name}</p>
                  <p className="text-xs tabular-nums text-gray-500">D{orderTotal(order).toLocaleString()}</p>
                </div>
              </div>
              <Link href="/dashboard/orders" className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900">View</Link>
            </div>
          ))}
          {orders.length === 0 && <div className="p-8 text-center text-sm text-gray-400">No recent orders.</div>}
        </div>
      </DashboardShell>
    </OnboardingInterceptor>
  );
}
