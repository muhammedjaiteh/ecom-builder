'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Globe, Crown, Loader2, ExternalLink,
  RefreshCw, Eye, EyeOff, Wand2, Compass,
} from 'lucide-react';
import { SITE_TEMPLATES, SiteConceptSchema, type SiteConcept, type WebsiteConfig, type TemplateKey } from '@/lib/siteTemplates';
import { slugify } from '@/lib/slugify';
import ConceptCard from '@/components/website/ConceptCard';

type ShopRow = {
  id: string;
  shop_name: string | null;
  shop_slug: string | null;
  subscription_tier: string | null;
};

type WebsiteRow = {
  id: string;
  shop_id: string;
  template_key: TemplateKey;
  config: WebsiteConfig;
  status: 'draft' | 'published';
  niche_reasoning: string | null;
  generated_at: string;
  published_at: string | null;
};

const WEBSITE_TIERS = ['advanced', 'flagship'];

// Client-side ceiling for either AI step — the route's maxDuration (120s)
// plus a small network margin, so a hung provider can never lock the UI.
const STEP_TIMEOUT_MS = 125_000;

// Two-step premium flow:
//   idle       → nothing in flight; consult button available
//   consulting → Step 1 running (fast concept pitch)
//   choosing   → two concepts on screen, awaiting the seller's pick
//   building   → Step 2 running (full site generation for the chosen concept)
type GenPhase = 'idle' | 'consulting' | 'choosing' | 'building';

export default function WebsiteGeneratorPage() {
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<ShopRow | null>(null);
  const [website, setWebsite] = useState<WebsiteRow | null>(null);
  const [phase, setPhase] = useState<GenPhase>('idle');
  const [concepts, setConcepts] = useState<SiteConcept[] | null>(null);
  const [conceptReasoning, setConceptReasoning] = useState<string | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Controller for the in-flight AI step. Aborted with a reason string
  // ('cancel' | 'timeout' | 'unmount' | 'superseded') so the catch blocks can
  // tell a seller-initiated cancel from a timeout from navigation.
  const abortRef = useRef<AbortController | null>(null);

  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const [shopRes, siteRes] = await Promise.all([
        supabase.from('shops').select('id, shop_name, shop_slug, subscription_tier').eq('id', user.id).single(),
        supabase.from('shop_websites').select('*').eq('shop_id', user.id).maybeSingle(),
      ]);

      setShop(shopRes.data as ShopRow | null);
      setWebsite(siteRes.data as WebsiteRow | null);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const beginStep = () => {
    abortRef.current?.abort('superseded');
    const controller = new AbortController();
    abortRef.current = controller;
    return controller;
  };

  const tier = (shop?.subscription_tier ?? '').toLowerCase().trim();
  const hasAccess = WEBSITE_TIERS.includes(tier);

  // Law 2 slug safety: /site links are minted ONLY from a slug that is
  // already canonical (lowercase, hyphenated) in the DB. Slugifying a legacy
  // value client-side could collide with ANOTHER shop's canonical slug and
  // open the wrong storefront — so legacy rows show no link until the
  // write-repair below round-trips the slug this shop verifiably owns.
  const storedSlug = shop?.shop_slug ?? null;
  const siteSlug = storedSlug && storedSlug === slugify(storedSlug) ? storedSlug : null;

  const syncShopSlug = (slug: unknown) => {
    if (typeof slug === 'string' && slug) {
      setShop((prev) => (prev ? { ...prev, shop_slug: slug } : prev));
    }
  };

  // Write-repair a legacy slug as soon as the dashboard loads, so "View Live
  // Site" works for pre-existing websites without requiring a generate or
  // publish first. The server resolves collisions (deterministic suffix) and
  // returns the canonical slug we mint links with.
  useEffect(() => {
    if (loading || !shop || !hasAccess || siteSlug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/generate-website', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 'repair-slug' }),
        });
        const data = await res.json();
        if (!cancelled && res.ok) syncShopSlug(data.shop_slug);
      } catch {
        // Non-fatal: the /site route's verified fallback still resolves
        // legacy slugs; we simply don't mint a link until repair succeeds.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, shop?.id, hasAccess, siteSlug]);

  // ── Step 1: design consultation ─────────────────────────────────────────
  const handleConsult = async () => {
    setError(null);
    setPhase('consulting');
    const controller = beginStep();
    const timeout = setTimeout(() => controller.abort('timeout'), STEP_TIMEOUT_MS);
    try {
      const res = await fetch('/api/ai/generate-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'concepts' }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (!res.ok) {
        setError(data.error || 'Failed to prepare your design concepts.');
        setPhase('idle');
        return;
      }
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
    } catch {
      if (controller.signal.aborted) {
        // 'cancel' / 'unmount' / 'superseded' already left the UI where it
        // belongs; only a timeout needs surfacing.
        if (controller.signal.reason === 'timeout') {
          setError('The design consultation timed out. Please try again.');
          setPhase('idle');
        }
        return;
      }
      setError('Network error preparing your design concepts. Please try again.');
      setPhase('idle');
    } finally {
      clearTimeout(timeout);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  // ── Step 2: build the chosen concept ────────────────────────────────────
  const handleBuild = async () => {
    if (selectedConcept === null || !concepts?.[selectedConcept]) return;
    const concept = concepts[selectedConcept];
    setError(null);
    setPhase('building');
    const controller = beginStep();
    const timeout = setTimeout(() => controller.abort('timeout'), STEP_TIMEOUT_MS);
    try {
      const res = await fetch('/api/ai/generate-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'execute', concept }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (!res.ok) {
        setError(data.error || 'Failed to build the website.');
        setPhase('choosing');
        return;
      }
      syncShopSlug(data.shop_slug);
      setWebsite(data as WebsiteRow);
      setConcepts(null);
      setConceptReasoning(null);
      setSelectedConcept(null);
      setPhase('idle');
    } catch {
      if (controller.signal.aborted) {
        if (controller.signal.reason === 'timeout') {
          setError('Building the website timed out. Your concepts are saved — please try again.');
          setPhase('choosing');
        }
        return;
      }
      setError('Network error building the website. Please try again.');
      setPhase('choosing');
    } finally {
      clearTimeout(timeout);
      if (abortRef.current === controller) abortRef.current = null;
    }
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
      const res = await fetch('/api/websites/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update publish state.');
        return;
      }
      syncShopSlug(data.shop_slug);
      setWebsite(data as WebsiteRow);
    } catch {
      setError('Network error updating publish state.');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const site = website?.config?.site;
  const templateMeta = website ? SITE_TEMPLATES[website.template_key] : null;
  const chosenConceptName =
    selectedConcept !== null && concepts?.[selectedConcept]
      ? concepts[selectedConcept].concept_name
      : null;

  return (
    <div className="min-h-screen bg-[#F9F8F6] pb-24 font-sans text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur-md md:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-1.5 rounded-full bg-gray-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:bg-gray-100">
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <div>
              <h1 className="font-serif text-xl font-bold">AI Website Generator</h1>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {shop?.shop_name ?? 'Your Boutique'}
              </p>
            </div>
          </div>
          {hasAccess && website?.status === 'published' && siteSlug && (
            <a
              href={`/site/${siteSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
            >
              <ExternalLink size={13} /> View Live Site
            </a>
          )}
          {hasAccess && website && website.status !== 'published' && siteSlug && (
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
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 md:px-10">

        {/* ── Locked state (non-Advanced) ─────────────────────────────────── */}
        {!hasAccess && (
          <div className="relative overflow-hidden rounded-[2rem] bg-[#1a1a1a] p-10 text-center text-white shadow-2xl md:p-16">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#f0a500]/10 blur-3xl" />
            <Crown size={36} className="mx-auto text-[#f0a500]" />
            <h2 className="mt-6 font-serif text-3xl font-bold md:text-4xl">Your entire storefront, generated.</h2>
            <p className="mx-auto mt-4 max-w-lg leading-relaxed text-white/60">
              The AI Website Generator studies your inventory, pitches two bespoke design concepts, and builds
              the one you choose — hero film, brand story, and all. Exclusive to the Advanced tier.
            </p>
            <Link
              href="/pricing"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#f0a500] px-8 py-3.5 text-[11px] font-black uppercase tracking-widest text-black transition hover:bg-amber-400 active:scale-95"
            >
              <Crown size={14} /> Upgrade to Advanced
            </Link>
          </div>
        )}

        {/* ── Generator (Advanced) ────────────────────────────────────────── */}
        {hasAccess && (
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
                      The AI studies your inventory and pitches two distinct storefront directions.
                      Choose the one that feels like your brand — then it builds the full site around
                      your products, logo, and Ad Studio assets.
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      onClick={handleConsult}
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
                    <button onClick={() => setError(null)} className="text-[11px] font-bold text-red-400 hover:text-red-600">✕</button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2 — Concept selection */}
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
                      <h2 className="mt-2 font-serif text-2xl font-bold">Two concepts, tailored to your boutique.</h2>
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
                      />
                    ))}
                  </div>

                  {error && (
                    <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
                      <p className="flex-1 text-sm font-medium text-red-800">{error}</p>
                      <button onClick={() => setError(null)} className="text-[11px] font-bold text-red-400 hover:text-red-600">✕</button>
                    </div>
                  )}

                  <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-6 md:flex-row">
                    <p className="text-sm text-gray-500">
                      {selectedConcept !== null && chosenConceptName
                        ? <>Selected: <span className="font-bold text-gray-900">{chosenConceptName}</span></>
                        : 'Select the concept that feels like your brand.'}
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
                  <h2 className="mt-6 font-serif text-2xl font-bold">
                    Building {chosenConceptName ? `“${chosenConceptName}”` : 'your storefront'}…
                  </h2>
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
                  Start the design consultation to see two bespoke storefront concepts for your
                  inventory — then pick one and the AI builds the whole site. Each step takes seconds.
                </p>
              </div>
            )}

            {/* Generated preview */}
            {website && site && phase !== 'building' && (
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
                      <Wand2 size={11} className="text-[#f0a500]" /> {templateMeta?.name} Template
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
                    <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500">Why this template</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-violet-900">{website.niche_reasoning}</p>
                  </div>
                )}

                {/* Copy preview */}
                <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Generated Site Copy</p>

                  <div className="mt-6 space-y-8">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#f0a500]">{site.tagline}</p>
                      <h2 className="mt-2 font-serif text-3xl font-bold leading-tight md:text-4xl">{site.hero_headline}</h2>
                      <p className="mt-3 max-w-2xl leading-relaxed text-gray-600">{site.hero_subheadline}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
      </main>
    </div>
  );
}
