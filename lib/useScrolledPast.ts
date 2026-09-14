'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * True once the observed element has scrolled ABOVE the viewport (its bottom
 * edge is past the top). False while it is visible or still below the fold.
 *
 * Drives the PDP sticky buy bars: the bar stays hidden over the gallery on a
 * phone's first screen and only slides in after the buyer has scrolled past
 * the real in-page CTA row. Initial state is always false (SSR-safe).
 */
export function useScrolledPast(ref: RefObject<HTMLElement | null>): boolean {
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const rootTop = entry.rootBounds?.top ?? 0;
        setPassed(!entry.isIntersecting && entry.boundingClientRect.bottom <= rootTop);
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return passed;
}
