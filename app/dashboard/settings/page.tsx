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
//   2. PLAN & BILLING — lib/tiers TIER_MATRIX as premium cards; current plan
//      highlighted; upgrade CTA = the existing WhatsApp payment flow with the
//      invoice prefilled at the NEW matrix prices. Legacy 'advanced' payers
//      see an honest legacy chip (they keep Studio + domain — lib/tiers).
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
  AlertTriangle, ArrowLeft, BadgeCheck, Banknote, Check, CheckCircle2,
  ChevronDown, CreditCard, Crown, Globe, HelpCircle, Loader2, Lock,
  MessageCircle, Store, WifiOff,
} from 'lucide-react';
import DomainManager from '@/components/domains/DomainManager';
import { resolveDashboardUser } from '@/lib/dashboardAuth';
import {
  SUPPORT_WHATSAPP, TIER_MATRIX, canUseCustomDomain, canUseStudio,
  normalizeTier, type TierCard,
} from '@/lib/tiers';
import { useShopRow } from '@/lib/useShopRow';

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
    a: 'Tap the upgrade button on a plan below — it opens WhatsApp with your prefilled request. Send your payment by the method our team confirms with you, and your dashboard unlocks the new tier in real time once it is activated.',
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

  const handleUpgradeClick = (card: TierCard) => {
    const shopName = shop?.shop_name || 'my boutique';
    const message = `👑 *Sanndikaa Upgrade Request*\n\nHello Admin! I am the owner of *${shopName}*.\n\nI would like to upgrade my store to the *${card.name} Plan* (D${card.monthlyPrice}/month) to unlock its features.\n\nHow can I send the payment to activate this?`;
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`, '_blank');
  };

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

          {isLegacyAdvanced && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <Crown size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-xs leading-relaxed text-amber-900">
                You are on the legacy <strong>Advanced</strong> plan. Everything you pay for stays yours —
                the AI Website Studio and your custom domain keep working exactly as before. Upgrading to
                Flagship adds VIP placement at the very top of the marketplace.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {TIER_MATRIX.map((card) => {
              const isCurrent = tier === card.id;
              const isFlagshipCard = card.id === 'flagship';
              return (
                <div
                  key={card.id}
                  className={`relative flex flex-col rounded-[1.75rem] p-6 transition ${
                    isFlagshipCard
                      ? `bg-[#1a1a1a] text-white shadow-xl ${isCurrent ? 'ring-4 ring-yellow-400/30 border-2 border-yellow-400' : 'border-2 border-[#2a2a2a]'}`
                      : `bg-white shadow-sm ${isCurrent ? 'border-2 border-emerald-600 ring-4 ring-emerald-600/10' : 'border-2 border-gray-100'}`
                  }`}
                >
                  {isCurrent && (
                    <div className={`absolute -top-3 left-0 right-0 mx-auto flex w-fit items-center gap-1 rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-widest shadow-sm ${
                      isFlagshipCard ? 'bg-yellow-500 text-gray-900' : 'bg-emerald-600 text-white'
                    }`}>
                      <CheckCircle2 size={11} /> Current plan
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {isFlagshipCard
                      ? <Crown size={18} className="text-yellow-500" fill="currentColor" />
                      : <BadgeCheck size={18} className={card.id === 'pro' ? 'text-emerald-600' : 'text-gray-400'} />}
                    <h3 className={`text-lg font-black uppercase tracking-widest ${isFlagshipCard ? 'text-white' : 'text-gray-900'}`}>{card.name}</h3>
                  </div>
                  <p className={`mt-1 text-xs font-medium ${isFlagshipCard ? 'text-gray-400' : 'text-gray-500'}`}>{card.tagline}</p>

                  <div className="my-4 flex items-baseline gap-1">
                    <span className={`text-3xl font-black tracking-tight ${isFlagshipCard ? 'text-white' : 'text-gray-900'}`}>D{card.monthlyPrice}</span>
                    <span className={`text-xs font-bold ${isFlagshipCard ? 'text-gray-500' : 'text-gray-400'}`}>/month</span>
                  </div>

                  <ul className={`mb-6 flex-1 space-y-2.5 text-[13px] leading-snug ${isFlagshipCard ? 'text-gray-300' : 'text-gray-600'}`}>
                    {card.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check size={14} className={`mt-0.5 shrink-0 ${isFlagshipCard ? 'text-yellow-500' : 'text-emerald-600'}`} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => handleUpgradeClick(card)}
                    disabled={isCurrent}
                    className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-[11px] font-bold uppercase tracking-widest shadow-md transition active:scale-95 disabled:opacity-50 ${
                      isFlagshipCard
                        ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-400 disabled:hover:bg-yellow-500'
                        : 'bg-[#1a2e1a] text-white hover:bg-black disabled:hover:bg-[#1a2e1a]'
                    }`}
                  >
                    {isCurrent
                      ? 'Your active plan'
                      : <>{isFlagshipCard ? <Crown size={14} /> : <CreditCard size={14} />} Upgrade on WhatsApp</>}
                  </button>
                </div>
              );
            })}
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
              <a
                href="#settings-billing"
                className="mt-7 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#f0a500] px-8 text-[11px] font-black uppercase tracking-widest text-black transition hover:bg-amber-400 active:scale-95"
              >
                <Crown size={14} /> See the Flagship plan
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
