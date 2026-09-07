'use client';

import { useState, type ReactNode, type SyntheticEvent } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// ProductCardXfade — the ONLY client boundary the Micro-Homepage cards add.
// Mounted exclusively on cards that own a DISTINCT second photo (see
// secondaryProductImage): single-photo cards render the plain server article
// and ship zero JavaScript.
//
// The island owns the card ROOT (<article class="sndk-xfade" data-xfade>):
// the hover state must live on an ancestor of BOTH image layers, and the
// data-xfade attribute is what globals.css reads to reveal the alt layer on
// touch devices (where :hover is deliberately inert — no sticky hover).
//
// LAYER CONTRACT (every card that mounts this island follows it):
//   primary image  z-auto   — the seller's first photo
//   .sndk-xfade-alt z-[1]   — the second photo, opacity-driven, ABOVE primary
//   badges/chips   z-[2]    — always legible over either photo
//   stretched Link z-10     — the whole card navigates
//   toggle button  z-50     — above the link, so a tap toggles, never navigates
//
// The 44px toggle is a SIBLING of the card's stretched <Link>, never a child
// (a <button> inside an <a> is invalid HTML). TOUCH HARDENING: pointerdown /
// touchstart / mousedown stop propagating (and pointerdown preventDefaults, so
// no focus/selection side effects and no compatibility mouse events reach an
// ancestor); the click itself preventDefaults + stops propagation and flips
// the state. touch-action:manipulation removes the double-tap-zoom delay.
// Inside the Site Editor the canvas capture-phase handler swallows the click
// first, so a canvas tap selects the grid SECTION — the existing behavior
// for every non-copy node.
//
// useState only — no motion runtime (framer stays confined to Reveal.tsx; the
// cross-fade itself is CSS with a reduced-motion block).
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  children: ReactNode;
  /** The card root classes (article) — the island prepends `sndk-xfade`. */
  className?: string;
  /** Toggle BUTTON classes: position + ink color (the 44px hit box). */
  toggleClassName: string;
  /** The visible chip around the two dots — per-dialect chrome. */
  chipClassName: string;
  /** Accessible label for the toggle — e.g. "Show another photo of {name}". */
  toggleLabel: string;
};

/** Keep the tap on the toggle: nothing bubbles to the card, nothing triggers
 *  the sibling link's touch/pointer prefetch or navigation. */
function swallow(e: SyntheticEvent) {
  e.stopPropagation();
}
function swallowAndPrevent(e: SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
}

export default function ProductCardXfade({ children, className, toggleClassName, chipClassName, toggleLabel }: Props) {
  const [alt, setAlt] = useState(false);
  return (
    <article className={`sndk-xfade ${className ?? ''}`} data-xfade={alt ? 'alt' : 'primary'}>
      {children}
      <button
        type="button"
        aria-pressed={alt}
        aria-label={toggleLabel}
        onPointerDown={swallowAndPrevent}
        onMouseDown={swallow}
        onTouchStart={swallow}
        onTouchEnd={swallow}
        onClick={(e) => {
          swallowAndPrevent(e);
          setAlt((v) => !v);
        }}
        className={`absolute z-50 flex h-11 w-11 touch-manipulation select-none items-center justify-center ${toggleClassName}`}
      >
        <span aria-hidden className={`flex items-center gap-1 ${chipClassName}`}>
          <span className={`h-1.5 w-1.5 rounded-full bg-current transition-opacity ${alt ? 'opacity-40' : 'opacity-100'}`} />
          <span className={`h-1.5 w-1.5 rounded-full bg-current transition-opacity ${alt ? 'opacity-100' : 'opacity-40'}`} />
        </span>
      </button>
    </article>
  );
}
