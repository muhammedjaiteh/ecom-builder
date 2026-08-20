'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR, { SWRConfig, useSWRConfig } from 'swr';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, Crown, Loader2, Lock, Plus, Sparkles, Wand2, WifiOff,
} from 'lucide-react';
import type { ShopWebsiteRow } from '@/lib/siteTemplates';
import { fetchJSON, isTransportError } from '@/lib/transport';
import { createPersistedSwrProvider, websiteContentKey } from '@/lib/swrCache';

// ─────────────────────────────────────────────────────────────────────────────
// THE "AHA!" ONBOARDING SEQUENCE — Magic Storefront Builder + its interceptor.
//
// OnboardingInterceptor wraps the command center's render tree. It resolves
// exactly one question through the owner content API (GET
// /api/websites/content via SWR over the per-user PERSISTED cache — never a
// browser-client read of shop_websites, which has no select policies and
// returns zero rows silently):
//
//   data === undefined → verdict unknown (no cache, fetch pending/failed)
//                        → the normal dashboard, exactly as today. Existing
//                        users NEVER see an onboarding flash.
//   data === null      → the owner channel CONFIRMED no website
//                        → ONLY the MagicStorefrontBuilder, centered.
//   data === row       → a website exists → the normal dashboard.
//
// Because the cache is persisted per user, a returning no-website seller's
// confirmed-null verdict paints the builder on the FIRST frame — and an
// existing seller's cached row pins the dashboard even while offline.
//
// The builder itself renders HONEST stepped states (the generator API
// hard-rejects otherwise — a magic button that always errors is anti-aha):
//   products === 0            → "Add Your First Product" → /dashboard/add
//   tier below Advanced       → the studio's premium lock idiom → /pricing
//   qualifying                → one ≥44px "Generate My Store" button firing
//                               the generator's preserved LEGACY one-call path.
//
// On success the fresh row is written into the SAME user-namespaced SWR cache
// the themes page reads (websiteContentKey) BEFORE router.push — so the
// editor paints the brand-new site instantly from cache, zero loading screen.
// ─────────────────────────────────────────────────────────────────────────────

const WEBSITE_TIERS = ['advanced', 'flagship'];

// Same client-side ceiling as WebsiteGeneratorStudio's AI steps: the route's
// maxDuration (120s) plus a small network margin, passed to fetchJSON as the
// per-call deadline override. The transport default of 12s is for ordinary
// API calls, not generation.
const GENERATION_TIMEOUT_MS = 125_000;

// Rotating loader copy — cycled every ~2.5s with an AnimatePresence crossfade.
const GENERATION_MESSAGES = [
  'Analyzing your brand profile…',
  'Designing your visual blocks…',
  'Composing your premium layout…',
  'Injecting your products…',
  // Honest lines for the zero-click asset phase (hero via the Ad Studio
  // IC-Light engine, AI logo draft) that now runs inside the same call.
  'Composing your hero shot…',
  'Drafting your logo…',
] as const;
const MESSAGE_ROTATE_MS = 2_500;

// Owner-channel fetcher — identical contract to the themes page's fetcher, so
// both pages read and populate the SAME key in the SAME per-user persisted
// cache. fetchJSON's 12s default deadline classifies a dead socket as
// 'timeout' instead of hanging the verdict.
async function fetchWebsiteRow(): Promise<ShopWebsiteRow | null> {
  const data = await fetchJSON<{ website: ShopWebsiteRow | null }>('/api/websites/content');
  return data.website ?? null;
}

// ═════════════════════════════════════════════════════════════════════════════
// The interceptor — mounted by app/dashboard/page.tsx around its render tree.
// ═════════════════════════════════════════════════════════════════════════════

type OnboardingInterceptorProps = {
  userId: string;
  productsCount: number;
  tier: string | null;
  children: React.ReactNode;
};

export function OnboardingInterceptor({ userId, productsCount, tier, children }: OnboardingInterceptorProps) {
  // The exact provider instance the themes page mounts: lib/swrCache keeps a
  // module-level registry of ONE cache per user per session, so the verdict
  // read here and the success mutate in the builder land in the very cache
  // /dashboard/online-store/themes paints from.
  const provider = useMemo(() => createPersistedSwrProvider(userId), [userId]);
  return (
    <SWRConfig value={{ provider }}>
      <InterceptorVerdict userId={userId} productsCount={productsCount} tier={tier}>
        {children}
      </InterceptorVerdict>
    </SWRConfig>
  );
}

function InterceptorVerdict({ userId, productsCount, tier, children }: OnboardingInterceptorProps) {
  const { cache } = useSWRConfig();
  const tierQualifies = WEBSITE_TIERS.includes((tier ?? '').toLowerCase().trim());

  // Locked tiers would 403 on the owner GET (it tier-gates like every website
  // route) — never fire a doomed request for them (the themes-page idiom). But
  // DO read an already-cached verdict: a seller whose tier lapsed after a
  // confirmed 'no website' still gets the builder, whose upsell state handles
  // the lock honestly.
  const verdictKey = websiteContentKey(userId);
  const cachedVerdict = cache.get(verdictKey);
  const hasCachedVerdict = cachedVerdict !== undefined && cachedVerdict.data !== undefined;

  const { data } = useSWR<ShopWebsiteRow | null>(
    tierQualifies || hasCachedVerdict ? verdictKey : null,
    fetchWebsiteRow,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      // Connectivity failures retry with SWR's backoff; a server verdict
      // (403/5xx) won't change by hammering — focus/reconnect picks those up.
      shouldRetryOnError: (err) => !(isTransportError(err) && err.kind === 'server'),
    }
  );

  // Sticky through the success handoff: the moment the builder writes the
  // fresh row into the cache, `data` becomes a row — without this flag the
  // dashboard would flash in behind the builder while router.push settles.
  const [handingOff, setHandingOff] = useState(false);

  // Session-local escape hatch: a seller with live orders but no generated
  // website must never be locked out of their command center. Skipping is
  // deliberate and in-memory only — the next visit shows the builder again.
  const [skipped, setSkipped] = useState(false);

  if ((data === null && !skipped) || handingOff) {
    return (
      <MagicStorefrontBuilder
        userId={userId}
        productsCount={productsCount}
        tier={tier}
        onHandoffStart={() => setHandingOff(true)}
        onSkip={() => setSkipped(true)}
      />
    );
  }
  return <>{children}</>;
}

// ═════════════════════════════════════════════════════════════════════════════
// The builder — the centered welcome + honest stepped states + generation.
// Must render inside the interceptor's SWRConfig scope: its success mutate
// binds to the scoped per-user persisted cache.
// ═════════════════════════════════════════════════════════════════════════════

type BuilderPhase = 'ready' | 'generating' | 'handoff';

// Which recovery the failure banner leads with. 'retry' re-fires generation;
// 'add-product' and 'upgrade' re-route the STEPPED CARD below the banner, so
// the server's verdict overrides stale page props without duplicate CTAs.
type FailureCta = 'retry' | 'add-product' | 'upgrade';

type BuilderFailure = {
  message: string;
  cta: FailureCta;
  /** Offline failures park an auto-retry that fires on the window 'online'
   *  event — the banner copy promises exactly that. */
  offline?: boolean;
};

type MagicStorefrontBuilderProps = {
  userId: string;
  productsCount: number;
  tier: string | null;
  /** Interceptor hook — flips its sticky flag BEFORE the fresh row lands in
   *  the shared cache, so the dashboard never flashes mid-navigation. */
  onHandoffStart?: () => void;
  /** Interceptor hook — session-local "open my dashboard anyway" escape. */
  onSkip?: () => void;
};

export default function MagicStorefrontBuilder({
  userId,
  productsCount,
  tier,
  onHandoffStart,
  onSkip,
}: MagicStorefrontBuilderProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();

  const [phase, setPhase] = useState<BuilderPhase>('ready');
  const [failure, setFailure] = useState<BuilderFailure | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  // External abort composed into fetchJSON — unmount/cancel/superseded all
  // surface as the silent classified 'abort' kind; deadlines are fetchJSON's.
  const abortRef = useRef<AbortController | null>(null);
  const pendingRetryRef = useRef(false);
  // Render-refreshed dispatch so the 'online' auto-retry never runs a stale
  // first-render closure.
  const retryRef = useRef<() => void>(() => {});

  const tierQualifies = WEBSITE_TIERS.includes((tier ?? '').toLowerCase().trim());

  // Abort any in-flight generation when the seller navigates away.
  useEffect(() => () => { abortRef.current?.abort('unmount'); }, []);

  // Elapsed ticker while generating.
  useEffect(() => {
    if (phase !== 'generating') { setElapsedSec(0); return; }
    const started = Date.now();
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Cycling loader copy.
  useEffect(() => {
    if (phase !== 'generating') { setMessageIndex(0); return; }
    const t = setInterval(() => setMessageIndex((i) => (i + 1) % GENERATION_MESSAGES.length), MESSAGE_ROTATE_MS);
    return () => clearInterval(t);
  }, [phase]);

  // Connectivity returned → fire the parked offline retry (if any).
  useEffect(() => {
    const onOnline = () => {
      if (!pendingRetryRef.current) return;
      pendingRetryRef.current = false;
      retryRef.current();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const handleGenerate = async () => {
    setFailure(null);
    pendingRetryRef.current = false;
    setPhase('generating');
    abortRef.current?.abort('superseded');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // DELIBERATE LEGACY PATH: a body WITHOUT `step` runs the generator's
      // preserved single-step contract (app/api/ai/generate-website/route.ts
      // treats a step-less body as 'execute' with no concept) — the AI picks
      // the best-fit template from the inventory itself and builds the full
      // site in ONE call. Onboarding is one click by design: no concept step,
      // no choice paralysis. The studio's richer two-step flow is one screen
      // away once the seller lands in the Website Studio.
      const row = await fetchJSON<ShopWebsiteRow & { shop_slug?: unknown }>(
        '/api/ai/generate-website',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          signal: controller.signal,
        },
        { timeoutMs: GENERATION_TIMEOUT_MS }
      );
      if (controller.signal.aborted) return;

      // THE INSTANT-EDITOR HANDOFF — the order is the whole trick:
      //   1. sticky-flag the interceptor (the fresh row must not swap the
      //      dashboard in behind this screen while navigation is in flight),
      //   2. write the row into the shared per-user SWR cache under the SAME
      //      key the themes page reads — no revalidate, this response IS the
      //      authoritative row,
      //   3. navigate. The themes page then paints the brand-new site from
      //      cache on its first frame — zero loading screen. That's the aha.
      setPhase('handoff');
      onHandoffStart?.();
      await mutate(websiteContentKey(userId), row as ShopWebsiteRow, { revalidate: false });
      router.push('/dashboard/online-store/themes');
    } catch (err) {
      if (isTransportError(err)) {
        // 'abort' = cancel/unmount/superseded — the UI is already where it
        // belongs; stay silent.
        if (err.kind === 'abort') return;
        if (err.kind === 'timeout') {
          setFailure({
            message: 'The build took longer than expected and timed out. Nothing was lost — try again.',
            cta: 'retry',
          });
        } else if (err.kind === 'offline') {
          pendingRetryRef.current = true;
          setFailure({
            message: 'You appear to be offline. We’ll start the build automatically the moment your connection returns.',
            cta: 'retry',
            offline: true,
          });
        } else if (err.status === 403) {
          // Tier gate — the server's verdict overrides the page's tier prop.
          setFailure({ message: err.message, cta: 'upgrade' });
        } else if (err.status === 400) {
          // Inventory gate — 'Add at least one product…' in the API's words.
          setFailure({ message: err.message, cta: 'add-product' });
        } else {
          // 429 busy ('try again in a moment') and 5xx both recover the same
          // way: the API's own message plus a retry.
          setFailure({
            message: err.message || 'Failed to generate your storefront. Please try again.',
            cta: 'retry',
          });
        }
      } else {
        setFailure({ message: 'Something unexpected interrupted the build. Please try again.', cta: 'retry' });
      }
      setPhase('ready');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  // Keep the offline auto-retry pointed at the current closure.
  retryRef.current = () => { void handleGenerate(); };

  const handleCancel = () => {
    abortRef.current?.abort('cancel');
    setPhase('ready');
  };

  // Honest stepped states — server failure verdicts override stale props.
  const showAddProduct = productsCount === 0 || failure?.cta === 'add-product';
  const showUpgrade = !showAddProduct && (!tierQualifies || failure?.cta === 'upgrade');

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F9F8F6] px-4 py-16 font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-xl text-center"
      >
        {/* Brand mark */}
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-[#1a2e1a] shadow-lg">
          <Wand2 size={24} className="text-[#f0a500]" />
        </div>

        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Sanndikaa · Website Studio</p>
        <h1 className="mt-3 font-serif text-4xl font-bold leading-tight text-[#1a2e1a] md:text-5xl">
          Welcome to Sanndikaa.
        </h1>
        <p className="mt-2 font-serif text-2xl text-gray-500 md:text-3xl">Let’s build your storefront.</p>

        <div className="mt-10">
          <AnimatePresence mode="wait">
            {phase === 'generating' && (
              <motion.div
                key="generating"
                role="status"
                aria-live="polite"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="rounded-[2rem] border border-gray-100 bg-white p-10 shadow-sm md:p-12"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1a2e1a]">
                  <Loader2 className="h-6 w-6 animate-spin text-[#f0a500]" />
                </div>
                {/* Fixed-height slot so the crossfade never reflows the card */}
                <div className="mt-6 flex h-8 items-center justify-center">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={messageIndex}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="font-serif text-lg font-bold text-gray-900"
                    >
                      {GENERATION_MESSAGES[messageIndex]}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  Building your complete storefront — usually under a minute.
                </p>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Elapsed {elapsedSec}s
                </p>
                <button
                  onClick={handleCancel}
                  className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-gray-50 px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  Cancel
                </button>
              </motion.div>
            )}

            {phase === 'handoff' && (
              <motion.div
                key="handoff"
                role="status"
                aria-live="polite"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="rounded-[2rem] border border-emerald-100 bg-white p-10 shadow-sm md:p-12"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                </div>
                <h2 className="mt-6 font-serif text-2xl font-bold text-gray-900">Your storefront is ready.</h2>
                <p className="mt-2 text-sm text-gray-500">Opening your Website Studio…</p>
              </motion.div>
            )}

            {phase === 'ready' && (
              <motion.div
                key="ready"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                {/* Classified failure banner — never a dead end: every kind
                    carries its recovery (retry here, or the re-routed CTA in
                    the stepped card just below). */}
                {failure && (
                  <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-left">
                    <div className="flex items-start gap-3">
                      {failure.offline
                        ? <WifiOff size={16} className="mt-0.5 shrink-0 text-red-500" />
                        : <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />}
                      <p className="flex-1 text-sm font-medium leading-relaxed text-red-800">{failure.message}</p>
                    </div>
                    {failure.cta === 'retry' && (
                      <button
                        onClick={() => void handleGenerate()}
                        className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-red-700 active:scale-95"
                      >
                        Try Again
                      </button>
                    )}
                  </div>
                )}

                {/* Stepped state a — zero products: the generator designs from
                    real inventory and hard-rejects an empty shop (400). */}
                {showAddProduct && (
                  <div className="rounded-[2rem] border border-gray-100 bg-white p-8 shadow-sm md:p-10">
                    <p className="mx-auto max-w-md text-sm leading-relaxed text-gray-500">
                      Your AI storefront is designed around your real inventory — add your
                      first product and we’ll build the whole site from it.
                    </p>
                    <Link
                      href="/dashboard/add"
                      className="mt-7 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#1a2e1a] px-8 py-3.5 text-[11px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black active:scale-95"
                    >
                      <Plus size={15} /> Add Your First Product
                    </Link>
                  </div>
                )}

                {/* Stepped state b — tier below Advanced: the studio's premium
                    lock idiom (the API 403s these tiers). */}
                {showUpgrade && (
                  <div className="relative overflow-hidden rounded-[2rem] bg-[#1a1a1a] p-8 text-center text-white shadow-2xl md:p-10">
                    <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#f0a500]/10 blur-3xl" />
                    <Crown size={30} className="mx-auto text-[#f0a500]" />
                    <h2 className="mt-5 font-serif text-2xl font-bold">Your entire storefront, generated.</h2>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/60">
                      The AI Website Studio studies your inventory and builds a complete premium
                      website around it — hero, brand story, and all. Exclusive to the Advanced tier.
                    </p>
                    <p className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                      <Lock size={12} /> Locked on your current plan
                    </p>
                    <Link
                      href="/pricing"
                      className="mt-7 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#f0a500] px-8 py-3.5 text-[11px] font-black uppercase tracking-widest text-black transition hover:bg-amber-400 active:scale-95"
                    >
                      <Crown size={14} /> Upgrade to Advanced
                    </Link>
                  </div>
                )}

                {/* Stepped state c — qualifying: the single magic button. */}
                {!showAddProduct && !showUpgrade && (
                  <div className="rounded-[2rem] border border-gray-100 bg-white p-8 shadow-sm md:p-10">
                    <p className="mx-auto max-w-md text-sm leading-relaxed text-gray-500">
                      One click. The AI studies your {productsCount === 1 ? 'product' : `${productsCount} products`},
                      chooses your layout, and writes every line of your site.
                    </p>
                    <button
                      onClick={() => void handleGenerate()}
                      className="mt-7 inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#1a2e1a] to-gray-900 px-10 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-xl transition-all hover:opacity-90 hover:shadow-2xl active:scale-95"
                    >
                      <Sparkles size={16} className="text-[#f0a500]" /> Generate My Store
                    </button>
                  </div>
                )}

                {/* Quiet escape — a no-website seller with live orders is never
                    locked out of their command center. Session-local. */}
                {onSkip && (
                  <button
                    onClick={onSkip}
                    className="mx-auto mt-6 inline-flex min-h-[44px] items-center justify-center px-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900"
                  >
                    Skip for now — open my dashboard
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
