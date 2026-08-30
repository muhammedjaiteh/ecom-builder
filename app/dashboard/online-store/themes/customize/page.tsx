'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Online Store → Themes → Customize — THE COCKPIT.
//
// FULL-SCREEN TAKEOVER: the dashboard layout wraps every page in the fixed
// w-60 sidebar + lg:pl-60 content region — an editing cockpit squeezed into
// that column wastes a third of the canvas. Instead of forking the layout,
// this page renders a `fixed inset-0 z-[80]` container: it paints ABOVE the
// sidebar (drawer layers sit at z-[70]/z-[75]) and below the studio's
// overwrite-warning modal (z-[90]), owns its own top bar (Back to Studio ·
// site name · publish chip · save state) and its own scroll region, and
// unmounts cleanly on Back — the layout underneath is never touched.
//
// Inside: the SAME SiteCopyEditor the hub used to embed (split rail + live
// preview), now carrying the theme layer (accent swatches, custom color with
// the WCAG contrast guard, curated font picker). Saves ride the editor's
// existing dirty-bar/outbox flow with theme included.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR, { SWRConfig } from 'swr';
import Link from 'next/link';
import { ArrowLeft, Crown, Globe, Loader2, Lock, Monitor, Redo2, Smartphone, Undo2, WifiOff } from 'lucide-react';
import SiteCopyEditor, {
  EDITABLE_TEMPLATE_COMPONENTS,
  type EditorHistoryHandle,
} from '@/components/website/SiteCopyEditor';
import { useIsMobileViewport } from '@/lib/useIsMobileViewport';
import { CoachLegend, useCoachMarks } from '@/components/website/CoachMarks';
import { WebsiteConfigSchema, type ShopWebsiteRow, type SiteShop } from '@/lib/siteTemplates';
import { resolveDashboardUser } from '@/lib/dashboardAuth';
import { canUseStudio } from '@/lib/tiers';
import { useShopRow } from '@/lib/useShopRow';
import { fetchJSON, isTransportError } from '@/lib/transport';
import { createPersistedSwrProvider, websiteContentKey } from '@/lib/swrCache';

// Tier gate: lib/tiers canUseStudio — Pro+ (legacy 'advanced' kept).
const HUB_PATH = '/dashboard/online-store/themes';

async function fetchWebsiteRow(): Promise<ShopWebsiteRow | null> {
  const data = await fetchJSON<{ website: ShopWebsiteRow | null }>('/api/websites/content');
  return data.website ?? null;
}

export default function CustomizeCockpitPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [userId, setUserId] = useState<string | null>(null);

  // Shops-row seam (lib/useShopRow, A3): the cockpit's shop identity rides
  // the dashboard layout's persisted provider — a brand save on Themes
  // repaints this editor's fulfillment/branding context instantly.
  const { shop: shopRow, verdict: shopVerdict, error: shopError } = useShopRow(userId);

  const hasWebsiteAccess = canUseStudio(shopRow?.subscription_tier);
  const editorShop = useMemo<SiteShop | null>(
    () =>
      shopRow
        ? {
            id: shopRow.id,
            shop_name: shopRow.shop_name ?? null,
            shop_slug: shopRow.shop_slug ?? null,
            logo_url: shopRow.logo_url ?? null,
            banner_url: shopRow.banner_url ?? null,
            bio: shopRow.bio ?? null,
            offers_delivery: shopRow.offers_delivery ?? null,
            offers_pickup: shopRow.offers_pickup ?? null,
            pickup_instructions: shopRow.pickup_instructions ?? null,
            phone: shopRow.phone ?? null,
          }
        : null,
    [shopRow]
  );

  // Loading = auth pending, or no shops-row verdict from cache/network yet.
  const loading = !userId || (shopVerdict === undefined && !shopError);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Non-evicting offline auth (lib/dashboardAuth) — transport failure with
      // a local session never redirects; only a genuine no-session does.
      const auth = await resolveDashboardUser(supabase);
      if (auth.status === 'unauthenticated') {
        router.push('/login');
        return;
      }
      if (cancelled) return;
      setUserId(auth.user.id);
    })();
    return () => { cancelled = true; };
  }, [router, supabase]);

  return (
    // The takeover shell (see header note). Everything inside scrolls in its
    // own region; the dashboard chrome underneath stays untouched.
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#F9F8F6] font-sans text-gray-900">
      {loading || !userId ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <CockpitBody key={userId} userId={userId} editorShop={editorShop} hasWebsiteAccess={hasWebsiteAccess} />
      )}
    </div>
  );
}

// ── SWR scope (same per-user persisted provider the hub uses) ────────────────

type CockpitBodyProps = {
  userId: string;
  editorShop: SiteShop | null;
  hasWebsiteAccess: boolean;
};

function CockpitBody(props: CockpitBodyProps) {
  const provider = useMemo(() => createPersistedSwrProvider(props.userId), [props.userId]);
  return (
    <SWRConfig value={{ provider }}>
      <CockpitBodyInner {...props} />
    </SWRConfig>
  );
}

function CockpitBodyInner({ userId, editorShop, hasWebsiteAccess }: CockpitBodyProps) {
  const { data, error, mutate } = useSWR<ShopWebsiteRow | null>(
    hasWebsiteAccess ? websiteContentKey(userId) : null,
    fetchWebsiteRow,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      errorRetryCount: 6,
      shouldRetryOnError: (err) => !(isTransportError(err) && err.kind === 'server'),
    }
  );

  const website = data ?? null;
  const websiteLoading = hasWebsiteAccess && data === undefined;
  const [dirty, setDirty] = useState(false);
  // Item 3: the editor's undo/redo handle (null while no editor is mounted).
  const [history, setHistory] = useState<EditorHistoryHandle | null>(null);
  // Item 4: preview device width. The toggle hides on actual mobile
  // viewports (<768px) — the seller IS the mobile preview there.
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const isMobileViewport = useIsMobileViewport();
  const coach = useCoachMarks('sndk:coach:cockpit:v1');

  const handleWebsiteChange = useCallback(
    (row: ShopWebsiteRow) => {
      void mutate(row, { revalidate: false });
    },
    [mutate]
  );

  // Mount gates. Hotfix 2: ALL THREE generated bases are cockpit surfaces now
  // (EDITABLE_TEMPLATE_COMPONENTS includes vitality — the high-contrast-street
  // archetype mints it, so a fresh vitality site must never be locked out).
  // The map lookup remains as a stage-gate for any future template key. The
  // load-bearing gate that remains is the SCHEMA parse: resolveBlocks derives
  // an editable block array for every schema-valid config (legacy rows
  // included), so the only rows that land in the "predates the cockpit"
  // notice are configs that fail the CURRENT WebsiteConfigSchema — genuinely
  // pre-schema/hand-damaged rows the editor cannot safely mutate. Regeneration
  // is the honest remedy for those, which is exactly what the notice says.
  const editorWebsite = useMemo<ShopWebsiteRow | null>(() => {
    if (!website || !EDITABLE_TEMPLATE_COMPONENTS[website.template_key]) return null;
    const parsed = WebsiteConfigSchema.safeParse(website.config);
    if (!parsed.success) return null;
    return { ...website, config: parsed.data };
  }, [website]);

  const transportError = isTransportError(error) ? error : null;
  const offline = transportError !== null && (transportError.kind === 'offline' || transportError.kind === 'timeout');
  const published = website?.status === 'published';

  return (
    <>
      {/* ── Cockpit top bar ─────────────────────────────────────────────── */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-gray-200 bg-white/95 px-4 py-2.5 backdrop-blur md:px-8">
        <Link
          href={HUB_PATH}
          className="flex min-h-[44px] items-center gap-2 rounded-full pr-3 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900"
        >
          <ArrowLeft size={16} /> Back to Studio
        </Link>
        <p className="min-w-0 flex-1 truncate font-serif text-lg font-bold text-gray-900">
          {editorShop?.shop_name ?? 'Your site'}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {/* Item 4: Desktop | Mobile preview width (≥44px targets). Hidden
              on actual mobile viewports — the seller IS the mobile preview. */}
          {!isMobileViewport && editorWebsite && (
            <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white p-0.5">
              <button
                type="button"
                aria-label="Desktop preview"
                aria-pressed={previewDevice === 'desktop'}
                title="Desktop preview"
                onClick={() => setPreviewDevice('desktop')}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                  previewDevice === 'desktop'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Monitor size={16} />
              </button>
              <button
                type="button"
                aria-label="Mobile preview"
                aria-pressed={previewDevice === 'mobile'}
                title="Mobile preview"
                onClick={() => setPreviewDevice('mobile')}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                  previewDevice === 'mobile'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Smartphone size={16} />
              </button>
            </div>
          )}
          {/* Item 3: undo/redo — same stack as Ctrl+Z / Ctrl+Shift+Z. */}
          {history && (
            <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white p-0.5">
              <button
                type="button"
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
                disabled={!history.canUndo}
                onClick={history.undo}
                className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Undo2 size={16} />
              </button>
              <button
                type="button"
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
                disabled={!history.canRedo}
                onClick={history.redo}
                className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Redo2 size={16} />
              </button>
            </div>
          )}
          {website && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest ${
                published
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${published ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {published ? 'Live' : 'Draft'}
            </span>
          )}
          <span
            className={`hidden items-center rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest sm:inline-flex ${
              dirty ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-gray-200 bg-gray-50 text-gray-400'
            }`}
          >
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
        </div>
      </header>

      {/* ── Cockpit canvas ──────────────────────────────────────────────── */}
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-8 md:py-6">
        {coach.visible && editorWebsite && (
          <div className="mb-4">
            <CoachLegend
              show
              steps={['Pick your accent & face', 'Click any copy to rewrite it', 'Save to update your site']}
              onDismiss={coach.dismiss}
            />
          </div>
        )}

        {offline && data === undefined && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-800">
            <WifiOff size={12} /> You appear to be offline — reconnecting…
          </div>
        )}

        {!hasWebsiteAccess ? (
          <CockpitNotice
            icon={<Lock size={28} className="text-[#f0a500]" />}
            title="The Customize cockpit is an Advanced feature."
            body="Upgrade to design your AI website's colors, fonts, and copy in a full-screen editor."
            ctaHref="/pricing"
            ctaLabel="See plans"
          />
        ) : websiteLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : !website ? (
          <CockpitNotice
            icon={<Globe size={28} className="text-gray-300" />}
            title="No website to customize yet."
            body="Generate your AI website in the studio first — then come back here to theme and rewrite it."
            ctaHref={HUB_PATH}
            ctaLabel="Open the studio"
          />
        ) : !editorWebsite ? (
          // Reached ONLY by schema-invalid configs (see the gate note above) —
          // every valid config, vitality included, opens the editor.
          <CockpitNotice
            icon={<Crown size={28} className="text-[#f0a500]" />}
            title="This site's layout predates the cockpit."
            body="Regenerate your website in the studio to unlock inline editing, theme colors, and fonts on the current layouts."
            ctaHref={HUB_PATH}
            ctaLabel="Back to the studio"
          />
        ) : editorShop ? (
          <SiteCopyEditor
            key={`${editorWebsite.id}:${editorWebsite.generated_at}`}
            userId={userId}
            website={editorWebsite}
            shop={editorShop}
            onSaved={handleWebsiteChange}
            onDirtyChange={setDirty}
            onHistoryChange={setHistory}
            previewDevice={previewDevice}
          />
        ) : null}
      </main>
    </>
  );
}

function CockpitNotice({
  icon,
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-[2rem] border border-gray-100 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">{icon}</div>
      <p className="mt-5 font-serif text-xl font-bold text-gray-900">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-500">{body}</p>
      <Link
        href={ctaHref}
        className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-gray-900 px-7 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-black active:scale-95"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
