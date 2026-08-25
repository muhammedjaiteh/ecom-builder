'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// PlaybackCoordinator — ONE playing video page-wide for the marketplace's
// cinematic tiles. Each tile's IntersectionObserver reports its visibility
// and distance-to-viewport-center here (register on mount via the first
// report, unregister on unmount); the coordinator elects the nearest visible
// tile as `activeId`. Non-active tiles hold their posters — the page never
// becomes a wall of competing autoplay streams (bandwidth discipline is a
// Gambia Standard, not just taste).
//
// report/unregister are referentially stable (safe inside effect deps);
// activeId flows through context so tiles re-render only on elections.
// ─────────────────────────────────────────────────────────────────────────────

type PlaybackChannel = {
  /** Tile visibility/distance report — IO-driven, idempotent. */
  report: (id: string, visible: boolean, distance: number) => void;
  /** Remove a tile from the election on unmount. */
  unregister: (id: string) => void;
  /** The one tile allowed to play right now. */
  activeId: string | null;
};

const PlaybackContext = createContext<PlaybackChannel | null>(null);

export function usePlaybackChannel(): PlaybackChannel | null {
  return useContext(PlaybackContext);
}

export default function PlaybackCoordinator({ children }: { children: ReactNode }) {
  const entries = useRef(new Map<string, { visible: boolean; distance: number }>());
  const [activeId, setActiveId] = useState<string | null>(null);

  const recompute = useCallback(() => {
    let best: string | null = null;
    let bestDistance = Infinity;
    for (const [id, entry] of entries.current) {
      if (entry.visible && entry.distance < bestDistance) {
        best = id;
        bestDistance = entry.distance;
      }
    }
    setActiveId((current) => (current === best ? current : best));
  }, []);

  const report = useCallback(
    (id: string, visible: boolean, distance: number) => {
      entries.current.set(id, { visible, distance });
      recompute();
    },
    [recompute]
  );

  const unregister = useCallback(
    (id: string) => {
      entries.current.delete(id);
      recompute();
    },
    [recompute]
  );

  const value = useMemo(() => ({ report, unregister, activeId }), [report, unregister, activeId]);

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}
