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
import { ArrowLeft, Crown, Globe, Loader2, Lock, WifiOff } from 'lucide-react';
import SiteCopyEditor, { EDITABLE_TEMPLATE_COMPONENTS } from '@/components/website/SiteCopyEditor';
import { CoachLegend, useCoachMarks } from '@/components/website/CoachMarks';
import { WebsiteConfigSchema, type ShopWebsiteRow, type SiteShop } from '@/lib/siteTemplates';
import { fetchJSON, isTransportError } from '@/lib/transport';
import { createPersistedSwrProvider, websiteContentKey } from '@/lib/swrCache';

const WEBSITE_TIERS = ['advanced', 'flagship'];
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
  const [editorShop, setEditorShop] = useState<SiteShop | null>(null);
  const [hasWebsiteAccess, setHasWebsiteAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
        setHasWebsiteAccess(WEBSITE_TIERS.includes((shop.subscription_tier ?? '').toLowerCase().trim()));
        setEditorShop({
          id: shop.id,
          shop_name: shop.shop_name ?? null,
          shop_slug: shop.shop_slug ?? null,
          logo_url: shop.logo_url ?? null,
          banner_url: shop.banner_url ?? null,
          bio: shop.bio ?? null,
          offers_delivery: shop.offers_delivery ?? null,
          offers_pickup: shop.offers_pickup ?? null,
          pickup_instructions: shop.pickup_instructions ?? null,
          phone: shop.phone ?? null,
        });
      }
      if (!cancelled) setLoading(false);
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
  const coach = useCoachMarks('sndk:coach:cockpit:v1');

  const handleWebsiteChange = useCallback(
    (row: ShopWebsiteRow) => {
      void mutate(row, { revalidate: false });
    },
    [mutate]
  );

  // Same mount gates as the hub's historical Site Editor section: an editable
  // (block-driven) template plus a schema-clean config.
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
