'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Orders — the dedicated Shopify-standard order manager.
//
// Rebuilt from the legacy page, which read flat columns the live schema does
// not carry (orders.product_name / orders.price → rendered empty cells). This
// page uses the exact relational query the command center's orders tab is
// verified on — customers + order_items + products joins — and the same
// optimistic pending/completed status flow, shop_id-scoped.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CheckCircle2, Loader2, MessageCircle, Package,
  Phone, ShoppingCart, Truck, User,
} from 'lucide-react';
import type { Order } from '@/lib/types';

// Full status vocabulary seen across the platform (legacy checkout wrote
// 'new'; the current flow writes 'pending' → 'completed').
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-700',
  new: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700',
  shipped: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

type StatusFilter = 'all' | 'pending' | 'completed';

function sanitizePhoneNumber(rawNumber?: string | null) {
  if (!rawNumber) return null;
  let cleanNumber = rawNumber.replace(/\D/g, '');
  if (!cleanNumber) return null;
  if (cleanNumber.length === 7) cleanNumber = `220${cleanNumber}`;
  return cleanNumber;
}

export default function OrdersPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      if (cancelled) return;
      setUserId(user.id);

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`id, total_amount, status, fulfillment_method, created_at, customers (name, phone_number, location), order_items (quantity, variant_details, products (name, image_url))`)
        .eq('shop_id', user.id)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (fetchError) {
        setError('Failed to load your orders. Please refresh.');
      } else {
        setOrders((data as unknown as Order[]) ?? []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const counts = useMemo(() => ({
    all: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    completed: orders.filter((o) => o.status === 'completed').length,
  }), [orders]);

  const visibleOrders = useMemo(
    () => (filter === 'all' ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter]
  );

  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    if (!userId) return;
    setError(null);
    const previous = orders;
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)
      .eq('shop_id', userId);
    if (updateError) {
      setError('Failed to update the order status.');
      setOrders(previous);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white pb-24">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur-md md:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <span className="rounded-full bg-gray-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {counts.pending} pending
          </span>
        </div>
      </header>

      <main className="mx-auto mt-4 max-w-6xl px-4 py-8 md:px-10">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-gray-900">Orders</h1>
          <p className="mt-2 text-sm text-gray-500">
            {counts.all === 0
              ? 'No orders yet — they land here the moment a customer checks out.'
              : `${counts.all} ${counts.all === 1 ? 'order' : 'orders'} · D${orders.reduce((acc, o) => acc + Number(o.total_amount), 0).toLocaleString()} lifetime value.`}
          </p>
        </div>

        {/* Status filter */}
        <div className="mb-6 flex gap-1 overflow-x-auto hide-scrollbar">
          {([
            { id: 'all', label: `All (${counts.all})` },
            { id: 'pending', label: `Pending (${counts.pending})` },
            { id: 'completed', label: `Completed (${counts.completed})` },
          ] as { id: StatusFilter; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`shrink-0 rounded-full px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all duration-200 ${
                filter === tab.id ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {visibleOrders.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white p-12 text-center">
              <ShoppingCart className="mx-auto mb-4 h-10 w-10 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">
                {counts.all === 0 ? 'No orders yet.' : `No ${filter} orders.`}
              </p>
            </div>
          ) : (
            visibleOrders.map((order) => {
              const whatsapp = sanitizePhoneNumber(order.customers.phone_number);
              return (
                <div key={order.id} className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm md:p-6">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest ${STATUS_STYLES[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {order.status}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-gray-400">#{order.id.split('-')[0]}</span>
                        <span className="text-[10px] text-gray-400">{new Date(order.created_at).toLocaleDateString()}</span>
                      </div>
                      <h4 className="flex items-center gap-1.5 text-base font-bold text-gray-900"><User size={14} className="text-gray-400" /> {order.customers.name}</h4>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><Phone size={12} /> {order.customers.phone_number}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><Truck size={12} /> {order.fulfillment_method === 'delivery' ? order.customers.location : 'Store Pickup'}</p>
                      {whatsapp && (
                        <a
                          href={`https://wa.me/${whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-green-700 transition hover:bg-green-100"
                        >
                          <MessageCircle size={12} /> Message Customer
                        </a>
                      )}
                    </div>

                    <div className="flex-1 border-y border-gray-50 py-4 md:border-y-0 md:border-l md:px-8 md:py-0">
                      {order.order_items.map((item, idx) => (
                        <div key={idx} className="mb-3 flex items-center gap-3 last:mb-0">
                          <div className="h-12 w-10 overflow-hidden rounded-lg bg-gray-50">
                            {item.products?.image_url ? (
                              <img src={item.products.image_url} alt={item.products?.name || 'Ordered item'} className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-full w-full p-3 text-gray-300" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900">{item.quantity}x {item.products?.name || 'Unknown Item'}</p>
                            {item.variant_details && item.variant_details !== 'None' && (
                              <p className="text-[10px] uppercase tracking-wider text-gray-400">{item.variant_details}</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {order.order_items.length === 0 && (
                        <p className="text-xs text-gray-400">No line items recorded for this order.</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 md:flex-col md:items-end md:justify-center">
                      <div className="text-lg font-black text-gray-900">D{Number(order.total_amount).toLocaleString()}</div>
                      {order.status === 'completed' ? (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'pending')}
                          className="flex items-center gap-1.5 rounded-full bg-gray-100 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 transition hover:bg-gray-200"
                        >
                          Undo
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'completed')}
                          className="flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-black"
                        >
                          <CheckCircle2 size={14} /> Mark Paid
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
