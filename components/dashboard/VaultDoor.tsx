'use client';

// THE GLOBAL VAULT DOOR — extracted from app/dashboard/layout.tsx (the lock
// screen markup is preserved verbatim) and upgraded with real-time unlock.
//
// The seller pays the admin over WhatsApp and then sits on this screen. The
// moment the admin flips shops.subscription_tier to any active paid tier, the
// vault must open by itself — no refresh, no "try again". Four writers race
// toward that single unlock, all funneled through one idempotent guard:
//
//   1. REALTIME (instant path): postgres_changes UPDATE on public.shops,
//      filter id=eq.<userId>. Same channel discipline as AdRenderNotifier /
//      VideoManager: unique channel name, removeChannel cleanup, and the
//      subscription only exists while the door is locked. Requires
//      public.shops in the supabase_realtime publication (provisioning.sql
//      SECTION 8) and passes RLS via shops_public_read.
//   2. POLL (the guarantee — Gambia standard): a quiet 15s re-read of the
//      tier through the same browser-client query the layout uses. Ticks are
//      skipped while document.hidden; unchanged state causes zero UI churn.
//      This also covers the missing-row case (admin INSERTs later), which
//      UPDATE-only realtime can never see.
//   3. visibilitychange→visible: the pocket-the-phone case — seller pays,
//      locks the phone, comes back. Immediate re-check on return.
//   4. window 'online': the reconnect case — realtime frames and poll ticks
//      dropped while offline are recovered the instant the network returns.
//
// Unlock condition (strict premium model — there is no free state): the new
// tier, lowercased and trimmed, is NOT in {pending, suspended, ''}. First
// writer through the ref-guard wins; every later signal no-ops. On unlock the
// door plays a ~2s "Payment Verified" interstitial, then hands the raw tier
// to the layout via onUnlocked — the layout swaps to the activated branch and
// fresh sellers hit the OnboardingInterceptor naturally (no shop_websites row
// → Magic Storefront Builder). No handoff logic is duplicated here.

import { createBrowserClient } from '@supabase/ssr';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock } from 'lucide-react';

const LOCKED_TIERS = new Set(['pending', 'suspended', '']);
const RECHECK_INTERVAL_MS = 15_000;
const INTERSTITIAL_MS = 2_000;

const isLockedTier = (tierRaw: string | null | undefined) =>
  LOCKED_TIERS.has((tierRaw ?? '').trim().toLowerCase());

type Props = {
  userId: string;
  paymentLink: string;
  /** Called once, after the interstitial, with the raw (trimmed) active tier. */
  onUnlocked: (tier: string) => void;
};

export default function VaultDoor({ userId, paymentLink, onUnlocked }: Props) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  const [phase, setPhase] = useState<'locked' | 'verified'>('locked');
  // Idempotent transition guard — realtime, the poll, and the event-driven
  // re-checks may all land the same activation; only the first one flips.
  const unlockedRef = useRef(false);
  const verifiedTierRef = useRef<string>('');
  // Ref'd callback so a parent re-render mid-interstitial can never restart
  // (or orphan) the handoff timer.
  const onUnlockedRef = useRef(onUnlocked);
  useEffect(() => {
    onUnlockedRef.current = onUnlocked;
  }, [onUnlocked]);

  const maybeUnlock = useCallback((tierRaw: string | null | undefined) => {
    if (isLockedTier(tierRaw)) return;
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    verifiedTierRef.current = (tierRaw ?? '').trim();
    setPhase('verified');
  }, []);

  // Shared quiet re-check — the same browser-client read the layout performs.
  // Supabase queries return errors instead of throwing; on error we simply
  // wait for the next signal, and an unchanged locked tier touches no state.
  const recheck = useCallback(async () => {
    if (unlockedRef.current) return;
    const { data, error } = await supabase
      .from('shops')
      .select('subscription_tier')
      .eq('id', userId)
      .single();
    if (!error && data) maybeUnlock(data.subscription_tier);
  }, [supabase, userId, maybeUnlock]);

  // ── Writer 1 · realtime (instant path) — only while locked ───────────────
  useEffect(() => {
    if (phase !== 'locked') return;
    const channel = supabase
      .channel(`shops_vault_unlock_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shops',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          maybeUnlock(
            (payload.new as { subscription_tier?: string | null })?.subscription_tier
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [phase, supabase, userId, maybeUnlock]);

  // ── Writer 2 · 15s poll (the guarantee) — skips hidden-tab ticks ─────────
  useEffect(() => {
    if (phase !== 'locked') return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void recheck();
    }, RECHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase, recheck]);

  // ── Writers 3 + 4 · immediate re-check on wake and on reconnect ──────────
  useEffect(() => {
    if (phase !== 'locked') return;
    const onVisibility = () => {
      if (!document.hidden) void recheck();
    };
    const onOnline = () => {
      void recheck();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [phase, recheck]);

  // ── Interstitial → handoff (single-fire by construction) ─────────────────
  useEffect(() => {
    if (phase !== 'verified') return;
    const timer = setTimeout(
      () => onUnlockedRef.current(verifiedTierRef.current),
      INTERSTITIAL_MS
    );
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <AnimatePresence mode="wait">
      {phase === 'verified' ? (
        <motion.div
          key="vault-verified"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex min-h-screen flex-col items-center justify-center bg-[#1a2e1a] px-4 text-center"
        >
          <div className="relative flex h-24 w-24 items-center justify-center">
            <motion.span
              className="absolute inset-0 rounded-full bg-emerald-500/20"
              animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0.15, 0.5] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
              className="relative flex h-20 w-20 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-500/15"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10">
                <motion.path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  stroke="#6ee7b7"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
                />
              </svg>
            </motion.div>
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.4, ease: 'easeOut' }}
            className="mt-8 text-3xl font-black tracking-tight text-white"
          >
            Payment Verified.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.4, ease: 'easeOut' }}
            className="mt-2 text-sm font-bold uppercase tracking-[0.3em] text-emerald-300/80"
          >
            Let&apos;s build.
          </motion.p>
        </motion.div>
      ) : (
        <motion.div
          key="vault-locked"
          initial={false}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex min-h-screen flex-col items-center justify-center bg-[#F9F8F6] px-4 text-center selection:bg-gray-900 selection:text-white"
        >
          <div className="w-full max-w-md rounded-[2rem] bg-white p-10 shadow-2xl border border-red-100">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
              <Lock size={32} />
            </div>
            <h1 className="mb-2 text-2xl font-black tracking-tight text-gray-900">Account Locked</h1>
            <p className="mb-8 text-sm leading-relaxed text-gray-500">
              Your boutique is currently <strong className="text-gray-900 uppercase">Pending Activation</strong>.
              To unlock your Command Center and start uploading products, please complete your subscription payment.
            </p>

            <div className="space-y-3">
              <a
                href={paymentLink}
                target="_blank"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a2e1a] py-4 text-xs font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black"
              >
                Contact Admin to Pay
              </a>

              <button
                onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-50 py-4 text-xs font-bold uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
