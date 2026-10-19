'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Globe, Crown, Loader2, ExternalLink, Lock,
  RefreshCw, Eye, EyeOff, Wand2, Compass,
  Sparkles, Check, MessageCircle, Ticket,
} from 'lucide-react';
import {
  ARCHETYPES,
  ARCHETYPE_KEYS,
  SITE_TEMPLATES,
  STUDIO_NICHES,
  SiteConceptSchema,
  type ArchetypeKey,
  type ShopWebsiteRow,
  type SiteProduct,
  type SiteConcept,
  type StudioNicheId,
} from '@/lib/siteTemplates';
import { canUseStudio } from '@/lib/tiers';
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
  logo_url?: string | null;
  banner_url?: string | null;
};

type StudioProps = {
  shop: StudioShop;
  website: ShopWebsiteRow | null;
  websiteLoading: boolean;
  onWebsiteChange: (row: ShopWebsiteRow) => void;
  variant?: 'full' | 'hub';
  products?: SiteProduct[] | null;
};

// Tier gate: lib/tiers canUseStudio — Pro+ (Studio moved down to Pro,
// founder matrix 2026-08-29; legacy 'advanced' payers keep access).

// Client-side ceilings for the AI steps — fetchJSON per-call deadline
// overrides, so a hung provider can never lock the UI (the transport default
// of 12s is for ordinary API calls, not generation). The route's maxDuration
// is 300s (claude-fable-5-1 primary + the zero-click asset phase), and BOTH
// steps must outlive that FULL server envelope: the concepts step runs the
// same generateWithFallback cascade the route budgets at ≈235s worst case
// (a multi-minute Fable adaptive-thinking turn, then serial fall-through
// fable → sonnet → gemini → 4o-mini), so a shorter consult deadline would
// self-author a timeout while the server is still legitimately working —
// abandoning a run the server would have self-reported on within 300s.
// 300s + 20s network/serialization margin = 320s: the server's honest error
// body (or result) always lands before we give up. Two names are kept so
// each call site documents which step it deadlines.
const CONSULT_TIMEOUT_MS = 320_000;
const EXECUTE_TIMEOUT_MS = 320_000;

// Multi-minute-safe elapsed label: "47s" until the first minute, then
// "3m 05s" — Fable builds legitimately run past 60s and a raw three-digit
// seconds counter reads like a hang.
const formatElapsed = (sec: number) =>
  sec >= 60 ? `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s` : `${sec}s`;

// ── Pre-generation selection (Step 1A niche → Step 1B theme) ────────────────
const recommendedArchetypesFor = (niche: StudioNicheId): ReadonlyArray<ArchetypeKey> =>
  STUDIO_NICHES.find((n) => n.id === niche)?.recommendedArchetypes ?? [];

/** Default Theme Archetype for a niche = its first recommended bundle. */
const defaultArchetypeFor = (niche: StudioNicheId): ArchetypeKey =>
  recommendedArchetypesFor(niche)[0] ?? ARCHETYPE_KEYS[0];

/** Entropy-engine seed: a FRESH token per click so no two builds replay. */
const mintVariationSeed = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : String(Date.now());

// ── Generation quota (2 included; +2 per Studio Token) ──────────────────────
// Studio Tokens are sold by the Sanndikaa team over WhatsApp (the limit is
// raised on the shop's row); the modal pre-fills the purchase message.
const STUDIO_TOKEN_WHATSAPP = '2203165466';

/** TEMPORARY testing switch, env-controlled only (NEXT_PUBLIC_ENFORCE_QUOTA).
 *  'true' = the full quota gate (client pre-checks, 402 handling, Token Top-Up
 *  modal). Anything else = the counters still read/render, but regeneration is
 *  never blocked and the modal never opens. No billing/quota code is removed. */
const ENFORCE_GENERATION_QUOTA = process.env.NEXT_PUBLIC_ENFORCE_QUOTA === 'true';

/** True when a generate-website response was the 402 QUOTA_EXCEEDED gate —
 *  matched defensively on status, code, or the server's error copy, since
 *  the transport error carries the body's `error` as its message. */
const isQuotaExceededError = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: unknown; code?: unknown; message?: unknown; body?: { code?: unknown } | null };
  if (e.status === 402 || e.code === 'QUOTA_EXCEEDED' || e.body?.code === 'QUOTA_EXCEEDED') return true;
  return typeof e.message === 'string' && /QUOTA_EXCEEDED|included website generations|of your website generations/i.test(e.message);
};

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

 export default function WebsiteGeneratorStudio({ shop, website, websiteLoading, onWebsiteChange, variant = 'full', products }: StudioProps) {
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

  // Step 1A / 1B selections — niche first; changing it re-defaults the theme
  // to that niche's first recommended archetype (the seller can still pick
  // any of the four). consultFirst swaps the primary CTA to the 2-step
  // consultation instead of the one-call direct build.
  const [selectedNiche, setSelectedNiche] = useState<StudioNicheId>('general');
  const [selectedArchetype, setSelectedArchetype] = useState<ArchetypeKey>(() => defaultArchetypeFor('general'));
  const [consultFirst, setConsultFirst] = useState(false);
  // Name shown on the building card during a direct (no-concept) build.
  const [directBuildName, setDirectBuildName] = useState<string | null>(null);
  // Which action the overwrite warning confirms — consult or direct build.
  const pendingOverwriteRef = useRef<'consult' | 'direct'>('consult');

  // Token Top-Up modal — opened when the quota is spent (client-side gate)
  // or when the server answers 402 QUOTA_EXCEEDED.
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const quotaCancelRef = useRef<HTMLButtonElement | null>(null);

  // Quota counters. A row read before the quota migration ran carries no
  // counters: an existing website then counts as 1 used (it was generated),
  // no website as 0; the included allowance is 2.
  const generationsUsed = website?.generations_used ?? (website ? 1 : 0);
  const generationsLimit = website?.generations_limit ?? 2;
  const generationsRemaining = Math.max(0, generationsLimit - generationsUsed);
  // Client-side gate — only bites while the env flag enforces the quota.
  const quotaBlocked = ENFORCE_GENERATION_QUOTA && generationsRemaining <= 0;

  // Entropy-engine seed coherence: the seed the on-screen concepts were
  // pitched under is held here and re-posted with the EXECUTE step, so the
  // concept pitched under seed S is BUILT under S — one creative identity per
  // consultation. Set only when a consultation succeeds; the next consult
  // replaces it.
  const [variationSeed, setVariationSeed] = useState<string | null>(null);

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
  const pendingRetryRef = useRef<'consult' | 'build' | 'direct' | null>(null);
  const retryHandlersRef = useRef<{ consult: () => void; build: () => void; direct: () => void }>({
    consult: () => {},
    build: () => {},
    direct: () => {},
  });

  const hasAccess = canUseStudio(shop.subscription_tier);

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
      else if (pending === 'direct') retryHandlersRef.current.direct();
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

  // Token Top-Up modal keyboard/focus wiring, active only while open.
  useEffect(() => {
    if (!isQuotaModalOpen) return;
    quotaCancelRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsQuotaModalOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isQuotaModalOpen]);

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
    // Entropy engine: a FRESH seed per consultation click. The server folds it
    // into the archetype-pair rotation and the concept prompt, so "Design New
    // Concepts" genuinely designs new concepts instead of replaying the
    // shop-id-deterministic pair — and the SAME seed is re-posted with the
    // execute step (handleBuild) so the build stays coherent with the pitch.
    // Onboarding's one-click builder mints its own seed per click.
    const seed =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : String(Date.now());
    try {
      const data = await fetchJSON<GenerateWebsiteResponse>(
        '/api/ai/generate-website',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 'concepts', variationSeed: seed, niche: selectedNiche }),
          signal: controller.signal,
        },
        { timeoutMs: CONSULT_TIMEOUT_MS }
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
      setVariationSeed(seed);
      setConceptReasoning(typeof data.niche_reasoning === 'string' ? data.niche_reasoning : null);
      setSelectedConcept(null);
      setPhase('choosing');
    } catch (err) {
      if (ENFORCE_GENERATION_QUOTA && isQuotaExceededError(err)) {
        setIsQuotaModalOpen(true);
        setPhase('idle');
        return;
      }
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
    if (quotaBlocked) {
      setIsQuotaModalOpen(true);
      return;
    }
    if (website) {
      pendingOverwriteRef.current = 'consult';
      setIsWarningModalOpen(true);
      return;
    }
    void handleConsult();
  };

  const handleConfirmOverwrite = () => {
    setIsWarningModalOpen(false);
    if (pendingOverwriteRef.current === 'direct') {
      void handleDirectBuild();
      return;
    }
    void handleConsult();
  };

  // ── Direct build (Step 1A niche + Step 1B theme → ONE execute call) ─────
  // No consultation: the seller's explicit niche and Theme Archetype ride the
  // execute step with a fresh seed, and the server builds the full site in a
  // single AI call. Same wholesale-upsert contract as the concept build.
  const handleDirectBuild = async () => {
    const archetypeName = ARCHETYPES[selectedArchetype].name;
    setError(null);
    setDirectBuildName(archetypeName);
    setPhase('building');
    const controller = beginStep();
    const seed = mintVariationSeed();
    try {
      const data = await fetchJSON<ShopWebsiteRow & { shop_slug?: unknown }>(
        '/api/ai/generate-website',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: 'execute',
            niche: selectedNiche,
            archetypeKey: selectedArchetype,
            variationSeed: seed,
          }),
          signal: controller.signal,
        },
        { timeoutMs: EXECUTE_TIMEOUT_MS }
      );
      if (controller.signal.aborted) return;
      syncShopSlug(data.shop_slug);
      onWebsiteChange(data as ShopWebsiteRow);
      setConcepts(null);
      setConceptReasoning(null);
      setSelectedConcept(null);
      setPhase('idle');
    } catch (err) {
      if (ENFORCE_GENERATION_QUOTA && isQuotaExceededError(err)) {
        setIsQuotaModalOpen(true);
        setPhase('idle');
        return;
      }
      if (isTransportError(err)) {
        if (err.kind === 'abort') return; // cancel/unmount/superseded — silent
        if (err.kind === 'timeout') {
          setError('Building the website timed out. Your selections are kept — please try again.');
        } else if (err.kind === 'offline') {
          pendingRetryRef.current = 'direct';
          setError('You appear to be offline. We’ll retry the build automatically once your connection returns — your selections are kept.');
        } else {
          setError(err.message || 'Failed to build the website.');
        }
        setPhase('idle');
        return;
      }
      setError('Network error building the website. Please try again.');
      setPhase('idle');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setDirectBuildName(null);
    }
  };

  // Primary Step 1 CTA: direct build by default; the "Preview 2 AI Concepts
  // First" toggle routes it through the consultation instead. Quota gate
  // first (Token Top-Up modal), then the overwrite warning for existing sites.
  const handleGenerateClick = () => {
    if (consultFirst) {
      handleConsultClick();
      return;
    }
    if (quotaBlocked) {
      setIsQuotaModalOpen(true);
      return;
    }
    if (website) {
      pendingOverwriteRef.current = 'direct';
      setIsWarningModalOpen(true);
      return;
    }
    void handleDirectBuild();
  };

  const handleNicheSelect = (id: StudioNicheId) => {
    setSelectedNiche(id);
    // Phase 5C auto-sync: keep the merchant's archetype if the new niche still
    // recommends it; otherwise snap to that niche's first recommended bundle so
    // a bakery can never carry High-Contrast Street into the build request.
    if (!recommendedArchetypesFor(id).includes(selectedArchetype)) {
      setSelectedArchetype(defaultArchetypeFor(id));
    }
  };

  // ── Step 2: build the chosen concept ────────────────────────────────────
  const handleBuild = async () => {
    if (selectedConcept === null || !concepts?.[selectedConcept]) return;
    if (quotaBlocked) {
      setIsQuotaModalOpen(true);
      return;
    }
    const concept = concepts[selectedConcept];
    setError(null);
    setPhase('building');
    const controller = beginStep();
    try {
      // The consult seed rides along (when held) so the build's structural
      // and copy variation is the same creative identity the seller approved.
      const data = await fetchJSON<ShopWebsiteRow & { shop_slug?: unknown }>(
        '/api/ai/generate-website',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: 'execute',
            concept,
            niche: selectedNiche,
            ...(variationSeed ? { variationSeed } : {}),
          }),
          signal: controller.signal,
        },
        { timeoutMs: EXECUTE_TIMEOUT_MS }
      );
      if (controller.signal.aborted) return;
      syncShopSlug(data.shop_slug);
      onWebsiteChange(data as ShopWebsiteRow);
      setConcepts(null);
      setConceptReasoning(null);
      setSelectedConcept(null);
      setPhase('idle');
    } catch (err) {
      if (ENFORCE_GENERATION_QUOTA && isQuotaExceededError(err)) {
        setIsQuotaModalOpen(true);
        setPhase('choosing');
        return;
      }
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
    direct: () => { void handleDirectBuild(); },
  };

  // Cancel an in-flight step: abort the request, land on the right phase.
  const handleCancelConsult = () => {
    abortRef.current?.abort('cancel');
    setPhase('idle');
  };

  // A cancelled DIRECT build has no concepts to return to — land on idle
  // (the 'choosing' panel renders nothing without concepts).
  const handleCancelBuild = () => {
    abortRef.current?.abort('cancel');
    setPhase(concepts ? 'choosing' : 'idle');
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

  const recommendedForNiche = recommendedArchetypesFor(selectedNiche);
  const selectedNicheLabel = STUDIO_NICHES.find((n) => n.id === selectedNiche)?.label ?? 'this niche';
  const quotaWhatsAppHref = `https://wa.me/${STUDIO_TOKEN_WHATSAPP}?text=${encodeURIComponent(
    `Hello Sanndikaa Team, I would like to purchase a Website Studio Token (+2 extra generations) for my shop: ${shop.shop_name ?? shopSlug ?? shop.id}`
  )}`;

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
              <Crown size={11} /> Pro
            </span>
          </div>
          <p className="mt-2 max-w-xl text-sm text-gray-500">
            A complete standalone storefront, designed and written by AI around your inventory —
            beyond the boutique themes below.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasAccess && !websiteLoading && (
            <span
              aria-live="polite"
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest ring-1 ${
                generationsRemaining > 0
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-red-50 text-red-700 ring-red-200'
              }`}
            >
              <Ticket size={12} /> {generationsRemaining} of {generationsLimit} Generations Left
            </span>
          )}
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
            the one you choose — hero film, brand story, and all. Included from the Pro tier.
          </p>
          <p className="mt-5 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
            <Lock size={12} /> Locked on your current plan
          </p>
          <Link
            href="/pricing"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#f0a500] px-8 py-3.5 text-[11px] font-black uppercase tracking-widest text-black transition hover:bg-amber-400 active:scale-95"
          >
            <Crown size={14} /> Upgrade to Pro
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

          {/* Step 1 — Niche + Theme selection → direct build (or consult first) */}
          {(phase === 'idle' || phase === 'consulting') && (
            <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Step 1 · Niche &amp; Theme
                  </p>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
                    Tell the studio what you sell and choose the design it should wear. One click
                    builds your complete storefront — hero, brand story, collection and all —
                    written around your real inventory.
                  </p>
                </div>
              </div>

              {/* Step 1A — Boutique niche */}
              <div className="mt-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-900">
                  1A · Select Your Boutique Niche
                </p>
                <div
                  role="radiogroup"
                  aria-label="Boutique niche"
                  className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
                >
                  {STUDIO_NICHES.map((n) => {
                    const active = n.id === selectedNiche;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={busy}
                        onClick={() => handleNicheSelect(n.id)}
                        className={`rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                          active
                            ? 'border-gray-900 bg-gray-900 text-white shadow-md'
                            : 'border-gray-200 bg-white text-gray-900 hover:border-gray-400'
                        }`}
                      >
                        <p className="text-xs font-bold">{n.label}</p>
                        <p className={`mt-0.5 text-[11px] leading-snug ${active ? 'text-white/60' : 'text-gray-500'}`}>
                          {n.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 1B — Theme template design (the four archetype bundles) */}
              <div className="mt-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-900">
                  1B · Select Your Theme Template Design
                </p>
                <div
                  role="radiogroup"
                  aria-label="Theme template design"
                  className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2"
                >
                  {ARCHETYPE_KEYS.map((key) => {
                    const a = ARCHETYPES[key];
                    const active = key === selectedArchetype;
                    const recommended = recommendedForNiche.includes(key);
                    // Phase 5C guardrail: non-recommended archetypes stay visible
                    // but are disabled, so the merchant sees WHY the option is
                    // off-limits instead of wondering where it went.
                    const blocked = !recommended;
                    const swatches = [a.theme.background, a.theme.primary, a.theme.accent, a.theme.text]
                      .filter((hex): hex is string => typeof hex === 'string');
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-disabled={blocked || undefined}
                        disabled={busy || blocked}
                        title={blocked ? `Not recommended for ${selectedNicheLabel}` : undefined}
                        onClick={() => setSelectedArchetype(key)}
                        className={`relative rounded-2xl border bg-white p-4 pr-12 text-left transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                          active
                            ? 'border-gray-900 shadow-md ring-2 ring-gray-900'
                            : 'border-gray-200 hover:border-gray-400'
                        } ${blocked ? 'pointer-events-none opacity-50 grayscale' : ''}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-serif text-base font-bold text-gray-900">{a.name}</p>
                          <span className="rounded-full bg-gray-900 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
                            {SITE_TEMPLATES[a.template_key].name} Layout
                          </span>
                          {recommended && (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-700 ring-1 ring-emerald-200">
                              Recommended
                            </span>
                          )}
                          {blocked && (
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-600 ring-1 ring-gray-200">
                              Not recommended for {selectedNicheLabel}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-gray-500">{a.vibe}</p>
                        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
                          {swatches.map((hex, i) => (
                            <span
                              key={`${hex}-${i}`}
                              className="h-4 w-4 rounded-full ring-1 ring-black/10"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                        {active && (
                          <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white">
                            <Check size={13} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Consult-first toggle + primary CTA */}
              <div className="mt-6 flex flex-col gap-4 border-t border-gray-100 pt-6 md:flex-row md:items-center md:justify-between">
                <button
                  type="button"
                  role="switch"
                  aria-checked={consultFirst}
                  disabled={busy}
                  onClick={() => setConsultFirst((v) => !v)}
                  className="flex items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${consultFirst ? 'bg-gray-900' : 'bg-gray-200'}`}>
                    <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${consultFirst ? 'translate-x-4' : 'translate-x-0'}`} />
                  </span>
                  <span>
                    <span className="block text-xs font-bold text-gray-900">Preview 2 AI Concepts First</span>
                    <span className="block text-[11px] leading-snug text-gray-500">
                      Run the design consultation and choose between two pitched directions before building.
                    </span>
                  </span>
                </button>

                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={handleGenerateClick}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#1a2e1a] to-gray-900 px-8 py-3.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {phase === 'consulting'
                      ? <><Loader2 size={13} className="animate-spin" /> Consulting… {formatElapsed(elapsedSec)}</>
                      : consultFirst
                        ? website
                          ? <><RefreshCw size={13} /> Design New Concepts</>
                          : <><Compass size={13} /> Start Design Consultation</>
                        : <><Sparkles size={13} /> {website ? 'Regenerate Website' : 'Generate Website'}</>}
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
  products={products}
  logoUrl={shop.logo_url}
  bannerUrl={shop.banner_url}
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
                  Building {chosenConceptName
                    ? `“${chosenConceptName}”`
                    : directBuildName
                      ? `your “${directBuildName}” storefront`
                      : 'your storefront'}…
                </h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-500">
                  Injecting your products, logo, and inventory into the chosen layout and writing
                  every line of your site copy. A considered build can take a few minutes.
                </p>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Elapsed {formatElapsed(elapsedSec)}
                </p>
                <button
                  onClick={handleCancelBuild}
                  className="mt-5 rounded-full bg-gray-50 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  {concepts ? 'Cancel — Keep My Concepts' : 'Cancel'}
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
                Pick your niche and a theme template above, then Generate Website — the AI builds the
                whole site around your inventory in one pass. Prefer to compare directions first?
                Switch on the concept preview. A full build can take a few minutes.
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

      {/* ── Token Top-Up modal (quota spent / server 402 QUOTA_EXCEEDED) ────
          Same z-[90] layer as the overwrite warning. */}
      <AnimatePresence>
        {ENFORCE_GENERATION_QUOTA && isQuotaModalOpen && (
          <motion.div
            key="quota-topup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setIsQuotaModalOpen(false)}
              className="absolute inset-0 cursor-default bg-neutral-950/60 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="quota-topup-title"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl md:p-8"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-[#f0a500]">
                  <Ticket size={18} />
                </span>
                <h3 id="quota-topup-title" className="font-serif text-xl font-bold leading-snug text-gray-900">
                  Studio Token required
                </h3>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-gray-600">
                You&apos;ve used your 2 included website generations. To prevent spam and guarantee
                flagship quality, additional generations require a Studio Token (+2 Generations).
              </p>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {generationsUsed} of {generationsLimit} generations used
              </p>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  ref={quotaCancelRef}
                  type="button"
                  onClick={() => setIsQuotaModalOpen(false)}
                  className="rounded-full border border-gray-200 bg-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:bg-gray-50 active:scale-95"
                >
                  Cancel
                </button>
                <a
                  href={quotaWhatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:opacity-90 active:scale-95"
                >
                  <MessageCircle size={14} /> Get a Studio Token on WhatsApp
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
