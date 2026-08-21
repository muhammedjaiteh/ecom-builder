'use client';

import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/components/CartProvider';
import type { SiteTone } from './chrome';

// ─────────────────────────────────────────────────────────────────────────────
// CartBagButton — the client island that makes the cart REACHABLE from the
// /site chrome. The chromes are server components; this island reads the cart
// context (CartProvider is mounted in app/layout.tsx, so the context reaches
// every /site route — including tenant custom domains, which rewrite into
// /site/[slug] under the same root layout) and opens the existing global
// drawer (components/Cart.tsx).
//
// Count badge: HIDDEN at zero. The chrome is luxury retail, not a dashboard —
// a persistent "0" is dead weight; the bag icon alone is the affordance, and
// the badge appearing IS the feedback that something was added.
//
// Hit target: h-11 w-11 = 44×44px on every tone.
//
// EDITOR SAFETY: data-cart-trigger marks the node. The Site Editor's preview
// click-capture (SiteCopyEditor.handlePreviewClickCapture) only lets
// [role="tab"] and [data-carousel-nav] clicks through — everything else gets
// preventDefault + stopPropagation in the CAPTURE phase, so this button's
// onClick never fires inside the editor preview and can never hijack an
// editing session. No editor change required; the attribute is for telemetry
// and tests.
// ─────────────────────────────────────────────────────────────────────────────

type BagStyles = { button: string; badge: string; strokeWidth: number };

const BAG_STYLES: Record<SiteTone, BagStyles> = {
  // Ritual (Minimal): quiet line icon in a soft round target — the stone nav's
  // understated utility, no chrome until hover.
  ritual: {
    button:
      'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-200/60 hover:text-stone-900 active:scale-95',
    badge:
      'absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-stone-900 px-1 text-[9px] font-bold leading-none text-[#FBFAF7]',
    strokeWidth: 1.5,
  },
  // Editorial: a hairline-ruled square that sits with the masthead's borders —
  // ink-on-paper, inverting on hover like the rest of the print language.
  editorial: {
    button:
      'relative flex h-11 w-11 shrink-0 items-center justify-center border border-neutral-900 bg-[#F7F5F0] text-neutral-900 transition hover:bg-neutral-900 hover:text-[#F7F5F0] active:scale-95',
    badge:
      'absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center bg-neutral-900 px-1 text-[9px] font-bold leading-none text-[#F7F5F0]',
    strokeWidth: 1.5,
  },
  // Neutral (Vitality fallback): simple ghost icon on the dark bar, gold badge
  // matching the accent.
  neutral: {
    button:
      'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white active:scale-95',
    badge:
      'absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f0a500] px-1 text-[9px] font-black leading-none text-black',
    strokeWidth: 2,
  },
};

export default function CartBagButton({ tone }: { tone: SiteTone }) {
  const { cartCount, setIsCartOpen } = useCart();
  const styles = BAG_STYLES[tone];

  return (
    <button
      type="button"
      data-cart-trigger
      onClick={() => setIsCartOpen(true)}
      aria-label={cartCount > 0 ? `Open shopping bag, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Open shopping bag'}
      className={styles.button}
    >
      <ShoppingBag size={19} strokeWidth={styles.strokeWidth} />
      {cartCount > 0 && (
        <span aria-hidden className={styles.badge}>
          {cartCount > 99 ? '99+' : cartCount}
        </span>
      )}
    </button>
  );
}
