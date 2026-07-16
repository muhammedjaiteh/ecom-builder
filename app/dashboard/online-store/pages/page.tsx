'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Online Store → Pages — honest inventory of the seller's live pages.
//
//   1. The classic boutique (/shop/{slug}) — every activated tier has it, live
//      by definition.
//   2. The AI website home page (/site/{slug}) — Advanced/Flagship, read from
//      the same shop_websites row the studio manages, with its real
//      publish state and preview/open links.
//   3. The omnichannel storefront routes shipped with the site router:
//      /site/{slug}/collections (full catalog) and /site/{slug}/products/{id}
//      (per-product pages with on-site checkout — a sample link is minted
//      from the seller's newest product when one exists).
//
// No dead buttons, no invented pages.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Crown, ExternalLink, Eye, FileText, Globe,
  LayoutGrid, Loader2, Lock, Package, Store, Wand2,
} from 'lucide-react';
import { SITE_TEMPLATES, type ShopWebsiteRow } from '@/lib/siteTemplates';
import { useCanonicalShopSlug } from '@/lib/useCanonicalShopSlug';

const WEBSITE_TIERS = ['advanced', 'flagship'];

type ShopIdentity = {
  shop_name: string | null;
  shop_slug: string | null;
  subscription_tier: string | null;
};

type SampleProduct = {
  id: string;
  name: string;
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatusPill({ live }: { live: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-widest ${
      live
        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border border-amber-200 bg-amber-50 text-amber-700'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {live ? 'Live' : 'Draft'}
    </span>
  );
}

export default function OnlineStorePagesPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<ShopIdentity | null>(null);
  const [website, setWebsite] = useState<ShopWebsiteRow | null>(null);
  const [sampleProduct, setSampleProduct] = useState<SampleProduct | null>(null);

  const tier = (shop?.subscription_tier ?? '').toLowerCase().trim();
  const hasAccess = WEBSITE_TIERS.includes(tier);
  const siteSlug = useCanonicalShopSlug(shop?.shop_slug ?? null, hasAccess);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: shopRow } = await supabase
        .from('shops')
        .select('shop_name, shop_slug, subscription_tier')
        .eq('id', user.id)
        .single();
      if (cancelled) return;
      setShop((shopRow as ShopIdentity | null) ?? null);

      const rowTier = ((shopRow as ShopIdentity | null)?.subscription_tier ?? '').toLowerCase().trim();
      if (WEBSITE_TIERS.includes(rowTier)) {
        // Website row via the owner content API. shop_websites has NO select
        // policies — the browser-client read this page shipped with returned
        // zero rows SILENTLY, so every generated site presented here as
        // "No AI website generated yet". All owner reads go through the
        // service-role-backed GET /api/websites/content.
        try {
          const res = await fetch('/api/websites/content');
          if (res.ok) {
            const data = await res.json();
            if (cancelled) return;
            setWebsite((data.website as ShopWebsiteRow | null) ?? null);
          }
        } catch {
          // Non-fatal: the page renders its empty state.
        }
        if (cancelled) return;

        // Newest product mints the sample /site/{slug}/products/{id} link.
        // Match either ownership column (mixed legacy schema — same rule the
        // site router applies).
        const { data: productRow } = await supabase
          .from('products')
          .select('id, name')
          .or(`shop_id.eq.${user.id},user_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        setSampleProduct((productRow as SampleProduct | null) ?? null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  const boutiqueSlug = shop?.shop_slug ?? null;
  const isPublished = website?.status === 'published';
  const homeTitle = website?.config?.site?.seo?.title || shop?.shop_name || 'Home';
  const templateMeta = website ? SITE_TEMPLATES[website.template_key] : null;
  const publishedDate = formatDate(website?.published_at ?? null);
  const generatedDate = formatDate(website?.generated_at ?? null);

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white pb-24">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur-md md:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <Link href="/dashboard/online-store/themes" className="flex items-center gap-1.5 rounded-full bg-gray-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:bg-gray-100">
            <Wand2 size={13} /> Open Themes
          </Link>
        </div>
      </header>

      <main className="mx-auto mt-4 max-w-5xl px-4 py-8 md:px-10">
        <div className="mb-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Online Store</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-gray-900">Pages</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-500">
            Every page your customers can visit right now, with its live status. Pages are composed
            by your theme — manage their design from Themes.
          </p>
        </div>

        <div className="space-y-6">
          {/* 1. Classic boutique — exists for every activated tier */}
          <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-gray-500">
                  <Store size={18} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-base font-bold text-gray-900">Boutique storefront</h2>
                    <StatusPill live />
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Your classic Sanndikaa boutique — always live, styled by your brand color and layout.
                  </p>
                  {boutiqueSlug && (
                    <p className="mt-2 font-mono text-xs font-bold text-gray-400">/shop/{boutiqueSlug}</p>
                  )}
                </div>
              </div>
              {boutiqueSlug && (
                <a
                  href={`/shop/${encodeURIComponent(boutiqueSlug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
                >
                  <ExternalLink size={13} /> Open
                </a>
              )}
            </div>
          </div>

          {/* 2. AI website home page — Advanced/Flagship (same gate as the studio) */}
          {!hasAccess && (
            <div className="relative overflow-hidden rounded-[2rem] bg-[#1a1a1a] p-10 text-center text-white shadow-2xl">
              <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#f0a500]/10 blur-3xl" />
              <Crown size={30} className="mx-auto text-[#f0a500]" />
              <h2 className="mt-5 font-serif text-2xl font-bold">Your AI website&apos;s pages live here.</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/60">
                Generate a complete standalone storefront in the AI Website Studio and this list grows
                with its home page — publish state, preview links, and all. Exclusive to the Advanced tier.
              </p>
              <p className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                <Lock size={12} /> Locked on your current plan
              </p>
              <Link
                href="/pricing"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#f0a500] px-7 py-3 text-[11px] font-black uppercase tracking-widest text-black transition hover:bg-amber-400 active:scale-95"
              >
                <Crown size={14} /> Upgrade to Advanced
              </Link>
            </div>
          )}

          {hasAccess && !website && (
            <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white p-12 text-center">
              <Globe className="mx-auto mb-4 h-10 w-10 text-gray-300" />
              <p className="text-sm font-bold">No AI website generated yet.</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
                Run the design consultation in Themes and your generated home page appears here with
                its publish state and links.
              </p>
              <Link
                href="/dashboard/online-store/themes"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#1a2e1a] to-gray-900 px-7 py-3 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:opacity-90 active:scale-95"
              >
                <Wand2 size={13} /> Open the Website Studio
              </Link>
            </div>
          )}

          {hasAccess && website && (
            <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1a2e1a] text-[#f0a500]">
                    <FileText size={18} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-base font-bold text-gray-900">{homeTitle}</h2>
                      <StatusPill live={isPublished} />
                      {templateMeta && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white">
                          <Wand2 size={10} className="text-[#f0a500]" /> {templateMeta.name} theme
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Home page of your AI-generated website
                      {isPublished && publishedDate && <> · published {publishedDate}</>}
                      {!isPublished && generatedDate && <> · generated {generatedDate}</>}
                    </p>
                    {siteSlug ? (
                      <p className="mt-2 font-mono text-xs font-bold text-gray-400">/site/{siteSlug}</p>
                    ) : (
                      <p className="mt-2 text-xs text-amber-700">
                        Finalizing your site address — it appears here the moment your store link is confirmed.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {siteSlug && isPublished && (
                    <a
                      href={`/site/${siteSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
                    >
                      <ExternalLink size={13} /> Open
                    </a>
                  )}
                  {siteSlug && !isPublished && (
                    <a
                      href={`/site/${siteSlug}?preview=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-100"
                    >
                      <Eye size={13} /> Preview Draft
                    </a>
                  )}
                  <Link
                    href="/dashboard/online-store/themes"
                    className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:bg-gray-50"
                  >
                    <Wand2 size={13} /> Manage in Themes
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* 3. Collection page — ships with every generated site */}
          {hasAccess && website && (
            <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1a2e1a] text-[#f0a500]">
                    <LayoutGrid size={18} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-base font-bold text-gray-900">Collection page</h2>
                      <StatusPill live={isPublished} />
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Your full catalog — every product, paginated 24 per page, inside your theme&apos;s
                      header and footer. Buyers browse and open products without leaving your site.
                    </p>
                    {siteSlug && (
                      <p className="mt-2 font-mono text-xs font-bold text-gray-400">/site/{siteSlug}/collections</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {siteSlug && isPublished && (
                    <a
                      href={`/site/${siteSlug}/collections`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
                    >
                      <ExternalLink size={13} /> Open
                    </a>
                  )}
                  {siteSlug && !isPublished && (
                    <a
                      href={`/site/${siteSlug}/collections?preview=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-100"
                    >
                      <Eye size={13} /> Preview Draft
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. Product pages — one per product, with on-site checkout */}
          {hasAccess && website && (
            <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1a2e1a] text-[#f0a500]">
                    <Package size={18} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-base font-bold text-gray-900">Product pages</h2>
                      <StatusPill live={isPublished} />
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Every product gets its own page — gallery, stock, quantity, and WhatsApp
                      checkout — wrapped in your theme. New products appear automatically.
                    </p>
                    {siteSlug && (
                      <p className="mt-2 font-mono text-xs font-bold text-gray-400">/site/{siteSlug}/products/{'{product-id}'}</p>
                    )}
                    {!sampleProduct && (
                      <p className="mt-2 text-xs text-amber-700">
                        Add your first product and its page appears here with a live link.
                      </p>
                    )}
                  </div>
                </div>
                {sampleProduct && siteSlug && (
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/site/${siteSlug}/products/${sampleProduct.id}${isPublished ? '' : '?preview=1'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest ring-1 transition ${
                        isPublished
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100'
                      }`}
                      title={`Sample: ${sampleProduct.name}`}
                    >
                      {isPublished ? <ExternalLink size={13} /> : <Eye size={13} />}
                      {isPublished ? 'Open sample' : 'Preview sample'}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
