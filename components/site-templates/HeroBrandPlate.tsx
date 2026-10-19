// ─────────────────────────────────────────────────────────────────────────────
// HeroBrandPlate — the designed null-tier hero (Pillar 4b). SERVER component,
// zero client JS: when a site has no saved hero and no banner, the masthead
// renders this animated brand plate instead of a static gradient (and instead
// of the retired raw-product auto-fill).
//
// Three layers, per template dialect:
//   1. The dialect's EXACT historical fallback gradient stops, panned by the
//      pure-CSS .sndk-hero-plate loop (globals.css: sndk-hero-plate-pan, 18s
//      ease-in-out alternate; prefers-reduced-motion freezes it).
//   2. A soft radial glow riding var(--site-accent, <dialect literal>) — a
//      themed site glows on-brand, a theme-less site keeps its dialect tone.
//   3. (Pass 3) The oversized serif monogram layer was retired — the hero copy
//      and masthead already carry the merchant's name, and a 14rem initial
//      read as decorative filler rather than identity. The plate is now the
//      panned gradient + accent glow only.
//
// aria-hidden throughout: the plate is pure decoration behind the hero copy;
// each template's existing scrim guarantees text contrast on top of it.
// ─────────────────────────────────────────────────────────────────────────────

export type HeroPlateTone = 'ritual' | 'editorial' | 'vitality';

const TONES: Record<HeroPlateTone, { gradient: string; accent: string }> = {
  ritual: {
    // EXACT historical stops (RitualTemplate null branch).
    gradient:
      'bg-[radial-gradient(ellipse_at_top_right,rgba(214,203,186,0.35),transparent_55%),linear-gradient(to_bottom_right,#292524,#1c1917,#3a352e)]',
    accent: '#d6cbba',
  },
  editorial: {
    // EXACT historical stops (EditorialTemplate null branch:
    // from-neutral-200 via-[#EDEAE2] to-neutral-300).
    gradient: 'bg-gradient-to-br from-neutral-200 via-[#EDEAE2] to-neutral-300',
    accent: '#1a2e1a',
  },
  vitality: {
    // EXACT historical stops (VitalityTemplate null branch).
    gradient: 'bg-gradient-to-br from-[#141414] via-[#0C0C0C] to-amber-950/40',
    accent: '#f0a500',
  },
};

type HeroBrandPlateProps = {
  tone: HeroPlateTone;
  shopName: string | null;
};

export default function HeroBrandPlate({ tone }: HeroBrandPlateProps) {
  const t = TONES[tone];

  return (
    // Static clipping wrapper. The .sndk-parallax drift (archetype pass:
    // pure-CSS scroll depth, @supports-gated, reduced-motion-honoring, zero
    // JS — globals.css) lives on the INNER layer: its scale(1.08) must be
    // clipped by this box, never applied to it, or the plate grows past the
    // hero pane and the whole page gains a horizontal scroll on phones.
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="sndk-parallax absolute inset-0">
        <div className={`sndk-hero-plate absolute inset-0 ${t.gradient}`} />
        <div
          className="absolute inset-0 opacity-25 blur-3xl"
          style={{
            background: `radial-gradient(ellipse at 28% 72%, var(--site-accent, ${t.accent}), transparent 62%)`,
          }}
        />
      </div>
    </div>
  );
}
