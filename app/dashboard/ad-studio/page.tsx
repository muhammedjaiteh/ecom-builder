'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Ad Studio — promoted from the retired /dashboard?tab=videos pane to its own
// route. This path is the Ad Studio deep link (lib/adNotifications
// AD_STUDIO_PATH) that the dashboard-wide render notifier jumps to.
// VideoManager owns the render pipeline; this page resolves the seller and
// their product list, then hands both over.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import VideoManager from '@/components/VideoManager';
import { resolveDashboardUser } from '@/lib/dashboardAuth';
import type { Product } from '@/lib/types';

type SellerContext = { userId: string; products: Product[] };

export default function AdStudioPage() {
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
    <DashboardShell title="Ad Studio" backLink={{ href: '/dashboard', label: 'Home' }}>
      {ctx === null ? (
        <div role="status" aria-label="Loading" className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <VideoManager userId={ctx.userId} products={ctx.products} />
      )}
    </DashboardShell>
  );
}
