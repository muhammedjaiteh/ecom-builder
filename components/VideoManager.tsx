'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BellRing,
  Clapperboard,
  Film,
  Loader2,
  Sparkles,
  RefreshCw,
  Check,
  Download,
  Image as ImageIcon,
  Link2,
  Wand2,
  Trash2,
} from 'lucide-react';
import type { Product } from '@/lib/types';
import { createBrowserClient } from '@supabase/ssr';
import {
  STILL_STAGES,
  advanceStages,
  completeStage,
  fetchAdPipeline,
  initialStageStatuses,
  type AdProgressEvent,
  type AdStageDef,
  type AdStageKey,
  type AdStageStatus,
} from '@/lib/adProgress';
import { isAnimateInFlight } from '@/lib/adNotifications';

type Category = 'apparel' | 'cosmetics' | 'electronics' | 'food' | 'other';

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'cosmetics', label: 'Cosmetics / Beauty' },
  { value: 'apparel', label: 'Apparel / Fashion' },
  { value: 'electronics', label: 'Electronics / Tech' },
  { value: 'food', label: 'Food / Culinary' },
  { value: 'other', label: 'Other' },
];

type Storyboard = {
  hook: string;
  value_prop: string;
  cta: string;
};

type VideoAd = {
  id: string;
  shop_id: string;
  product_id: string;
  status: string;
  storyboard: Storyboard | null;
  hero_image_url: string | null;
  video_url: string | null;
  category: Category | null;
  pipeline_stage: string | null;
  created_at?: string;
};

type Props = {
  userId: string;
  products: Pick<Product, 'id' | 'name' | 'image_url'>[];
};

// 'isolating' is intentionally absent: since the director + BiRefNet calls were
// parallelized, rows are inserted at the 'composing' stage and 'isolating' is
// never written. Old interrupted rows fall back to the generic preparing label.
const STAGE_LABELS: Record<string, string> = {
  composing: 'Composing premium environment…',
  preview_ready: 'Scene ready',
  animating: 'Bringing the scene to life…',
  finalizing: 'Adding captions and CTA…',
  completed: 'Done',
};

const VIDEO_AD_COLUMNS =
  'id, shop_id, product_id, status, storyboard, hero_image_url, video_url, category, pipeline_stage, created_at';

// Gallery membership: completed commercials plus video renders still cooking
// in the background (they render with the status chip until they land).
const isGalleryWorthy = (row: VideoAd) => row.status === 'completed' || isAnimateInFlight(row);

export default function VideoManager({ userId: _userId, products }: Props) {
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id ?? '');
  const [category, setCategory] = useState<Category>('cosmetics');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoAd, setVideoAd] = useState<VideoAd | null>(null);
  const [generations, setGenerations] = useState<VideoAd[]>([]);
  const [linkingToProduct, setLinkingToProduct] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [copyDraft, setCopyDraft] = useState<Storyboard | null>(null);
  const [copySaving, setCopySaving] = useState(false);
  const [regeneratingCopy, setRegeneratingCopy] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  // ── Streamed progress state (SSE from generate-still ONLY) ──────────────
  // The animate pipeline is fire-and-forget JSON — it never drives this
  // checklist; its progress renders as the compact background chip instead.
  const [stageStatuses, setStageStatuses] = useState<Record<string, AdStageStatus>>({});
  const [progressDetail, setProgressDetail] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards setState after unmount for the fire-and-forget animate fetch —
  // the request itself is deliberately never aborted.
  const mountedRef = useRef(true);
  // Mirror of the active generation id so applyRowUpdate can decide whether a
  // terminal update should clear the attended loader.
  const activeAdIdRef = useRef<string | null>(null);
  // Blocks duplicate animate submissions per row (double-click protection).
  const inFlightAnimateRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    activeAdIdRef.current = videoAd?.id ?? null;
  }, [videoAd?.id]);

  // Abort any in-flight STILL stream and clear armed timers on unmount so
  // nothing fires setState against an unmounted component. The animate fetch
  // is intentionally NOT registered here: it must survive unmount so the
  // background render continues untouched (the DB row stays 'pending' and
  // rehydration + the pollers land completion later).
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      if (linkTimerRef.current) clearTimeout(linkTimerRef.current);
    };
  }, []);

  // ── Single idempotent merge point for every update writer ────────────────
  // Realtime events, the 5s poller, animate fetch results (200 row / 202
  // handoff mirror), and optimistic transitions all land here, so the racing
  // completion writers can never fight: partial patches merge into existing
  // state, and brand-new gallery entries are only materialized from full rows.
  const applyRowUpdate = useCallback((id: string, patch: Partial<VideoAd>) => {
    if (
      activeAdIdRef.current === id &&
      (patch.status === 'preview_ready' || patch.status === 'completed' || patch.status === 'failed')
    ) {
      setIsGenerating(false);
    }
    setVideoAd((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
    setGenerations((prev) => {
      const idx = prev.findIndex((g) => g.id === id);
      const merged: VideoAd | null =
        idx !== -1
          ? { ...prev[idx], ...patch }
          : typeof patch.product_id === 'string' && typeof patch.shop_id === 'string'
            ? (patch as VideoAd)
            : null;
      if (!merged) return prev;
      if (!isGalleryWorthy(merged)) {
        return idx === -1 ? prev : prev.filter((g) => g.id !== id);
      }
      if (idx === -1) return [merged, ...prev];
      const next = [...prev];
      next[idx] = merged;
      return next;
    });
  }, []);

  // Applies streamed micro-stage events to the checklist for the still phase.
  const makeProgressHandler = (order: AdStageDef[]) => (event: AdProgressEvent) => {
    if (event.t === 'stage') {
      setProgressDetail(null);
      setStageStatuses((prev) => advanceStages(prev, event.key, order, event.soft));
    } else if (event.t === 'stage-done') {
      setStageStatuses((prev) => completeStage(prev, event.key));
    } else if (event.t === 'detail') {
      setProgressDetail(event.message);
    }
  };

  // Sync selectedProductId once products arrive.
  useEffect(() => {
    if (!selectedProductId && products.length > 0) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  // ── Load history + rehydrate any in-flight generation ───────────────────
  // Two queries: completed rows AND background video renders feed the
  // gallery; the most-recent row of ANY status lets a refresh mid-generation
  // resume where it left off (the realtime effect below re-attaches
  // automatically once videoAd is set).
  useEffect(() => {
    if (!selectedProductId) {
      setGenerations([]);
      setVideoAd(null);
      return;
    }

    let cancelled = false;
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    (async () => {
      const [galleryRes, recentRes] = await Promise.all([
        supabase
          .from('video_ads')
          .select(VIDEO_AD_COLUMNS)
          .eq('product_id', selectedProductId)
          .or('status.eq.completed,and(status.eq.pending,pipeline_stage.in.(animating,finalizing))')
          .order('created_at', { ascending: false }),
        supabase
          .from('video_ads')
          .select(VIDEO_AD_COLUMNS)
          .eq('product_id', selectedProductId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (galleryRes.error) {
        console.error('[VideoManager] Failed to load generation history:', galleryRes.error);
        return;
      }

      const list = (galleryRes.data ?? []) as VideoAd[];
      const recent = (recentRes.data ?? null) as VideoAd | null;
      console.log(`[VideoManager] Loaded ${list.length} gallery generation(s) for product ${selectedProductId}`);
      setGenerations(list);

      setVideoAd((current) => {
        // A live in-memory session always wins.
        if (current && (current.status === 'pending' || current.status === 'preview_ready')) {
          return current;
        }
        // Rehydrate an in-flight row after a refresh.
        if (recent && (recent.status === 'pending' || recent.status === 'preview_ready')) {
          console.log(`[VideoManager] Rehydrated in-flight generation ${recent.id} (${recent.status}/${recent.pipeline_stage})`);
          return recent;
        }
        return list[0] ?? null;
      });

      // Mid-STILL-generation refresh: the SSE stream is gone but the server
      // keeps composing — resume the attended loader until preview_ready
      // lands. In-flight VIDEO renders deliberately do NOT set isGenerating:
      // they render as the compact background chip and the studio stays
      // fully usable.
      if (recent?.status === 'pending' && !isAnimateInFlight(recent)) {
        setIsGenerating(true);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedProductId]);

  // ── Realtime: product-scoped channel picks up server-side updates ────────
  // Covers the active generation AND background renders sitting in the
  // gallery. Channel name is distinct from the global notifier's shop-scoped
  // channel (`video_ads_notifier_*`) — both merge idempotently through
  // applyRowUpdate-style logic, so they never fight.
  useEffect(() => {
    if (!selectedProductId) return;

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel(`video_ads_product_${selectedProductId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_ads',
          filter: `product_id=eq.${selectedProductId}`,
        },
        (payload) => {
          const next = payload.new as VideoAd;
          if (next?.id) applyRowUpdate(next.id, next);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedProductId, applyRowUpdate]);

  // ── Fallback polling while the ACTIVE row's video render runs ────────────
  // Realtime can silently drop a connection; render-status polls Creatomate
  // directly and writes completion to the DB itself, so this guarantees the
  // active card always reaches a terminal state. Background rows on other
  // pages are covered by the dashboard-wide notifier's 15s sweep.
  const activeAdId = videoAd?.id;
  const activeAdStatus = videoAd?.status;
  const activeAdStage = videoAd?.pipeline_stage;
  useEffect(() => {
    if (!activeAdId || activeAdStatus !== 'pending') return;
    if (activeAdStage !== 'animating' && activeAdStage !== 'finalizing') return;

    const videoId = activeAdId;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai/render-status?videoId=${videoId}`);
        if (!res.ok) return;
        const { status, video_url } = await res.json() as { status: string; video_url?: string };
        if (status === 'completed') {
          applyRowUpdate(videoId, {
            status: 'completed',
            pipeline_stage: 'completed',
            ...(video_url ? { video_url } : {}),
          });
        } else if (status === 'failed') {
          applyRowUpdate(videoId, { status: 'failed', pipeline_stage: 'failed' });
        }
      } catch {
        // network blip — next tick retries
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activeAdId, activeAdStatus, activeAdStage, applyRowUpdate]);

  // ── Fold DB pipeline_stage updates (realtime / rehydration) into the
  // streamed checklist while the attended STILL loader is up ───────────────
  useEffect(() => {
    if (!isGenerating) return;
    const ps = videoAd?.pipeline_stage;
    if (ps === 'composing' || ps === 'preview_ready') {
      setStageStatuses((prev) => advanceStages(prev, ps as AdStageKey, STILL_STAGES));
    }
  }, [videoAd?.pipeline_stage, isGenerating]);

  // ── Elapsed-time ticker while generating ─────────────────────────────────
  useEffect(() => {
    if (!isGenerating) {
      setElapsedSec(0);
      return;
    }
    const started = Date.now();
    setElapsedSec(0);
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [isGenerating]);

  // ── Keep the editable copy draft in sync with the active generation ─────
  useEffect(() => {
    setCopyDraft(videoAd?.storyboard ? { ...videoAd.storyboard } : null);
  }, [videoAd?.id, videoAd?.storyboard]);

  const handleGenerate = async () => {
    if (!selectedProductId) {
      setError('Please select a product first.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setVideoAd(null);
    setStageStatuses(initialStageStatuses(STILL_STAGES));
    setProgressDetail(null);
    setIsGenerating(true);

    try {
      const result = await fetchAdPipeline(
        '/api/ai/generate-still',
        { productId: selectedProductId, category },
        { signal: controller.signal, onEvent: makeProgressHandler(STILL_STAGES) }
      );
      if (controller.signal.aborted) return;
      if (!result.ok) {
        setError(result.error || 'Failed to generate scene.');
        return;
      }
      setVideoAd(result.payload as VideoAd);
    } catch {
      if (controller.signal.aborted) return;
      setError('Network error contacting the Director. Please try again.');
    } finally {
      if (!controller.signal.aborted) setIsGenerating(false);
    }
  };

  // Network drops leave the truth ambiguous (did the render start?) — read
  // the row back instead of blindly rolling back the optimistic state.
  const reconcileRowFromDb = useCallback(async (id: string) => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from('video_ads')
      .select(VIDEO_AD_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (!mountedRef.current) return;
    const row = (data ?? null) as VideoAd | null;
    if (!row) {
      setError('Network error during animation. Please refresh to check the render status.');
      return;
    }
    applyRowUpdate(row.id, row);
    if (row.status === 'preview_ready') {
      setError('Network hiccup — the render did not start. Please approve again.');
    }
  }, [applyRowUpdate]);

  // ── Approve & Animate — asynchronous background handoff ─────────────────
  // Fire-and-forget JSON request (NO SSE): the route runs the full pipeline
  // (Kling await → Creatomate submit with webhook → DB writes) independent of
  // this connection, so navigating away or closing the tab cannot roll
  // anything back. The card flips into a compact non-blocking chip; the
  // realtime channel + pollers + dashboard notifier land the final state.
  const handleAnimate = () => {
    if (!videoAd?.id || !videoAd.hero_image_url) return;
    if (videoAd.status !== 'preview_ready' && videoAd.status !== 'failed') return;
    const targetId = videoAd.id;
    if (inFlightAnimateRef.current.has(targetId)) return;
    inFlightAnimateRef.current.add(targetId);

    setError(null);
    // Optimistic flip into the background-rendering state — deliberately does
    // NOT touch isGenerating: the studio stays fully usable.
    applyRowUpdate(targetId, { ...videoAd, status: 'pending', pipeline_stage: 'animating' });

    void (async () => {
      try {
        // keepalive lets the tiny request body survive an immediate tab close.
        const res = await fetch('/api/ai/animate-still', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoAdId: targetId }),
          keepalive: true,
        });
        let data: (Partial<VideoAd> & { error?: string }) | null = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        // Unmounted mid-flight: the DB row stays 'pending', so rehydration +
        // the pollers + the dashboard notifier finish the job. No rollback.
        if (!mountedRef.current) return;
        if (!res.ok) {
          setError(data?.error || 'Failed to start the video render. Please try again.');
          // Restore the approve card locally so the seller can retry at once.
          applyRowUpdate(targetId, { status: 'preview_ready', pipeline_stage: 'preview_ready' });
          return;
        }
        // 200 → full completed row; 202 → handoff mirror of the DB state
        // ({ status: 'pending', pipeline_stage: 'finalizing' }) that keeps the
        // chip + pollers driving toward completion. Merge either idempotently.
        if (data) applyRowUpdate(targetId, data as Partial<VideoAd>);
      } catch {
        if (!mountedRef.current) return;
        await reconcileRowFromDb(targetId);
      } finally {
        inFlightAnimateRef.current.delete(targetId);
      }
    })();
  };

  // Save hand-edited copy on blur — only fires when something actually changed.
  const saveCopyIfChanged = async () => {
    if (!videoAd || !copyDraft) return;
    const orig = videoAd.storyboard;
    if (
      orig &&
      orig.hook === copyDraft.hook &&
      orig.value_prop === copyDraft.value_prop &&
      orig.cta === copyDraft.cta
    ) {
      return;
    }
    if (!copyDraft.hook.trim() || !copyDraft.value_prop.trim() || !copyDraft.cta.trim()) {
      setError('Copy fields cannot be empty.');
      return;
    }

    setCopySaving(true);
    try {
      const res = await fetch('/api/ai/update-copy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoAdId: videoAd.id, ...copyDraft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save copy.');
        return;
      }
      setVideoAd((prev) => prev ? { ...prev, storyboard: data.storyboard } : prev);
    } catch {
      setError('Network error saving copy.');
    } finally {
      setCopySaving(false);
    }
  };

  // Regenerate ONLY the copy — LLM call, no image charge.
  const handleRegenerateCopy = async () => {
    if (!videoAd?.id) return;
    setRegeneratingCopy(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/regenerate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoAdId: videoAd.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to regenerate copy.');
        return;
      }
      setVideoAd((prev) => prev ? { ...prev, storyboard: data.storyboard } : prev);
    } catch {
      setError('Network error regenerating copy.');
    } finally {
      setRegeneratingCopy(false);
    }
  };

  const handleSelectFromGallery = (gen: VideoAd) => {
    // Never swap the active card out from under an attended still run — the
    // SSE result would stomp the selection when it lands.
    if (isGenerating) return;
    console.log(`[VideoManager] Selected generation ${gen.id} from gallery`);
    setVideoAd(gen);
    setError(null);
    setLinkSuccess(false);
    setDeleteConfirmId(null);
  };

  // Two-click delete: first click arms the confirm state (auto-disarms after
  // 3s), second click deletes optimistically and rolls back on failure.
  const handleDeleteGeneration = async (genId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirmId !== genId) {
      setDeleteConfirmId(genId);
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = setTimeout(() => setDeleteConfirmId((prev) => (prev === genId ? null : prev)), 3000);
      return;
    }
    setDeleteConfirmId(null);

    const prevList = generations;
    setGenerations((list) => list.filter((g) => g.id !== genId));
    if (videoAd?.id === genId) setVideoAd(null);

    try {
      const res = await fetch('/api/ai/delete-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoAdId: genId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete generation.');
        setGenerations(prevList);
      } else {
        console.log(`[VideoManager] Deleted generation ${genId}`);
      }
    } catch {
      setError('Network error deleting generation.');
      setGenerations(prevList);
    }
  };

  const handleUseOnProductPage = async () => {
    if (!videoAd?.id) return;
    setLinkingToProduct(true);
    setLinkSuccess(false);
    setError(null);
    try {
      const res = await fetch('/api/products/add-ad-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoAdId: videoAd.id, productId: videoAd.product_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to link video to product.');
        return;
      }
      console.log('[VideoManager] Linked video to product:', data);
      setLinkSuccess(true);
      if (linkTimerRef.current) clearTimeout(linkTimerRef.current);
      linkTimerRef.current = setTimeout(() => setLinkSuccess(false), 3500);
    } catch {
      setError('Network error linking video to product.');
    } finally {
      setLinkingToProduct(false);
    }
  };

  const selectedProductName = products.find((p) => p.id === videoAd?.product_id)?.name;
  const stageLabel = videoAd?.pipeline_stage ? STAGE_LABELS[videoAd.pipeline_stage] : null;

  // The active card's video render is running server-side — show the compact
  // non-blocking chip instead of any takeover loader.
  const isBackgroundRendering = !!videoAd && isAnimateInFlight(videoAd);

  // Streamed micro-update wins; the DB stage label covers realtime/rehydration
  // updates; static copy is the graceful fallback when the stream yields no
  // events (e.g. behind a buffering proxy).
  const loaderSubline = progressDetail ?? stageLabel ?? 'Preparing your generation…';

  return (
    <div className="animate-in fade-in duration-300 space-y-6">

      {/* ── Header banner ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0d1117] via-[#1a1f2e] to-[#1a2e1a] p-6 shadow-xl md:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-36 w-36 rounded-full bg-emerald-500/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white">
              <Clapperboard size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">AI Commercial Director</h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-400">
                Upload a product photo. Pick a category. We generate a photorealistic premium scene around your product — your product stays pixel-perfect.
              </p>
            </div>
          </div>
          <div className="self-start rounded-full bg-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-300 ring-1 ring-white/10">
            Ad Studio
          </div>
        </div>
      </div>

      {/* ── Controls card ──────────────────────────────────────────────────── */}
      <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px_auto] md:items-end md:gap-6">

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Product
            </label>
            {products.length === 0 ? (
              <p className="text-sm text-gray-500">Add a product first to generate ads.</p>
            ) : (
              <select
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setError(null);
                  setLinkSuccess(false);
                }}
                disabled={isGenerating}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none transition focus:border-gray-900 focus:bg-white disabled:opacity-60"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              disabled={isGenerating}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none transition focus:border-gray-900 focus:bg-white disabled:opacity-60"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedProductId || products.length === 0}
            className="flex shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#1a2e1a] to-gray-900 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
          >
            {isGenerating
              ? <><Loader2 size={13} className="animate-spin" /> Generating…</>
              : <><Sparkles size={13} /> Generate Scene</>}
          </button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3"
            >
              <p className="flex-1 text-sm font-medium text-red-800">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-[11px] font-bold text-red-400 hover:text-red-600"
              >
                ✕
              </button>
            </motion.div>
          )}
          {linkSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"
            >
              <Check size={16} className="text-emerald-600" />
              <p className="flex-1 text-sm font-medium text-emerald-800">Linked to product page.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── In-flight loader (attended STILL pipeline only) ───────────────── */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0d1117] via-[#1a1f2e] to-[#0a1a0a] p-12 shadow-2xl"
          >
            <motion.div
              className="pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/5 to-transparent"
              animate={{ x: ['-120%', '220%'] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'linear', repeatDelay: 1.2 }}
            />
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-8 -left-8 h-48 w-48 rounded-full bg-emerald-500/10 blur-2xl" />

            <div className="relative mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/15" />
                <motion.span
                  className="absolute inset-2 rounded-full bg-violet-500/15"
                  animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/10 backdrop-blur-sm">
                  <Sparkles size={32} className="text-white" />
                </div>
              </div>

              <div>
                <p className="text-lg font-bold text-white">
                  Building your premium scene
                </p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={loaderSubline}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="mt-2 max-w-sm text-sm leading-relaxed text-gray-400"
                  >
                    {loaderSubline}
                  </motion.p>
                </AnimatePresence>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-emerald-400/70">
                  {elapsedSec}s elapsed
                </p>
              </div>

              {/* ── Live stage checklist (streamed micro-stages) ─────────── */}
              <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left backdrop-blur-sm">
                {STILL_STAGES.map((stage, i) => {
                  const status = stageStatuses[stage.key] ?? 'pending';
                  return (
                    <motion.div
                      key={stage.key}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.06, ease: 'easeOut' }}
                      className={`flex items-center gap-3 px-5 py-3 ${i > 0 ? 'border-t border-white/5' : ''}`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                        {status === 'done' ? (
                          <motion.span
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/90 text-white"
                          >
                            <Check size={11} />
                          </motion.span>
                        ) : status === 'active' ? (
                          <Loader2 size={15} className="animate-spin text-emerald-300" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                        )}
                      </span>
                      <span
                        className={`flex-1 text-[12px] font-semibold tracking-wide transition-colors duration-300 ${
                          status === 'done'
                            ? 'text-emerald-300/80'
                            : status === 'active'
                              ? 'text-white'
                              : 'text-gray-500'
                        }`}
                      >
                        {stage.label}
                      </span>
                      {status === 'active' && (
                        <span className="flex gap-1">
                          {[0, 0.2, 0.4].map((delay, j) => (
                            <motion.span
                              key={j}
                              className="h-1 w-1 rounded-full bg-emerald-400"
                              animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1.1, delay, repeat: Infinity, ease: 'easeInOut' }}
                            />
                          ))}
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* ── Background video render — compact, non-blocking ───────────── */}
        {videoAd && !isGenerating && isBackgroundRendering && (
          <motion.div
            key="background-render"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="relative overflow-hidden rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-7"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative h-40 w-24 shrink-0 overflow-hidden rounded-2xl bg-black shadow-lg">
                {videoAd.hero_image_url ? (
                  <img
                    src={videoAd.hero_image_url}
                    alt="Scene being animated"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-500">
                    <Film size={20} />
                  </div>
                )}
                <motion.div
                  className="pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ x: ['-140%', '240%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'linear', repeatDelay: 0.9 }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                    <Loader2 size={11} className="animate-spin" />
                    Rendering in background
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    ID #{videoAd.id.split('-')[0].toUpperCase()}
                  </span>
                  {selectedProductName && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      · {selectedProductName}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm font-bold text-gray-900">
                  {stageLabel ?? 'Rendering your commercial…'}
                </p>
                <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-gray-500">
                  Your commercial is rendering on our studio servers. Keep working, switch pages, or close this tab — nothing is lost.
                </p>
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 ring-1 ring-gray-100">
                  <BellRing size={11} className="text-emerald-600" />
                  We&apos;ll notify you the moment it&apos;s ready
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Hero still preview ───────────────────────────────────────────── */}
        {videoAd && !isGenerating && videoAd.status === 'preview_ready' && videoAd.hero_image_url && (
          <motion.div
            key="hero-still"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-violet-700">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                Scene Ready — Review
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                ID #{videoAd.id.split('-')[0].toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.4fr_1fr]">
              <div className="relative overflow-hidden rounded-[2rem] bg-black shadow-2xl">
                <img
                  src={videoAd.hero_image_url}
                  alt="AI-generated hero scene"
                  className="w-full h-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/10" />
                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Preview</p>
                    {selectedProductName && (
                      <p className="mt-0.5 text-sm font-bold text-white">{selectedProductName}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Ad Copy {copySaving && <span className="ml-2 normal-case text-gray-300">saving…</span>}
                    </p>
                    <button
                      onClick={handleRegenerateCopy}
                      disabled={regeneratingCopy}
                      className="flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-violet-700 transition-all hover:bg-violet-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Regenerate the copy only — no image charge"
                    >
                      {regeneratingCopy
                        ? <><Loader2 size={11} className="animate-spin" /> Writing…</>
                        : <><Wand2 size={11} /> New Copy</>}
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Hook</label>
                      <input
                        value={copyDraft?.hook ?? ''}
                        onChange={(e) => setCopyDraft((d) => d ? { ...d, hook: e.target.value } : d)}
                        onBlur={saveCopyIfChanged}
                        maxLength={60}
                        disabled={regeneratingCopy}
                        className="mt-0.5 w-full rounded-lg border border-transparent bg-transparent px-2 py-1 -mx-2 text-base font-bold text-gray-900 outline-none transition hover:border-gray-200 focus:border-gray-900 focus:bg-gray-50 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Value Prop</label>
                      <input
                        value={copyDraft?.value_prop ?? ''}
                        onChange={(e) => setCopyDraft((d) => d ? { ...d, value_prop: e.target.value } : d)}
                        onBlur={saveCopyIfChanged}
                        maxLength={60}
                        disabled={regeneratingCopy}
                        className="mt-0.5 w-full rounded-lg border border-transparent bg-transparent px-2 py-1 -mx-2 text-base font-semibold text-gray-900 outline-none transition hover:border-gray-200 focus:border-gray-900 focus:bg-gray-50 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">CTA</label>
                      <input
                        value={copyDraft?.cta ?? ''}
                        onChange={(e) => setCopyDraft((d) => d ? { ...d, cta: e.target.value } : d)}
                        onBlur={saveCopyIfChanged}
                        maxLength={60}
                        disabled={regeneratingCopy}
                        className="mt-0.5 w-full rounded-lg border border-transparent bg-transparent px-2 py-1 -mx-2 text-base font-bold text-emerald-700 outline-none transition hover:border-gray-200 focus:border-gray-900 focus:bg-gray-50 disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-gray-400">
                    Click any line to edit it. Changes save automatically and appear in the final video.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleAnimate}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#1a2e1a] to-gray-900 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-95"
                  >
                    <Check size={13} /> Approve & Animate
                  </button>
                  <button
                    onClick={handleGenerate}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-700 transition-all duration-200 hover:bg-gray-50 active:scale-95"
                  >
                    <RefreshCw size={13} /> Regenerate Scene
                  </button>
                  <p className="pt-1 text-center text-[10px] leading-relaxed text-gray-400">
                    Animation renders in the background — you can keep working while we film.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Completed video — constrained, centered ───────────────────── */}
        {videoAd && !isGenerating && videoAd.video_url && videoAd.status === 'completed' && (
          <motion.div
            key="video-player"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="space-y-5"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Commercial Ready
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                ID #{videoAd.id.split('-')[0].toUpperCase()}
              </span>
              {selectedProductName && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  · {selectedProductName}
                </span>
              )}
            </div>

            <div className="flex justify-center">
              <div className="relative w-full max-w-[340px] aspect-[9/16] max-h-[70vh] overflow-hidden rounded-[2rem] bg-black shadow-2xl">
                <video
                  key={videoAd.video_url}
                  src={videoAd.video_url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/10" />
              </div>
            </div>

            {/* ── Action buttons ────────────────────────────────────────── */}
            <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3">
              {videoAd.video_url && (
                <a
                  href={videoAd.video_url}
                  download={`sanndikaa-ad-${videoAd.id.split('-')[0]}.mp4`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#1a2e1a] to-gray-900 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-95"
                >
                  <Download size={13} /> Download Video
                </a>
              )}
              {videoAd.hero_image_url && (
                <a
                  href={videoAd.hero_image_url}
                  download={`sanndikaa-still-${videoAd.id.split('-')[0]}.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-800 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
                >
                  <ImageIcon size={13} /> Download Image
                </a>
              )}
              <button
                onClick={handleUseOnProductPage}
                disabled={linkingToProduct}
                className="flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-violet-700 shadow-sm transition-all hover:bg-violet-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {linkingToProduct ? (
                  <><Loader2 size={13} className="animate-spin" /> Linking…</>
                ) : (
                  <><Link2 size={13} /> Use on Product Page</>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Failed ─────────────────────────────────────────────────────── */}
        {videoAd && !isGenerating && videoAd.status === 'failed' && (
          <motion.div
            key="failed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-center"
          >
            <p className="text-sm font-bold text-red-900">
              {videoAd.hero_image_url ? 'The video render failed.' : 'Scene generation failed.'}
            </p>
            <p className="mt-2 text-sm text-red-700">Try again — the AI models are stochastic and a retry usually fixes it.</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              {videoAd.hero_image_url && (
                <button
                  onClick={handleAnimate}
                  className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition-all hover:bg-red-700 active:scale-95"
                >
                  <Clapperboard size={13} /> Retry Animation
                </button>
              )}
              <button
                onClick={handleGenerate}
                className={videoAd.hero_image_url
                  ? 'inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest text-red-700 shadow-sm transition-all hover:bg-red-100 active:scale-95'
                  : 'inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition-all hover:bg-red-700 active:scale-95'}
              >
                <RefreshCw size={13} /> {videoAd.hero_image_url ? 'New Scene' : 'Retry'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Previous Generations gallery ───────────────────────────────────── */}
      {generations.length > 0 && (
        <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Previous Generations</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-gray-300">
              {generations.length} {generations.length === 1 ? 'iteration' : 'iterations'}
            </p>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
            {generations.map((gen) => {
              const isActive = gen.id === videoAd?.id;
              const isArmed = deleteConfirmId === gen.id;
              const isRendering = gen.status === 'pending';
              return (
                <div
                  key={gen.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectFromGallery(gen)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSelectFromGallery(gen); }}
                  className={`group relative shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-black transition-all duration-200 hover:scale-[1.03] ${
                    isActive
                      ? 'ring-2 ring-emerald-500 ring-offset-2'
                      : isRendering
                        ? 'ring-1 ring-amber-300 hover:ring-amber-400'
                        : 'ring-1 ring-gray-200 hover:ring-gray-300'
                  }`}
                  style={{ width: 88, height: 156 }}
                  aria-label={
                    isRendering
                      ? `Generation ${gen.id.split('-')[0]} rendering in background`
                      : `Load generation ${gen.id.split('-')[0]}`
                  }
                >
                  {gen.hero_image_url ? (
                    <img
                      src={gen.hero_image_url}
                      alt="Generation thumbnail"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-500">
                      <Film size={20} />
                    </div>
                  )}
                  {isRendering ? (
                    <>
                      {/* Background-render chip + shimmer — replaces the id label */}
                      <motion.div
                        className="pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                        animate={{ x: ['-140%', '240%'] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'linear', repeatDelay: 0.9 }}
                      />
                      <div className="pointer-events-none absolute inset-x-1.5 bottom-1.5 flex items-center justify-center gap-1 rounded-full bg-black/70 px-1.5 py-1 backdrop-blur-sm">
                        <Loader2 size={9} className="animate-spin text-amber-300" />
                        <span className="text-[8px] font-bold uppercase tracking-widest text-amber-200">Rendering</span>
                      </div>
                    </>
                  ) : (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-white/90">
                        #{gen.id.split('-')[0].toUpperCase()}
                      </p>
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                      <Check size={11} />
                    </div>
                  )}
                  {/* Delete stays hidden while a render is in flight — killing the
                      row mid-render would orphan the Creatomate job. */}
                  {!isRendering && (
                    <button
                      onClick={(e) => handleDeleteGeneration(gen.id, e)}
                      className={`absolute left-1.5 top-1.5 flex h-6 items-center justify-center gap-1 rounded-full px-1.5 text-white shadow-md transition-all ${
                        isArmed
                          ? 'bg-red-600 opacity-100'
                          : 'bg-black/50 opacity-0 backdrop-blur-sm hover:bg-red-600 group-hover:opacity-100'
                      }`}
                      aria-label={isArmed ? 'Click again to confirm delete' : 'Delete generation'}
                      title={isArmed ? 'Click again to confirm' : 'Delete'}
                    >
                      <Trash2 size={11} />
                      {isArmed && <span className="text-[8px] font-bold uppercase">Sure?</span>}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!videoAd && !isGenerating && generations.length === 0 && (
        <div className="rounded-[2rem] border border-dashed border-gray-200 bg-[#F9F8F6] p-12 text-center">
          <Film className="mx-auto mb-4 h-10 w-10 text-gray-300" />
          <p className="text-sm font-bold text-gray-900">No scene generated yet.</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            Pick a product and category, then hit <span className="font-semibold">Generate Scene</span> to create a photorealistic AI environment around your product.
          </p>
        </div>
      )}
    </div>
  );
}
