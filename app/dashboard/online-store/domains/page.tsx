'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Online Store → Domain — the seller-facing BYOD surface (Step 3 of the
// custom-domain plan). Mobile-first, Gambia Standard:
//
//   · SWR over GET /api/domains via fetchJSON (12s deadline) — 30s polling
//     ONLY while the domain is mid-connection (pending_txt / awaiting_dns),
//     plus focus, visibilitychange→visible (pocket-the-phone), and 'online'
//     revalidation. Cached data always paints under an honest chip; a failed
//     refresh never locks or blanks the screen.
//   · not_connected → 16px connect form (no iOS zoom) with classified error
//     mapping; attached → a visual timeline Not connected → Awaiting DNS →
//     Verifying → Live (SSL secured), DNS record rows with per-row Copy
//     buttons (never select-and-hold), and a WhatsApp escape hatch.
//   · Disconnect confirms via BottomSheet on mobile / centered modal on
//     desktop (the VideoHeroPicker split), DELETE → mutate; failures restore
//     the view with an honest toast — domain ops need a live connection, so
//     there is deliberately NO outbox here.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, ArrowLeft, Check, Copy, Crown, ExternalLink, Globe,
  Loader2, Lock, MessageCircle, RefreshCw, Unlink, WifiOff,
} from 'lucide-react';
import BottomSheet from '@/components/website/BottomSheet';
import { useIsMobileViewport } from '@/lib/useIsMobileViewport';
import { fetchJSON, isTransportError, type TransportError } from '@/lib/transport';

// Same gate as DOMAIN_TIERS in app/api/domains/route.ts — the API is the
// enforcer; this constant only decides which shell (studio lock vs manager)
// renders. If the founder flips the API to flagship-only, flip this too.
const DOMAIN_TIERS = ['advanced', 'flagship'];

// The vault door / dashboard support line (app/dashboard/layout.tsx).
const SUPPORT_WHATSAPP = '447599710468';

type DomainState = 'not_connected' | 'pending_txt' | 'awaiting_dns' | 'active';
type DnsRecord = { type: 'A' | 'CNAME' | 'TXT'; name: string; value: string; reason?: string };
type DomainPayload = { status: DomainState; domain?: string; records?: DnsRecord[] };

const STATUS_LABELS: Record<DomainState, string> = {
  not_connected: 'Not connected',
  awaiting_dns: 'Awaiting DNS',
  pending_txt: 'Verifying ownership',
  active: 'Live',
};

// Poll only while the seller is waiting on DNS/verification — a settled state
// (not_connected or active) costs zero background requests.
const POLLING_STATES = new Set<DomainState>(['pending_txt', 'awaiting_dns']);

const fetchDomainStatus = () => fetchJSON<DomainPayload>('/api/domains');

/** Seller-honest wording for classified API/transport codes; unknown codes
 *  fall through to the API's own `error` string (already seller-safe). */
function mapFailureMessage(code: string, apiMessage: string): string {
  switch (code) {
    case 'domain_taken':
      return 'This domain is already connected to another Sanndikaa shop.';
    case 'no_website':
      return 'You need a live website before a domain can point at it.';
    case 'not_configured':
      return "Domain automation isn't enabled yet — contact support and we'll connect it for you.";
    case 'offline':
      return 'You appear to be offline — check your connection and try again.';
    case 'timeout':
      return 'The request timed out — try again.';
    default:
      return apiMessage;
  }
}

/** Pulls the classified { code, records } out of a kind==='server'
 *  TransportError body (e.g. domain_already_in_use ships TXT proof rows). */
function extractServerDetails(err: TransportError): { code: string; records?: DnsRecord[] } {
  const body = err.body as { code?: unknown; records?: unknown } | null | undefined;
  const code = body && typeof body.code === 'string' ? body.code : 'server';
  const records = body && Array.isArray(body.records) ? (body.records as DnsRecord[]) : undefined;
  return { code, records };
}

function describeFailure(err: unknown): string {
  if (isTransportError(err)) {
    if (err.kind === 'offline' || err.kind === 'timeout') return mapFailureMessage(err.kind, err.message);
    if (err.kind === 'server') return mapFailureMessage(extractServerDetails(err).code, err.message);
    return ''; // abort — silence by contract
  }
  return 'Something went wrong — try again.';
}

/** Middle truncation for long DNS values (TXT verification tokens) — the FULL
 *  value always goes to the clipboard; only the display is shortened. */
function truncateMiddle(value: string, max = 44): string {
  if (value.length <= max) return value;
  const head = Math.ceil((max - 1) * 0.6);
  const tail = max - 1 - head;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

// ─── Page shell — shop load + tier gate (themes-page conventions) ────────────

export default function OnlineStoreDomainsPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState('starter');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      if (cancelled) return;
      const { data: shop } = await supabase
        .from('shops')
        .select('shop_name, subscription_tier')
        .eq('id', user.id)
        .single();
      if (cancelled) return;
      if (shop) {
        setShopName(shop.shop_name ?? null);
        setSubscriptionTier(shop.subscription_tier || 'starter');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router, supabase]);

  const hasAccess = DOMAIN_TIERS.includes((subscriptionTier ?? '').toLowerCase().trim());

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F9F8F6]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#F9F8F6] pb-24 font-sans text-gray-900">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur-md md:px-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900"
          >
            <ArrowLeft size={16} /> Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto mt-4 max-w-3xl px-4 py-8 md:px-10">
        <div className="mb-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Online Store</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-gray-900">Domain</h1>
          <p className="mt-2 text-sm text-gray-500">
            Connect a domain you own — like maimuna-fashion.gm — to your Sanndikaa website. SSL is automatic.
          </p>
        </div>

        {hasAccess ? (
          <DomainManager shopName={shopName} />
        ) : (
          // The studio lock idiom — same dark card, same /pricing upsell.
          <div className="relative overflow-hidden rounded-[2rem] bg-[#1a1a1a] p-10 text-center text-white shadow-2xl md:p-16">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#f0a500]/10 blur-3xl" />
            <Globe size={36} className="mx-auto text-[#f0a500]" />
            <h3 className="mt-6 font-serif text-3xl font-bold md:text-4xl">Your own .com, .gm, or .sn address.</h3>
            <p className="mx-auto mt-4 max-w-lg leading-relaxed text-white/60">
              Point a domain you already own at your Sanndikaa website — automatic setup, automatic SSL,
              no developer needed. Exclusive to the Advanced tier.
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
      </main>
    </div>
  );
}

// ─── DomainManager — SWR state machine + all four states ─────────────────────

function DomainManager({ shopName }: { shopName: string | null }) {
  const isMobile = useIsMobileViewport();

  const { data, error, mutate } = useSWR<DomainPayload>('/api/domains', fetchDomainStatus, {
    // 30s polling ONLY mid-connection — SWR accepts a function of latest data.
    refreshInterval: (latest: DomainPayload | undefined) =>
      latest && POLLING_STATES.has(latest.status) ? 30_000 : 0,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    errorRetryCount: 4,
    // Connectivity failures ride SWR's backoff; a server verdict (4xx/5xx)
    // won't change by hammering — focus/visibility/online pick those back up.
    shouldRetryOnError: (err: unknown) => !(isTransportError(err) && err.kind === 'server'),
  });

  // Pocket-the-phone + radio-back revalidation: focus events don't fire when a
  // phone screen wakes on the same tab, so listen for visibility and 'online'
  // explicitly. SWR dedupes any overlap with revalidateOnFocus/Reconnect.
  useEffect(() => {
    const revalidate = () => { void mutate(); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') revalidate();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', revalidate);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', revalidate);
    };
  }, [mutate]);

  // Connect form
  const [domainInput, setDomainInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<{ code: string; message: string; records?: DnsRecord[] } | null>(null);

  // Disconnect confirm + honest failure toast
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const showToast = (message: string) => {
    if (!message) return;
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  };

  // Desktop modal Escape (the BottomSheet handles its own on mobile).
  useEffect(() => {
    if (!showDisconnect || isMobile) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowDisconnect(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDisconnect, isMobile]);

  const handleConnect = async () => {
    const value = domainInput.trim();
    if (!value || connecting) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const payload = await fetchJSON<DomainPayload>('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: value }),
      });
      setDomainInput('');
      await mutate(payload, { revalidate: false });
    } catch (err) {
      if (isTransportError(err)) {
        if (err.kind === 'abort') return;
        if (err.kind === 'offline' || err.kind === 'timeout') {
          setConnectError({ code: err.kind, message: mapFailureMessage(err.kind, err.message) });
        } else {
          const { code, records } = extractServerDetails(err);
          setConnectError({ code, message: mapFailureMessage(code, err.message), records });
        }
      } else {
        setConnectError({ code: 'internal', message: 'Failed to connect your domain — try again.' });
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (disconnecting) return;
    setDisconnecting(true);
    try {
      const payload = await fetchJSON<DomainPayload>('/api/domains', { method: 'DELETE' });
      setShowDisconnect(false);
      await mutate(payload, { revalidate: false });
    } catch (err) {
      // No optimistic mutate happened, so the cached state IS the restored
      // state — just close the confirm and tell the truth.
      setShowDisconnect(false);
      showToast(describeFailure(err));
    } finally {
      setDisconnecting(false);
    }
  };

  const transportError = isTransportError(error) ? error : null;
  const connectivityIssue = transportError !== null && (transportError.kind === 'offline' || transportError.kind === 'timeout');
  const firstLoad = data === undefined && !error;

  const status: DomainState = data?.status ?? 'not_connected';
  const domain = data?.domain ?? null;
  const records = data?.records ?? [];
  const attached = data !== undefined && status !== 'not_connected' && domain !== null;

  // Escape hatch — prefilled per state; the domain line drops out gracefully
  // when nothing is connected yet.
  const shopLabel = shopName || 'my shop';
  const waText = attached && domain
    ? `Hi, I need help connecting my domain ${domain} for ${shopLabel}. Current status: ${STATUS_LABELS[status]}.`
    : `Hi, I need help connecting a domain for ${shopLabel}. Current status: Not connected.`;
  const waHref = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(waText)}`;

  const disconnectActions = (mobile: boolean) => (
    <div className={mobile ? 'flex gap-2 px-5 pt-3' : 'mt-6 flex gap-2'}>
      <button
        type="button"
        onClick={() => setShowDisconnect(false)}
        disabled={disconnecting}
        className="flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-gray-200 bg-white text-[11px] font-bold uppercase tracking-widest text-gray-700 transition hover:bg-gray-50 active:scale-95 disabled:opacity-50"
      >
        Keep it
      </button>
      <button
        type="button"
        onClick={handleDisconnect}
        disabled={disconnecting}
        className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-red-600 text-[11px] font-bold uppercase tracking-widest text-white transition hover:bg-red-700 active:scale-95 disabled:opacity-60"
      >
        {disconnecting ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
        Disconnect
      </button>
    </div>
  );

  const disconnectBody = (
    <p className="text-sm leading-relaxed text-gray-600">
      Disconnect <span className="break-all font-mono font-semibold text-gray-900">{domain}</span>?
      Your website stays live on its sanndikaa.com address, but this domain stops serving it until
      you reconnect. The DNS records at your registrar will no longer do anything.
    </p>
  );

  return (
    <>
      {/* Honest failure toast (disconnect and refresh failures) */}
      <div
        aria-live="polite"
        className={`fixed left-1/2 top-24 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 transition-all duration-500 ${
          toast ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-4 opacity-0'
        }`}
      >
        <div className="flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-xs font-semibold text-white shadow-xl">
          <AlertTriangle size={14} className="shrink-0" /> {toast}
        </div>
      </div>

      {/* Honest offline / stale chip — cached data stays visible underneath */}
      {transportError && data !== undefined && (
        <div
          className={`mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-widest ${
            connectivityIssue
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {connectivityIssue ? <WifiOff size={12} /> : <AlertTriangle size={12} />}
          {connectivityIssue
            ? 'Offline — showing your last synced status. We keep checking automatically.'
            : 'Could not refresh — showing your last synced status.'}
        </div>
      )}

      {/* First-load skeleton — never a blank, never a lock */}
      {firstLoad && (
        <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-3 w-28 rounded-full bg-gray-100" />
            <div className="h-6 w-56 rounded-full bg-gray-100" />
            <div className="h-12 w-full rounded-2xl bg-gray-100" />
            <div className="h-12 w-full rounded-2xl bg-gray-50" />
          </div>
        </div>
      )}

      {/* First load failed with nothing cached — retry affordance */}
      {error !== undefined && data === undefined && (
        <div className="rounded-[2rem] border border-gray-100 bg-white p-8 text-center shadow-sm">
          {connectivityIssue ? (
            <WifiOff size={24} className="mx-auto text-amber-500" />
          ) : (
            <AlertTriangle size={24} className="mx-auto text-red-400" />
          )}
          <p className="mx-auto mt-3 max-w-sm text-sm font-medium text-gray-700">{describeFailure(error)}</p>
          <button
            type="button"
            onClick={() => void mutate()}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-gray-900 px-6 text-[11px] font-bold uppercase tracking-widest text-white transition hover:bg-black active:scale-95"
          >
            <RefreshCw size={13} /> Try again
          </button>
        </div>
      )}

      {/* ── not_connected — the connect form ─────────────────────────────── */}
      {data !== undefined && !attached && (
        <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
          <h2 className="font-serif text-lg font-bold text-gray-900">Connect your domain</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            Type the domain exactly as you bought it — an apex like{' '}
            <span className="font-mono text-gray-700">maimuna-fashion.gm</span> or a subdomain like{' '}
            <span className="font-mono text-gray-700">shop.maimuna-fashion.gm</span>.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            {/* text-base = 16px — iOS never zooms; url keyboard, no autocap */}
            <input
              type="text"
              value={domainInput}
              onChange={(e) => {
                setDomainInput(e.target.value);
                setConnectError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleConnect();
                }
              }}
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="yourdomain.com"
              aria-label="Your domain"
              className="min-h-[48px] min-w-0 flex-1 rounded-2xl border border-gray-200 bg-gray-50/50 px-5 text-base font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
            />
            <button
              type="button"
              onClick={() => void handleConnect()}
              disabled={connecting || domainInput.trim().length === 0}
              className="flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-full bg-[#1a2e1a] px-8 text-[11px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black active:scale-95 disabled:opacity-50"
            >
              {connecting ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
              {connecting ? 'Connecting…' : 'Connect'}
            </button>
          </div>

          {connectError && (
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4">
              <p className="text-sm font-medium leading-relaxed text-red-700">{connectError.message}</p>
              {connectError.code === 'no_website' && (
                <Link
                  href="/dashboard/online-store/themes"
                  className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-gray-900 px-6 text-[11px] font-bold uppercase tracking-widest text-white transition hover:bg-black active:scale-95"
                >
                  Generate your website first
                </Link>
              )}
              {(connectError.code === 'offline' || connectError.code === 'timeout') && (
                <button
                  type="button"
                  onClick={() => void handleConnect()}
                  disabled={connecting}
                  className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-gray-900 px-6 text-[11px] font-bold uppercase tracking-widest text-white transition hover:bg-black active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw size={13} /> Try again
                </button>
              )}
              {connectError.records && connectError.records.length > 0 && (
                <div className="mt-4 space-y-3">
                  {connectError.records.map((record) => (
                    <DnsRecordRow key={`${record.type}:${record.name}:${record.value}`} record={record} emphasized />
                  ))}
                  <p className="text-xs leading-relaxed text-red-700/80">
                    Add this record at your registrar, then tap Connect again.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── attached — timeline + records / celebration ──────────────────── */}
      {attached && domain && (
        <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Connected domain</p>
              <p className="mt-1 truncate font-mono text-lg font-bold text-gray-900">{domain}</p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ring-1 ${
                status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-amber-50 text-amber-800 ring-amber-200'
              }`}
            >
              {status !== 'active' && <Loader2 size={11} className="animate-spin" />}
              {STATUS_LABELS[status]}
            </span>
          </div>

          <div className="mt-8">
            <StatusTimeline status={status} />
          </div>

          {status === 'active' ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-center"
            >
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md">
                <DrawnCheck size={22} />
              </span>
              <p className="mt-3 font-serif text-lg font-bold text-emerald-900">Live — SSL secured</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-emerald-800/80">
                Your domain now serves your website over https. Share it everywhere.
              </p>
              <a
                href={`https://${domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-emerald-700 px-7 text-[11px] font-bold uppercase tracking-widest text-white transition hover:bg-emerald-800 active:scale-95"
              >
                <ExternalLink size={13} /> Open {domain}
              </a>
            </motion.div>
          ) : (
            <div className="mt-8">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Add these at your registrar
              </h3>
              <div className="mt-3 space-y-3">
                {records.map((record) => (
                  <DnsRecordRow
                    key={`${record.type}:${record.name}:${record.value}`}
                    record={record}
                    emphasized={status === 'pending_txt' && record.type === 'TXT'}
                  />
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-gray-500">
                Note: Local domains like .gm or .sn can take up to 24 hours to connect. We keep
                checking automatically.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowDisconnect(true)}
            className="mt-8 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-red-200 px-5 text-[11px] font-bold uppercase tracking-widest text-red-600 transition hover:bg-red-50 active:scale-95"
          >
            <Unlink size={13} /> Disconnect domain
          </button>
        </div>
      )}

      {/* ── Escape hatch — a human on WhatsApp, prefilled with the state ──── */}
      {data !== undefined && (
        <div className="mt-8">
          <p className="mb-2 text-center text-xs text-gray-500">
            Stuck? Send us a message — we will connect it for you.
          </p>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#1da851] px-6 text-[11px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-[#178f44] active:scale-[0.99]"
          >
            <MessageCircle size={16} /> Get help on WhatsApp
          </a>
        </div>
      )}

      {/* ── Disconnect confirm — sheet on mobile, centered modal on desktop ── */}
      <AnimatePresence>
        {showDisconnect && isMobile && (
          <BottomSheet
            label="Disconnect domain"
            onDismiss={() => setShowDisconnect(false)}
            footer={disconnectActions(true)}
          >
            <div className="px-5 pb-4 pt-2">{disconnectBody}</div>
          </BottomSheet>
        )}
      </AnimatePresence>
      {showDisconnect && !isMobile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setShowDisconnect(false)}
            className="absolute inset-0 cursor-default bg-neutral-950/60 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Disconnect domain"
            className="relative w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-2xl"
          >
            <h3 className="font-serif text-lg font-bold text-gray-900">Disconnect domain</h3>
            <div className="mt-3">{disconnectBody}</div>
            {disconnectActions(false)}
          </div>
        </div>
      )}
    </>
  );
}

// ─── DnsRecordRow — badge, name, monospace value, per-row Copy ───────────────

const RECORD_BADGE: Record<DnsRecord['type'], string> = {
  A: 'bg-blue-50 text-blue-700 ring-blue-200',
  CNAME: 'bg-violet-50 text-violet-700 ring-violet-200',
  TXT: 'bg-amber-50 text-amber-800 ring-amber-200',
};

function DnsRecordRow({ record, emphasized }: { record: DnsRecord; emphasized: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(record.value);
    } catch {
      return; // clipboard denied — the button simply doesn't flip
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 ${
        emphasized ? 'border-amber-200 bg-amber-50/50 ring-2 ring-amber-300' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ring-1 ${RECORD_BADGE[record.type]}`}
          >
            {record.type}
          </span>
          <span className="truncate font-mono text-xs font-semibold text-gray-600">{record.name}</span>
          {emphasized && (
            <span className="inline-flex rounded-full bg-amber-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
              Add this now
            </span>
          )}
        </div>
        <p className="mt-1.5 break-all font-mono text-[13px] font-medium text-gray-900" title={record.value}>
          {truncateMiddle(record.value)}
        </p>
        {record.reason && <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{record.reason}</p>}
      </div>
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label={`Copy ${record.type} record value`}
        className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[10px] font-bold uppercase tracking-widest transition active:scale-95 ${
          copied ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-white hover:bg-black'
        }`}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

// ─── StatusTimeline — Not connected → Awaiting DNS → Verifying → Live ────────

const TIMELINE_STEPS = [
  { label: 'Not connected', hint: 'Your domain is added to Sanndikaa.' },
  { label: 'Awaiting DNS', hint: 'Add the records below at your registrar — we detect them automatically.' },
  { label: 'Verifying ownership', hint: 'We are confirming the TXT record that proves this domain is yours.' },
  { label: 'Live — SSL secured', hint: 'Certificate issued — your domain serves your website.' },
];

function timelineIndex(status: DomainState): number {
  switch (status) {
    case 'active': return 3;
    case 'pending_txt': return 2;
    case 'awaiting_dns': return 1;
    default: return 0;
  }
}

function StatusTimeline({ status }: { status: DomainState }) {
  const activeIndex = timelineIndex(status);
  return (
    <ol aria-label="Domain connection progress">
      {TIMELINE_STEPS.map((step, i) => {
        const done = i < activeIndex;
        const current = i === activeIndex;
        const isLast = i === TIMELINE_STEPS.length - 1;
        const live = isLast && current; // status === 'active'
        return (
          <li key={step.label} className="relative flex gap-4 pb-7 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={`absolute left-[13px] top-8 h-[calc(100%-2rem)] w-0.5 rounded-full ${
                  done ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
              />
            )}
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
              {current && !live && (
                <span aria-hidden className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gray-900 opacity-20" />
              )}
              <span
                className={`relative flex h-7 w-7 items-center justify-center rounded-full ${
                  live
                    ? 'bg-emerald-600 text-white shadow-md'
                    : done
                      ? 'bg-emerald-500 text-white'
                      : current
                        ? 'bg-gray-900 text-white shadow-md'
                        : 'border-2 border-gray-200 bg-white'
                }`}
              >
                {live ? <DrawnCheck size={14} /> : done ? <Check size={13} /> : null}
              </span>
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={`text-sm ${
                  live
                    ? 'font-bold text-emerald-700'
                    : current
                      ? 'font-bold text-gray-900'
                      : done
                        ? 'font-semibold text-gray-700'
                        : 'font-medium text-gray-400'
                }`}
              >
                {step.label}
              </p>
              {current && <p className="mt-1 text-xs leading-relaxed text-gray-500">{step.hint}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── DrawnCheck — the subtle draw-on celebration stroke ──────────────────────

function DrawnCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <motion.path
        d="M4.5 12.5l5 5 10-11"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: 'easeOut', delay: 0.2 }}
      />
    </svg>
  );
}
