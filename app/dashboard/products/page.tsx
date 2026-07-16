'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Products — the dedicated Shopify-standard product index.
//
// Rebuilt from the legacy inventory page, which read a column that no longer
// exists (products.price_d → rendered "D undefined") and linked to the dead
// /dashboard/add-product route. This page reads the same live columns the
// command center's inventory tab uses and reuses its verified action targets
// (/dashboard/add, /dashboard/edit/[id], /dashboard/share/[id], /product/[id]).
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Edit, ExternalLink, Loader2, Package, Plus,
  Search, Share2, Trash2,
} from 'lucide-react';
import type { Product } from '@/lib/types';

function stockBadge(stock: number | null | undefined) {
  if (stock === null || stock === undefined) return null;
  if (stock <= 0) {
    return <span className="rounded-full bg-red-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-red-600 ring-1 ring-red-100">Out of stock</span>;
  }
  if (stock <= 5) {
    return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-700 ring-1 ring-amber-100">{stock} left</span>;
  }
  return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-emerald-700 ring-1 ring-emerald-100">{stock} in stock</span>;
}

export default function ProductsPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      if (cancelled) return;
      setUserId(user.id);

      const { data } = await supabase
        .from('products')
        .select('id, name, price, image_url, category, stock_quantity, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      setProducts((data as Product[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q)
    );
  }, [products, query]);

  const handleDelete = async (id: string) => {
    if (!userId) return;
    if (!confirm('Are you sure you want to delete this product?')) return;

    setDeletingId(id);
    const previous = products;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabase.from('products').delete().eq('id', id).eq('user_id', userId);
    setDeletingId(null);
    if (error) {
      alert('Failed to delete the product. Please try again.');
      setProducts(previous);
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
          <Link href="/dashboard/add" className="flex items-center gap-1.5 rounded-full bg-[#1a2e1a] px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black">
            <Plus size={14} /> Add Product
          </Link>
        </div>
      </header>

      <main className="mx-auto mt-4 max-w-6xl px-4 py-8 md:px-10">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-gray-900">Products</h1>
            <p className="mt-2 text-sm text-gray-500">
              {products.length === 0
                ? 'Your catalog is empty — add your first product to start selling.'
                : `${products.length} ${products.length === 1 ? 'product' : 'products'} in your catalog.`}
            </p>
          </div>
          <label className="relative block md:w-72">
            <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or category"
              className="w-full rounded-full border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm font-medium text-gray-900 shadow-sm outline-none transition focus:border-gray-900"
            />
          </label>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="p-14 text-center">
              <Package className="mx-auto mb-4 h-10 w-10 text-gray-200" />
              {products.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-gray-500">No products yet.</p>
                  <Link href="/dashboard/add" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#1a2e1a] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black">
                    <Plus size={13} /> Add Your First Product
                  </Link>
                </>
              ) : (
                <p className="text-sm font-medium text-gray-500">No products match &ldquo;{query}&rdquo;.</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-4 p-4 transition hover:bg-gray-50 md:p-5">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {product.image_url
                        ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                        : <Package className="h-full w-full p-3 text-gray-300" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold text-gray-900">{product.name}</h4>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-500">D{Number(product.price).toLocaleString()}</span>
                        {product.category && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{product.category}</span>
                        )}
                        {stockBadge(product.stock_quantity)}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 md:gap-2">
                    <Link href={`/product/${product.id}`} target="_blank" title="View product page" className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-900">
                      <ExternalLink size={16} />
                    </Link>
                    <Link href={`/dashboard/share/${product.id}`} title="Create a social post" className="rounded-full p-2 text-gray-400 transition hover:bg-emerald-50 hover:text-emerald-600">
                      <Share2 size={16} />
                    </Link>
                    <Link href={`/dashboard/edit/${product.id}`} title="Edit product" className="rounded-full p-2 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600">
                      <Edit size={16} />
                    </Link>
                    <button
                      onClick={() => handleDelete(product.id)}
                      disabled={deletingId === product.id}
                      title="Delete product"
                      className="rounded-full p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      {deletingId === product.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
