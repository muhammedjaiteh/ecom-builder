'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Online Store → Domain — the page SHELL only. The full BYOD manager (SWR
// state machine, connect form, DNS timeline, disconnect confirm, WhatsApp
// escape hatch) was EXTRACTED VERBATIM to components/domains/DomainManager
// (Pillar 2) so the Settings cockpit's Custom Domains Hub renders the exact
// same component — reuse, never duplicate.
//
// Tier gate: lib/tiers canUseCustomDomain — Flagship-exclusive in the new
// ladder (founder matrix 2026-08-29); legacy 'advanced' payers keep it. The
// API (/api/domains) is the enforcer; this only decides which shell renders.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Crown, Globe, Loader2, Lock } from 'lucide-react';
import DomainManager from '@/components/domains/DomainManager';
import { resolveDashboardUser } from '@/lib/dashboardAuth';
import { canUseCustomDomain } from '@/lib/tiers';
import { useShopRow } from '@/lib/useShopRow';

export default function OnlineStoreDomainsPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [userId, setUserId] = useState<string | null>(null);

  // Shops-row seam (lib/useShopRow, A3) — one cached read for the whole
  // dashboard instead of this page's own bare shops query.
  const { shop, verdict: shopVerdict, error: shopError } = useShopRow(userId);
  const shopName = shop?.shop_name ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Non-evicting offline auth (lib/dashboardAuth) — transport failure with
      // a local session never redirects; only a genuine no-session does.
      const auth = await resolveDashboardUser(supabase);
      if (auth.status === 'unauthenticated') {
        router.push('/login');
        return;
      }
      if (cancelled) return;
      setUserId(auth.user.id);
    })();
    return () => { cancelled = true; };
  }, [router, supabase]);

  // Loading = auth pending, or no shops-row verdict from cache/network yet.
  const loading = !userId || (shopVerdict === undefined && !shopError);

  const hasAccess = canUseCustomDomain(shop?.subscription_tier);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F9F8F6]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#F9F8F6] pb-24 font-sans text-gray-900">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur-md md:px-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900"
          >
            <ArrowLeft size={16} /> Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto mt-4 max-w-3xl px-4 py-8 md:px-10">
        <div className="mb-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Online Store</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-gray-900">Domain</h1>
          <p className="mt-2 text-sm text-gray-500">
            Connect a domain you own — like maimuna-fashion.gm — to your Sanndikaa website. SSL is automatic.
          </p>
        </div>

        {hasAccess ? (
          <DomainManager shopName={shopName} />
        ) : (
          // The studio lock idiom — same dark card, same /pricing upsell.
          <div className="relative overflow-hidden rounded-[2rem] bg-[#1a1a1a] p-10 text-center text-white shadow-2xl md:p-16">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#f0a500]/10 blur-3xl" />
            <Globe size={36} className="mx-auto text-[#f0a500]" />
            <h3 className="mt-6 font-serif text-3xl font-bold md:text-4xl">Your own .com, .gm, or .sn address.</h3>
            <p className="mx-auto mt-4 max-w-lg leading-relaxed text-white/60">
              Point a domain you already own at your Sanndikaa website — automatic setup, automatic SSL,
              no developer needed. Exclusive to the Flagship tier.
            </p>
            <p className="mt-5 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
              <Lock size={12} /> Locked on your current plan
            </p>
            <Link
              href="/pricing"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#f0a500] px-8 py-3.5 text-[11px] font-black uppercase tracking-widest text-black transition hover:bg-amber-400 active:scale-95"
            >
              <Crown size={14} /> Upgrade to Flagship
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
