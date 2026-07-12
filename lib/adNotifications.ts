// AD STUDIO notification helpers — shared by the dashboard-wide render
// notifier (components/adstudio/AdRenderNotifier.tsx) and the Ad Studio
// client (components/VideoManager.tsx).
//
// Completion tracking works WITHOUT any DB schema changes: a bounded
// per-user localStorage map is the only persistence. Three completion
// writers can race (Creatomate webhook, VideoManager's 5s poll, the
// notifier's 15s sweep) — every announcement dedupes through this map so the
// seller hears about each render exactly once no matter which writer wins.
// This file is client-safe — no server-only imports.

/**
 * Ad Studio deep link. VideoManager mounts on /dashboard behind the
 * URL-synced `?tab=videos` tab (see app/dashboard/page.tsx).
 */
export const AD_STUDIO_PATH = '/dashboard?tab=videos';

// Fallback polling — drives completion in environments the Creatomate
// webhook can't reach (local dev, tunneled previews): one sweep every ~15s
// while renders are pending, with the per-row render-status calls staggered
// inside each sweep so they never burst.
export const NOTIFIER_POLL_INTERVAL_MS = 15_000;
export const NOTIFIER_POLL_STAGGER_MS = 1_200;
export const NOTIFIER_FIRST_POLL_DELAY_MS = 4_000;

export const SUCCESS_TOAST_TTL_MS = 8_000;
export const FAILURE_TOAST_TTL_MS = 12_000;

// How often the notifier re-checks whether the seller has landed on the Ad
// Studio tab while a badge is showing. Tab switches on /dashboard use
// history.replaceState, which fires no navigation event we can subscribe to
// without useSearchParams (deliberately avoided repo-wide — it forces a
// Suspense boundary on client pages).
export const STUDIO_VISIT_CHECK_MS = 2_500;

const STORAGE_PREFIX = 'sanndikaa_ad_notify_v1:';
const MAX_TRACKED_IDS = 200;

export type AdNotifyState = {
  /**
   * `${videoId}:${status}` → epoch ms. Announcement dedupe across realtime,
   * polling, and page reloads. Keyed by status so a failed row that the
   * seller retries can still announce its eventual completion.
   */
  notified: Record<string, number>;
  /** videoId → epoch ms. Rows acknowledged by visiting the Ad Studio or clicking through. */
  seen: Record<string, number>;
};

export type AdToastKind = 'success' | 'failure' | 'summary';

export type AdToast = {
  id: string;
  kind: AdToastKind;
  title: string;
  message: string;
};

export function emptyAdNotifyState(): AdNotifyState {
  return { notified: {}, seen: {} };
}

export function notifiedKey(videoId: string, status: 'completed' | 'failed'): string {
  return `${videoId}:${status}`;
}

function sanitizeIdMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, ts] of Object.entries(value as Record<string, unknown>)) {
    if (typeof ts === 'number' && Number.isFinite(ts)) out[key] = ts;
  }
  return out;
}

// Keeps only the newest `max` entries so the map can never grow unbounded.
function pruneIdMap(map: Record<string, number>, max = MAX_TRACKED_IDS): Record<string, number> {
  const entries = Object.entries(map);
  if (entries.length <= max) return map;
  entries.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(entries.slice(0, max));
}

/**
 * Returns null on first run (nothing stored) so the caller can seed the
 * baseline silently — pre-existing completed rows must never toast-storm the
 * first session after this feature ships.
 */
export function loadAdNotifyState(userId: string): AdNotifyState | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdNotifyState> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    return { notified: sanitizeIdMap(parsed.notified), seen: sanitizeIdMap(parsed.seen) };
  } catch {
    // Storage unavailable (private mode, disabled, corrupt JSON) — behave
    // like a first run; worst case is a suppressed toast, never a crash.
    return null;
  }
}

export function saveAdNotifyState(userId: string, state: AdNotifyState): void {
  try {
    const bounded: AdNotifyState = {
      notified: pruneIdMap(state.notified),
      seen: pruneIdMap(state.seen),
    };
    window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(bounded));
  } catch {
    // Best-effort persistence — a failed write only risks a duplicate toast later.
  }
}

// ── Row predicates (shared vocabulary with VideoManager) ───────────────────

export type AdRenderRowLike = {
  status: string | null;
  pipeline_stage: string | null;
  hero_image_url?: string | null;
};

/** A VIDEO render is running server-side (Kling await or Creatomate finalize). */
export function isAnimateInFlight(row: AdRenderRowLike): boolean {
  return (
    row.status === 'pending' &&
    (row.pipeline_stage === 'animating' || row.pipeline_stage === 'finalizing')
  );
}

/**
 * Distinguishes VIDEO render failures from still-pipeline failures: animate
 * failures always carry a hero image (the approved preview); still failures
 * never do. Only the former deserve a dashboard-wide notification — the
 * still pipeline is SSE-attended inside the Ad Studio itself.
 */
export function isVideoRenderFailure(row: AdRenderRowLike): boolean {
  return row.status === 'failed' && !!row.hero_image_url;
}

let toastSeq = 0;
export function nextToastId(): string {
  toastSeq += 1;
  return `ad-toast-${Date.now()}-${toastSeq}`;
}
