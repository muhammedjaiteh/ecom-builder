'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Online Store → Themes — THE HUB. One hero card carries the seller's live
// site thumbnail (MiniSitePreview of the real config), the publish chip, and
// exactly three primary actions: Generate (the studio flow below, decluttered
// via variant="hub"), Publish toggle, and Customize → the full-screen cockpit
// at ./customize (where the Site Editor now lives — it no longer renders
// here). The classic-boutique appearance settings (colors/layouts/bio/
// branding/fulfillment — they style /shop, not the AI site) are demoted into
// one collapsed section at the bottom, all behavior preserved.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR, { SWRConfig } from 'swr';
import {
  ArrowLeft, Brush, Camera, CheckCircle2, ChevronDown, ExternalLink, Eye, EyeOff,
  Globe, Image as ImageIcon, LayoutTemplate, Loader2, Lock, MapPin, Palette, Save, Store,
  Truck, Wand2, WifiOff, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import SmartImage from '@/components/SmartImage';
import MiniSitePreview from '@/components/website/MiniSitePreview';
import WebsiteGeneratorStudio, { type StudioShop } from '@/components/website/WebsiteGeneratorStudio';
import { CoachDot, CoachLegend, useCoachMarks } from '@/components/website/CoachMarks';
import { SITE_TEMPLATES, WebsiteConfigSchema, type ShopWebsiteRow, type WebsiteConfig } from '@/lib/siteTemplates';
import { slugify } from '@/lib/slugify';
import { fetchJSON, isTransportError } from '@/lib/transport';
import { createPersistedSwrProvider, websiteContentKey } from '@/lib/swrCache';
import { flushWebsiteOutbox } from '@/lib/offlineOutbox';

// Same gate as the studio and every website API route.
const WEBSITE_TIERS = ['advanced', 'flagship'];

// 🚀 Premium Locks for Themes
const THEMES = [
  { id: 'emerald', name: 'Emerald', hex: 'bg-[#1a2e1a]', isPremium: false },
  { id: 'midnight', name: 'Midnight', hex: 'bg-slate-900', isPremium: false },
  { id: 'terracotta', name: 'Terracotta', hex: 'bg-orange-700', isPremium: true },
  { id: 'ocean', name: 'Ocean', hex: 'bg-blue-600', isPremium: true },
  { id: 'rose', name: 'Rose', hex: 'bg-rose-500', isPremium: true },
  { id: 'champagne', name: 'Champagne', hex: 'bg-[#D7C0AE]', isPremium: true },
  { id: 'onyx', name: 'Onyx', hex: 'bg-[#1A1A1A]', isPremium: true },
];

// 🚀 Premium Locks for Layouts
const LAYOUTS = [
  { id: 'bantaba', name: 'The Bantaba', desc: 'Airy, premium floating cards', isPremium: false },
  { id: 'senegambia', name: 'The Senegambia', desc: 'Massive editorial lookbook', isPremium: true },
  { id: 'kairaba', name: 'The Kairaba', desc: 'Horizontal list view', isPremium: true },
  { id: 'jollof', name: 'The Jollof', desc: 'Dynamic sneakerhead hype drops', isPremium: true },
  { id: 'serrekunda', name: 'The Serrekunda', desc: 'Dense, fast catalog grid', isPremium: true },
];

// SWR fetcher for the owner website row — the key carries the user id (cache
// namespacing); the endpoint itself authenticates via cookies. fetchJSON's
// 12s deadline means a dead socket surfaces as a classified 'timeout' the
// retry/backoff machinery handles — never a screen-locking hang.
async function fetchWebsiteRow(): Promise<ShopWebsiteRow | null> {
  const data = await fetchJSON<{ website: ShopWebsiteRow | null }>('/api/websites/content');
  return data.website ?? null;
}

export default function OnlineStoreThemesPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState('starter');
  // Identity snapshot for the AI Website Studio (the flagship section below).
  const [generatorShop, setGeneratorShop] = useState<StudioShop | null>(null);
  // Classic-boutique appearance settings live collapsed at the bottom.
  const [classicOpen, setClassicOpen] = useState(false);

  // The shop_websites row now lives in WebsiteStudioSections below: SWR over
  // the owner content API with a per-user persisted cache (instant paint from
  // the last synced row, background revalidate, deadline-bounded transport) —
  // the bare mount fetch that could hang this page for minutes is gone.

  // States
  const [bio, setBio] = useState('');
  const [themeColor, setThemeColor] = useState('emerald');
  const [storeLayout, setStoreLayout] = useState('bantaba');
  const [offersDelivery, setOffersDelivery] = useState(false);
  const [offersPickup, setOffersPickup] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<'logo' | 'banner' | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadShopData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      if (cancelled) return;
      setUserId(user.id);

      const { data: shop } = await supabase.from('shops').select('*').eq('id', user.id).single();
      if (cancelled) return;
      if (shop) {
        setShopId(shop.id);
        setSubscriptionTier(shop.subscription_tier || 'starter');
        setGeneratorShop({
          id: shop.id,
          shop_name: shop.shop_name ?? null,
          shop_slug: shop.shop_slug ?? null,
          subscription_tier: shop.subscription_tier ?? null,
        });
        setBio(shop.bio || '');
        setThemeColor(shop.theme_color || 'emerald');
        setStoreLayout(shop.store_layout || 'bantaba');
        setOffersDelivery(shop.offers_delivery || false);
        setOffersPickup(shop.offers_pickup || false);
        setLogoUrl(shop.logo_url || null);
        setBannerUrl(shop.banner_url || null);
      }
      if (!cancelled) {
        setLoading(false);
      }
    }
    loadShopData();
    return () => { cancelled = true; };
  }, [router, supabase]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file || !shopId) return;

    setUploadingImage(type);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${shopId}/${type}_${Date.now()}.${fileExt}`;

      // 🚀 FIXED: Pointing exactly to 'brand' (No 's')
      const { error: uploadError } = await supabase.storage.from('brand').upload(filePath, file);

      if (uploadError) {
        console.error("Upload Error Details:", uploadError);
        throw new Error(uploadError.message || "Could not upload image to the server.");
      }

      // 🚀 FIXED: Pointing exactly to 'brand' (No 's')
      const { data: { publicUrl } } = supabase.storage.from('brand').getPublicUrl(filePath);

      if (type === 'logo') setLogoUrl(publicUrl);
      if (type === 'banner') setBannerUrl(publicUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      alert(message || `Failed to upload ${type}. Please try again.`);
    } finally {
      setUploadingImage(null);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);

    try {
      const { error } = await supabase.from('shops').update({
        bio: bio.trim(),
        theme_color: themeColor,
        store_layout: storeLayout,
        offers_delivery: offersDelivery,
        offers_pickup: offersPickup,
        logo_url: logoUrl,
        banner_url: bannerUrl,
      }).eq('id', userId);

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const hasPremiumAccess = subscriptionTier === 'pro' || subscriptionTier === 'advanced' || subscriptionTier === 'flagship';
  const hasWebsiteAccess = WEBSITE_TIERS.includes((subscriptionTier ?? '').toLowerCase().trim());

  const handlePremiumClick = (itemName: string) => {
    alert(`The ${itemName} design is locked. Upgrade to District PRO or ADVANCED to unlock premium branding features!`);
    router.push('/dashboard/settings');
  };

  // dvh (not vh): mobile browsers' collapsing URL bars and the virtual
  // keyboard resize the DYNAMIC viewport — 100vh overshoots it (Step 3,
  // virtual keyboard defense). Identical to 100vh on desktop.
  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-[#F9F8F6]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="min-h-dvh bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white pb-24">

      {/* HEADER — the global Save moved into the collapsed classic-boutique
          section below (it only ever saved those settings). */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-4 md:px-10">
        <div className="max-w-5xl mx-auto flex min-h-[44px] items-center justify-between">
          <Link href="/dashboard" className="flex min-h-[44px] items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900">
            <ArrowLeft size={16} /> Dashboard
          </Link>
        </div>
      </header>

      {/* SUCCESS TOAST */}
      <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${success ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <div className="bg-emerald-600 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
          <CheckCircle2 size={16} /> Boutique Updated
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8 md:px-10 mt-4">
        <div className="mb-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Online Store</p>
          <h1 className="mt-1 text-3xl font-serif font-bold text-gray-900">Themes</h1>
          <p className="mt-2 text-sm text-gray-500">Your storefront&apos;s design home. Generate your AI website, publish it, and customize it in the cockpit.</p>
        </div>

        {/* FLAGSHIP: HERO CARD + AI WEBSITE STUDIO — the website row lives
            in SWR behind a per-user persisted cache. Keyed on the user id so
            an account switch on a shared phone remounts a clean scope.
            The Site Editor moved OUT to the full-screen Customize cockpit. */}
        {generatorShop && userId && (
          <WebsiteStudioSections
            key={userId}
            userId={userId}
            generatorShop={generatorShop}
            hasWebsiteAccess={hasWebsiteAccess}
          />
        )}

        {/* ── CLASSIC BOUTIQUE APPEARANCE — collapsed. These settings style
            the classic /shop boutique, not the AI site, so they sit quietly
            at the bottom with every behavior preserved. */}
        <section className="rounded-[2rem] border border-gray-100 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setClassicOpen((o) => !o)}
            aria-expanded={classicOpen}
            className="flex min-h-[64px] w-full items-center justify-between gap-4 px-6 py-4 text-left md:px-8"
          >
            <span>
              <span className="flex items-center gap-2 text-lg font-serif font-bold text-gray-900">
                <Store size={18} className="text-gray-400" /> Classic boutique appearance
              </span>
              <span className="mt-1 block text-xs text-gray-500">
                Colors, layout, bio, branding, and fulfillment for your classic /shop boutique.
              </span>
            </span>
            <ChevronDown
              size={18}
              className={`shrink-0 text-gray-400 transition-transform duration-300 ${classicOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence initial={false}>
            {classicOpen && (
              <motion.div
                key="classic-appearance"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="border-t border-gray-100 px-6 py-6 md:px-8">
                  <div className="mb-6 flex justify-end">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex min-h-[44px] items-center gap-2 rounded-full bg-[#1a2e1a] px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black disabled:opacity-70"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {saving ? 'Saving...' : 'Save Boutique Changes'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* LEFT COLUMN: VISUALS & BIO */}
          <div className="md:col-span-2 space-y-8">

            {/* 1. IMAGES CARD */}
            <div className="rounded-[2rem] bg-white p-6 md:p-8 shadow-sm border border-gray-100">
              <h2 className="text-lg font-serif font-bold text-gray-900 mb-6 flex items-center gap-2"><ImageIcon size={18} className="text-gray-400" /> Visual Assets</h2>

              {/* Banner Upload */}
              <div className="mb-8">
                <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Store Banner (Landscape)</label>
                <div className="relative h-32 md:h-48 w-full overflow-hidden rounded-[1.5rem] border-2 border-dashed border-gray-200 bg-gray-50 group">
                  {bannerUrl ? (
                    <SmartImage
                      src={bannerUrl}
                      alt="Banner"
                      fill
                      sizes="(min-width: 768px) 640px, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-gray-400">
                      <ImageIcon size={32} className="mb-2 opacity-50" />
                      <span className="text-xs font-medium">Upload Banner Image</span>
                    </div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition cursor-pointer">
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest text-gray-900">
                      {uploadingImage === 'banner' ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                      {uploadingImage === 'banner' ? 'Uploading...' : 'Change Banner'}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'banner')} disabled={uploadingImage !== null} />
                  </label>
                </div>
              </div>

              {/* Logo Upload */}
              <div>
                <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Brand Logo (Square)</label>
                <div className="flex items-center gap-6">
                  <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-dashed border-gray-200 bg-gray-50 group shrink-0">
                    {logoUrl ? (
                      <SmartImage src={logoUrl} alt="Logo" fill sizes="96px" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-400"><Store size={24} className="opacity-50" /></div>
                    )}
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition cursor-pointer rounded-full">
                      {uploadingImage === 'logo' ? <Loader2 size={16} className="text-white animate-spin" /> : <Camera size={16} className="text-white" />}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'logo')} disabled={uploadingImage !== null} />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-sm">
                    Upload a high-resolution version of your logo. This appears on the District homepage and at the top of your boutique.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. BIO & LOGISTICS CARD */}
            <div className="rounded-[2rem] bg-white p-6 md:p-8 shadow-sm border border-gray-100">
              <h2 className="text-lg font-serif font-bold text-gray-900 mb-6 flex items-center gap-2"><Store size={18} className="text-gray-400" /> Store Details</h2>

              <div className="mb-8">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Boutique Biography</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  placeholder="Tell the story of your brand. What makes your products special?"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-base font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900 resize-none"
                />
              </div>

              <div>
                <label className="mb-4 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Fulfillment Options</label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button onClick={() => setOffersDelivery(!offersDelivery)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-4 text-xs font-bold uppercase tracking-widest transition ${offersDelivery ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                    <Truck size={16} /> Delivery {offersDelivery ? 'Enabled' : 'Disabled'}
                  </button>
                  <button onClick={() => setOffersPickup(!offersPickup)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-4 text-xs font-bold uppercase tracking-widest transition ${offersPickup ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                    <MapPin size={16} /> Pickup {offersPickup ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: THEME & LAYOUT */}
          <div className="space-y-8">

            {/* 3. THEME CARD */}
            <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-serif font-bold text-gray-900 mb-6 flex items-center gap-2"><Palette size={18} className="text-gray-400" /> Brand Color</h2>
              <div className="grid grid-cols-4 gap-3">
                {THEMES.map((theme) => {
                  const isLocked = theme.isPremium && !hasPremiumAccess;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => isLocked ? handlePremiumClick(theme.name) : setThemeColor(theme.id)}
                      className={`flex flex-col items-center gap-2 group relative ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {isLocked && <div className="absolute -top-1 -right-1 z-10 bg-gray-900 text-white rounded-full p-0.5"><Lock size={10} /></div>}
                      <div className={`h-10 w-10 rounded-full ${theme.hex} flex items-center justify-center transition-transform ${themeColor === theme.id ? 'ring-2 ring-gray-900 ring-offset-2 scale-110' : 'hover:scale-110 shadow-sm border border-gray-200'}`}>
                        {themeColor === theme.id && <CheckCircle2 size={16} className="text-white opacity-90" />}
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-widest ${themeColor === theme.id ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'}`}>
                        {theme.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. LAYOUT CARD */}
            <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-serif font-bold text-gray-900 mb-6 flex items-center gap-2"><LayoutTemplate size={18} className="text-gray-400" /> Boutique Layout</h2>
              <div className="space-y-3">
                {LAYOUTS.map((layout) => {
                  const isLocked = layout.isPremium && !hasPremiumAccess;
                  return (
                    <button
                      key={layout.id}
                      onClick={() => isLocked ? handlePremiumClick(layout.name) : setStoreLayout(layout.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                        storeLayout === layout.id
                          ? 'border-gray-900 bg-gray-900 text-white shadow-md'
                          : isLocked
                            ? 'border-gray-100 bg-gray-50/50 opacity-60 cursor-not-allowed'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div>
                        <h4 className={`text-sm font-bold flex items-center gap-2 ${storeLayout === layout.id ? 'text-white' : 'text-gray-900'}`}>
                          {layout.name}
                        </h4>
                        <p className={`text-[10px] uppercase tracking-widest mt-1 ${storeLayout === layout.id ? 'text-gray-300' : 'text-gray-500'}`}>{layout.desc}</p>
                      </div>

                      {/* Show Checkmark if active, otherwise show Lock if locked */}
                      {storeLayout === layout.id ? (
                        <CheckCircle2 size={18} className="text-white" />
                      ) : isLocked ? (
                        <Lock size={16} className="text-gray-400" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WebsiteStudioSections — SWR scope for the shop_websites row.
//
// The provider is the per-user persisted cache (lib/swrCache.ts): the last
// synced row paints instantly from localStorage while SWR revalidates in the
// background with retry/backoff and focus/reconnect revalidation. The bare
// mount fetch this replaces could pin `websiteLoading` on a dead socket for
// minutes; now the transport deadline (12s) classifies the failure and the
// studio shell renders regardless.
// ─────────────────────────────────────────────────────────────────────────────

type WebsiteSectionsProps = {
  userId: string;
  generatorShop: StudioShop;
  hasWebsiteAccess: boolean;
};

function WebsiteStudioSections(props: WebsiteSectionsProps) {
  // Stable per user: the provider hands SWR the same persisted cache instance
  // across page mounts, so client-side navigation keeps in-memory freshness.
  const provider = useMemo(() => createPersistedSwrProvider(props.userId), [props.userId]);
  return (
    <SWRConfig value={{ provider }}>
      <WebsiteStudioSectionsInner {...props} />
    </SWRConfig>
  );
}

function WebsiteStudioSectionsInner({ userId, generatorShop, hasWebsiteAccess }: WebsiteSectionsProps) {
  // Locked sellers get the premium pitch — null key, never a wasted 403.
  const { data, error, mutate } = useSWR<ShopWebsiteRow | null>(
    hasWebsiteAccess ? websiteContentKey(userId) : null,
    fetchWebsiteRow,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      errorRetryCount: 6,
      // Connectivity failures retry with SWR's exponential backoff; a server
      // verdict (4xx/5xx) won't change by hammering — focus/reconnect
      // revalidation picks those back up instead.
      shouldRetryOnError: (err) => !(isTransportError(err) && err.kind === 'server'),
    }
  );

  const website = data ?? null;
  // "Loading" now means: no data from EITHER cache or network yet. A seller
  // with a persisted row never sees this state again — stale paints first.
  const websiteLoading = hasWebsiteAccess && data === undefined;

  // Single source of truth: generate/build/publish/save responses all route
  // through SWR's cache, so UI, cache, and localStorage persistence agree.
  const handleWebsiteChange = useCallback(
    (row: ShopWebsiteRow) => {
      void mutate(row, { revalidate: false });
    },
    [mutate]
  );

  // Opportunistic outbox flush — mount + reconnect. The editor (when mounted)
  // shares the same deduped in-flight promise, so this can never double-PUT;
  // reconciling here covers queued saves even when the editor isn't rendered.
  useEffect(() => {
    if (!hasWebsiteAccess) return;
    let cancelled = false;
    const attempt = () => {
      void flushWebsiteOutbox(userId).then((result) => {
        if (!cancelled && result.status === 'flushed') {
          void mutate(result.row, { revalidate: false });
        }
      });
    };
    attempt();
    window.addEventListener('online', attempt);
    return () => {
      cancelled = true;
      window.removeEventListener('online', attempt);
    };
  }, [userId, hasWebsiteAccess, mutate]);

  const transportError = isTransportError(error) ? error : null;
  const connectivityIssue = transportError !== null && (transportError.kind === 'offline' || transportError.kind === 'timeout');
  const serverIssue = transportError !== null && transportError.kind === 'server';

  // Publish toggle — lifted from the studio into the hero card (the studio's
  // own status row is hidden by variant="hub").
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const handlePublishToggle = async () => {
    if (!website) return;
    setPublishError(null);
    setPublishing(true);
    try {
      const action = website.status === 'published' ? 'unpublish' : 'publish';
      const row = await fetchJSON<ShopWebsiteRow>('/api/websites/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      handleWebsiteChange(row);
    } catch (err) {
      if (isTransportError(err) && err.kind === 'offline') {
        // No auto-retry: publish TOGGLES — re-firing minutes later could
        // silently unpublish a site the seller since decided to keep.
        setPublishError('You appear to be offline — the publish change was not applied.');
      } else if (isTransportError(err) && err.kind === 'server') {
        setPublishError(err.message || 'Failed to update publish state.');
      } else {
        setPublishError('Network error updating publish state. Please try again.');
      }
    } finally {
      setPublishing(false);
    }
  };

  // Thumbnail config: any schema-clean stored config renders in the
  // miniature (all three templates), independent of cockpit editability.
  const previewConfig = useMemo<WebsiteConfig | null>(() => {
    if (!website) return null;
    const parsed = WebsiteConfigSchema.safeParse(website.config);
    return parsed.success ? parsed.data : null;
  }, [website]);

  // Law 2 slug safety (same rule as the studio): mint /site links only from
  // an already-canonical slug — the studio's mount-time write-repair fixes
  // legacy rows in the background.
  const siteSlug =
    generatorShop.shop_slug && generatorShop.shop_slug === slugify(generatorShop.shop_slug)
      ? generatorShop.shop_slug
      : null;

  const coach = useCoachMarks('sndk:coach:themes-hub:v1');
  const published = website?.status === 'published';
  const templateMeta = website ? SITE_TEMPLATES[website.template_key] : null;

  const scrollToStudio = () => {
    document.getElementById('website-studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      {/* Quiet connectivity chip — a failed revalidate over cached data never
          locks the studio; it labels the data honestly instead. */}
      {hasWebsiteAccess && connectivityIssue && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-800">
          <WifiOff size={12} />
          {data !== undefined
            ? 'Offline — showing your last synced site. It will refresh automatically.'
            : 'You appear to be offline — reconnecting…'}
        </div>
      )}
      {hasWebsiteAccess && serverIssue && data === undefined && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-red-700">
          <AlertTriangle size={12} />
          {transportError.message}
        </div>
      )}

      {/* ── HERO CARD — the site's home base: live thumbnail, publish chip,
          and exactly three actions (Generate · Publish · Customize). */}
      {hasWebsiteAccess && (
        <section className="mb-8 overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,380px)_1fr]">
            {/* Live miniature of the REAL stored site (theme layer included). */}
            <div className="relative h-56 border-b border-gray-100 bg-gray-50 md:h-auto md:min-h-[300px] md:border-b-0 md:border-r">
              {websiteLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
                </div>
              ) : previewConfig ? (
                <MiniSitePreview config={previewConfig} shopName={generatorShop.shop_name} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <Globe className="h-9 w-9 text-gray-300" />
                  <p className="text-sm font-bold text-gray-900">No website yet.</p>
                  <p className="max-w-[240px] text-xs leading-relaxed text-gray-500">
                    Generate one below — the AI designs it around your inventory in about a minute.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                {website ? (
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
                      published
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${published ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {published ? 'Live' : 'Draft'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Not generated
                  </span>
                )}
                {templateMeta && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white">
                    <Wand2 size={11} className="text-[#f0a500]" /> {templateMeta.name} Layout
                  </span>
                )}
              </div>

              <div>
                <h2 className="font-serif text-2xl font-bold text-gray-900">
                  {generatorShop.shop_name ?? 'Your boutique'}
                </h2>
                {siteSlug && website && (
                  <a
                    href={published ? `/site/${siteSlug}` : `/site/${siteSlug}?preview=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 font-mono text-xs text-gray-500 transition hover:text-gray-900"
                  >
                    /site/{siteSlug} <ExternalLink size={11} />
                  </a>
                )}
              </div>

              {/* THE THREE ACTIONS */}
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                <span className="relative">
                  <CoachDot show={coach.visible} />
                  <button
                    type="button"
                    onClick={scrollToStudio}
                    className="flex min-h-[44px] items-center gap-2 rounded-full bg-gradient-to-r from-[#1a2e1a] to-gray-900 px-6 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:opacity-90 active:scale-95"
                  >
                    <Wand2 size={13} /> {website ? 'Regenerate' : 'Generate'}
                  </button>
                </span>

                <span className="relative">
                  <CoachDot show={coach.visible && !!website} />
                  <button
                    type="button"
                    onClick={() => void handlePublishToggle()}
                    disabled={!website || publishing}
                    className={`flex min-h-[44px] items-center gap-2 rounded-full border px-6 text-[10px] font-bold uppercase tracking-widest shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                      published
                        ? 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {publishing ? (
                      <><Loader2 size={13} className="animate-spin" /> Working…</>
                    ) : published ? (
                      <><EyeOff size={13} /> Unpublish</>
                    ) : (
                      <><Eye size={13} /> Publish Live</>
                    )}
                  </button>
                </span>

                <span className="relative">
                  <CoachDot show={coach.visible && !!website} />
                  {website ? (
                    <Link
                      href="/dashboard/online-store/themes/customize"
                      className="flex min-h-[44px] items-center gap-2 rounded-full bg-[#f0a500] px-6 text-[10px] font-black uppercase tracking-widest text-black shadow-md transition hover:brightness-110 active:scale-95"
                    >
                      <Brush size={13} /> Customize
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="flex min-h-[44px] cursor-not-allowed items-center gap-2 rounded-full bg-gray-100 px-6 text-[10px] font-black uppercase tracking-widest text-gray-400"
                    >
                      <Brush size={13} /> Customize
                    </button>
                  )}
                </span>
              </div>

              {publishError && (
                <p className="text-xs font-medium text-red-700">{publishError}</p>
              )}

              <CoachLegend
                show={coach.visible}
                steps={['Generate your site', 'Customize it', 'Publish it live']}
                onDismiss={coach.dismiss}
              />
            </div>
          </div>
        </section>
      )}

      {/* GENERATE FLOW — the studio, decluttered (hero card owns everything
          else). Its id anchors the hero card's Generate action. */}
      <WebsiteGeneratorStudio
        shop={generatorShop}
        website={website}
        websiteLoading={websiteLoading}
        onWebsiteChange={handleWebsiteChange}
        variant="hub"
      />
    </>
  );
}
