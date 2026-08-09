// ─────────────────────────────────────────────────────────────────────────────
// localStorage-backed SWR cache provider — instant paint from the last synced
// data, background revalidate over it.
//
// USER-NAMESPACED BY LAW: shared phones are common in our market, so another
// account's cached site must NEVER paint after an account switch. The user id
// is embedded twice — in the localStorage namespace (one bucket per user) AND
// in the SWR keys themselves (websiteContentKey below) — so even a mis-wired
// provider could not cross-pollinate accounts. We deliberately do NOT purge
// other users' buckets on switch: each account keeps its own instant paint.
//
// Semantics:
//   - Map seeded synchronously from localStorage at first use → cached rows
//     render on the first frame, then SWR revalidates in the background.
//   - Write-behind persistence: set/delete schedule a debounced write; a
//     pagehide/hidden-tab flush covers mobile browsers where beforeunload
//     never fires.
//   - Only `data` is persisted (errors/validation flags are transient and
//     must not be resurrected), bounded to the most recent entries.
//   - One cache instance per user per session (module-level registry): the
//     dashboard page can mount/unmount freely without re-parsing storage or
//     stacking window listeners — no leak, and in-memory freshness survives
//     client-side navigation.
// ─────────────────────────────────────────────────────────────────────────────

import type { Cache } from 'swr';

const STORAGE_PREFIX = 'sndk:swr:v1:';
const MAX_PERSISTED_ENTRIES = 24;
const PERSIST_DEBOUNCE_MS = 400;

/** SWR key for the owner website row — the user id is part of the key, so an
 *  account switch can never read another account's cached row even within a
 *  shared cache scope. */
export const websiteContentKey = (userId: string) => `website-content:${userId}`;

type CachedState = { data?: unknown; error?: unknown; isValidating?: boolean; isLoading?: boolean };

function loadSeed(storageKey: string): Array<[string, CachedState]> {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is [string, CachedState] =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === 'string' &&
        typeof entry[1] === 'object' &&
        entry[1] !== null &&
        (entry[1] as CachedState).data !== undefined
    );
  } catch {
    return []; // corrupt storage — cold start, revalidate fills it back in
  }
}

// One live cache per user per session — see header note.
const liveCaches = new Map<string, Cache>();

function buildPersistedCache(storageKey: string): Cache {
  const map = new Map<string, CachedState>(loadSeed(storageKey));

  let timer: number | undefined;

  const persist = () => {
    try {
      const entries = Array.from(map.entries())
        .filter(([, value]) => value && value.data !== undefined)
        .map(([key, value]) => [key, { data: value.data }] as const);
      // Bounded: keep only the most recent entries (set() below refreshes
      // insertion order, so the slice is genuine recency).
      window.localStorage.setItem(storageKey, JSON.stringify(entries.slice(-MAX_PERSISTED_ENTRIES)));
    } catch {
      // Quota or serialization failure — persistence is best-effort; the
      // in-memory cache and network revalidation stay correct.
    }
  };

  const schedule = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = undefined;
      persist();
    }, PERSIST_DEBOUNCE_MS);
  };

  const flush = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
    persist();
  };

  // Attached ONCE per user per session (registry above) — mobile-safe flush.
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  return {
    keys: () => map.keys(),
    get: (key: string) => map.get(key),
    set: (key: string, value: CachedState) => {
      map.delete(key); // refresh insertion order → recency-bounded persistence
      map.set(key, value);
      schedule();
    },
    delete: (key: string) => {
      map.delete(key);
      schedule();
    },
  } as Cache;
}

/** Provider factory for `<SWRConfig value={{ provider }}>`, namespaced to the
 *  signed-in user. Returns the same cache instance for the same user across
 *  page mounts within a session. */
export function createPersistedSwrProvider(userId: string): () => Cache {
  return () => {
    // SSR safety: this page renders a spinner server-side, but guard anyway.
    if (typeof window === 'undefined') return new Map() as unknown as Cache;
    const storageKey = `${STORAGE_PREFIX}${userId}`;
    const existing = liveCaches.get(storageKey);
    if (existing) return existing;
    const cache = buildPersistedCache(storageKey);
    liveCaches.set(storageKey, cache);
    return cache;
  };
}
