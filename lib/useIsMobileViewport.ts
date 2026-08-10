'use client';

// ─────────────────────────────────────────────────────────────────────────────
// useIsMobileViewport — SSR-safe matchMedia subscription for the editor's
// mobile UX branch (< 768px, mirroring Tailwind's md breakpoint).
//
// Built on useSyncExternalStore so there is NO hydration mismatch by
// construction: the server snapshot is always `false` (desktop markup),
// React re-renders with the real matchMedia value immediately after
// hydration, and breakpoint crossings flip the value live via the media
// query's change event.
// ─────────────────────────────────────────────────────────────────────────────

import { useSyncExternalStore } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

// Older WebKit (< Safari 14) only ships addListener/removeListener on
// MediaQueryList — typed optionally so the fallback needs no `any`.
type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

function subscribe(onStoreChange: () => void): () => void {
  const mql = window.matchMedia(MOBILE_QUERY) as LegacyMediaQueryList;
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onStoreChange);
    return () => mql.removeEventListener('change', onStoreChange);
  }
  mql.addListener?.(onStoreChange);
  return () => mql.removeListener?.(onStoreChange);
}

const getSnapshot = () => window.matchMedia(MOBILE_QUERY).matches;
const getServerSnapshot = () => false;

export function useIsMobileViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
