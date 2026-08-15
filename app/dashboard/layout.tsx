'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import AdRenderNotifier from '@/components/adstudio/AdRenderNotifier';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import VaultDoor from '@/components/dashboard/VaultDoor';
import { fetchJSON } from '@/lib/transport';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLink, setPaymentLink] = useState('https://wa.me/447599710468');
  // Loop guard: at most ONE heal attempt per layout mount — the ref persists
  // across the pathname-keyed effect re-runs, so in-dashboard navigation can
  // never re-fire the heal.
  const healAttempted = useRef(false);
  
  const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkGlobalAccess() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);

      // Fetch their exact subscription tier and shop name
      let { data } = await supabase.from('shops').select('shop_name, subscription_tier').eq('id', user.id).single();

      // ORPHAN HEAL: a NULL row here means the signup trigger never minted
      // this account's shops row. Fire the heal API once, then refetch ONCE.
      // Failures are swallowed into the existing null path — the vault door
      // below already renders correctly for a missing row.
      if (!data && !healAttempted.current) {
        healAttempted.current = true;
        try {
          await fetchJSON('/api/shops/ensure', { method: 'POST' });
          const refetch = await supabase.from('shops').select('shop_name, subscription_tier').eq('id', user.id).single();
          data = refetch.data;
        } catch {
          // Heal unavailable (offline/timeout/server) — fall through to the
          // vault door's existing missing-row behavior.
        }
      }

      if (data) {
        setStatus(data.subscription_tier);
        setShopName(data.shop_name ?? null);

        // 🧠 THE MAGIC: Read their memory and generate the personalized professional invoice
        if (data.subscription_tier === 'pending' || data.subscription_tier === 'suspended') {
          const savedPlan = localStorage.getItem('sanndikaa_plan') || 'starter';
          const savedConcierge = localStorage.getItem('sanndikaa_concierge') || 'no';

          let planPrice = 399;
          let planName = 'Starter';
          if (savedPlan === 'pro') { planPrice = 1500; planName = 'Pro'; }
          if (savedPlan === 'advanced' || savedPlan === 'flagship') { planPrice = 2500; planName = 'Advanced'; }

          let total = planPrice;
          let conciergeText = '';
          if (savedConcierge === 'yes') {
             total += 500;
             conciergeText = `\nI also added the *Done-For-You Setup* (D500).`;
          }

          const shopNameStr = data.shop_name || 'my boutique';
          
          // The Ultimate Professional Invoice Message
          const msg = `✨ *Sanndikaa Store Activation*\n\nHello Admin! I need to complete my payment to unlock the dashboard for *${shopNameStr}*.\n\nI selected the *${planName} Plan* (D${planPrice}).${conciergeText}\n\n*Total Due: D${total}*\n\nHow do I send my payment?`;
          
          setPaymentLink(`https://wa.me/447599710468?text=${encodeURIComponent(msg)}`);
        }
      }
      setLoading(false);
    }
    checkGlobalAccess();
  }, [router, supabase, pathname]);

  // Real-time activation handoff: VaultDoor watched the shops row (realtime +
  // 15s poll + wake/reconnect re-checks), played its "Payment Verified"
  // interstitial, and now hands us the fresh active tier. Setting status swaps
  // this layout to the activated branch — fresh sellers then hit the
  // OnboardingInterceptor naturally (no shop_websites row → Magic Storefront
  // Builder). VaultDoor unmounts, tearing down its channel and timers.
  const handleUnlocked = useCallback((tier: string) => {
    setStatus(tier);
  }, []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  // 🛑 THE GLOBAL VAULT DOOR — lock screen + real-time unlock live in
  // components/dashboard/VaultDoor.tsx. userId is guaranteed non-null here:
  // the only setLoading(false) runs AFTER a successful auth check (the no-user
  // path redirects and never clears loading). The unreachable null guard
  // renders the same loader — no side effects in render.
  if (status === 'pending' || status === 'suspended' || status === null) {
    if (!userId) {
      return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
    }
    return <VaultDoor userId={userId} paymentLink={paymentLink} onUnlocked={handleUnlocked} />;
  }

  // Activated accounts get the persistent Shopify-standard sidebar plus the
  // dashboard-wide Ad Studio render notifier: video generations render in the
  // background, so completion toasts + the unseen badge must live on EVERY
  // dashboard page, not just the studio. The lg:pl-60 content region matches
  // the fixed w-60 sidebar; below lg the sidebar becomes a floating-trigger
  // drawer and pages keep their full-width designs.
  return (
    <>
      <DashboardSidebar shopName={shopName} />
      <div className="lg:pl-60">{children}</div>
      <AdRenderNotifier />
    </>
  );
}