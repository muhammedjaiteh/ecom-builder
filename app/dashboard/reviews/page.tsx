'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Reviews — promoted from the retired /dashboard?tab=reviews pane to its own
// route. Pick a product, read its feedback (ReviewList) and add external
// seller-verified reviews (ReviewForm). The product list is the only data
// this page loads itself.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Star } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import ReviewForm from '@/components/ReviewForm';
import ReviewList from '@/components/ReviewList';
import { resolveDashboardUser } from '@/lib/dashboardAuth';
import type { Product } from '@/lib/types';

function ReviewsPanel({ products }: { products: Product[] }) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(products[0]?.id ?? null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0];

  if (!selectedProduct) {
    return (
      <div className="animate-in fade-in duration-300 rounded-[2rem] border border-dashed border-gray-200 bg-white p-12 text-center">
        <Star className="mx-auto mb-4 h-10 w-10 text-gray-200" />
        <p className="text-sm font-medium text-gray-500">Add a product first to collect and manage reviews.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Reviews</h3>
            <p className="mt-1 text-sm text-gray-500">Choose a product to view feedback or add external seller-verified reviews.</p>
          </div>
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">Active Product</span>
            <select
              value={selectedProduct.id}
              onChange={(event) => setSelectedProductId(event.target.value)}
              className="w-full min-w-[260px] rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base font-medium text-gray-900 outline-none transition focus:border-gray-900"
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,1fr)]">
        <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
          <ReviewList productId={selectedProduct.id} refreshTrigger={refreshTrigger} />
        </div>
        <div>
          <ReviewForm productId={selectedProduct.id} onReviewSubmitted={() => setRefreshTrigger((prev) => prev + 1)} />
        </div>
      </div>
    </div>
  );
}

export default function ReviewsPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // null until auth + the product read both resolve — ReviewsPanel seeds its
  // selection from products[0] on mount, so it must never mount early.
  const [products, setProducts] = useState<Product[] | null>(null);

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
      setProducts((data as Product[]) || []);
    })();
    return () => { cancelled = true; };
  }, [router, supabase]);

  return (
    <DashboardShell title="Reviews" backLink={{ href: '/dashboard', label: 'Home' }}>
      {products === null ? (
        <div role="status" aria-label="Loading" className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <ReviewsPanel products={products} />
      )}
    </DashboardShell>
  );
}
