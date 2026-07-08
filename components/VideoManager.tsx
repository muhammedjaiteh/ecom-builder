'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
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

  // Sync selectedProductId once products arrive.
  useEffect(() => {
    if (!selectedProductId && products.length > 0) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  // ── Load history + rehydrate any in-flight generation ───────────────────
  // Two queries: completed rows feed the gallery; the most-recent row of ANY
  // status lets a refresh mid-generation resume where it left off (the
  // Realtime effect below re-attaches automatically once videoAd is set).
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
      const [completedRes, recentRes] = await Promise.all([
        supabase
          .from('video_ads')
          .select(VIDEO_AD_COLUMNS)
          .eq('product_id', selectedProductId)
          .eq('status', 'completed')
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

      if (completedRes.error) {
        console.error('[VideoManager] Failed to load generation history:', completedRes.error);
        return;
      }

      const list = (completedRes.data ?? []) as VideoAd[];
      const recent = (recentRes.data ?? null) as VideoAd | null;
      console.log(`[VideoManager] Loaded ${list.length} completed generation(s) for product ${selectedProductId}`);
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

      if (recent?.status === 'pending') {
        setIsGenerating(true);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedProductId]);

  // ── Realtime: pick up server-side pipeline_stage / status updates ───────
  useEffect(() => {
    if (!videoAd || videoAd.status === 'completed' || videoAd.status === 'failed') {
      return;
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel(`video_ad_${videoAd.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_ads',
          filter: `id=eq.${videoAd.id}`,
        },
        (payload) => {
          const next = payload.new as VideoAd;
          setVideoAd((prev) => prev ? { ...prev, ...next } : next);
          if (next.status === 'completed' || next.status === 'failed') {
            setIsGenerating(false);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [videoAd?.id, videoAd?.status]);

  // ── Fallback polling while the animate step renders ──────────────────────
  // Realtime can silently drop a connection; render-status polls Creatomate
  // directly and writes completion to the DB itself, so this guarantees the
  // UI always reaches a terminal state.
  useEffect(() => {
    if (!videoAd || videoAd.status !== 'pending') return;
    const stage = videoAd.pipeline_stage;
    if (stage !== 'animating' && stage !== 'finalizing') return;

    const videoId = videoAd.id;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai/render-status?videoId=${videoId}`);
        if (!res.ok) return;
        const { status, video_url } = await res.json() as { status: string; video_url?: string };
        if (status === 'completed') {
          setVideoAd((prev) => prev ? { ...prev, status: 'completed', pipeline_stage: 'completed', video_url: video_url ?? prev.video_url } : prev);
          setIsGenerating(false);
        } else if (status === 'failed') {
          setVideoAd((prev) => prev ? { ...prev, status: 'failed', pipeline_stage: 'failed' } : prev);
          setIsGenerating(false);
        }
      } catch {
        // network blip — next tick retries
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [videoAd?.id, videoAd?.status, videoAd?.pipeline_stage]);

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

  // ── Prepend a freshly completed generation into the gallery ─────────────
  useEffect(() => {
    if (videoAd?.status === 'completed' && videoAd.video_url) {
      setGenerations((prev) => {
        if (prev.some((g) => g.id === videoAd.id)) return prev;
        return [videoAd, ...prev];
      });
    }
  }, [videoAd?.id, videoAd?.status, videoAd?.video_url]);

  const handleGenerate = async () => {
    if (!selectedProductId) {
      setError('Please select a product first.');
      return;
    }

    setError(null);
    setVideoAd(null);
    setIsGenerating(true);

    try {
      const res = await fetch('/api/ai/generate-still', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedProductId, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate scene.');
        return;
      }
      setVideoAd(data as VideoAd);
    } catch {
      setError('Network error contacting the Director. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnimate = async () => {
    if (!videoAd?.id) return;
    setError(null);
    setIsGenerating(true);
    setVideoAd((prev) => prev ? { ...prev, status: 'pending', pipeline_stage: 'animating' } : prev);

    try {
      const res = await fetch('/api/ai/animate-still', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoAdId: videoAd.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to animate the scene.');
        setVideoAd((prev) => prev ? { ...prev, status: 'preview_ready', pipeline_stage: 'preview_ready' } : prev);
        setIsGenerating(false);
        return;
      }
      setVideoAd((prev) => prev ? { ...prev, ...(data as Partial<VideoAd>) } : (data as VideoAd));
      if (res.status === 200 && (data as VideoAd).video_url) {
        setIsGenerating(false);
      }
    } catch {
      setError('Network error during animation. Please try again.');
      setVideoAd((prev) => prev ? { ...prev, status: 'preview_ready', pipeline_stage: 'preview_ready' } : prev);
      setIsGenerating(false);
    }
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
      setTimeout(() => setDeleteConfirmId((prev) => (prev === genId ? null : prev)), 3000);
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
      setTimeout(() => setLinkSuccess(false), 3500);
    } catch {
      setError('Network error linking video to product.');
    } finally {
      setLinkingToProduct(false);
    }
  };

  const selectedProductName = products.find((p) => p.id === videoAd?.product_id)?.name;
  const stageLabel = videoAd?.pipeline_stage ? STAGE_LABELS[videoAd.pipeline_stage] : null;

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

      {/* ── In-flight loader ───────────────────────────────────────────────── */}
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

            <div className="relative flex flex-col items-center gap-6 text-center">
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
                  {videoAd?.hero_image_url ? '🎬 Animating your commercial…' : '✨ Building your premium scene…'}
                </p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-400">
                  {stageLabel ?? 'Preparing your generation…'}
                </p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-emerald-400/70">
                  {elapsedSec}s elapsed
                </p>
              </div>

              <div className="flex gap-2">
                {[0, 0.2, 0.4].map((delay, i) => (
                  <motion.div
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                    animate={{ scale: [1, 1.6, 1], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.2, delay, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero still preview ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
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
            <p className="text-sm font-bold text-red-900">Scene generation failed.</p>
            <p className="mt-2 text-sm text-red-700">Try regenerating — the AI models are stochastic and a retry usually fixes it.</p>
            <button
              onClick={handleGenerate}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition-all hover:bg-red-700 active:scale-95"
            >
              <RefreshCw size={13} /> Retry
            </button>
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
                      : 'ring-1 ring-gray-200 hover:ring-gray-300'
                  }`}
                  style={{ width: 88, height: 156 }}
                  aria-label={`Load generation ${gen.id.split('-')[0]}`}
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
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/90">
                      #{gen.id.split('-')[0].toUpperCase()}
                    </p>
                  </div>
                  {isActive && (
                    <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                      <Check size={11} />
                    </div>
                  )}
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
