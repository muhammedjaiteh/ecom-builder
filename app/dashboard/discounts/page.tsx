'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Discounts — promoted from the retired /dashboard?tab=discounts pane to its
// own route. DiscountManager owns the discount data and writes; this page
// resolves the seller and their product list, then hands both over.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import DiscountManager from '@/components/DiscountManager';
import { resolveDashboardUser } from '@/lib/dashboardAuth';
import type { Product } from '@/lib/types';

type SellerContext = { userId: string; products: Product[] };

export default function DiscountsPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // One state object so the manager mounts exactly once, with both inputs.
  const [ctx, setCtx] = useState<SellerContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Non-evicting offline auth (lib/dashboardAuth) — transport failure with
      // a local session never redirects; only a genuine no-session does.
      const auth = await resolveDashboardUser(supabase);
      if (cancelled) return;
      if (auth.status === 'unauthenticated') { router.push('/login'); return; }

      const { data } = await supabase
        .from('products')
        .select('id, image_url, name, price, category')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      setCtx({ userId: auth.user.id, products: (data as Product[]) || [] });
    })();
    return () => { cancelled = true; };
  }, [router, supabase]);

  return (
    <DashboardShell title="Discounts" backLink={{ href: '/dashboard', label: 'Home' }}>
      {ctx === null ? (
        <div role="status" aria-label="Loading" className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <DiscountManager userId={ctx.userId} products={ctx.products} />
      )}
    </DashboardShell>
  );
}
