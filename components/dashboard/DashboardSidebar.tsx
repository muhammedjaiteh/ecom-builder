'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Persistent dashboard sidebar — mounted once from app/dashboard/layout.tsx so
// EVERY /dashboard/* page carries the same Shopify-standard navigation.
//
// Two link families live here, with different navigation mechanics:
//   1. Route links (Orders, Products, Online Store, …) — ordinary <Link>s.
//   2. Command-center tab links (?tab=customers, ?tab=videos, …) — /dashboard
//      reads ?tab= ONCE on mount (repo idiom: no useSearchParams, tab switches
//      use history.replaceState). So when the seller is ALREADY on /dashboard,
//      a client-side push would silently fail to flip the tab; we force a full
//      navigation instead — the exact contract AdRenderNotifier.openStudio()
//      established for the ?tab=videos deep link.
//
// Active-state for tab links is read from window.location on mount and kept
// fresh with a light watcher while on /dashboard (replaceState fires no event
// we can subscribe to — same trade-off the notifier badge makes).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgePercent, BarChart3, Boxes, FileText, Film, Home, ListTree,
  Megaphone, Menu, Package, Palette, Settings, ShoppingCart, Star,
  Store, Users, X,
} from 'lucide-react';

type IconType = typeof Home;

type NavEntry = {
  label: string;
  href: string;
  icon: IconType;
  /**
   * Set for links whose destination is the command center's internal tab
   * machine (/dashboard?tab=…). Drives both the full-navigation seam and
   * tab-aware active highlighting.
   */
  commandCenterTab?: string;
  /** Route links also claiming a ?tab= alias (e.g. /dashboard?tab=orders). */
  tabAlias?: string;
};

type NavGroup = { title: string | null; entries: NavEntry[] };

// Tabs the command center actually accepts — anything else falls back to
// 'overview' inside app/dashboard/page.tsx, so Home claims those URLs too.
const DASHBOARD_TABS = new Set([
  'overview', 'analytics', 'orders', 'customers', 'discounts',
  'videos', 'reviews', 'inventory', 'broadcast',
]);

// How often the sidebar re-reads ?tab= while the seller sits on /dashboard.
const TAB_WATCH_MS = 1_500;

const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    entries: [
      { label: 'Home', href: '/dashboard', icon: Home, commandCenterTab: 'overview' },
      { label: 'Orders', href: '/dashboard/orders', icon: ShoppingCart, tabAlias: 'orders' },
      { label: 'Products', href: '/dashboard/products', icon: Package },
      { label: 'Customers', href: '/dashboard?tab=customers', icon: Users, commandCenterTab: 'customers' },
      { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, tabAlias: 'analytics' },
    ],
  },
  {
    title: 'Marketing',
    entries: [
      { label: 'Ad Studio', href: '/dashboard?tab=videos', icon: Film, commandCenterTab: 'videos' },
      { label: 'Broadcast', href: '/dashboard?tab=broadcast', icon: Megaphone, commandCenterTab: 'broadcast' },
      { label: 'Discounts', href: '/dashboard?tab=discounts', icon: BadgePercent, commandCenterTab: 'discounts' },
      { label: 'Reviews', href: '/dashboard?tab=reviews', icon: Star, commandCenterTab: 'reviews' },
      { label: 'Inventory', href: '/dashboard?tab=inventory', icon: Boxes, commandCenterTab: 'inventory' },
    ],
  },
  {
    title: 'Online Store',
    entries: [
      { label: 'Themes', href: '/dashboard/online-store/themes', icon: Palette },
      { label: 'Pages', href: '/dashboard/online-store/pages', icon: FileText },
      { label: 'Navigation', href: '/dashboard/online-store/navigation', icon: ListTree },
    ],
  },
];

const SETTINGS_ENTRY: NavEntry = { label: 'Settings', href: '/dashboard/settings', icon: Settings };

/** Normalizes a ?tab= value to what the command center will actually show. */
function effectiveTab(tab: string | null): string {
  return tab && DASHBOARD_TABS.has(tab) ? tab : 'overview';
}

function readTabFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('tab');
}

export default function DashboardSidebar({ shopName }: { shopName?: string | null }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Mount-time read + light watcher while on /dashboard: in-page tab pills
  // flip via history.replaceState, which fires no navigation event.
  useEffect(() => {
    const sync = () => setActiveTab(readTabFromLocation());
    sync();
    if (pathname !== '/dashboard') return;
    const interval = setInterval(sync, TAB_WATCH_MS);
    return () => clearInterval(interval);
  }, [pathname]);

  // Route changes always close the drawer — even navigations this sidebar
  // didn't trigger (e.g. the Ad Studio toast's jump link). Adjust-during-
  // render pattern instead of an effect: no cascading render.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setDrawerOpen(false);
  }

  // Escape + scroll-lock while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  const isEntryActive = useCallback(
    (entry: NavEntry): boolean => {
      if (entry.commandCenterTab) {
        return pathname === '/dashboard' && effectiveTab(activeTab) === entry.commandCenterTab;
      }
      if (pathname === entry.href || pathname.startsWith(`${entry.href}/`)) return true;
      return Boolean(entry.tabAlias) && pathname === '/dashboard' && activeTab === entry.tabAlias;
    },
    [pathname, activeTab]
  );

  // The ?tab= seam: already on /dashboard → full navigation (the page reads
  // ?tab= on mount only); already showing the target tab → do nothing.
  const handleCommandCenterClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, entry: NavEntry) => {
      setDrawerOpen(false);
      // Modified clicks (new tab/window) keep their native behavior.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      if (window.location.pathname !== '/dashboard') return; // <Link> client nav mounts the page fresh
      event.preventDefault();
      const target = new URL(entry.href, window.location.origin);
      if (effectiveTab(target.searchParams.get('tab')) === effectiveTab(readTabFromLocation())) return;
      window.location.assign(entry.href);
    },
    []
  );

  const renderEntry = (entry: NavEntry) => {
    const active = isEntryActive(entry);
    const Icon = entry.icon;
    return (
      <Link
        key={entry.label}
        href={entry.href}
        aria-current={active ? 'page' : undefined}
        onClick={
          entry.commandCenterTab
            ? (event) => handleCommandCenterClick(event, entry)
            : () => setDrawerOpen(false)
        }
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors ${
          active
            ? 'bg-[#1a2e1a] text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
      >
        <Icon size={15} className={active ? 'text-[#f0a500]' : 'text-gray-400'} />
        {entry.label}
      </Link>
    );
  };

  const navBody = (
    <>
      <div className="border-b border-gray-100 px-5 py-5">
        <Link href="/dashboard" onClick={() => setDrawerOpen(false)} className="block">
          <span className="font-serif text-lg font-bold tracking-tight text-gray-900">Sanndikaa</span>
        </Link>
        <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-widest text-gray-400">
          {shopName || 'Seller Command'}
        </p>
      </div>

      <nav aria-label="Dashboard" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title ?? 'core'}>
            {group.title && (
              <p className="mb-1.5 flex items-center gap-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">
                {group.title === 'Online Store' && <Store size={11} />}
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">{group.entries.map(renderEntry)}</div>
          </div>
        ))}
      </nav>

      <div
        className="border-t border-gray-100 px-3 py-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {renderEntry(SETTINGS_ENTRY)}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-gray-100 bg-white lg:flex">
        {navBody}
      </aside>

      {/* Mobile: floating trigger (bottom-left; the Ad Studio notifier owns bottom-right) */}
      <button
        onClick={() => setDrawerOpen(true)}
        aria-label="Open dashboard menu"
        className="fixed left-4 z-50 flex items-center gap-2 rounded-full bg-[#1a2e1a] py-3 pl-4 pr-5 text-[10px] font-bold uppercase tracking-widest text-white shadow-xl ring-1 ring-white/10 transition hover:bg-black active:scale-95 lg:hidden"
        style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <Menu size={15} /> Menu
      </button>

      {/* Mobile: drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="sidebar-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px] lg:hidden"
            />
            <motion.aside
              key="sidebar-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
              role="dialog"
              aria-modal="true"
              aria-label="Dashboard menu"
              className="fixed inset-y-0 left-0 z-[75] flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl lg:hidden"
            >
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close dashboard menu"
                className="absolute right-3 top-4 rounded-full p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-900"
              >
                <X size={16} />
              </button>
              {navBody}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
