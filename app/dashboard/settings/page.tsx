'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard → Settings — the seller settings cockpit (Pillar 2 overhaul).
// Replaces the legacy paywall-only page with four working sections:
//
//   1. PROFILE — shop name, WhatsApp number, bio. Browser-client owner-scoped
//      shops UPDATE (RLS shops_owner_update is live-proven — the Themes brand
//      save uses the same channel), then the merged row is pushed through the
//      shops-row seam's bound mutate so the sidebar, studio, and storefront
//      links repaint instantly. Currency renders as FIXED "GMD (D)" with an
//      honest note (D is hardcoded platform-wide — an editable currency
//      nothing consumes would lie). Region and owner-name are OMITTED: the
//      shops table has no such columns (signup captures shop_name + phone
//      only) — no dead fields.
//   2. PLAN & BILLING — ONE card: the shop's ACTIVE tier only (no pricing
//      grid — that lives on /pricing). Starter/Pro carry a single "Upgrade
//      Plan" CTA = the existing WhatsApp upgrade flow, prefilled with every
//      tier above the current one at lib/tiers matrix prices. Flagship
//      renders the forest + gold crown treatment with NO upgrade affordance
//      (nothing left to sell). Legacy 'advanced' payers get an honest legacy
//      card built from the capabilities lib/tiers still grants them (Studio +
//      domain + broadcast) with no fabricated price, and a Flagship upgrade.
//   3. CUSTOM DOMAINS HUB — the SHARED components/domains/DomainManager
//      (extracted from the Online Store page — reuse, never duplicate),
//      tier-gated via canUseCustomDomain.
//   4. HELP & SUPPORT — prefilled WhatsApp support button (shop name + tier +
//      page context) and a truthful FAQ accordion: every claim matches a
//      shipped feature (WhatsApp checkout, Cash/Wave, domains, the Studio) —
//      no escrow/returns/guarantee language (the purge precedent).
//
// Gambia standard: rides useShopRow (persisted instant paint), honest offline
// chip when the row can't refresh, text-base (16px) inputs, ≥44px targets.
// The only destructive confirmation (domain disconnect) lives inside
// DomainManager, which already ships the BottomSheet/modal split.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Banknote, Check, CheckCircle2,
  ChevronDown, CreditCard, Crown, Globe, HelpCircle, Loader2, Lock,
  MessageCircle, Store, WifiOff,
} from 'lucide-react';
import DomainManager from '@/components/domains/DomainManager';
import { resolveDashboardUser } from '@/lib/dashboardAuth';
import { getTierRank } from '@/lib/feedRanking';
import {
  SUPPORT_WHATSAPP, TIER_BY_ID, TIER_MATRIX, canUseCustomDomain, canUseStudio,
  normalizeTier, type AnyTier, type TierCard,
} from '@/lib/tiers';
import { useShopRow } from '@/lib/useShopRow';

// ── Active-plan view model ───────────────────────────────────────────────────
// The billing section renders exactly ONE card — the tier the shop is on.
// Sellable tiers come straight from TIER_MATRIX; the legacy 'advanced' plan
// (no longer sold, so no TierCard) is described from the capabilities
// lib/tiers still grants it. monthlyPrice is null for legacy — the seller's
// historical rate is not in the matrix and must never be invented.

type ActivePlan = {
  id: AnyTier;
  name: string;
  tagline: string;
  features: string[];
  monthlyPrice: number | null;
  legacy: boolean;
};

const LEGACY_ADVANCED_PLAN: ActivePlan = {
  id: 'advanced',
  name: 'Advanced',
  tagline: 'Everything you pay for stays yours — the Studio and your custom domain keep working exactly as before.',
  features: [
    'AI Website Studio & Live Site Editor',
    'Custom domain (.com / .gm / .sn) with automatic SSL',
    'WhatsApp customer broadcast engine',
    'Unlimited AI credits',
    'Placement above Pro shops in the feed',
  ],
  monthlyPrice: null,
  legacy: true,
};

function resolveActivePlan(tier: string): ActivePlan {
  if (tier === 'advanced') return LEGACY_ADVANCED_PLAN;
  // Unknown/empty values fall to Starter — the historical default and the
  // same fallback the header chip renders.
  const card: TierCard =
    tier === 'pro' || tier === 'flagship' ? TIER_BY_ID[tier] : TIER_BY_ID.starter;
  return {
    id: card.id,
    name: card.name,
    tagline: card.tagline,
    features: card.features,
    monthlyPrice: card.monthlyPrice,
    legacy: false,
  };
}

// ── Truthful FAQ — every answer describes a SHIPPED behavior ─────────────────

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'How does ordering work for my customers?',
    a: 'Customers browse your boutique or website, add pieces to the bag (or tap Order on a product), and enter their name, phone, and delivery or pickup choice. Checkout opens WhatsApp with the full itemized order addressed to your number, and the same order is recorded in your dashboard under Orders so you can track and update its status.',
  },
  {
    q: 'How do customers pay?',
    a: 'Payments happen directly between you and your customer — Cash on delivery or a Wave / mobile-money transfer to your number, agreed in the WhatsApp conversation. Sanndikaa does not process card payments or hold money on the website.',
  },
  {
    q: 'How do custom domains work?',
    a: 'On the Flagship plan you can point a domain you already own (like maimuna-fashion.gm) at your Sanndikaa website. You add the DNS records we show you at your registrar, we verify them automatically, and SSL is issued for you. Local domains like .gm or .sn can take up to 24 hours to connect.',
  },
  {
    q: 'What is the AI Website Studio?',
    a: 'From the Pro plan, the Studio studies your inventory and pitches two website concepts. Pick one and it builds a complete branded site — hero, story, collection, and closing banner — that you can edit section by section (copy, colors, fonts, layout) and publish on your own sanndikaa.com link.',
  },
  {
    q: 'How do I upgrade my plan?',
    a: 'Tap Upgrade Plan in the Plan & Billing section above — it opens WhatsApp with your prefilled request and the plans above yours. Send your payment by the method our team confirms with you, and your dashboard unlocks the new tier in real time once it is activated. Flagship is the highest tier, so Flagship shops see no upgrade button.',
  },
];

export default function SettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  // Shops-row seam (lib/useShopRow, A3) — instant persisted paint; the
  // profile save below pushes the merged row back through the bound mutate.
  const { shop, verdict: shopVerdict, error: shopError, mutate } = useShopRow(userId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Non-evicting offline auth (lib/dashboardAuth) — transport failure with
      // a local session never redirects; only a genuine no-session does.
      const auth = await resolveDashboardUser(supabase);
      if (cancelled) return;
      if (auth.status === 'unauthenticated') {
        router.push('/login');
        return;
      }
      setUserId(auth.user.id);
    })();
    return () => { cancelled = true; };
  }, [router, supabase]);

  // ── Profile drafts — null = untouched (render the live row value) ─────────
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftPhone, setDraftPhone] = useState<string | null>(null);
  const [draftBio, setDraftBio] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileToast, setProfileToast] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const showProfileToast = (tone: 'ok' | 'error', message: string) => {
    setProfileToast({ tone, message });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setProfileToast(null), 4000);
  };

  const nameValue = draftName ?? shop?.shop_name ?? '';
  const phoneValue = draftPhone ?? shop?.phone ?? '';
  const bioValue = draftBio ?? shop?.bio ?? '';
  const profileDirty =
    (draftName !== null && draftName !== (shop?.shop_name ?? '')) ||
    (draftPhone !== null && draftPhone !== (shop?.phone ?? '')) ||
    (draftBio !== null && draftBio !== (shop?.bio ?? ''));

  const handleSaveProfile = async () => {
    if (!userId || !shop || savingProfile) return;
    const nextName = nameValue.trim();
    if (!nextName) {
      showProfileToast('error', 'Your shop needs a name.');
      return;
    }
    setSavingProfile(true);
    try {
      const updates = {
        shop_name: nextName,
        phone: phoneValue.trim() || null,
        bio: bioValue.trim() || null,
      };
      const { error } = await supabase.from('shops').update(updates).eq('id', userId);
      if (error) throw new Error(error.message);
      // The Step-1 seam: push the merged row through the bound mutate so the
      // whole dashboard (sidebar, studio identity, storefront links) repaints
      // instantly; background revalidation confirms from the DB.
      await mutate({ ...shop, ...updates }, { revalidate: true });
      setDraftName(null);
      setDraftPhone(null);
      setDraftBio(null);
      showProfileToast('ok', 'Profile saved — your boutique is up to date.');
    } catch (err) {
      console.error('[settings] profile save failed:', err);
      showProfileToast('error', 'Could not save your profile — check your connection and try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Billing helpers ────────────────────────────────────────────────────────
  const tier = normalizeTier(shop?.subscription_tier);
  const isLegacyAdvanced = tier === 'advanced';
  const currentTierLabel = isLegacyAdvanced
    ? 'Advanced (legacy)'
    : (TIER_MATRIX.find((t) => t.id === tier)?.name ?? (shop?.subscription_tier || 'Starter'));

  // The ONE card the billing section renders.
  const activePlan = resolveActivePlan(tier);
  const isFlagship = activePlan.id === 'flagship';

  // Every sellable tier ranked above the active one (lib/feedRanking is the
  // shared placement ladder: flagship 4 > advanced 3 > pro 2 > starter 1).
  // Flagship → [] → no upgrade affordance at all.
  const activeRank = getTierRank(activePlan.id);
  const upgradeOptions = TIER_MATRIX.filter((card) => getTierRank(card.id) > activeRank);

  // The standard WhatsApp upgrade flow (SUPPORT_WHATSAPP + prefilled request),
  // generalized: one option names it outright (Pro → Flagship); several list
  // them with matrix prices so the seller chooses in the conversation.
  const upgradeHref = (() => {
    if (upgradeOptions.length === 0) return null;
    const shopName = shop?.shop_name || 'my boutique';
    const ask = upgradeOptions.length === 1
      ? `I would like to upgrade my store to the *${upgradeOptions[0].name} Plan* (D${upgradeOptions[0].monthlyPrice}/month) to unlock its features.`
      : `I would like to upgrade my store. The plans above mine are:\n${upgradeOptions
          .map((card) => `• *${card.name} Plan* — D${card.monthlyPrice}/month`)
          .join('\n')}`;
    const message = `👑 *Sanndikaa Upgrade Request*\n\nHello Admin! I am the owner of *${shopName}*, currently on the *${activePlan.name} Plan*.\n\n${ask}\n\nHow can I send the payment to activate my upgrade?`;
    return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
  })();

  // ── Support ────────────────────────────────────────────────────────────────
  const supportHref = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
    `Hi Sanndikaa Support! This is ${shop?.shop_name || 'my boutique'} (${currentTierLabel} plan), writing from the Settings page. I need help with: `
  )}`;

  // ── FAQ accordion state ────────────────────────────────────────────────────
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Loading = auth pending, or no shops-row verdict from cache/network yet.
  const loading = !userId || (shopVerdict === undefined && !shopError);
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F9F8F6]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white pb-24">

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur-md md:px-10">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/dashboard" className="group flex min-h-[44px] items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500 transition hover:text-gray-900">
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Dashboard
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Plan:</span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${
              tier === 'flagship' || isLegacyAdvanced ? 'text-yellow-600' : tier === 'pro' ? 'text-emerald-700' : 'text-gray-900'
            }`}>
              {currentTierLabel}
            </span>
          </div>
        </div>
      </header>

      {/* Profile save toast */}
      <div
        aria-live="polite"
        className={`fixed left-1/2 top-24 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 transition-all duration-500 ${
          profileToast ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-4 opacity-0'
        }`}
      >
        <div className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-semibold text-white shadow-xl ${
          profileToast?.tone === 'ok' ? 'bg-emerald-700' : 'bg-red-600'
        }`}>
          {profileToast?.tone === 'ok' ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
          {profileToast?.message}
        </div>
      </div>

      <main className="mx-auto mt-4 max-w-4xl space-y-12 px-4 py-8 md:px-10">

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Command Center</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-sm text-gray-500">Your boutique identity, plan, domain, and a direct line to support.</p>
        </div>

        {/* Honest offline / stale chip — cached row stays editable underneath */}
        {Boolean(shopError) && shop && (
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-800">
            <WifiOff size={12} /> Could not refresh — showing your last synced profile.
          </div>
        )}

        {/* ═══ 1 · PROFILE ═══════════════════════════════════════════════════ */}
        <section aria-labelledby="settings-profile">
          <div className="mb-4 flex items-center gap-2">
            <Store size={16} className="text-gray-400" />
            <h2 id="settings-profile" className="text-sm font-bold uppercase tracking-widest text-gray-900">Shop Profile</h2>
          </div>

          <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Shop name</span>
                {/* text-base = 16px — iOS never zooms on focus */}
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setDraftName(e.target.value)}
                  maxLength={80}
                  placeholder="Your boutique name"
                  className="mt-1.5 min-h-[48px] w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-4 text-base font-medium text-gray-900 outline-none transition focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">WhatsApp number</span>
                <input
                  type="tel"
                  value={phoneValue}
                  onChange={(e) => setDraftPhone(e.target.value)}
                  maxLength={30}
                  inputMode="tel"
                  placeholder="e.g. 2203456789"
                  className="mt-1.5 min-h-[48px] w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-4 text-base font-medium text-gray-900 outline-none transition focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
                />
                <span className="mt-1.5 block text-[11px] leading-relaxed text-gray-400">
                  Where customer orders arrive — used by every order button on your boutique and website.
                </span>
              </label>

              <label className="block md:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Bio</span>
                <textarea
                  value={bioValue}
                  onChange={(e) => setDraftBio(e.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="Tell customers what your boutique stands for."
                  className="mt-1.5 w-full resize-none rounded-2xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-base font-medium leading-relaxed text-gray-900 outline-none transition focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
                />
              </label>
            </div>

            {/* Currency — deliberately FIXED, with the honest reason. */}
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-700 ring-1 ring-gray-200">
                <Banknote size={12} className="text-emerald-700" /> Currency: GMD (D)
              </span>
              <p className="text-[11px] leading-relaxed text-gray-500">
                Fixed for now — every price across Sanndikaa is in Dalasi, so a currency switch here would change nothing yet.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              {profileDirty && !savingProfile && (
                <span className="text-[11px] font-medium text-amber-700">Unsaved changes</span>
              )}
              <button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={!profileDirty || savingProfile}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#1a2e1a] px-8 text-[11px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black active:scale-95 disabled:opacity-40"
              >
                {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {savingProfile ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </div>
        </section>

        {/* ═══ 2 · PLAN & BILLING ════════════════════════════════════════════ */}
        <section aria-labelledby="settings-billing">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard size={16} className="text-gray-400" />
            <h2 id="settings-billing" className="text-sm font-bold uppercase tracking-widest text-gray-900">Plan &amp; Billing</h2>
          </div>

          {/* ONE card — the active tier. Full width so a single card reads as a
              deliberate statement, not a grid with two gaps: identity on the
              left, "what's included" on the right, the CTA row across the
              bottom. Flagship inverts to forest + gold; Starter/Pro stay on
              the raised white surface with a forest CTA. */}
          <div
            className={`relative overflow-hidden rounded-[2rem] p-6 md:p-8 ${
              isFlagship
                ? 'bg-mall-forest text-white shadow-2xl ring-1 ring-mall-gold/40'
                : 'border border-gray-100 bg-white shadow-sm'
            }`}
          >
            {isFlagship && (
              <>
                <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-mall-gold/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-mall-gold/10 blur-3xl" />
              </>
            )}

            <div className="relative grid grid-cols-1 gap-8 md:grid-cols-2 md:items-start md:gap-10">

              {/* Identity — chips, crown/badge, name, tagline, price */}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-widest shadow-sm ${
                    isFlagship ? 'bg-mall-gold text-mall-forest' : 'bg-mall-forest text-mall-bone'
                  }`}>
                    <CheckCircle2 size={11} /> Current plan
                  </span>
                  {activePlan.legacy && (
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-800">
                      Legacy plan
                    </span>
                  )}
                </div>

                <div className="mt-5 flex items-center gap-4">
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                    isFlagship
                      ? 'bg-mall-gold/15 ring-1 ring-mall-gold/50'
                      : activePlan.id === 'pro'
                        ? 'bg-emerald-50 ring-1 ring-emerald-100'
                        : 'bg-mall-bone ring-1 ring-mall-forest/10'
                  }`}>
                    {isFlagship
                      ? <Crown size={28} className="text-mall-gold" fill="currentColor" />
                      : <BadgeCheck size={26} className={activePlan.id === 'pro' ? 'text-emerald-600' : 'text-mall-forest/70'} />}
                  </span>
                  <div>
                    <h3 className={`font-serif text-3xl font-bold leading-none ${isFlagship ? 'text-white' : 'text-gray-900'}`}>
                      {activePlan.name}
                    </h3>
                    <p className={`mt-1.5 text-[10px] font-bold uppercase tracking-widest ${isFlagship ? 'text-mall-gold' : 'text-gray-400'}`}>
                      {isFlagship ? 'Sanndikaa’s highest tier' : activePlan.legacy ? 'Honored as agreed' : 'Sanndikaa plan'}
                    </p>
                  </div>
                </div>

                <p className={`mt-5 max-w-md text-sm leading-relaxed ${isFlagship ? 'text-white/70' : 'text-gray-500'}`}>
                  {activePlan.tagline}
                </p>

                {activePlan.monthlyPrice !== null ? (
                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span className={`text-4xl font-black tracking-tight ${isFlagship ? 'text-white' : 'text-gray-900'}`}>D{activePlan.monthlyPrice}</span>
                    <span className={`text-sm font-semibold ${isFlagship ? 'text-white/50' : 'text-gray-400'}`}>/month</span>
                  </div>
                ) : (
                  <div className="mt-6">
                    <span className="text-2xl font-black tracking-tight text-gray-900">Legacy rate</span>
                    <p className="mt-1 text-[11px] text-gray-400">Your monthly price stays exactly as agreed.</p>
                  </div>
                )}
              </div>

              {/* What's included — the tier's TRUTHFUL feature list (lib/tiers) */}
              <div className={`rounded-[1.5rem] p-5 md:p-6 ${
                isFlagship ? 'bg-white/5 ring-1 ring-white/10' : 'bg-mall-bone/60 ring-1 ring-mall-forest/5'
              }`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${isFlagship ? 'text-mall-gold' : 'text-gray-400'}`}>
                  Included in your plan
                </p>
                <ul className={`mt-4 space-y-3 text-[13px] leading-snug ${isFlagship ? 'text-white/85' : 'text-gray-700'}`}>
                  {activePlan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check size={15} className={`mt-0.5 shrink-0 ${
                        isFlagship ? 'text-mall-gold' : activePlan.id === 'pro' ? 'text-emerald-600' : 'text-mall-forest'
                      }`} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* CTA row — Starter / Pro / legacy: the ONE upgrade button (standard
                WhatsApp flow). Flagship: a quiet acknowledgement, zero buttons. */}
            {upgradeHref ? (
              <div className="relative mt-8 flex flex-col gap-4 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-gray-500">
                  Next up:{' '}
                  {upgradeOptions.map((card, i) => (
                    <span key={card.id}>
                      {i > 0 && <span className="text-gray-300"> · </span>}
                      <strong className="font-bold text-gray-900">{card.name}</strong> D{card.monthlyPrice}/mo
                    </span>
                  ))}
                  {' — '}
                  <Link href="/pricing#plans" className="inline-flex items-center gap-1 font-semibold text-mall-forest underline decoration-mall-gold/60 underline-offset-4 transition hover:decoration-mall-gold">
                    see every plan in detail <ArrowRight size={12} />
                  </Link>
                </p>
                <a
                  href={upgradeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-full bg-mall-forest px-8 text-[11px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black active:scale-95"
                >
                  <CreditCard size={14} /> Upgrade Plan
                </a>
              </div>
            ) : (
              <div className="relative mt-8 flex items-start gap-3 border-t border-white/10 pt-6">
                <Crown size={16} className="mt-0.5 shrink-0 text-mall-gold" fill="currentColor" />
                <p className="text-xs leading-relaxed text-white/70">
                  You hold Sanndikaa’s highest tier — VIP placement, your custom domain, and the broadcast
                  engine are all live on this account. Nothing left to unlock; support is one tap below.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ═══ 3 · CUSTOM DOMAINS HUB ════════════════════════════════════════ */}
        <section aria-labelledby="settings-domain">
          <div className="mb-4 flex items-center gap-2">
            <Globe size={16} className="text-gray-400" />
            <h2 id="settings-domain" className="text-sm font-bold uppercase tracking-widest text-gray-900">Custom Domain</h2>
          </div>

          {canUseCustomDomain(shop?.subscription_tier) ? (
            <DomainManager shopName={shop?.shop_name ?? null} />
          ) : (
            <div className="relative overflow-hidden rounded-[2rem] bg-[#1a1a1a] p-8 text-center text-white shadow-2xl md:p-12">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#f0a500]/10 blur-3xl" />
              <Globe size={30} className="mx-auto text-[#f0a500]" />
              <h3 className="mt-5 font-serif text-2xl font-bold md:text-3xl">Your own .com, .gm, or .sn address.</h3>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/60">
                Point a domain you already own at your Sanndikaa website — automatic setup, automatic SSL,
                no developer needed. Exclusive to the Flagship tier.
                {!canUseStudio(shop?.subscription_tier) && ' A domain needs a website to point at — Flagship includes the AI Website Studio too.'}
              </p>
              <p className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                <Lock size={12} /> Locked on your current plan
              </p>
              {/* Lands on the billing card above, whose Upgrade Plan CTA
                  prefills Flagship (the only tier with domains). */}
              <a
                href="#settings-billing"
                className="mt-7 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-mall-gold px-8 text-[11px] font-black uppercase tracking-widest text-mall-forest transition hover:bg-amber-400 active:scale-95"
              >
                <Crown size={14} /> Upgrade to Flagship
              </a>
            </div>
          )}
        </section>

        {/* ═══ 4 · HELP & SUPPORT ════════════════════════════════════════════ */}
        <section aria-labelledby="settings-support">
          <div className="mb-4 flex items-center gap-2">
            <HelpCircle size={16} className="text-gray-400" />
            <h2 id="settings-support" className="text-sm font-bold uppercase tracking-widest text-gray-900">Help &amp; Support</h2>
          </div>

          <a
            href={supportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#1da851] px-6 text-[11px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-[#178f44] active:scale-[0.99]"
          >
            <MessageCircle size={16} /> Message Sanndikaa Support on WhatsApp
          </a>
          <p className="mt-2 text-center text-[11px] text-gray-400">
            Your shop name and plan are prefilled — just describe what you need.
          </p>

          {/* Truthful FAQ accordion — ≥44px rows */}
          <div className="mt-6 overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
            {FAQ_ITEMS.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q} className={i > 0 ? 'border-t border-gray-50' : ''}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex min-h-[52px] w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-gray-50/60 md:px-7"
                  >
                    <span className="text-sm font-semibold text-gray-900">{item.q}</span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-[13px] leading-relaxed text-gray-500 md:px-7">{item.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
}
