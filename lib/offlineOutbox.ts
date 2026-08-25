// ─────────────────────────────────────────────────────────────────────────────
// Offline outbox for website block saves — the truthful "Saved on this phone,
// syncing when back online" path behind SiteCopyEditor.
//
// Rules of the outbox:
//   - USER-NAMESPACED storage key (shared phones): one user's queued edit can
//     never flush under another account's session.
//   - Latest-wins per site: queueing replaces any earlier entry outright, and
//     a successful ONLINE save clears the queue (its payload is superseded).
//   - Only connectivity failures queue ('offline'/'timeout'). Server errors
//     (validation, 409) never queue — a payload the API rejected once will be
//     rejected forever; the editor rolls back and surfaces the error instead.
//   - Stale-race guard on flush: the entry pins the generated_at of the site
//     build it was edited against. Before the PUT we re-read the live row —
//     if the site was rebuilt since (generated_at moved), the queued payload
//     is DROPPED, never applied over the newer build. After the PUT, the
//     entry is only cleared if it wasn't replaced mid-flight (queuedAt
//     compare), so a save queued during a slow flush survives.
//   - Flush is deduped per user: mount + window 'online' + a manual "Sync
//     now" can all fire together and share one in-flight promise — never a
//     double PUT.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import { fetchJSON, isTransportError } from '@/lib/transport';
import {
  SiteAssetsSchema,
  SiteBlockSchema,
  SiteThemeSchema,
  type ShopWebsiteRow,
  type SiteAssets,
  type SiteBlock,
  type SiteTheme,
} from '@/lib/siteTemplates';

const OUTBOX_PREFIX = 'sndk:outbox:website:v1:';

const storageKey = (userId: string) => `${OUTBOX_PREFIX}${userId}`;

// Same shape gate the PUT applies (1–12 blocks) — corrupt or tampered storage
// parses to null and is discarded rather than sent to the API.
const OutboxEntrySchema = z.object({
  blocks: z.array(SiteBlockSchema).min(1).max(12),
  /** Optional asset-slot state — additive: entries queued before the visual
   *  editor (no key) still parse and flush exactly as before. */
  assets: SiteAssetsSchema.optional(),
  /** Optional theme state (Customize cockpit) — additive: pre-theme entries
   *  (no key) still parse and flush exactly as before. */
  theme: SiteThemeSchema.optional(),
  /** generated_at of the site build this edit was made against. */
  baseGeneratedAt: z.string().min(1),
  queuedAt: z.number(),
});

export type WebsiteOutboxEntry = {
  blocks: SiteBlock[];
  assets?: SiteAssets;
  theme?: SiteTheme;
  baseGeneratedAt: string;
  queuedAt: number;
};

export function readWebsiteOutbox(userId: string): WebsiteOutboxEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = OutboxEntrySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      window.localStorage.removeItem(storageKey(userId));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

/** Latest-wins: replaces any existing entry for this user's site. */
export function queueWebsiteSave(
  userId: string,
  entry: { blocks: SiteBlock[]; assets?: SiteAssets; theme?: SiteTheme; baseGeneratedAt: string }
): WebsiteOutboxEntry | null {
  if (typeof window === 'undefined') return null;
  const record: WebsiteOutboxEntry = { ...entry, queuedAt: Date.now() };
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(record));
    return record;
  } catch {
    return null; // quota — caller falls back to a plain retryable error
  }
}

export function clearWebsiteOutbox(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    // best-effort
  }
}

export type FlushResult =
  | { status: 'empty' }
  /** PUT succeeded — `row` is the fresh server row for cache reconciliation. */
  | { status: 'flushed'; row: ShopWebsiteRow }
  /** Still offline / timed out — entry kept for the next flush trigger. */
  | { status: 'kept' }
  /** Entry discarded (site rebuilt since, or the API rejected the payload). */
  | { status: 'dropped'; error: string };

const inFlight = new Map<string, Promise<FlushResult>>();

/** Flush the queued save, deduped per user (see header). Safe to call
 *  opportunistically — resolves { status: 'empty' } when nothing is queued. */
export function flushWebsiteOutbox(userId: string): Promise<FlushResult> {
  const existing = inFlight.get(userId);
  if (existing) return existing;
  const run = doFlush(userId).finally(() => {
    inFlight.delete(userId);
  });
  inFlight.set(userId, run);
  return run;
}

async function doFlush(userId: string): Promise<FlushResult> {
  const entry = readWebsiteOutbox(userId);
  if (!entry) return { status: 'empty' };

  try {
    // Stale-race guard: a queued older payload must not clobber a newer row.
    const { website } = await fetchJSON<{ website: ShopWebsiteRow | null }>('/api/websites/content');
    if (!website || website.generated_at !== entry.baseGeneratedAt) {
      clearWebsiteOutbox(userId);
      return {
        status: 'dropped',
        error:
          'Your site was rebuilt after this edit was saved on this phone, so the older offline change was discarded to protect the newer version.',
      };
    }

    // A newer interactive save may have superseded the entry while the GET
    // ran (the editor clears the outbox before its own PUT) — re-check.
    const current = readWebsiteOutbox(userId);
    if (!current || current.queuedAt !== entry.queuedAt) return { status: 'empty' };

    const row = await fetchJSON<ShopWebsiteRow>('/api/websites/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocks: entry.blocks,
        // Only entries that carried asset/theme state send it — the PUT
        // preserves the stored values when a key is absent (older entries).
        ...(entry.assets !== undefined ? { assets: entry.assets } : {}),
        ...(entry.theme !== undefined ? { theme: entry.theme } : {}),
      }),
    });

    // Only clear if the entry wasn't replaced mid-flight by a newer queue.
    const after = readWebsiteOutbox(userId);
    if (after && after.queuedAt === entry.queuedAt) clearWebsiteOutbox(userId);
    return { status: 'flushed', row };
  } catch (err) {
    if (isTransportError(err) && (err.kind === 'offline' || err.kind === 'timeout')) {
      return { status: 'kept' };
    }
    if (isTransportError(err) && err.kind === 'server') {
      // The API said no — retrying the identical payload can never succeed.
      clearWebsiteOutbox(userId);
      return { status: 'dropped', error: err.message };
    }
    return { status: 'kept' };
  }
}
