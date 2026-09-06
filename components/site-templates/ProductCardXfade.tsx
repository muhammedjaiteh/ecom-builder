'use client';

import { useState, type ReactNode } from 'react';

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
// The 44px toggle is a SIBLING of the card's stretched <Link>, never a child
// (a <button> inside an <a> is invalid HTML). It sits above the link (z-20 vs
// z-10) so a tap swaps the photo instead of navigating; the card body itself
// still navigates. Inside the Site Editor the canvas capture-phase handler
// swallows the click first, so a canvas tap selects the grid SECTION — the
// existing behavior for every non-copy node.
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

export default function ProductCardXfade({ children, className, toggleClassName, chipClassName, toggleLabel }: Props) {
  const [alt, setAlt] = useState(false);
  return (
    <article className={`sndk-xfade ${className ?? ''}`} data-xfade={alt ? 'alt' : 'primary'}>
      {children}
      <button
        type="button"
        aria-pressed={alt}
        aria-label={toggleLabel}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAlt((v) => !v);
        }}
        className={`absolute z-20 flex h-11 w-11 items-center justify-center ${toggleClassName}`}
      >
        <span aria-hidden className={`flex items-center gap-1 ${chipClassName}`}>
          <span className={`h-1.5 w-1.5 rounded-full bg-current transition-opacity ${alt ? 'opacity-40' : 'opacity-100'}`} />
          <span className={`h-1.5 w-1.5 rounded-full bg-current transition-opacity ${alt ? 'opacity-100' : 'opacity-40'}`} />
        </span>
      </button>
    </article>
  );
}
