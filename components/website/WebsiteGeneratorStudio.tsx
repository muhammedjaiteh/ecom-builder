'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Globe, Crown, Loader2, ExternalLink, Lock,
  RefreshCw, Eye, EyeOff, Wand2, Compass,
} from 'lucide-react';
import { SITE_TEMPLATES, SiteConceptSchema, type ShopWebsiteRow, type SiteConcept } from '@/lib/siteTemplates';
import { slugify } from '@/lib/slugify';
import { fetchJSON, isTransportError } from '@/lib/transport';
import ConceptCard from '@/components/website/ConceptCard';

// ─────────────────────────────────────────────────────────────────────────────
// AI Website Studio — the full generator experience, embedded as the flagship
// section of Online Store → Themes. Carries the complete 2-step flow:
// consultation → visual concept choice → build → preview/publish, with
// abort/cancel, timeouts, slug write-repair, and publish toggling intact.
// Advanced/Flagship tiers only; everyone else sees the premium lock.
//
// The website row is CONTROLLED BY THE PAGE (loaded once through the owner
// content API, GET /api/websites/content). The studio previously read
// shop_websites with the browser client here — that table has no select
// policies, so the read returned zero rows silently and every pre-existing
// site presented as "No website generated yet" until a generate/publish
// response repopulated state. Generate/build/publish responses flow back up
// through onWebsiteChange so the page (and the Site Editor beside this
// studio) stay in sync.
// ─────────────────────────────────────────────────────────────────────────────

export type StudioShop = {
  id: string;
  shop_name: string | null;
  shop_slug: string | null;
  subscription_tier: string | null;
};

type StudioProps = {
  shop: StudioShop;
  website: ShopWebsiteRow | null;
  websiteLoading: boolean;
  onWebsiteChange: (row: ShopWebsiteRow) => void;
  /** 'hub' (Themes hub) declutters the studio to the pure GENERATE flow:
   *  the hero card above it owns the thumbnail, publish chip/toggle, and
   *  live links, so the status row, copy-preview, reasoning, and link-hint
   *  panels stay hidden. Default 'full' keeps the historical rendering. */
  variant?: 'full' | 'hub';
};

const WEBSITE_TIERS = ['advanced', 'flagship'];

// Client-side ceiling for either AI step — the route's maxDuration (120s)
// plus a small network margin, so a hung provider can never lock the UI.
// Passed to fetchJSON as the per-call deadline override (the transport
// default of 12s is for ordinary API calls, not generation).
const STEP_TIMEOUT_MS = 125_000;

// Loose response shape for /api/ai/generate-website — fields are validated
// individually (SiteConceptSchema, syncShopSlug's typeof gate) before use.
type GenerateWebsiteResponse = {
  concepts?: unknown;
  niche_reasoning?: unknown;
  shop_slug?: unknown;
};

// Two-step premium flow:
//   idle       → nothing in flight; consult button available
//   consulting → Step 1 running (fast concept pitch)
//   choosing   → two concepts on screen, awaiting the seller's pick
//   building   → Step 2 running (full site generation for the chosen concept)
type GenPhase = 'idle' | 'consulting' | 'choosing' | 'building';

export default function WebsiteGeneratorStudio({ shop, website, websiteLoading, onWebsiteChange, variant = 'full' }: StudioProps) {
  const hub = variant === 'hub';
  const [shopSlug, setShopSlug] = useState<string | null>(shop.shop_slug);
  const [phase, setPhase] = useState<GenPhase>('idle');
  const [concepts, setConcepts] = useState<SiteConcept[] | null>(null);
  const [conceptReasoning, setConceptReasoning] = useState<string | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);

  // Cancel is the safe default — focus lands on it when the overwrite
  // warning opens, and Escape dismisses without firing anything.
  const warningCancelRef = useRef<HTMLButtonElement | null>(null);

  // Controller for the in-flight AI step — the EXTERNAL signal composed into
  // fetchJSON ('cancel' | 'unmount' | 'superseded'). All three surface as the
  // classified 'abort' kind and stay silent; deadlines are fetchJSON's job
  // now ('timeout' kind).
  const abortRef = useRef<AbortController | null>(null);

  // Offline auto-retry: when a step fails with the classified 'offline' kind,
  // the failed step is parked here and re-fired on the window 'online' event
  // — the error banner promises exactly that. Dispatch goes through a
  // render-refreshed ref so the retry always sees current state (a first-
  // render closure over handleBuild would read stale concepts).
  const pendingRetryRef = useRef<'consult' | 'build' | null>(null);
  const retryHandlersRef = useRef<{ consult: () => void; build: () => void }>({
    consult: () => {},
    build: () => {},
  });

  const tier = (shop.subscription_tier ?? '').toLowerCase().trim();
  const hasAccess = WEBSITE_TIERS.includes(tier);

  // Elapsed ticker during either AI step.
  const busy = phase === 'consulting' || phase === 'building';
  useEffect(() => {
    if (!busy) { setElapsedSec(0); return; }
    const started = Date.now();
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [busy]);

  // Abort any in-flight AI step when the seller navigates away — no leaked
  // requests, no setState on an unmounted component.
  useEffect(() => () => { abortRef.current?.abort('unmount'); }, []);

  // Connectivity returned → fire the parked offline retry (if any).
  useEffect(() => {
    const onOnline = () => {
      const pending = pendingRetryRef.current;
      pendingRetryRef.current = null;
      if (pending === 'consult') retryHandlersRef.current.consult();
      else if (pending === 'build') retryHandlersRef.current.build();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  // Overwrite-warning modal keyboard/focus wiring, active only while open.
  useEffect(() => {
    if (!isWarningModalOpen) return;
    warningCancelRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsWarningModalOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isWarningModalOpen]);

  const beginStep = () => {
    abortRef.current?.abort('superseded');
    pendingRetryRef.current = null; // a manual step supersedes a parked retry
    const controller = new AbortController();
    abortRef.current = controller;
    return controller;
  };

  // Dismissing the error banner also cancels a parked offline auto-retry —
  // the banner is the promise; no banner, no surprise re-fire.
  const dismissError = () => {
    setError(null);
    pendingRetryRef.current = null;
  };

  // Law 2 slug safety: /site links are minted ONLY from a slug that is
  // already canonical (lowercase, hyphenated) in the DB. Slugifying a legacy
  // value client-side could collide with ANOTHER shop's canonical slug and
  // open the wrong storefront — so legacy rows show no link until the
  // write-repair below round-trips the slug this shop verifiably owns.
  const siteSlug = shopSlug && shopSlug === slugify(shopSlug) ? shopSlug : null;

  const syncShopSlug = (slug: unknown) => {
    if (typeof slug === 'string' && slug) setShopSlug(slug);
  };

  // Write-repair a legacy slug as soon as the studio mounts, so "View Live
  // Site" works for pre-existing websites without requiring a generate or
  // publish first. The server resolves collisions (deterministic suffix) and
  // returns the canonical slug we mint links with.
  useEffect(() => {
    if (!hasAccess || siteSlug) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchJSON<GenerateWebsiteResponse>('/api/ai/generate-website', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 'repair-slug' }),
        });
        if (!cancelled) syncShopSlug(data.shop_slug);
      } catch {
        // Non-fatal (any transport kind): the /site route's verified fallback
        // still resolves legacy slugs; we simply don't mint a link until
        // repair succeeds. The 12s default deadline stops a dead socket from
        // holding the request open.
      }
    })();
    return () => { cancelled = true; };
  }, [hasAccess, siteSlug]);

  // ── Step 1: design consultation ─────────────────────────────────────────
  const handleConsult = async () => {
    setError(null);
    setPhase('consulting');
    const controller = beginStep();
    try {
      const data = await fetchJSON<GenerateWebsiteResponse>(
        '/api/ai/generate-website',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 'concepts' }),
          signal: controller.signal,
        },
        { timeoutMs: STEP_TIMEOUT_MS }
      );
      if (controller.signal.aborted) return;
      // Defensive contract check: never enter 'choosing' without two
      // renderable concepts, or the panel has nothing to show and no way back.
      const received = Array.isArray(data.concepts)
        ? (data.concepts as unknown[]).filter((c): c is SiteConcept => SiteConceptSchema.safeParse(c).success)
        : [];
      if (received.length < 2) {
        setError('The consultation returned an unexpected response. Please try again.');
        setPhase('idle');
        return;
      }
      syncShopSlug(data.shop_slug);
      setConcepts(received);
      setConceptReasoning(typeof data.niche_reasoning === 'string' ? data.niche_reasoning : null);
      setSelectedConcept(null);
      setPhase('choosing');
    } catch (err) {
      if (isTransportError(err)) {
        // 'abort' = cancel/unmount/superseded — the UI is already where it
        // belongs; stay silent.
        if (err.kind === 'abort') return;
        if (err.kind === 'timeout') {
          setError('The design consultation timed out. Please try again.');
        } else if (err.kind === 'offline') {
          pendingRetryRef.current = 'consult';
          setError('You appear to be offline. We’ll retry the consultation automatically once your connection returns.');
        } else {
          setError(err.message || 'Failed to prepare your design concepts.');
        }
        setPhase('idle');
        return;
      }
      setError('Network error preparing your design concepts. Please try again.');
      setPhase('idle');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  // Destructive gate in front of Step 1. The execute step upserts config
  // WHOLESALE (generationToConfig in lib/siteTemplates.ts): seller-added
  // video_hero/product_tabs blocks and every inline copy edit are dropped.
  // So an existing website interposes the warning modal before the
  // consultation fires; a first-time seller has nothing to lose and proceeds
  // directly — showing them an "overwrite" warning would be dishonest UX.
  const handleConsultClick = () => {
    if (website) {
      setIsWarningModalOpen(true);
      return;
    }
    void handleConsult();
  };

  const handleConfirmOverwrite = () => {
    setIsWarningModalOpen(false);
    void handleConsult();
  };

  // ── Step 2: build the chosen concept ────────────────────────────────────
  const handleBuild = async () => {
    if (selectedConcept === null || !concepts?.[selectedConcept]) return;
    const concept = concepts[selectedConcept];
    setError(null);
    setPhase('building');
    const controller = beginStep();
    try {
      const data = await fetchJSON<ShopWebsiteRow & { shop_slug?: unknown }>(
        '/api/ai/generate-website',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 'execute', concept }),
          signal: controller.signal,
        },
        { timeoutMs: STEP_TIMEOUT_MS }
      );
      if (controller.signal.aborted) return;
      syncShopSlug(data.shop_slug);
      onWebsiteChange(data as ShopWebsiteRow);
      setConcepts(null);
      setConceptReasoning(null);
      setSelectedConcept(null);
      setPhase('idle');
    } catch (err) {
      if (isTransportError(err)) {
        if (err.kind === 'abort') return; // cancel/unmount/superseded — silent
        if (err.kind === 'timeout') {
          setError('Building the website timed out. Your concepts are saved — please try again.');
        } else if (err.kind === 'offline') {
          pendingRetryRef.current = 'build';
          setError('You appear to be offline. We’ll retry the build automatically once your connection returns — your concepts are saved.');
        } else {
          setError(err.message || 'Failed to build the website.');
        }
        setPhase('choosing');
        return;
      }
      setError('Network error building the website. Please try again.');
      setPhase('choosing');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  // Keep the offline auto-retry dispatch pointed at the CURRENT closures
  // (concepts/selectedConcept live in state) — assigned every render.
  retryHandlersRef.current = {
    consult: () => { void handleConsult(); },
    build: () => { void handleBuild(); },
  };

  // Cancel an in-flight step: abort the request, land on the right phase.
  const handleCancelConsult = () => {
    abortRef.current?.abort('cancel');
    setPhase('idle');
  };

  const handleCancelBuild = () => {
    abortRef.current?.abort('cancel');
    setPhase('choosing');
  };

  const handleCancelConcepts = () => {
    setConcepts(null);
    setConceptReasoning(null);
    setSelectedConcept(null);
    setPhase('idle');
  };

  const handlePublishToggle = async () => {
    if (!website) return;
    setError(null);
    setPublishing(true);
    try {
      const action = website.status === 'published' ? 'unpublish' : 'publish';
      const data = await fetchJSON<ShopWebsiteRow & { shop_slug?: unknown }>('/api/websites/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      syncShopSlug(data.shop_slug);
      onWebsiteChange(data as ShopWebsiteRow);
    } catch (err) {
      if (isTransportError(err) && err.kind === 'offline') {
        // No auto-retry for publish: it TOGGLES — re-firing minutes later
        // could silently unpublish a site the seller since decided to keep.
        setError('You appear to be offline — the publish change was not applied. Try again once you’re connected.');
      } else if (isTransportError(err) && err.kind === 'timeout') {
        setError('Updating the publish state timed out. Please try again.');
      } else if (isTransportError(err) && err.kind === 'server') {
        setError(err.message || 'Failed to update publish state.');
      } else {
        setError('Network error updating publish state.');
      }
    } finally {
      setPublishing(false);
    }
  };

  const site = website?.config?.site;
  const templateMeta = website ? SITE_TEMPLATES[website.template_key] : null;
  const chosenConceptName =
    selectedConcept !== null && concepts?.[selectedConcept]
      ? concepts[selectedConcept].concept_name
      : null;

  return (
    <section id="website-studio" className="mb-12">
      {/* Section header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2.5">
              <Wand2 size={20} className="text-[#f0a500]" /> AI Website Studio
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-50 to-yellow-50 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-800 ring-1 ring-amber-200">
              <Crown size={11} /> Advanced
            </span>
          </div>
          <p className="mt-2 max-w-xl text-sm text-gray-500">
            A complete standalone storefront, designed and written by AI around your inventory —
            beyond the boutique themes below.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!hub && hasAccess && website?.status === 'published' && siteSlug && (
            <a
              href={`/site/${siteSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
            >
              <ExternalLink size={13} /> View Live Site
            </a>
          )}
          {!hub && hasAccess && website && website.status !== 'published' && siteSlug && (
            <a
              href={`/site/${siteSlug}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-100"
            >
              <Eye size={13} /> Preview Draft
            </a>
          )}
        </div>
      </div>

      {/* ── Locked state (below Advanced) ─────────────────────────────────── */}
      {!hasAccess && (
        <div className="relative overflow-hidden rounded-[2rem] bg-[#1a1a1a] p-10 text-center text-white shadow-2xl md:p-16">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#f0a500]/10 blur-3xl" />
          <Crown size={36} className="mx-auto text-[#f0a500]" />
          <h3 className="mt-6 font-serif text-3xl font-bold md:text-4xl">Your entire storefront, generated.</h3>
          <p className="mx-auto mt-4 max-w-lg leading-relaxed text-white/60">
            The AI Website Studio studies your inventory, pitches two live website concepts, and builds
            the one you choose — hero film, brand story, and all. Exclusive to the Advanced tier.
          </p>
          <p className="mt-5 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
            <Lock size={12} /> Locked on your current plan
          </p>
          <Link
            href="/pricing"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#f0a500] px-8 py-3.5 text-[11px] font-black uppercase tracking-widest text-black transition hover:bg-amber-400 active:scale-95"
          >
            <Crown size={14} /> Upgrade to Advanced
          </Link>
        </div>
      )}

      {/* ── Studio (Advanced) ─────────────────────────────────────────────── */}
      {hasAccess && websiteLoading && (
        <div className="flex items-center justify-center rounded-[2rem] border border-gray-100 bg-white p-14 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {hasAccess && !websiteLoading && (
        <div className="space-y-6">

          {/* Step 1 — Consultation controls */}
          {(phase === 'idle' || phase === 'consulting') && (
            <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Step 1 · Design Consultation
                  </p>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
                    The AI studies your inventory and presents two live website previews —
                    two genuinely different layouts wearing your brand. Pick the one that
                    feels right and it builds the full site around your products.
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={handleConsultClick}
                    disabled={phase === 'consulting'}
                    className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#1a2e1a] to-gray-900 px-8 py-3.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {phase === 'consulting'
                      ? <><Loader2 size={13} className="animate-spin" /> Consulting… {elapsedSec}s</>
                      : website
                        ? <><RefreshCw size={13} /> Design New Concepts</>
                        : <><Compass size={13} /> Start Design Consultation</>}
                  </button>
                  {phase === 'consulting' && (
                    <button
                      onClick={handleCancelConsult}
                      className="rounded-full bg-gray-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="flex-1 text-sm font-medium text-red-800">{error}</p>
                  <button onClick={dismissError} className="text-[11px] font-bold text-red-400 hover:text-red-600">✕</button>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Visual concept selection */}
          <AnimatePresence>
            {phase === 'choosing' && concepts && (
              <motion.div
                key="concepts"
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#f0a500]">
                      Step 2 · Choose Your Direction
                    </p>
                    <h3 className="mt-2 font-serif text-2xl font-bold">Two live previews, tailored to your boutique.</h3>
                    {conceptReasoning && (
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">{conceptReasoning}</p>
                    )}
                  </div>
                  <button
                    onClick={handleCancelConcepts}
                    className="rounded-full bg-gray-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                  {concepts.map((concept, i) => (
                    <ConceptCard
                      key={`${concept.template_key}-${i}`}
                      concept={concept}
                      index={i}
                      selected={selectedConcept === i}
                      onSelect={() => setSelectedConcept(i)}
                      shopName={shop.shop_name}
                    />
                  ))}
                </div>

                {error && (
                  <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
                    <p className="flex-1 text-sm font-medium text-red-800">{error}</p>
                    <button onClick={dismissError} className="text-[11px] font-bold text-red-400 hover:text-red-600">✕</button>
                  </div>
                )}

                <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-6 md:flex-row">
                  <p className="text-sm text-gray-500">
                    {selectedConcept !== null && chosenConceptName
                      ? <>Selected: <span className="font-bold text-gray-900">{chosenConceptName}</span></>
                      : 'Select the website that feels like your brand.'}
                  </p>
                  <button
                    onClick={handleBuild}
                    disabled={selectedConcept === null}
                    className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#1a2e1a] to-gray-900 px-8 py-3.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Wand2 size={13} /> Build This Site
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 2 — Execution progress */}
          <AnimatePresence>
            {phase === 'building' && (
              <motion.div
                key="building"
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="rounded-[2rem] border border-gray-100 bg-white p-10 text-center shadow-sm md:p-14"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1a2e1a]">
                  <Loader2 className="h-6 w-6 animate-spin text-[#f0a500]" />
                </div>
                <h3 className="mt-6 font-serif text-2xl font-bold">
                  Building {chosenConceptName ? `“${chosenConceptName}”` : 'your storefront'}…
                </h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-500">
                  Injecting your products, logo, and inventory into the chosen layout and writing
                  every line of your site copy. About 20 seconds.
                </p>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Elapsed {elapsedSec}s
                </p>
                <button
                  onClick={handleCancelBuild}
                  className="mt-5 rounded-full bg-gray-50 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  Cancel — Keep My Concepts
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          {!website && phase === 'idle' && (
            <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white p-14 text-center">
              <Globe className="mx-auto mb-4 h-10 w-10 text-gray-300" />
              <p className="text-sm font-bold">No website generated yet.</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
                Start the design consultation to see two live storefront previews built around your
                inventory — then pick one and the AI builds the whole site. Each step takes seconds.
              </p>
            </div>
          )}

          {/* Generated preview — hidden on the hub (the hero card owns the
              live thumbnail, publish state, and links). */}
          {!hub && website && site && phase !== 'building' && (
            <div className="space-y-6">
              {/* Status + publish row */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
                    website.status === 'published'
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border border-amber-200 bg-amber-50 text-amber-700'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${website.status === 'published' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {website.status === 'published' ? 'Live' : 'Draft'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white">
                    <Wand2 size={11} className="text-[#f0a500]" /> {templateMeta?.name} Layout
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {templateMeta?.niche}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {website.status !== 'published' && siteSlug && (
                    <a
                      href={`/site/${siteSlug}?preview=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
                    >
                      <ExternalLink size={13} /> Preview Draft
                    </a>
                  )}
                  <button
                    onClick={handlePublishToggle}
                    disabled={publishing}
                    className={`flex items-center gap-2 rounded-full px-6 py-3 text-[10px] font-bold uppercase tracking-widest shadow-md transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                      website.status === 'published'
                        ? 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        : 'bg-gradient-to-r from-[#1a2e1a] to-gray-900 text-white hover:opacity-90'
                    }`}
                  >
                    {publishing
                      ? <><Loader2 size={13} className="animate-spin" /> Working…</>
                      : website.status === 'published'
                        ? <><EyeOff size={13} /> Unpublish</>
                        : <><Eye size={13} /> Publish Live</>}
                  </button>
                </div>
              </div>

              {website.niche_reasoning && (
                <div className="rounded-[2rem] border border-violet-100 bg-violet-50/60 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500">Why this layout</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-violet-900">{website.niche_reasoning}</p>
                </div>
              )}

              {/* Copy preview */}
              <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Generated Site Copy</p>

                <div className="mt-6 space-y-8">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#f0a500]">{site.tagline}</p>
                    <h3 className="mt-2 font-serif text-3xl font-bold leading-tight md:text-4xl">{site.hero_headline}</h3>
                    <p className="mt-3 max-w-2xl leading-relaxed text-gray-600">{site.hero_subheadline}</p>
                  </div>

                  {/* 2–4 value props (Phase 8): 4 folds to a clean 2×2 */}
                  <div className={`grid grid-cols-1 gap-4 ${site.value_props.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                    {site.value_props.map((v, i) => (
                      <div key={i} className="rounded-2xl bg-gray-50 p-5">
                        <p className="font-serif text-base font-bold">{v.title}</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{v.body}</p>
                      </div>
                    ))}
                  </div>

                  <div className="border-l-2 border-[#1a2e1a] pl-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Brand Story</p>
                    <p className="mt-2 font-serif text-lg leading-relaxed text-gray-800">{site.brand_story}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#1a2e1a] p-6 text-white">
                    <div>
                      <p className="font-serif text-xl font-bold">{site.cta_banner.headline}</p>
                      <p className="mt-1 text-sm text-white/60">{site.cta_banner.subtext}</p>
                    </div>
                    <span className="rounded-full bg-[#f0a500] px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-black">
                      {site.cta_banner.button_label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Live link hint */}
              {siteSlug && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Globe size={18} className="text-gray-400" />
                    <p className="text-sm text-gray-600">
                      Your site lives at{' '}
                      <span className="font-mono text-sm font-bold text-gray-900">/site/{siteSlug}</span>
                      {website.status !== 'published' && <span className="ml-2 text-xs text-amber-600">(publish to make it public)</span>}
                    </p>
                  </div>
                  {website.status === 'published' ? (
                    <a
                      href={`/site/${siteSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700 hover:text-emerald-900"
                    >
                      Open <ExternalLink size={12} />
                    </a>
                  ) : (
                    <a
                      href={`/site/${siteSlug}?preview=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-700 hover:text-amber-900"
                    >
                      Preview Draft <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Destructive overwrite warning ─────────────────────────────────
          Sits above every layer of dashboard chrome (notifier stack z-[60],
          sidebar drawer z-[70]/z-[75], editor save bar) at z-[90]. */}
      <AnimatePresence>
        {isWarningModalOpen && (
          <motion.div
            key="overwrite-warning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          >
            <button
              type="button"
              aria-label="Cancel and keep my current design"
              onClick={() => setIsWarningModalOpen(false)}
              className="absolute inset-0 cursor-default bg-neutral-950/60 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="overwrite-warning-title"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl md:p-8"
            >
              <h3 id="overwrite-warning-title" className="font-serif text-xl font-bold leading-snug text-gray-900">
                ⚠️ Warning: This will replace your current design.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                Generating a new concept will completely overwrite your existing website layout.
                Any custom sections you added (like Videos or Tabs) and any text you manually
                edited will be replaced. Your current design is kept as a restorable backup —
                you can bring it back anytime from the studio.
              </p>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  ref={warningCancelRef}
                  type="button"
                  onClick={() => setIsWarningModalOpen(false)}
                  className="rounded-full border border-gray-200 bg-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:bg-gray-50 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmOverwrite}
                  disabled={busy}
                  className="rounded-full bg-red-600 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-red-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Yes, Overwrite My Site
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
