'use client';

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// StoryClamp — the brand-story teaser island (Final UX Polish, Fix 1).
// Templates compose it AROUND their story copy node (children-as-props RSC
// pattern, exactly like Reveal): the copy renders clamped to 3 lines under a
// paper-matched fade, and a minimalist ≥44px "Read the full story" affordance
// expands it with a smooth height animation (collapse affordance after).
//
// ANIMATION CHOICE — measured-height FLIP, not grid-template-rows 0fr→1fr and
// not framer height:auto:
//   · the grid trick can only animate 0→auto; a 3-line teaser floor would
//     need a DUPLICATED copy node (one clamped, one collapsible) — a
//     screen-reader double-read and a double target for the Site Editor's
//     click-capture. Disqualified.
//   · framer's height:auto does the same measure-then-tween internally but
//     ships the motion runtime into a copy-critical island. Pure CSS/JS keeps
//     the island dependency-free (reduced-data honesty) with identical
//     zero-jump results: from-height is measured before the state commit,
//     to-height after it, the transition runs px→px, and the inline styles
//     are cleared on settle so the frame returns to natural auto height.
// prefers-reduced-motion toggles instantly (no transition).
//
// TRUNCATION HONESTY: the server renders the clamped state (identical to the
// hydrated initial state — zero CLS); after hydration the island measures the
// clamp box and REMOVES the fade + button when the story already fits in 3
// lines (re-checked on resize via ResizeObserver). The clamp lives on a
// WRAPPER (-webkit-box line clamp cascades over the child block), so the copy
// node's own classes and data attributes are never touched.
//
// EDITOR SAFETY (the Reveal/GatedVideo preview-scope precedent): inside
// <StoryClampPreviewScope> the island renders the BARE children — expanded,
// static, no wrapper geometry, no fade, no button — so the story copy node
// stays fully clickable and measurable for the Site Editor's rect math. The
// reveal button carries NO data-block-id/-field attributes (the CartBagButton
// contract: the editor's capture-phase click blocker swallows it anyway).
//
// ACCENT COHESION (Fix 6): every tone's button label rides
// var(--site-accent, <template default accent>) — the same seam as the
// templates' primary CTAs.
// ─────────────────────────────────────────────────────────────────────────────

const StoryClampPreviewContext = createContext(false);

/** Forces every StoryClamp underneath into the expanded/static state — for
 *  the Site Editor's scaled preview and template miniatures (mirror of
 *  RevealPreviewScope / GatedVideoPreviewScope). */
export function StoryClampPreviewScope({ children }: { children: ReactNode }) {
  return <StoryClampPreviewContext.Provider value={true}>{children}</StoryClampPreviewContext.Provider>;
}

export type StoryClampTone = 'ritual' | 'editorial' | 'vitality';

// Per-template dialect: the fade matches each template's story-section paper
// (Ritual story sits on white, Editorial on the #F7F5F0 sheet, Vitality on
// its #111 panel) and the button speaks the template's type register.
const TONES: Record<StoryClampTone, { fade: string; button: string }> = {
  ritual: {
    fade: 'bg-gradient-to-t from-white to-transparent',
    button:
      'mt-4 inline-flex min-h-11 items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--site-accent,#1c1917)] underline underline-offset-4 transition hover:opacity-70 active:scale-95',
  },
  editorial: {
    fade: 'bg-gradient-to-t from-[#F7F5F0] to-transparent',
    button:
      'mt-4 inline-flex min-h-11 items-center gap-1.5 border-b-2 border-[var(--site-accent,#1a2e1a)] text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-accent,#1a2e1a)] transition hover:opacity-70 active:scale-95',
  },
  vitality: {
    fade: 'bg-gradient-to-t from-[#111] to-transparent',
    button:
      'mt-4 inline-flex min-h-11 items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-[var(--site-accent,#f0a500)] transition hover:brightness-110 active:scale-95',
  },
};

type StoryClampProps = {
  tone: StoryClampTone;
  /** The template's story copy node (EditableText / plain copy) — rendered
   *  untouched, so editor data attributes and type classes survive. */
  children: ReactNode;
};

export default function StoryClamp({ tone, children }: StoryClampProps) {
  const inPreviewScope = useContext(StoryClampPreviewContext);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const clampRef = useRef<HTMLDivElement | null>(null);
  // Height captured synchronously in the toggle click, consumed by the
  // layout effect after the state commit — the FLIP "first" measurement.
  const pendingFrom = useRef<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  // Server assumption: a 600-char story budget almost always exceeds 3 lines.
  // The post-hydration measurement corrects the rare short-story case.
  const [clampable, setClampable] = useState(true);
  const contentId = useId();

  // Truncation measurement — collapsed state only (expanded content never
  // overflows its box, so measuring there would wrongly drop the affordance).
  useEffect(() => {
    if (inPreviewScope || expanded) return;
    const el = clampRef.current;
    if (!el) return;
    const measure = () => setClampable(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [inPreviewScope, expanded]);

  const toggle = () => {
    pendingFrom.current = frameRef.current?.getBoundingClientRect().height ?? null;
    setExpanded((e) => !e);
  };

  // FLIP: animate the frame from the pre-commit height to the new natural
  // height, then clear the inline styles so the frame is auto-height again.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const from = pendingFrom.current;
    pendingFrom.current = null;
    if (!frame || from === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const to = frame.getBoundingClientRect().height;
    if (Math.abs(to - from) < 1) return;
    frame.style.height = `${from}px`;
    frame.style.overflow = 'hidden';
    // Commit the start height before the transition arms (reflow).
    void frame.offsetHeight;
    frame.style.transition = 'height 340ms cubic-bezier(0.33, 1, 0.68, 1)';
    frame.style.height = `${to}px`;
    const settle = () => {
      frame.style.height = '';
      frame.style.transition = '';
      frame.style.overflow = '';
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.target !== frame || e.propertyName !== 'height') return;
      frame.removeEventListener('transitionend', onEnd);
      settle();
    };
    frame.addEventListener('transitionend', onEnd);
    // Cleanup runs pre-paint on the next toggle/unmount: an interrupted
    // animation settles to natural height before the next FLIP re-measures.
    return () => {
      frame.removeEventListener('transitionend', onEnd);
      settle();
    };
  }, [expanded]);

  // Editor preview / miniatures: the bare copy node — expanded, static,
  // fully measurable, nothing extra to click.
  if (inPreviewScope) {
    return <>{children}</>;
  }

  const t = TONES[tone];

  return (
    <div>
      <div ref={frameRef} className="relative">
        <div id={contentId} ref={clampRef} className={expanded ? undefined : 'line-clamp-3'}>
          {children}
        </div>
        {/* Absolutely positioned fade: zero layout footprint (no jump), and it
            simply fades away as the story expands. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-14 transition-opacity duration-300 ${t.fade} ${
            expanded || !clampable ? 'opacity-0' : 'opacity-100'
          }`}
        />
      </div>
      {clampable && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={toggle}
          className={t.button}
        >
          {expanded ? 'Show less' : 'Read the full story'}
          <ChevronDown
            size={14}
            aria-hidden
            className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </div>
  );
}
