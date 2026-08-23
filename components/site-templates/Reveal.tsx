'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// Reveal — the entrance-animation island for /site sections (Beta QA UX pass).
// Server templates compose it around sections (children-as-props RSC pattern):
// a subtle whileInView fade-in-up (y 20px, 0.6s easeOut, once), with an
// optional small `delay` for sibling stagger.
//
// THREE SAFETY RAILS, in priority order:
//
//   1. PREVIEW SCOPE (the GatedVideoPreviewScope pattern): the dashboard Site
//      Editor measures post-transform DOM rects for its click-overlay and
//      scroll targeting — a mid-animation translateY would corrupt every
//      measurement. Wrapping a preview tree in <RevealPreviewScope> forces
//      every Reveal underneath to render a STATIC element: no motion node, no
//      transform, no opacity — byte-stable geometry.
//
//   2. REDUCED MOTION: prefers-reduced-motion renders static.
//
//   3. 2G HYDRATION SAFETY (Gambia Standard): the server HTML must never ship
//      opacity-0 sections that stay invisible until a slow connection finishes
//      hydrating. Server render is fully visible; after hydration, ONLY
//      sections still below the fold arm the animation — content the visitor
//      is already reading never flashes hidden. (This also keeps hero/LCP
//      pixels untouched.)
// ─────────────────────────────────────────────────────────────────────────────

const RevealPreviewContext = createContext(false);

/** Forces every Reveal underneath into the static state — for the Site
 *  Editor's scaled preview and template miniatures (mirror of
 *  GatedVideoPreviewScope). */
export function RevealPreviewScope({ children }: { children: ReactNode }) {
  return <RevealPreviewContext.Provider value={true}>{children}</RevealPreviewContext.Provider>;
}

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Small sibling stagger in seconds (keep ≤ ~0.2s). */
  delay?: number;
};

export default function Reveal({ children, className, delay = 0 }: RevealProps) {
  const inPreviewScope = useContext(RevealPreviewContext);
  const reducedMotion = useReducedMotion();
  const probeRef = useRef<HTMLDivElement | null>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (inPreviewScope || reducedMotion) return;
    const el = probeRef.current;
    if (!el) return;
    // Arm only when the section is still comfortably below the viewport at
    // hydration time — in-view content stays static (no flash, no LCP shift).
    // rAF: measure after layout settles, and keep setState out of the effect
    // body (no cascading render).
    const frame = requestAnimationFrame(() => {
      if (el.getBoundingClientRect().top > window.innerHeight * 0.9) {
        setArmed(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [inPreviewScope, reducedMotion]);

  if (!armed) {
    return (
      <div ref={probeRef} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      // 'some' amount + a -12% bottom margin: tall sections (product grids)
      // reveal as their first pixels approach, never after a long blank scroll.
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.6, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  );
}
