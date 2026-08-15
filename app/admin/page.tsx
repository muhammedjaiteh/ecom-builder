'use client';

// ─────────────────────────────────────────────────────────────────────────────
// CEO Vault — Approval Queue (mobile-first).
//
// The founder works this page from a phone in The Gambia, so it follows the
// Gambia Standard: SWR + fetchJSON (12s hard deadline, classified errors,
// exponential backoff on connectivity failures), skeleton cards while loading,
// an honest offline chip, and ≥44px tap targets everywhere.
//
// Money decisions are DELIBERATELY not outboxed: an approval either reaches
// the server or the card comes back with an honest error toast. Never a
// silent queue of cash decisions replaying later.
//
// Wall 3 (HONESTY): a CEO who passed the proxy's email wall but lacks the
// app_metadata.role='ceo' claim would otherwise hit a mysterious 403 loop
// (Wall 2 requires role AND email). Instead they get the one-time setup SQL.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Crown,
  DollarSign,
  Inbox,
  Loader2,
  MessageCircle,
  RefreshCw,
  Rocket,
  TrendingUp,
  Users,
  WifiOff,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import BottomSheet from '@/components/website/BottomSheet';
import { useIsMobileViewport } from '@/lib/useIsMobileViewport';
import { fetchJSON, isTransportError } from '@/lib/transport';
import { resolveAdmin } from '@/lib/adminGuard';
import { buildWhatsAppLink } from '@/lib/orderFlow';

// ── Pricing law (mirrors app/dashboard/layout.tsx invoice logic) ─────────────
const PLAN_PRICING: Record<string, { label: string; price: number }> = {
  starter: { label: 'Starter', price: 399 },
  pro: { label: 'Pro', price: 1500 },
  advanced: { label: 'Advanced', price: 2500 },
  flagship: { label: 'Flagship', price: 2500 },
};
const PRICE_RANGE = 'D399–D2,500';

const TIER_OPTIONS: Array<{ tier: string; label: string; price: number; desc: string }> = [
  { tier: 'starter', label: 'Starter', price: 399, desc: 'Core boutique on the marketplace' },
  { tier: 'pro', label: 'Pro', price: 1500, desc: 'Growth toolkit for serious sellers' },
  { tier: 'advanced', label: 'Advanced', price: 2500, desc: 'Unlocks the AI Website Studio' },
  { tier: 'flagship', label: 'Flagship', price: 2500, desc: 'Everything, top priority support' },
];

const dalasi = (n: number) => `D${n.toLocaleString('en-US')}`;

// ── API row shapes ───────────────────────────────────────────────────────────
type PendingShop = {
  id: string;
  shop_name: string | null;
  shop_slug: string | null;
  phone: string | null;
  requested_plan: string | null;
  created_at: string;
  status: string | null;
};

type AdminShop = {
  id: string;
  shop_name: string | null;
  status: string | null;
  subscription_tier: string | null;
  created_at: string;
  owner_email: string | null;
  phone?: string | null;
  requested_plan?: string | null;
};

const fetchPendingQueue = () => fetchJSON<{ shops: PendingShop[] }>('/api/admin/pending');
const fetchAllShops = () => fetchJSON<{ shops: AdminShop[] }>('/api/admin/shops');

// Connectivity failures retry with SWR's backoff; a server verdict (4xx/5xx)
// won't change by hammering — focus/reconnect revalidation picks those up.
const SWR_OPTS = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  errorRetryCount: 6,
  shouldRetryOnError: (err: unknown) => !(isTransportError(err) && err.kind === 'server'),
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  if (d < 35) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function planFor(requestedPlan: string | null | undefined) {
  const key = (requestedPlan ?? '').toLowerCase().trim();
  return PLAN_PRICING[key] ? { key, ...PLAN_PRICING[key] } : null;
}

/** Prefilled payment-confirmation WhatsApp message (admin → seller). */
function paymentConfirmationMessage(shop: PendingShop): string {
  const name = shop.shop_name || 'there';
  const plan = planFor(shop.requested_plan);
  const planLine = plan
    ? `the *${plan.label} Plan* (${dalasi(plan.price)})`
    : `your selected plan (${PRICE_RANGE})`;
  return `✨ *Sanndikaa Store Activation*\n\nHello ${name}! This is Sanndikaa. We are processing your store activation for ${planLine}.\n\nPlease reply with your payment confirmation (Wave screenshot or transaction ID) and we will unlock your dashboard right away.`;
}

function describeMutationError(err: unknown, verb: string): string {
  if (isTransportError(err)) {
    if (err.kind === 'offline') return `You're offline — the ${verb} needs a connection. Nothing was changed.`;
    if (err.kind === 'timeout') return `The server didn't answer in time — the ${verb} was NOT confirmed. Try again.`;
    if (err.kind === 'server') return err.message;
  }
  return `Could not complete the ${verb}. Please try again.`;
}

const TIER_BADGES: Record<string, { icon: LucideIcon; classes: string; label: string }> = {
  pending: { icon: Clock, classes: 'bg-yellow-100 border-yellow-200 text-yellow-700', label: 'Pending' },
  starter: { icon: CheckCircle2, classes: 'bg-green-100 border-green-200 text-green-700', label: 'Starter' },
  pro: { icon: Crown, classes: 'bg-purple-100 border-purple-200 text-purple-700', label: 'Pro' },
  advanced: { icon: Rocket, classes: 'bg-blue-100 border-blue-200 text-blue-700', label: 'Advanced' },
  flagship: { icon: Crown, classes: 'bg-amber-100 border-amber-200 text-amber-800', label: 'Flagship' },
  suspended: { icon: XCircle, classes: 'bg-red-100 border-red-200 text-red-700', label: 'Suspended' },
  free: { icon: Clock, classes: 'bg-gray-100 border-gray-200 text-gray-700', label: 'Free' },
};

function TierBadge({ tier }: { tier: string | null }) {
  const badge = TIER_BADGES[(tier ?? 'pending').toLowerCase()] ?? TIER_BADGES.pending;
  const Icon = badge.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badge.classes}`}>
      <Icon size={11} />
      {badge.label}
    </span>
  );
}

// The shop the approval surface is acting on, regardless of which list opened it.
type ApprovalTarget = {
  id: string;
  name: string;
  requestedPlan: string | null;
  source: 'queue' | 'all';
};

type Toast = { type: 'success' | 'error'; message: string };

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminApprovalQueue() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();
  const isMobile = useIsMobileViewport();

  // Wall 3 — role claim check (client-side we only trust the role flag; the
  // email wall is a server judgment made by the proxy before we ever render).
  const [gate, setGate] = useState<'checking' | 'ready' | 'needs-setup'>('checking');
  const [ceoEmail, setCeoEmail] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;
      if (!user) {
        router.push('/login');
        return;
      }
      setCeoEmail(user.email ?? '');
      setGate(resolveAdmin(user).role ? 'ready' : 'needs-setup');
    });
    return () => { cancelled = true; };
  }, [supabase, router]);

  // ── Queue data (Gambia Standard transport) ────────────────────────────────
  const {
    data: pendingData,
    error: pendingError,
    isLoading: pendingLoading,
    mutate: mutatePending,
  } = useSWR(gate === 'ready' ? 'admin:pending-queue' : null, fetchPendingQueue, SWR_OPTS);

  const queue = pendingData?.shops ?? [];
  const isOffline = isTransportError(pendingError) && pendingError.kind === 'offline';

  // ── All shops (lazy — only fetched when the CEO opens the section) ────────
  const [allOpen, setAllOpen] = useState(false);
  const {
    data: allData,
    error: allError,
    isLoading: allLoading,
    mutate: mutateAll,
  } = useSWR(gate === 'ready' && allOpen ? 'admin:all-shops' : null, fetchAllShops, SWR_OPTS);
  const allShops = allData?.shops ?? [];

  // ── Toasts ────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((type: Toast['type'], message: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  // ── Suspend arming (two-tap confirm — no accidental suspensions) ──────────
  const [armedSuspendId, setArmedSuspendId] = useState<string | null>(null);
  const armTimer = useRef<number | null>(null);
  const armSuspend = useCallback((id: string): boolean => {
    if (armedSuspendId === id) {
      if (armTimer.current !== null) window.clearTimeout(armTimer.current);
      setArmedSuspendId(null);
      return true; // armed → this tap confirms
    }
    setArmedSuspendId(id);
    if (armTimer.current !== null) window.clearTimeout(armTimer.current);
    armTimer.current = window.setTimeout(() => setArmedSuspendId(null), 3500);
    return false;
  }, [armedSuspendId]);

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    if (armTimer.current !== null) window.clearTimeout(armTimer.current);
  }, []);

  // ── Approval surface state ────────────────────────────────────────────────
  const [approvalTarget, setApprovalTarget] = useState<ApprovalTarget | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [updatingShopId, setUpdatingShopId] = useState<string | null>(null);

  const openApproval = useCallback((target: ApprovalTarget) => {
    // Plan-derived default: advanced/flagship → that tier; starter/pro → same;
    // null → explicit choice required (confirm stays disabled).
    setSelectedTier(planFor(target.requestedPlan)?.key ?? null);
    setApprovalTarget(target);
  }, []);

  const closeApproval = useCallback(() => {
    if (confirming) return; // never dismiss mid-flight on the 'all' path
    setApprovalTarget(null);
  }, [confirming]);

  // Desktop modal Escape parity — BottomSheet owns its own Escape handling.
  useEffect(() => {
    if (!approvalTarget || isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeApproval();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [approvalTarget, isMobile, closeApproval]);

  const patchShop = useCallback(
    (payload: { id: string; status: string; subscription_tier: string }) =>
      fetchJSON<{ success: boolean; shop: AdminShop }>('/api/admin/shops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    []
  );

  // Approve (queue): optimistic — the card vanishes the instant the CEO
  // confirms; a classified failure restores it with an honest toast.
  const confirmApproval = useCallback(async () => {
    if (!approvalTarget || !selectedTier) return;
    const target = approvalTarget;
    const tierLabel = PLAN_PRICING[selectedTier]?.label ?? selectedTier;

    if (target.source === 'queue') {
      const previous = pendingData;
      setApprovalTarget(null);
      await mutatePending(
        (current) => ({ shops: (current?.shops ?? []).filter((s) => s.id !== target.id) }),
        { revalidate: false }
      );
      try {
        await patchShop({ id: target.id, status: 'active', subscription_tier: selectedTier });
        showToast('success', `${target.name} is live on ${tierLabel}. Their vault door opens in seconds.`);
        mutatePending();
        if (allOpen) mutateAll();
      } catch (err) {
        await mutatePending(previous, { revalidate: false });
        showToast('error', describeMutationError(err, 'approval'));
      }
      return;
    }

    // 'all' source: non-optimistic — hold the surface open with a spinner
    // until the server answers (tier changes on live shops are rarer and the
    // list must reflect truth, not hope).
    setConfirming(true);
    try {
      await patchShop({ id: target.id, status: 'active', subscription_tier: selectedTier });
      setConfirming(false);
      setApprovalTarget(null);
      showToast('success', `${target.name} moved to ${tierLabel}.`);
      mutateAll();
      mutatePending();
    } catch (err) {
      setConfirming(false);
      showToast('error', describeMutationError(err, 'tier change'));
    }
  }, [approvalTarget, selectedTier, pendingData, mutatePending, mutateAll, allOpen, patchShop, showToast]);

  // Suspend (queue): optimistic removal, same restore-on-failure contract.
  // subscription_tier goes to 'suspended' (NOT 'free' — the vault door gates
  // on the tier, so 'free' would silently leave the dashboard unlocked).
  const suspendFromQueue = useCallback(async (shop: PendingShop) => {
    if (!armSuspend(shop.id)) return;
    const previous = pendingData;
    await mutatePending(
      (current) => ({ shops: (current?.shops ?? []).filter((s) => s.id !== shop.id) }),
      { revalidate: false }
    );
    try {
      await patchShop({ id: shop.id, status: 'suspended', subscription_tier: 'suspended' });
      showToast('success', `${shop.shop_name || 'Shop'} suspended.`);
      mutatePending();
      if (allOpen) mutateAll();
    } catch (err) {
      await mutatePending(previous, { revalidate: false });
      showToast('error', describeMutationError(err, 'suspension'));
    }
  }, [armSuspend, pendingData, mutatePending, mutateAll, allOpen, patchShop, showToast]);

  // All-shops row actions (suspend / re-queue) — non-optimistic, per-row busy.
  const runAllShopsAction = useCallback(async (
    shop: AdminShop,
    payload: { status: string; subscription_tier: string },
    verb: string,
    successMessage: string
  ) => {
    setUpdatingShopId(shop.id);
    try {
      await patchShop({ id: shop.id, ...payload });
      showToast('success', successMessage);
      mutateAll();
      mutatePending();
    } catch (err) {
      showToast('error', describeMutationError(err, verb));
    } finally {
      setUpdatingShopId(null);
    }
  }, [patchShop, showToast, mutateAll, mutatePending]);

  // ── Gate branches ─────────────────────────────────────────────────────────
  if (gate === 'checking') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (gate === 'needs-setup') {
    // Wall 3: the proxy's email wall let this account in, but the durable
    // role claim is missing — every /api/admin/* call would 403. Honest fix
    // path instead of a mysterious loop.
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <h2 className="text-base font-black text-amber-900">One-time CEO setup required</h2>
              <p className="mt-2 text-sm leading-relaxed text-amber-800">
                Your account passed the email wall, but the durable <code className="rounded bg-amber-100 px-1 font-mono text-xs">role: ceo</code> claim
                is not on it yet — the vault APIs stay locked (403) until it is. Run this once in the
                Supabase SQL Editor:
              </p>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs leading-relaxed text-green-300">
{`UPDATE auth.users
SET raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"ceo"}'::jsonb
WHERE email = '${ceoEmail || 'YOUR-ADMIN-EMAIL'}';`}
              </pre>
              <p className="mt-3 text-sm leading-relaxed text-amber-800">
                Then reload this page. If the notice persists, sign out and back in so a fresh
                session picks up the claim. Also set <code className="rounded bg-amber-100 px-1 font-mono text-xs">ADMIN_EMAIL</code> in{' '}
                <code className="rounded bg-amber-100 px-1 font-mono text-xs">.env.local</code> and the Vercel project environment.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Ready: the queue ──────────────────────────────────────────────────────
  const activeTierOption = selectedTier ? TIER_OPTIONS.find((t) => t.tier === selectedTier) : undefined;

  const approvalBody = approvalTarget && (
    <div className="px-5 pb-2 pt-1">
      {!planFor(approvalTarget.requestedPlan) && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          No plan was recorded at signup — pick the tier the seller actually paid for.
        </p>
      )}
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Subscription tier">
        {TIER_OPTIONS.map((opt) => {
          const selected = selectedTier === opt.tier;
          return (
            <button
              key={opt.tier}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setSelectedTier(opt.tier)}
              className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left transition ${
                selected ? 'border-gray-900 bg-gray-900/[0.03] ring-1 ring-gray-900' : 'border-gray-200 active:bg-gray-50'
              }`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-900">
                  {opt.label} · {dalasi(opt.price)}
                </span>
                <span className="block truncate text-xs text-gray-500">{opt.desc}</span>
              </span>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  selected ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-transparent'
                }`}
                aria-hidden
              >
                <Check size={13} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const approvalFooter = approvalTarget && (
    <div className="px-5 pt-3">
      <button
        type="button"
        onClick={confirmApproval}
        disabled={!selectedTier || confirming}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-40"
      >
        {confirming ? (
          <Loader2 size={16} className="animate-spin" />
        ) : activeTierOption ? (
          <>Activate — {activeTierOption.label} · {dalasi(activeTierOption.price)}</>
        ) : (
          'Choose a plan to continue'
        )}
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Queue header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-black tracking-tight text-gray-900">Approval Queue</h2>
          {!pendingLoading && (
            <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-bold text-yellow-800">
              {queue.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOffline && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
              <WifiOff size={12} />
              Offline
            </span>
          )}
          <button
            type="button"
            onClick={() => mutatePending()}
            aria-label="Refresh queue"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition active:bg-gray-50"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Honest stale-data note: we have a queue AND a live error */}
      {pendingError && queue.length > 0 && !isOffline && (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Couldn&apos;t refresh just now — showing the last synced queue.
        </p>
      )}

      {/* Skeletons (first load only) */}
      {pendingLoading && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="h-4 w-40 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-56 rounded bg-gray-100" />
              <div className="mt-4 h-11 w-full rounded-xl bg-gray-100" />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="h-11 rounded-xl bg-gray-100" />
                <div className="h-11 rounded-xl bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hard failure with nothing to show */}
      {!pendingLoading && pendingError && queue.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white py-14 text-center shadow-sm">
          {isOffline ? (
            <WifiOff className="mx-auto h-10 w-10 text-gray-300" />
          ) : (
            <AlertTriangle className="mx-auto h-10 w-10 text-gray-300" />
          )}
          <p className="mt-3 text-sm font-semibold text-gray-600">
            {isOffline ? 'You are offline — the queue needs a connection.' : 'The queue failed to load.'}
          </p>
          <button
            type="button"
            onClick={() => mutatePending()}
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gray-900 px-5 text-sm font-bold text-white"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      )}

      {/* Empty queue */}
      {!pendingLoading && !pendingError && queue.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white py-14 text-center shadow-sm">
          <Inbox className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-semibold text-gray-600">Queue clear — no sellers waiting.</p>
        </div>
      )}

      {/* The queue itself */}
      {queue.length > 0 && (
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {queue.map((shop) => {
              const plan = planFor(shop.requested_plan);
              const waLink = buildWhatsAppLink(shop.phone, paymentConfirmationMessage(shop));
              const armed = armedSuspendId === shop.id;
              return (
                <motion.div
                  key={shop.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-gray-900">
                        {shop.shop_name || 'Unnamed shop'}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {shop.shop_slug ? `/${shop.shop_slug} · ` : ''}signed up {timeAgo(shop.created_at)}
                      </p>
                    </div>
                    {plan ? (
                      <span className="shrink-0 rounded-full bg-gray-900 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                        {plan.label}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        No plan
                      </span>
                    )}
                  </div>

                  <p className="mt-2.5 text-sm text-gray-700">
                    {plan ? (
                      <>Amount due: <span className="font-black text-gray-900">{dalasi(plan.price)}</span></>
                    ) : (
                      <>Plan not recorded — <span className="font-black text-gray-900">{PRICE_RANGE}</span> due</>
                    )}
                  </p>

                  {waLink ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 text-sm font-bold text-green-700 transition active:bg-green-100"
                    >
                      <MessageCircle size={16} />
                      Confirm payment on WhatsApp
                    </a>
                  ) : (
                    <div className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-400">
                      <MessageCircle size={16} />
                      No phone on file
                    </div>
                  )}

                  <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        openApproval({
                          id: shop.id,
                          name: shop.shop_name || 'Unnamed shop',
                          requestedPlan: shop.requested_plan,
                          source: 'queue',
                        })
                      }
                      className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-bold text-white transition active:scale-[0.99]"
                    >
                      <CheckCircle2 size={16} />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => suspendFromQueue(shop)}
                      className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition ${
                        armed
                          ? 'border-red-600 bg-red-600 text-white'
                          : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50'
                      }`}
                    >
                      <Ban size={15} />
                      {armed ? 'Confirm' : 'Suspend'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── All shops (the preserved god-mode tools) ───────────────────────── */}
      <div className="mt-8">
        <button
          type="button"
          onClick={() => setAllOpen((v) => !v)}
          aria-expanded={allOpen}
          className="flex min-h-[44px] w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 shadow-sm transition active:bg-gray-50"
        >
          <span className="flex items-center gap-2 text-sm font-black text-gray-900">
            <Users size={16} className="text-gray-500" />
            All shops
          </span>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${allOpen ? 'rotate-180' : ''}`} />
        </button>

        {allOpen && (
          <div className="mt-3">
            {allLoading && (
              <div className="flex flex-col gap-3">
                {[0, 1].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl border border-gray-200 bg-white shadow-sm" />
                ))}
              </div>
            )}

            {!allLoading && allError && allShops.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white py-10 text-center shadow-sm">
                <p className="text-sm font-semibold text-gray-600">
                  {isTransportError(allError) && allError.kind === 'offline'
                    ? 'You are offline — shop list needs a connection.'
                    : 'Failed to load shops.'}
                </p>
                <button
                  type="button"
                  onClick={() => mutateAll()}
                  className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gray-900 px-5 text-sm font-bold text-white"
                >
                  <RefreshCw size={14} />
                  Try again
                </button>
              </div>
            )}

            {allShops.length > 0 && (
              <>
                {/* Stats (formerly the top-of-page cards) */}
                <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {(() => {
                    const active = allShops.filter((s) => (s.status ?? '').toLowerCase() === 'active');
                    const revenue = active.reduce(
                      (sum, s) => sum + (PLAN_PRICING[(s.subscription_tier ?? '').toLowerCase()]?.price ?? 0),
                      0
                    );
                    const cells = [
                      { label: 'Total', value: String(allShops.length), icon: Users, tone: 'text-gray-600' },
                      { label: 'Pending', value: String(queue.length), icon: Clock, tone: 'text-yellow-600' },
                      { label: 'Active', value: String(active.length), icon: TrendingUp, tone: 'text-green-600' },
                      { label: 'Monthly', value: dalasi(revenue), icon: DollarSign, tone: 'text-emerald-600' },
                    ];
                    return cells.map((c) => {
                      const Icon = c.icon;
                      return (
                        <div key={c.label} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{c.label}</p>
                            <Icon size={14} className={c.tone} />
                          </div>
                          <p className="mt-1 text-lg font-black text-gray-900">{c.value}</p>
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="flex flex-col gap-3">
                  {allShops.map((shop) => {
                    const tier = (shop.subscription_tier ?? 'pending').toLowerCase();
                    const busy = updatingShopId === shop.id;
                    const armed = armedSuspendId === shop.id;
                    return (
                      <div key={shop.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-gray-900">
                              {shop.shop_name || 'Unnamed shop'}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-gray-500">
                              {shop.owner_email || 'No email linked'} · joined{' '}
                              {new Date(shop.created_at).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                          <TierBadge tier={tier} />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              openApproval({
                                id: shop.id,
                                name: shop.shop_name || 'Unnamed shop',
                                requestedPlan: PLAN_PRICING[tier] ? tier : (shop.requested_plan ?? null),
                                source: 'all',
                              })
                            }
                            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-gray-900 bg-gray-900 px-4 text-xs font-bold text-white transition active:scale-[0.99] disabled:opacity-40"
                          >
                            {PLAN_PRICING[tier] ? 'Change plan' : 'Activate'}
                          </button>
                          {tier !== 'suspended' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                if (!armSuspend(shop.id)) return;
                                runAllShopsAction(
                                  shop,
                                  { status: 'suspended', subscription_tier: 'suspended' },
                                  'suspension',
                                  `${shop.shop_name || 'Shop'} suspended.`
                                );
                              }}
                              className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-bold transition disabled:opacity-40 ${
                                armed
                                  ? 'border-red-600 bg-red-600 text-white'
                                  : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50'
                              }`}
                            >
                              {busy ? <Loader2 size={13} className="animate-spin" /> : armed ? 'Confirm' : 'Suspend'}
                            </button>
                          )}
                          {tier !== 'pending' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runAllShopsAction(
                                  shop,
                                  { status: 'active', subscription_tier: 'pending' },
                                  'reset',
                                  `${shop.shop_name || 'Shop'} moved back to the queue.`
                                )
                              }
                              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-bold text-gray-600 transition active:bg-gray-50 disabled:opacity-40"
                            >
                              {busy ? <Loader2 size={13} className="animate-spin" /> : 'Back to queue'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Approval surface: shared BottomSheet on mobile ─────────────────── */}
      <AnimatePresence>
        {approvalTarget && isMobile && (
          <BottomSheet label={`Activate ${approvalTarget.name}`} onDismiss={closeApproval} footer={approvalFooter}>
            {approvalBody}
          </BottomSheet>
        )}
      </AnimatePresence>

      {/* Centered modal on desktop */}
      <AnimatePresence>
        {approvalTarget && !isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={closeApproval}
              className="absolute inset-0 cursor-default bg-neutral-950/60 backdrop-blur-[2px]"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`Activate ${approvalTarget.name}`}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3 pl-5 pr-2.5 pt-3">
                <p className="truncate text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Activate {approvalTarget.name}
                </p>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={closeApproval}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100"
                >
                  <X size={16} />
                </button>
              </div>
              {approvalBody}
              <div className="border-t border-gray-100 pb-4">{approvalFooter}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-x-4 z-[60] sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2"
            style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            <div
              role="status"
              className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl ${
                toast.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              )}
              <span className="min-w-0">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
