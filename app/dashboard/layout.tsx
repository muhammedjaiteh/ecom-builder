'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SWRConfig } from 'swr';
import { Loader2 } from 'lucide-react';
import AdRenderNotifier from '@/components/adstudio/AdRenderNotifier';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import VaultDoor from '@/components/dashboard/VaultDoor';
import { resolveDashboardUser } from '@/lib/dashboardAuth';
import { createPersistedSwrProvider } from '@/lib/swrCache';
import { CONCIERGE_PRICE, SUPPORT_WHATSAPP, invoicePlanFor } from '@/lib/tiers';
import { useShopRow } from '@/lib/useShopRow';
import { fetchJSON } from '@/lib/transport';

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard layout — auth gate + THE provider scope + the vault door.
//
// A3 (shops-row seam): this layout mounts createPersistedSwrProvider(userId)
// around EVERY dashboard page, so lib/useShopRow (and the existing
// websiteContentKey reads) share one persisted per-user cache. The layout's
// own tier gate consumes the same seam — the shops row is read ONCE per
// dashboard session and revalidated on focus/reconnect, instead of two bare
// reads per route visit. Vault-door semantics are behavior-identical: only
// the data source changed.
//
// B2 (non-evicting offline auth): the pathname-keyed re-check resolves through
// lib/dashboardAuth — a transport failure with a local session present is
// authenticated-offline and NEVER redirects to /login mid-navigation.
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Non-evicting offline auth (lib/dashboardAuth): local session first,
      // classified network verify. Re-fired per pathname (the historical
      // security posture), but in-dashboard navigation with the radio dead now
      // resolves authenticated-offline instead of bouncing to /login.
      const auth = await resolveDashboardUser(supabase);
      if (cancelled) return;
      if (auth.status === 'unauthenticated') {
        router.push('/login');
        return;
      }
      setUserId(auth.user.id);
    })();
    return () => { cancelled = true; };
  }, [router, supabase, pathname]);

  if (!userId) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  // key={userId}: an account switch on a shared phone remounts a clean scope —
  // the provider registry (lib/swrCache) hands each account its own bucket.
  return (
    <DashboardShell key={userId} userId={userId}>
      {children}
    </DashboardShell>
  );
}

// ── Provider scope — ONE persisted per-user cache for every dashboard page ──

function DashboardShell({ userId, children }: { userId: string; children: React.ReactNode }) {
  const provider = useMemo(() => createPersistedSwrProvider(userId), [userId]);
  return (
    <SWRConfig value={{ provider }}>
      <DashboardGate userId={userId}>{children}</DashboardGate>
    </SWRConfig>
  );
}

// ── The vault door gate — tier truth now flows from the shops-row seam ──────

function DashboardGate({ userId, children }: { userId: string; children: React.ReactNode }) {
  const { shop, verdict, error, mutate } = useShopRow(userId);
  // Loop guard: at most ONE heal attempt per gate mount — in-dashboard
  // navigation can never re-fire the heal (the layout persists across routes).
  const healAttempted = useRef(false);
  // Real-time activation handoff (VaultDoor onUnlocked) — an instant local
  // override while the seam revalidates the fresh tier from the DB.
  const [unlockedTier, setUnlockedTier] = useState<string | null>(null);

  // ORPHAN HEAL: a DEFINITIVE null verdict means the signup trigger never
  // minted this account's shops row (a thrown read error is NOT a verdict —
  // SWR retries those). Fire the heal API once, then revalidate the seam.
  // Failures are swallowed — the vault door renders correctly for a missing
  // row, exactly as before.
  useEffect(() => {
    if (verdict !== null || healAttempted.current) return;
    healAttempted.current = true;
    (async () => {
      try {
        await fetchJSON('/api/shops/ensure', { method: 'POST' });
        await mutate();
      } catch {
        // Heal unavailable (offline/timeout/server) — vault door path below.
      }
    })();
  }, [verdict, mutate]);

  const status = unlockedTier ?? shop?.subscription_tier ?? null;
  const shopName = shop?.shop_name ?? null;

  // 🧠 THE MAGIC: read the seller's plan memory and mint the personalized
  // professional invoice. Prices flow from lib/tiers (founder matrix
  // 2026-08-29: Starter D100 · Pro D250 · Flagship D750); a legacy 'advanced'
  // localStorage intent invoices as Flagship — advanced is no longer sold.
  const paymentLink = useMemo(() => {
    const fallback = `https://wa.me/${SUPPORT_WHATSAPP}`;
    if (typeof window === 'undefined') return fallback;
    if (status !== 'pending' && status !== 'suspended') return fallback;

    const savedPlan = localStorage.getItem('sanndikaa_plan') || 'starter';
    const savedConcierge = localStorage.getItem('sanndikaa_concierge') || 'no';

    const { name: planName, price: planPrice } = invoicePlanFor(savedPlan);

    let total = planPrice;
    let conciergeText = '';
    if (savedConcierge === 'yes') {
      total += CONCIERGE_PRICE;
      conciergeText = `\nI also added the *Done-For-You Setup* (D${CONCIERGE_PRICE}).`;
    }

    const shopNameStr = shopName || 'my boutique';

    // The Ultimate Professional Invoice Message
    const msg = `✨ *Sanndikaa Store Activation*\n\nHello Admin! I need to complete my payment to unlock the dashboard for *${shopNameStr}*.\n\nI selected the *${planName} Plan* (D${planPrice}).${conciergeText}\n\n*Total Due: D${total}*\n\nHow do I send my payment?`;

    return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`;
  }, [status, shopName]);

  // Real-time activation handoff: VaultDoor watched the shops row (realtime +
  // 15s poll + wake/reconnect re-checks), played its "Payment Verified"
  // interstitial, and now hands us the fresh active tier. The local override
  // swaps this gate to the activated branch instantly; the seam revalidation
  // writes the fresh row into the shared cache so every consumer agrees.
  const handleUnlocked = useCallback((tier: string) => {
    setUnlockedTier(tier);
    void mutate();
  }, [mutate]);

  // Loading = no verdict from cache OR network yet, and no terminal error.
  // A returning seller paints instantly from the persisted cache; a failed
  // read with nothing cached degrades to the vault door exactly as the
  // historical error-swallowing read did.
  if (verdict === undefined && !error) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  // 🛑 THE GLOBAL VAULT DOOR — lock screen + real-time unlock live in
  // components/dashboard/VaultDoor.tsx. Same status vocabulary as ever:
  // pending/suspended/null (missing row or unreadable) stay locked.
  if (status === 'pending' || status === 'suspended' || status === null) {
    return <VaultDoor userId={userId} paymentLink={paymentLink} onUnlocked={handleUnlocked} />;
  }

  // Activated accounts get the persistent Shopify-standard sidebar plus the
  // dashboard-wide Ad Studio render notifier: video generations render in the
  // background, so completion toasts + the unseen badge must live on EVERY
  // dashboard page, not just the studio. The lg:pl-60 content region matches
  // the fixed w-60 sidebar; below lg the sidebar becomes a floating-trigger
  // drawer and pages keep their full-width designs. shopName rides the seam —
  // a brand save anywhere updates the sidebar instantly via shopRowKey.
  return (
    <>
      <DashboardSidebar shopName={shopName} />
      <div className="lg:pl-60">{children}</div>
      <AdRenderNotifier />
    </>
  );
}
