'use client';

// Dashboard-wide Ad Studio render notifier — mounted once from
// app/dashboard/layout.tsx so it lives on EVERY dashboard page. Sellers kick
// off a video render, navigate anywhere (or close the tab entirely), and
// still get a premium toast + persistent badge the moment their commercial
// lands.
//
// Completion writers it listens to:
//   1. Supabase realtime UPDATE events on video_ads (shop-scoped channel,
//      distinct from VideoManager's product-scoped channel — both merge
//      idempotently, so they never fight).
//   2. A 15s fallback sweep against GET /api/ai/render-status per pending
//      row — that route writes terminal state to the DB itself straight from
//      Creatomate, which then fires the realtime event naturally. This keeps
//      notifications working where the Creatomate webhook can't reach
//      (local/dev). Announcements dedupe by row id via a bounded per-user
//      localStorage map, so the racing writers can never double-toast.

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Clapperboard, Film, X } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import {
  AD_STUDIO_PATH,
  FAILURE_TOAST_TTL_MS,
  NOTIFIER_FIRST_POLL_DELAY_MS,
  NOTIFIER_POLL_INTERVAL_MS,
  NOTIFIER_POLL_STAGGER_MS,
  STUDIO_VISIT_CHECK_MS,
  SUCCESS_TOAST_TTL_MS,
  emptyAdNotifyState,
  isAnimateInFlight,
  isVideoRenderFailure,
  loadAdNotifyState,
  nextToastId,
  notifiedKey,
  saveAdNotifyState,
  type AdNotifyState,
  type AdToast,
} from '@/lib/adNotifications';

type NotifierRow = {
  id: string;
  status: string | null;
  pipeline_stage: string | null;
  hero_image_url: string | null;
  created_at: string | null;
};

const NOTIFIER_ROW_COLUMNS = 'id, status, pipeline_stage, hero_image_url, created_at';

// The dashboard's tab state lives in ?tab= via history.replaceState — read
// the URL directly instead of useSearchParams (repo idiom: avoids the
// Suspense boundary requirement on client pages).
const isOnAdStudio = () =>
  typeof window !== 'undefined' &&
  window.location.pathname === '/dashboard' &&
  new URLSearchParams(window.location.search).get('tab') === 'videos';

export default function AdRenderNotifier() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<AdToast[]>([]);
  // Completed-and-not-yet-acknowledged row ids — drives the persistent badge.
  const [unseenIds, setUnseenIds] = useState<string[]>([]);
  // Gates the fallback poll effect; mirrors pendingRef.size > 0.
  const [hasPending, setHasPending] = useState(false);

  const stateRef = useRef<AdNotifyState | null>(null);
  const userIdRef = useRef<string | null>(null);
  const pendingRef = useRef<Set<string>>(new Set());
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const persist = useCallback(() => {
    if (userIdRef.current && stateRef.current) {
      saveAdNotifyState(userIdRef.current, stateRef.current);
    }
  }, []);

  // ── Toast stack plumbing ─────────────────────────────────────────────────
  const dismissToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
    const timer = toastTimersRef.current.get(toastId);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(toastId);
    }
  }, []);

  const pushToast = useCallback(
    (toast: AdToast, ttlMs: number) => {
      // Cap the visible stack at 4 — older toasts age out silently.
      setToasts((prev) => [...prev.slice(-3), toast]);
      toastTimersRef.current.set(
        toast.id,
        setTimeout(() => dismissToast(toast.id), ttlMs)
      );
    },
    [dismissToast]
  );

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  // ── Badge acknowledgement ────────────────────────────────────────────────
  const markAllSeen = useCallback(() => {
    setUnseenIds((prev) => {
      if (prev.length === 0) return prev;
      const state = stateRef.current;
      if (state) {
        const now = Date.now();
        prev.forEach((id) => {
          state.seen[id] = now;
        });
        persist();
      }
      return [];
    });
  }, [persist]);

  // Jump link into the Ad Studio. /dashboard reads ?tab= only on mount, so
  // when the seller is already on /dashboard we force a full navigation to
  // actually flip the tab; from any other dashboard page a client-side push
  // freshly mounts the page, which then reads the param.
  const openStudio = useCallback(() => {
    markAllSeen();
    if (typeof window === 'undefined' || isOnAdStudio()) return;
    if (window.location.pathname === '/dashboard') {
      window.location.assign(AD_STUDIO_PATH);
      return;
    }
    router.push(AD_STUDIO_PATH);
  }, [markAllSeen, router]);

  const syncPendingFlag = useCallback(() => {
    setHasPending(pendingRef.current.size > 0);
  }, []);

  // ── Announcements (idempotent by row id via the localStorage map) ────────
  const notifyCompletion = useCallback(
    (videoId: string) => {
      const state = stateRef.current;
      if (!state) return;
      const key = notifiedKey(videoId, 'completed');
      if (state.notified[key]) return; // realtime + poll + reload dedupe
      state.notified[key] = Date.now();
      if (isOnAdStudio()) {
        // Seller is watching the studio — VideoManager updates live, no badge debt.
        state.seen[videoId] = Date.now();
      } else {
        setUnseenIds((prev) => (prev.includes(videoId) ? prev : [...prev, videoId]));
      }
      persist();
      pushToast(
        {
          id: nextToastId(),
          kind: 'success',
          title: 'Your commercial is ready',
          message: 'The final cut just finished rendering. Open the Ad Studio to watch it.',
        },
        SUCCESS_TOAST_TTL_MS
      );
    },
    [persist, pushToast]
  );

  const notifyFailure = useCallback(
    (videoId: string) => {
      const state = stateRef.current;
      if (!state) return;
      const key = notifiedKey(videoId, 'failed');
      if (state.notified[key]) return;
      state.notified[key] = Date.now();
      persist();
      pushToast(
        {
          id: nextToastId(),
          kind: 'failure',
          title: 'A video render failed',
          message: 'The Ad Studio hit a snag while finishing your commercial. Open it to retry.',
        },
        FAILURE_TOAST_TTL_MS
      );
    },
    [persist, pushToast]
  );

  const handleRowUpdate = useCallback(
    (row: NotifierRow) => {
      if (!row?.id) return;
      if (isAnimateInFlight(row)) {
        pendingRef.current.add(row.id);
        syncPendingFlag();
        return;
      }
      // Any non-in-flight status ends tracking for this row.
      pendingRef.current.delete(row.id);
      syncPendingFlag();
      if (row.status === 'completed') {
        notifyCompletion(row.id);
      } else if (isVideoRenderFailure(row)) {
        notifyFailure(row.id);
      }
    },
    [notifyCompletion, notifyFailure, syncPendingFlag]
  );

  // ── Bootstrap: auth → stored state → realtime → initial sync ────────────
  useEffect(() => {
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (disposed || !user) return;
      userIdRef.current = user.id;

      const stored = loadAdNotifyState(user.id);
      const firstRun = stored === null;
      stateRef.current = stored ?? emptyAdNotifyState();
      setUserId(user.id);

      channel = supabase
        .channel(`video_ads_notifier_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'video_ads',
            filter: `shop_id=eq.${user.id}`,
          },
          (payload) => {
            handleRowUpdate(payload.new as NotifierRow);
          }
        )
        .subscribe();

      if (disposed) {
        // Cleanup already ran while we awaited auth — release the channel.
        supabase.removeChannel(channel);
        channel = null;
        return;
      }

      const [completedRes, pendingRes] = await Promise.all([
        supabase
          .from('video_ads')
          .select(NOTIFIER_ROW_COLUMNS)
          .eq('shop_id', user.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(24),
        supabase
          .from('video_ads')
          .select(NOTIFIER_ROW_COLUMNS)
          .eq('shop_id', user.id)
          .eq('status', 'pending')
          .in('pipeline_stage', ['animating', 'finalizing']),
      ]);
      if (disposed) return;

      const state = stateRef.current;
      if (!state) return;
      const completed = (completedRes.data ?? []) as NotifierRow[];
      const pendingRows = (pendingRes.data ?? []) as NotifierRow[];

      if (firstRun) {
        // Baseline seeding — history from before this feature must never
        // toast-storm or badge the first session.
        const now = Date.now();
        completed.forEach((row) => {
          state.notified[notifiedKey(row.id, 'completed')] = now;
          state.seen[row.id] = now;
        });
        persist();
      } else {
        const unseen = completed.filter((row) => !state.seen[row.id]).map((row) => row.id);
        const unannounced = completed.filter(
          (row) => !state.notified[notifiedKey(row.id, 'completed')]
        );
        if (unannounced.length > 0) {
          const now = Date.now();
          unannounced.forEach((row) => {
            state.notified[notifiedKey(row.id, 'completed')] = now;
          });
          persist();
          // Max ONE summary toast on load — never a storm.
          pushToast(
            {
              id: nextToastId(),
              kind: 'summary',
              title:
                unannounced.length === 1
                  ? 'Your commercial is ready'
                  : `${unannounced.length} commercials are ready`,
              message:
                unannounced.length === 1
                  ? 'It finished rendering while you were away. Open the Ad Studio to watch it.'
                  : 'They finished rendering while you were away. Open the Ad Studio to watch them.',
            },
            SUCCESS_TOAST_TTL_MS
          );
        }
        if (unseen.length > 0) {
          if (isOnAdStudio()) {
            const now = Date.now();
            unseen.forEach((id) => {
              state.seen[id] = now;
            });
            persist();
          } else {
            setUnseenIds((prev) => Array.from(new Set([...prev, ...unseen])));
          }
        }
      }

      pendingRows.forEach((row) => pendingRef.current.add(row.id));
      syncPendingFlag();
    })();

    return () => {
      disposed = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, handleRowUpdate, persist, pushToast, syncPendingFlag]);

  // ── Fallback polling sweep (no-webhook environments, dropped realtime) ──
  // render-status writes terminal state to the DB server-side, which fires
  // the realtime event for every open surface; the direct handling below is
  // the last line of defense when realtime itself is down. Interval only
  // exists while rows are pending; fully cleaned up on unmount.
  useEffect(() => {
    if (!userId || !hasPending) return;
    let disposed = false;
    const staggerTimers: ReturnType<typeof setTimeout>[] = [];

    const sweep = async () => {
      // Cancel any unfired stagger timers from the previous sweep so a slow
      // backlog can never double-poll a row.
      staggerTimers.splice(0).forEach(clearTimeout);

      // Self-healing: re-sync the pending set from the DB so renders started
      // on other pages/devices (or missed realtime frames) are still tracked.
      const { data, error } = await supabase
        .from('video_ads')
        .select('id')
        .eq('shop_id', userId)
        .eq('status', 'pending')
        .in('pipeline_stage', ['animating', 'finalizing']);
      if (disposed) return;
      if (!error) {
        pendingRef.current = new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
        syncPendingFlag();
      }
      const ids = Array.from(pendingRef.current);
      if (ids.length === 0) return;

      ids.forEach((videoId, index) => {
        const timer = setTimeout(async () => {
          if (disposed) return;
          try {
            const res = await fetch(`/api/ai/render-status?videoId=${videoId}`);
            if (disposed) return;
            if (!res.ok) {
              // Row deleted or ownership lost — stop tracking it.
              if (res.status === 404 || res.status === 403) {
                pendingRef.current.delete(videoId);
                syncPendingFlag();
              }
              return;
            }
            const body = (await res.json()) as { status?: string };
            if (disposed) return;
            if (body.status === 'completed') {
              pendingRef.current.delete(videoId);
              syncPendingFlag();
              notifyCompletion(videoId);
            } else if (body.status === 'failed') {
              pendingRef.current.delete(videoId);
              syncPendingFlag();
              notifyFailure(videoId);
            }
          } catch {
            // Network blip — the next sweep retries.
          }
        }, index * NOTIFIER_POLL_STAGGER_MS);
        staggerTimers.push(timer);
      });
    };

    const first = setTimeout(sweep, NOTIFIER_FIRST_POLL_DELAY_MS);
    const interval = setInterval(sweep, NOTIFIER_POLL_INTERVAL_MS);
    return () => {
      disposed = true;
      clearTimeout(first);
      clearInterval(interval);
      staggerTimers.forEach(clearTimeout);
    };
  }, [userId, hasPending, supabase, notifyCompletion, notifyFailure, syncPendingFlag]);

  // ── Badge clearance when the seller reaches the Ad Studio ───────────────
  useEffect(() => {
    if (isOnAdStudio()) markAllSeen();
  }, [pathname, markAllSeen]);

  useEffect(() => {
    if (unseenIds.length === 0) return;
    const timer = setInterval(() => {
      if (isOnAdStudio()) markAllSeen();
    }, STUDIO_VISIT_CHECK_MS);
    return () => clearInterval(timer);
  }, [unseenIds.length, markAllSeen]);

  if (toasts.length === 0 && unseenIds.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-24 right-6 z-[60] flex w-[min(22rem,calc(100vw-3rem))] flex-col items-end gap-3"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const isFailure = toast.kind === 'failure';
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d1117] via-[#1a1f2e] to-[#0a1a0a] shadow-2xl"
            >
              <div className="flex items-start gap-3 p-4">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    isFailure ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'
                  }`}
                >
                  {isFailure ? <AlertTriangle size={16} /> : <Clapperboard size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white">{toast.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{toast.message}</p>
                  <button
                    onClick={() => {
                      dismissToast(toast.id);
                      openStudio();
                    }}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-white ring-1 ring-white/15 transition hover:bg-white/20 active:scale-95"
                  >
                    <Film size={11} /> Open Ad Studio
                  </button>
                </div>
                <button
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss notification"
                  className="shrink-0 rounded-full p-1 text-gray-500 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <AnimatePresence>
        {unseenIds.length > 0 && (
          <motion.button
            key="ad-render-badge"
            layout
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={openStudio}
            aria-label={`${unseenIds.length} new ${
              unseenIds.length === 1 ? 'commercial' : 'commercials'
            } ready — open Ad Studio`}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-gradient-to-r from-[#1a2e1a] to-gray-900 py-2.5 pl-4 pr-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-xl ring-1 ring-white/10 transition hover:opacity-90 active:scale-95"
          >
            <Clapperboard size={13} className="text-emerald-300" />
            New {unseenIds.length === 1 ? 'commercial' : 'commercials'} ready
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-black text-white">
              {unseenIds.length}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
