'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Customers — the seller CRM, promoted from the retired /dashboard?tab=customers
// pane to its own route.
//
// Derived entirely from the shared orders seam (lib/useOrders): one row per
// customer phone number, cancelled orders excluded from spend and counts
// (sql/analytics.sql vocabulary). This page owns NO customer state of its
// own — a status commit on /dashboard/orders repaints these rows too.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MessageCircle, Users } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { resolveDashboardUser } from '@/lib/dashboardAuth';
import { orderTotal } from '@/lib/orderMetrics';
import { useOrders } from '@/lib/useOrders';
import type { CustomerCRM } from '@/lib/types';

function sanitizePhoneNumber(rawNumber?: string | null) {
  if (!rawNumber) return null;
  let cleanNumber = rawNumber.replace(/\D/g, '');
  if (!cleanNumber) return null;
  if (cleanNumber.length === 7) cleanNumber = `220${cleanNumber}`;
  return cleanNumber;
}

export default function CustomersPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [userId, setUserId] = useState<string | null>(null);

  // Auth only — the seller id is the seam's cache key. Non-evicting offline
  // auth (lib/dashboardAuth): transport failure with a local session never
  // redirects; only a genuine no-session does.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const auth = await resolveDashboardUser(supabase);
      if (cancelled) return;
      if (auth.status === 'unauthenticated') { router.push('/login'); return; }
      setUserId(auth.user.id);
    })();
    return () => { cancelled = true; };
  }, [router, supabase]);

  const { orders, isLoading, isError } = useOrders(userId ?? undefined);

  // CRM spend: cancelled orders never count toward Total Spent.
  const customers = useMemo(() => {
    const crmMap = new Map<string, CustomerCRM>();
    orders
      .filter((order) => order.status !== 'cancelled')
      .forEach((order) => {
        const phone = order.customers.phone_number;
        if (!crmMap.has(phone)) {
          crmMap.set(phone, { phone, name: order.customers.name, location: order.customers.location, totalSpent: 0, orderCount: 0, lastOrderDate: order.created_at });
        }
        const c = crmMap.get(phone)!;
        c.totalSpent += orderTotal(order);
        c.orderCount += 1;
        if (new Date(order.created_at) > new Date(c.lastOrderDate)) c.lastOrderDate = order.created_at;
      });
    return Array.from(crmMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [orders]);

  // The seam's key is inactive until auth resolves, so isLoading alone would
  // read false before we even know who the seller is.
  const ready = userId !== null && !isLoading;

  return (
    <DashboardShell title="Customers" backLink={{ href: '/dashboard', label: 'Home' }}>
      {!ready ? (
        <div role="status" aria-label="Loading" className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {isError && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
              {orders.length > 0
                ? 'Could not refresh your orders — showing the last synced customers. Retrying automatically.'
                : 'Could not load your orders — this list is not live. Retrying automatically.'}
            </div>
          )}

          <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
            {customers.length === 0 ? (
              <div className="p-12 text-center"><Users className="mx-auto mb-4 h-10 w-10 text-gray-200" /><p className="text-sm text-gray-500">No customers yet.</p></div>
            ) : (
              <div className="divide-y divide-gray-50">
                {customers.map((c) => (
                  <div key={c.phone} className="flex flex-col justify-between p-5 transition hover:bg-gray-50 md:flex-row md:items-center md:p-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1a2e1a] text-sm font-bold text-white">{c.name.substring(0, 2).toUpperCase()}</div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">{c.name}</h4>
                        <p className="mt-0.5 text-xs text-gray-500">{c.phone}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between md:mt-0 md:gap-8">
                      <div className="text-left md:text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Spent</p>
                        <p className="text-lg font-black text-gray-900">D{c.totalSpent.toLocaleString()}</p>
                      </div>
                      <a href={`https://wa.me/${sanitizePhoneNumber(c.phone)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full bg-green-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-green-700 transition hover:bg-green-100">
                        <MessageCircle size={14} /> Retarget
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </DashboardShell>
  );
}
