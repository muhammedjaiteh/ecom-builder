'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// CarouselTrack — the shared horizontal product carousel island (Phase 4,
// product_grid displayMode 'carousel'). Pure CSS scroll-snap: native momentum
// scrolling on touch, no wheel hijacking, no dependencies. Desktop gains
// prev/next paging buttons (scrollBy one viewport-page) that render ONLY when
// the track actually overflows — with 1-2 products the section degrades to a
// static row, buttons absent. Each template supplies its own card nodes and
// styling dialect via className props, so the cards themselves stay
// server-rendered and byte-identical to their grid counterparts.
//
// data-carousel-nav marks the paging buttons for the dashboard Site Editor's
// click-capture, which routes these clicks to the buttons instead of the copy
// editor (inert on the public site).
// ─────────────────────────────────────────────────────────────────────────────

type CarouselItem = { key: string; node: ReactNode };

type CarouselTrackProps = {
  ariaLabel: string;
  items: CarouselItem[];
  /** Track layout (gaps, padding, hairlines) — template dialect. */
  trackClassName?: string;
  /** Snap-item sizing — template dialect. */
  itemClassName?: string;
  /** Paging-button chrome — template dialect. */
  buttonClassName?: string;
};

export default function CarouselTrack({
  ariaLabel,
  items,
  trackClassName = '',
  itemClassName = '',
  buttonClassName = '',
}: CarouselTrackProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [scrollable, setScrollable] = useState(false);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 1;
    setScrollable(overflow);
    setCanPrev(el.scrollLeft > 1);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  // Item widths are fixed by class, so scrollWidth is settled at layout time:
  // a container ResizeObserver + the passive scroll listener cover every
  // state change (viewport resize, editor rescale, item count changes).
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    el.addEventListener('scroll', updateScrollState, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', updateScrollState);
    };
  }, [updateScrollState, items.length]);

  const page = (direction: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.9, 200), behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        role="region"
        aria-label={ariaLabel}
        className={`flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${trackClassName}`}
      >
        {items.map((item) => (
          <div key={item.key} className={`shrink-0 snap-start ${itemClassName}`}>
            {item.node}
          </div>
        ))}
      </div>

      {scrollable && (
        <>
          <button
            type="button"
            data-carousel-nav
            aria-label="Previous products"
            onClick={() => page(-1)}
            className={`absolute left-2 top-1/2 hidden -translate-y-1/2 items-center justify-center transition md:flex ${buttonClassName} ${
              canPrev ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            data-carousel-nav
            aria-label="Next products"
            onClick={() => page(1)}
            className={`absolute right-2 top-1/2 hidden -translate-y-1/2 items-center justify-center transition md:flex ${buttonClassName} ${
              canNext ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}
    </div>
  );
}
