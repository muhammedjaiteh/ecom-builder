'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Analytics — the dedicated analytics surface.
//
// Upgraded from the legacy leads-only page: it now mounts the shared
// AnalyticsDashboard (revenue, AOV, top products, recent activity — the same
// component the command center's Analytics tab renders) on top, and preserves
// the WhatsApp interest data below (the `leads` table is written by the
// product page's order buttons and is shown nowhere else).
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, DollarSign, Loader2, MessageCircle, Users } from 'lucide-react';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import type { Order, Product } from '@/lib/types';

type Lead = {
  id: string;
  product_name: string | null;
  product_price: number | null;
  created_at: string;
};

export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const [ordersRes, productsRes, leadsRes] = await Promise.all([
        supabase
          .from('orders')
          .select(`id, total_amount, status, fulfillment_method, created_at, customers (name, phone_number, location), order_items (quantity, variant_details, products (name, image_url))`)
          .eq('shop_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('products')
          .select('id, name, price, image_url')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('leads')
          .select('id, product_name, product_price, created_at')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      if (cancelled) return;

      setOrders((ordersRes.data as unknown as Order[]) ?? []);
      setProducts((productsRes.data as Product[]) ?? []);
      setLeads((leadsRes.data as Lead[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  // Shape adapters for the shared AnalyticsDashboard (same mapping the
  // command center performs before mounting it).
  const analyticsOrders = orders.map((order) => ({
    id: order.id,
    total_amount: order.total_amount,
    status: order.status,
    created_at: order.created_at,
    customers: { name: order.customers.name },
    order_items: order.order_items.map((item) => ({
      quantity: item.quantity,
      products: {
        name: item.products?.name || 'Unknown Item',
        image_url: item.products?.image_url ?? null,
      },
    })),
  }));

  const analyticsProducts = products.map((product) => ({
    id: product.id,
    name: product.name,
    price: product.price,
    image_url: product.image_url ?? null,
  }));

  const totalLeads = leads.length;
  const potentialRevenue = leads.reduce((acc, lead) => acc + Number(lead.product_price || 0), 0);

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white pb-24">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur-md md:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900">
            <ArrowLeft size={16} /> Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto mt-4 max-w-6xl px-4 py-8 md:px-10">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-2 text-sm text-gray-500">Sales performance, best sellers, and WhatsApp buying interest.</p>
        </div>

        <AnalyticsDashboard orders={analyticsOrders} products={analyticsProducts} />

        {/* WhatsApp interest — unique to this page: written by the product
            page's order buttons before the WhatsApp handoff. */}
        <section className="mt-10">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-900">WhatsApp Interest</h2>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <Users size={14} className="text-blue-600" /> Total Leads
              </p>
              <div className="font-serif text-3xl font-medium text-gray-900">{totalLeads}</div>
              <p className="mt-2 text-xs text-gray-400">Taps on order buttons across your product pages</p>
            </div>
            <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <DollarSign size={14} className="text-green-600" /> Potential Revenue
              </p>
              <div className="font-serif text-3xl font-medium text-gray-900">D{potentialRevenue.toLocaleString()}</div>
              <p className="mt-2 text-xs text-gray-400">Combined value of the products customers asked about</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-50 p-6">
              <h3 className="text-sm font-bold text-gray-900">Recent Interested Customers</h3>
            </div>
            {leads.length === 0 ? (
              <div className="p-10 text-center">
                <MessageCircle className="mx-auto mb-3 h-8 w-8 text-gray-200" />
                <p className="text-sm text-gray-400">No leads yet. Share your shop link to start conversations.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {leads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-gray-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">{lead.product_name || 'Unknown product'}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{new Date(lead.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-green-700">D{Number(lead.product_price || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
