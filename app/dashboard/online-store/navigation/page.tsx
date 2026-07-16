'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Online Store → Navigation — a read-only visualization of the menus your
// generated site ships with TODAY. Each template's chrome composes its own
// header menu, in-page anchors, real page routes, and footer links; this page
// mirrors that anatomy exactly (source of truth:
// components/site-templates/chrome/*.tsx + the template bodies) and says
// plainly that menu editing arrives in a later phase. No editable fields that
// save nowhere, no invented links.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Compass, Crown, ExternalLink, Globe, ListTree,
  Loader2, Lock, Wand2,
} from 'lucide-react';
import { SITE_TEMPLATES, type ShopWebsiteRow, type TemplateKey } from '@/lib/siteTemplates';
import { useCanonicalShopSlug } from '@/lib/useCanonicalShopSlug';

const WEBSITE_TIERS = ['advanced', 'flagship'];

type WebsiteRow = Pick<ShopWebsiteRow, 'template_key' | 'status'>;

type ShopIdentity = {
  shop_name: string | null;
  shop_slug: string | null;
  subscription_tier: string | null;
};

// kind decides how the link is minted:
//   'anchor'   — home-page section anchor (sub-pages route home first)
//   'page'     — a real route under /site/{slug}
//   'boutique' — the deliberate classic-boutique escape (/shop/{raw slug})
//   'external' — dynamic external target (e.g. WhatsApp), described, not linked
type MenuLink = { label: string; target: string; kind: 'anchor' | 'page' | 'boutique' | 'external'; note: string };

// Mirrors the REAL markup of each template's chrome + body
// (components/site-templates/chrome/*.tsx, components/site-templates/*.tsx).
// Ritual/Editorial share one chrome across home, /collections, and
// /products/[id]. Vitality is split: its legacy home template keeps the old
// nav (anchor + /shop button), while its NEW collection and product pages are
// wrapped by NeutralChrome (Home link + gold Collection button, classic-
// boutique footer escape) — both surfaces are mapped below, with each row's
// note naming where it appears. If a chrome's menu changes, update this map
// in the same commit.
const NAV_ANATOMY: Record<TemplateKey, {
  headerStyle: string;
  menu: MenuLink[];
  footerLinks: MenuLink[];
}> = {
  ritual: {
    headerStyle: 'Sticky top bar with your logo, a three-link menu, and a Shop Now button',
    menu: [
      { label: 'Collection', target: '/collections', kind: 'page', note: 'Opens the full collection page — every product, paginated' },
      { label: 'Story', target: '#story', kind: 'anchor', note: 'Scrolls to your brand story on the home page' },
      { label: 'Contact', target: '#contact', kind: 'anchor', note: 'Scrolls to the footer with delivery, pickup, and contact details' },
      { label: 'Shop Now', target: '/collections', kind: 'page', note: 'Header button — opens the full collection page' },
    ],
    footerLinks: [
      { label: 'The Collection', target: '/collections', kind: 'page', note: 'Footer shortcut to the full collection page' },
      { label: 'Our Story', target: '#story', kind: 'anchor', note: 'Footer shortcut to the brand story' },
      { label: 'View classic boutique', target: '/shop', kind: 'boutique', note: 'Subtle escape to your classic Sanndikaa boutique — the only link that leaves your site' },
      { label: 'Message the boutique on WhatsApp', target: 'wa.me', kind: 'external', note: 'Opens WhatsApp with your business number (shown when a number is saved)' },
    ],
  },
  editorial: {
    headerStyle: 'Serif masthead with a hairline top bar and a centered menu row beneath it',
    menu: [
      { label: 'Shop The Collection', target: '/collections', kind: 'page', note: 'Top bar link — opens the full collection page' },
      { label: 'Features', target: '#features', kind: 'anchor', note: 'Scrolls to the full-width product features on the home page' },
      { label: 'The Collection', target: '/collections', kind: 'page', note: 'Opens the full collection page — every product, paginated' },
      { label: 'Story', target: '#story', kind: 'anchor', note: 'Scrolls to the pull-quote brand story on the home page' },
    ],
    footerLinks: [
      { label: 'Closing banner button', target: '/collections', kind: 'page', note: 'Your AI-written call-to-action label — opens the full collection page' },
      { label: 'View classic boutique', target: '/shop', kind: 'boutique', note: 'Subtle escape to your classic Sanndikaa boutique — the only link that leaves your site' },
    ],
  },
  vitality: {
    headerStyle: 'Home page keeps the legacy sticky dark bar (lineup anchor + gold Shop Direct button); the collection and product pages add a matching dark bar with a Home link and a gold Collection button',
    menu: [
      { label: 'The Lineup', target: '#lineup', kind: 'anchor', note: 'Home-page bar — scrolls to the benefit-led product rows (legacy home layout)' },
      { label: 'Shop Direct', target: '/shop', kind: 'boutique', note: 'Home-page bar button — opens your classic Sanndikaa boutique (legacy home layout)' },
      { label: 'Home', target: '/', kind: 'page', note: 'Collection & product pages — returns to your site home' },
      { label: 'The Collection', target: '/collections', kind: 'page', note: 'Collection & product pages — gold button opening the full collection page' },
    ],
    footerLinks: [
      { label: 'Full Boutique & Checkout', target: '/shop', kind: 'boutique', note: 'Home-page footer — opens your classic Sanndikaa boutique (legacy home layout)' },
      { label: 'View classic boutique', target: '/shop', kind: 'boutique', note: 'Collection & product page footer — the subtle escape to your classic boutique' },
    ],
  },
};

export default function OnlineStoreNavigationPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<ShopIdentity | null>(null);
  const [website, setWebsite] = useState<WebsiteRow | null>(null);

  const tier = (shop?.subscription_tier ?? '').toLowerCase().trim();
  const hasAccess = WEBSITE_TIERS.includes(tier);
  const siteSlug = useCanonicalShopSlug(shop?.shop_slug ?? null, hasAccess);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: shopRow } = await supabase
        .from('shops')
        .select('shop_name, shop_slug, subscription_tier')
        .eq('id', user.id)
        .single();
      if (cancelled) return;
      setShop((shopRow as ShopIdentity | null) ?? null);

      const rowTier = ((shopRow as ShopIdentity | null)?.subscription_tier ?? '').toLowerCase().trim();
      if (WEBSITE_TIERS.includes(rowTier)) {
        // Website row via the owner content API. shop_websites has NO select
        // policies — the browser-client read this page shipped with returned
        // zero rows SILENTLY, so generated sites presented here as
        // "No AI website generated yet". All owner reads go through the
        // service-role-backed GET /api/websites/content.
        try {
          const res = await fetch('/api/websites/content');
          if (res.ok) {
            const data = await res.json();
            if (cancelled) return;
            setWebsite((data.website as WebsiteRow | null) ?? null);
          }
        } catch {
          // Non-fatal: the page renders its empty state.
        }
        if (cancelled) return;
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  const anatomy = website ? NAV_ANATOMY[website.template_key] : null;
  const templateMeta = website ? SITE_TEMPLATES[website.template_key] : null;
  const isPublished = website?.status === 'published';

  const hrefFor = (link: MenuLink): string | null => {
    switch (link.kind) {
      case 'anchor':
        return siteSlug ? `/site/${siteSlug}${isPublished ? '' : '?preview=1'}${link.target}` : null;
      case 'page': {
        if (!siteSlug) return null;
        // '/' is the site home itself — mint the bare base path (a literal
        // trailing slash would bounce through Next's redirect).
        const path = link.target === '/' ? '' : link.target;
        return `/site/${siteSlug}${path}${isPublished ? '' : '?preview=1'}`;
      }
      case 'boutique':
        // /shop matches the RAW stored slug — encode it as-is (Law 2).
        return shop?.shop_slug ? `/shop/${encodeURIComponent(shop.shop_slug)}` : null;
      case 'external':
        // Dynamic target (seller's WhatsApp number) — described, not minted here.
        return null;
    }
  };

  const renderLinkRow = (link: MenuLink) => {
    const href = hrefFor(link);
    return (
      <div key={link.target + link.label} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">{link.label}</p>
          <p className="mt-0.5 text-xs text-gray-500">{link.note}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white px-3 py-1 font-mono text-[10px] font-bold text-gray-500 ring-1 ring-gray-200">{link.target}</span>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 transition hover:text-emerald-900"
            >
              Visit <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white pb-24">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur-md md:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <Link href="/dashboard/online-store/themes" className="flex items-center gap-1.5 rounded-full bg-gray-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:bg-gray-100">
            <Wand2 size={13} /> Open Themes
          </Link>
        </div>
      </header>

      <main className="mx-auto mt-4 max-w-5xl px-4 py-8 md:px-10">
        <div className="mb-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Online Store</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-gray-900">Navigation</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-500">
            The menus your generated website ships with, exactly as customers see them.
          </p>
        </div>

        {!hasAccess && (
          <div className="relative overflow-hidden rounded-[2rem] bg-[#1a1a1a] p-10 text-center text-white shadow-2xl">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#f0a500]/10 blur-3xl" />
            <Crown size={30} className="mx-auto text-[#f0a500]" />
            <h2 className="mt-5 font-serif text-2xl font-bold">Your website&apos;s menus live here.</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/60">
              Generate your AI website and this page maps its header menu, section anchors, and
              footer links. Exclusive to the Advanced tier.
            </p>
            <p className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
              <Lock size={12} /> Locked on your current plan
            </p>
            <Link
              href="/pricing"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#f0a500] px-7 py-3 text-[11px] font-black uppercase tracking-widest text-black transition hover:bg-amber-400 active:scale-95"
            >
              <Crown size={14} /> Upgrade to Advanced
            </Link>
          </div>
        )}

        {hasAccess && !website && (
          <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white p-12 text-center">
            <Globe className="mx-auto mb-4 h-10 w-10 text-gray-300" />
            <p className="text-sm font-bold">No AI website generated yet.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
              Once you build a site in the Website Studio, its header menu, anchors, and footer
              links are mapped here.
            </p>
            <Link
              href="/dashboard/online-store/themes"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#1a2e1a] to-gray-900 px-7 py-3 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:opacity-90 active:scale-95"
            >
              <Compass size={13} /> Open the Website Studio
            </Link>
          </div>
        )}

        {hasAccess && website && anatomy && (
          <div className="space-y-6">
            {/* Managed-by-theme framing */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1a2e1a] text-[#f0a500]">
                  <ListTree size={18} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-base font-bold text-gray-900">Managed by your theme</h2>
                    {templateMeta && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white">
                        <Wand2 size={10} className="text-[#f0a500]" /> {templateMeta.name} theme
                      </span>
                    )}
                  </div>
                  <p className="mt-1 max-w-xl text-sm text-gray-500">
                    The {templateMeta?.name} theme composes these menus automatically around your
                    inventory. Custom menu editing arrives in a later release — switching themes in
                    the studio changes the navigation with it.
                  </p>
                </div>
              </div>
              {!isPublished && (
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Draft — links open your private preview
                </span>
              )}
            </div>

            {/* Header menu */}
            <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Header menu</p>
              <p className="mt-1.5 text-sm text-gray-500">{anatomy.headerStyle}.</p>
              <div className="mt-5 space-y-2.5">{anatomy.menu.map(renderLinkRow)}</div>
            </div>

            {/* Footer links */}
            <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Footer links</p>
              {anatomy.footerLinks.length > 0 ? (
                <div className="mt-5 space-y-2.5">{anatomy.footerLinks.map(renderLinkRow)}</div>
              ) : (
                <p className="mt-1.5 text-sm text-gray-500">
                  The {templateMeta?.name} theme closes with a sign-off footer — your brand mark and
                  copyright line, no navigation links.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
