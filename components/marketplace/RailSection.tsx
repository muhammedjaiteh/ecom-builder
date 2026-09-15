import type { ReactNode } from 'react';
import CarouselTrack from '@/components/site-templates/CarouselTrack';

// ─────────────────────────────────────────────────────────────────────────────
// RailSection — one Amazon-style horizontal feed on the mall: a tight header
// (gold kicker · serif title · optional trailing slot) over a scroll-snap
// track. The track is the shared CarouselTrack island (pure CSS scroll-snap,
// native momentum on touch, prev/next paging buttons that appear ONLY when the
// row actually overflows and ONLY from md+ — touch users swipe). Each caller
// supplies its own snap items so the cards stay whatever the feed needs:
// dense product cards, a double-width cinematic feature tile, boutique cards.
//
// The trailing spacer item guarantees the last card clears the viewport edge
// on engines that still ignore end-padding inside a flex scroll container.
// ─────────────────────────────────────────────────────────────────────────────

export type RailItem = { key: string; node: ReactNode };

type RailSectionProps = {
  /** Anchor for the browse chips / footer jumps (scroll-mt via className). */
  id: string;
  title: string;
  /** Whisper line above the title — gold caps. */
  kicker?: string;
  /** One line under the title, md+ only (mobile keeps the header to 2 rows). */
  description?: string;
  /** Right-hand slot in the header row (count, link). */
  trailing?: ReactNode;
  ariaLabel: string;
  items: RailItem[];
  className?: string;
  /** Vertical rhythm override — the default is the mall's standard section. */
  paddingClassName?: string;
};

const RAIL_BUTTON =
  'h-10 w-10 rounded-full bg-mall-ivory text-mall-forest shadow-[0_2px_10px_rgba(27,58,45,0.18)] ring-1 ring-mall-forest/10 hover:bg-white';

export default function RailSection({
  id,
  title,
  kicker,
  description,
  trailing,
  ariaLabel,
  items,
  className = '',
  paddingClassName = 'py-4 md:py-6',
}: RailSectionProps) {
  const trackItems: RailItem[] = [
    ...items,
    { key: '__rail-end', node: <div aria-hidden className="w-1 md:w-4" /> },
  ];

  return (
    <section id={id} className={`${paddingClassName} ${className}`}>
      <div className="mb-2.5 flex items-end justify-between gap-3 px-4 md:mb-3.5 md:px-10">
        <div className="min-w-0">
          {kicker && (
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-mall-gold">{kicker}</p>
          )}
          <h2 className="mt-0.5 truncate font-serif text-[20px] font-semibold leading-tight tracking-tight text-mall-forest md:text-2xl">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 hidden text-[13px] text-mall-forest/60 md:block">{description}</p>
          )}
        </div>
        {trailing && <div className="shrink-0 pb-0.5">{trailing}</div>}
      </div>

      {/* scroll-px MUST mirror px: with snap-mandatory the browser snaps item 0
          to the scroll container's edge and would otherwise swallow the inset,
          pinning the first card flush against the screen edge on load. */}
      <CarouselTrack
        ariaLabel={ariaLabel}
        items={trackItems}
        trackClassName="hide-scrollbar gap-3 px-4 scroll-px-4 pb-1 md:gap-4 md:px-10 md:scroll-px-10"
        buttonClassName={RAIL_BUTTON}
      />
    </section>
  );
}
