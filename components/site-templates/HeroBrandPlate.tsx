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
//   3. An oversized low-opacity serif monogram of the boutique initial.
//
// aria-hidden throughout: the plate is pure decoration behind the hero copy;
// each template's existing scrim guarantees text contrast on top of it.
// ─────────────────────────────────────────────────────────────────────────────

export type HeroPlateTone = 'ritual' | 'editorial' | 'vitality';

const TONES: Record<HeroPlateTone, { gradient: string; accent: string; monogram: string }> = {
  ritual: {
    // EXACT historical stops (RitualTemplate null branch).
    gradient:
      'bg-[radial-gradient(ellipse_at_top_right,rgba(214,203,186,0.35),transparent_55%),linear-gradient(to_bottom_right,#292524,#1c1917,#3a352e)]',
    accent: '#d6cbba',
    monogram: 'font-serif text-[9rem] italic leading-none text-white/[0.08] md:text-[14rem]',
  },
  editorial: {
    // EXACT historical stops (EditorialTemplate null branch:
    // from-neutral-200 via-[#EDEAE2] to-neutral-300).
    gradient: 'bg-gradient-to-br from-neutral-200 via-[#EDEAE2] to-neutral-300',
    accent: '#1a2e1a',
    monogram: 'font-serif text-[10rem] italic leading-none text-neutral-400/40 md:text-[16rem]',
  },
  vitality: {
    // EXACT historical stops (VitalityTemplate null branch).
    gradient: 'bg-gradient-to-br from-[#141414] via-[#0C0C0C] to-amber-950/40',
    accent: '#f0a500',
    monogram: 'font-serif text-[9rem] italic leading-none text-white/[0.07] md:text-[14rem]',
  },
};

type HeroBrandPlateProps = {
  tone: HeroPlateTone;
  shopName: string | null;
};

export default function HeroBrandPlate({ tone, shopName }: HeroBrandPlateProps) {
  const t = TONES[tone];
  const initial = (shopName ?? 'S').trim().charAt(0).toUpperCase() || 'S';

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className={`sndk-hero-plate absolute inset-0 ${t.gradient}`} />
      <div
        className="absolute inset-0 opacity-25 blur-3xl"
        style={{
          background: `radial-gradient(ellipse at 28% 72%, var(--site-accent, ${t.accent}), transparent 62%)`,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={t.monogram}>{initial}</span>
      </div>
    </div>
  );
}
