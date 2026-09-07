'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import SmartImage from '@/components/SmartImage';
import GatedVideo from '@/components/site-templates/GatedVideo';
import type { SiteTone } from '@/components/site-templates/chrome';

// Product media gallery for the on-site PDP. Server builds the ordered media
// list (Ad Studio video → AI hero still → seller originals — always the
// seller's real pixels, Law 4; the gallery never crops, filters or recolors
// them — object-cover framing only).
//
// LUXURY GALLERY LAYOUT (PDP overhaul, Phase 2):
//   • Desktop: a vertical thumbnail rail on the LEFT of a tall 4:5 frame —
//     the fashion-house PDP idiom — inside the page's 7-column gallery slot.
//   • Mobile: the frame runs full-bleed (edge to edge) with a live
//     "01 / 04" counter; the horizontal thumb row sits beneath it.
//   • The active thumb is ringed in --site-accent so the gallery wears the
//     boutique theme like every other accent spot.
//
// SINGLE MEDIA: one static frame, no rail, no counter, no island state used.
//
// MULTI MEDIA: the frame is a native scroll-snap swipe track (the
// CarouselTrack idiom — snap-mandatory, momentum touch scrolling, no wheel
// hijack, hidden scrollbar) with dot indicators, synced thumbnails (tap thumb
// → smooth-scroll to slide; swipe → active thumb follows via a passive scroll
// listener), ≥44px desktop paging arrows, and ←/→ keyboard paging on the
// focused frame.
//
// The video slide keeps the shared 2G gate (GatedVideo): constrained networks
// get the poster + a ≥44px tap-to-play instead of autoplay, native controls
// once playing. Battery/bandwidth honesty: the <video> element is mounted
// ONLY while its slide is active — swiping away swaps it for its own poster
// (the identical pixels), so an off-screen slide never keeps a stream alive.

export type GalleryMedia =
  | { type: 'video'; url: string; poster: string | null }
  | { type: 'image'; url: string };

const FRAME_STYLES: Record<SiteTone, {
  /** Two-column desktop grid (rail | frame) when multi-media. */
  rootMulti: string;
  /** Mobile full-bleed wrapper (the page section pads px-5). */
  frameWrap: string;
  main: string;
  rail: string;
  mobileThumbs: string;
  thumb: string;
  thumbActive: string;
  fallback: string;
  fallbackInitial: string;
  arrow: string;
  dot: string;
  dotActive: string;
  counter: string;
}> = {
  ritual: {
    rootMulti: 'md:grid md:grid-cols-[4.5rem_minmax(0,1fr)] md:gap-4',
    frameWrap: '-mx-5 md:mx-0',
    main: 'relative aspect-[4/5] overflow-hidden bg-stone-100 md:rounded-2xl',
    rail: 'hidden md:flex md:flex-col md:gap-3',
    mobileThumbs: 'mt-4 flex gap-3 overflow-x-auto pb-1 md:hidden',
    thumb: 'relative h-[5.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl ring-1 ring-stone-200 transition hover:ring-stone-400',
    thumbActive: 'relative h-[5.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl ring-2 ring-[var(--site-accent,#1c1917)]',
    fallback: 'flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300',
    fallbackInitial: 'font-serif text-6xl italic text-stone-400/70',
    arrow: 'absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-stone-900 shadow-lg ring-1 ring-stone-200 backdrop-blur transition hover:bg-white active:scale-95 md:flex',
    dot: 'h-1.5 w-1.5 rounded-full bg-white/50 transition-all',
    dotActive: 'h-1.5 w-4 rounded-full bg-white transition-all',
    counter: 'absolute bottom-3 right-3 z-10 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-bold tabular-nums tracking-[0.2em] text-white backdrop-blur-sm',
  },
  editorial: {
    rootMulti: 'md:grid md:grid-cols-[4.5rem_minmax(0,1fr)] md:gap-4',
    frameWrap: '-mx-5 md:mx-0',
    main: 'relative aspect-[4/5] overflow-hidden border-y border-neutral-900 bg-[#EDEAE2] md:border',
    rail: 'hidden md:flex md:flex-col md:gap-3',
    mobileThumbs: 'mt-4 flex gap-3 overflow-x-auto pb-1 md:hidden',
    thumb: 'relative h-[5.5rem] w-[4.5rem] shrink-0 overflow-hidden border border-neutral-300 transition hover:border-neutral-900',
    thumbActive: 'relative h-[5.5rem] w-[4.5rem] shrink-0 overflow-hidden border-2 border-[var(--site-accent,#171717)]',
    fallback: 'flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-200 via-[#EDEAE2] to-neutral-300',
    fallbackInitial: 'font-serif text-6xl italic text-neutral-400/60',
    arrow: 'absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-neutral-900 bg-[#F7F5F0]/95 text-neutral-900 backdrop-blur transition hover:bg-neutral-900 hover:text-[#F7F5F0] active:scale-95 md:flex',
    dot: 'h-1.5 w-1.5 bg-white/50 transition-all',
    dotActive: 'h-1.5 w-4 bg-white transition-all',
    counter: 'absolute bottom-3 right-3 z-10 border border-neutral-900 bg-[#F7F5F0]/95 px-2.5 py-1 text-[9px] font-bold tabular-nums tracking-[0.3em] text-neutral-900',
  },
  neutral: {
    rootMulti: 'md:grid md:grid-cols-[4.5rem_minmax(0,1fr)] md:gap-4',
    frameWrap: '-mx-5 md:mx-0',
    main: 'relative aspect-[4/5] overflow-hidden bg-black md:rounded-2xl md:border md:border-white/10',
    rail: 'hidden md:flex md:flex-col md:gap-3',
    mobileThumbs: 'mt-4 flex gap-3 overflow-x-auto pb-1 md:hidden',
    thumb: 'relative h-[5.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15 transition hover:ring-white/40',
    thumbActive: 'relative h-[5.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl ring-2 ring-[var(--site-accent,#f0a500)]',
    fallback: 'flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1c1c1c] via-[#141414] to-[#242424]',
    fallbackInitial: 'text-6xl font-black uppercase text-white/15',
    arrow: 'absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-black active:scale-95 md:flex',
    dot: 'h-1.5 w-1.5 rounded-full bg-white/40 transition-all',
    dotActive: 'h-1.5 w-4 rounded-full bg-[var(--site-accent,#f0a500)] transition-all',
    counter: 'absolute bottom-3 right-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black tabular-nums tracking-[0.2em] text-white',
  },
};

// The frame fills the 7-column gallery slot (≈620px at the 1280px container)
// minus the 4.5rem rail; below md it is full-bleed.
const FRAME_SIZES = '(min-width: 1280px) 620px, (min-width: 768px) 55vw, 100vw';

const pad2 = (n: number) => String(n).padStart(2, '0');

export default function SiteProductGallery({
  name,
  media,
  tone,
}: {
  name: string;
  media: GalleryMedia[];
  tone: SiteTone;
}) {
  const [selected, setSelected] = useState(0);
  const styles = FRAME_STYLES[tone];
  const trackRef = useRef<HTMLDivElement | null>(null);
  // Guards the scroll listener while a thumb/arrow-initiated smooth scroll is
  // in flight, so the animation's intermediate frames don't fight the target.
  const programmaticTarget = useRef<number | null>(null);

  const slideCount = media.length;
  const multi = slideCount > 1;
  const activeIndex = Math.min(selected, Math.max(0, slideCount - 1));

  // Swipe → selection follows. Passive listener, CarouselTrack idiom.
  useEffect(() => {
    const el = trackRef.current;
    if (!el || slideCount <= 1) return;
    const onScroll = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      const index = Math.max(0, Math.min(slideCount - 1, Math.round(el.scrollLeft / width)));
      if (programmaticTarget.current !== null) {
        if (index === programmaticTarget.current) programmaticTarget.current = null;
        return;
      }
      setSelected((cur) => (cur === index ? cur : index));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [slideCount]);

  // Thumb tap / arrow / key → smooth-scroll the track to the slide.
  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(slideCount - 1, index));
    setSelected(clamped);
    const el = trackRef.current;
    if (el && slideCount > 1) {
      programmaticTarget.current = clamped;
      el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
    }
  }, [slideCount]);

  const onTrackKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(activeIndex + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(activeIndex - 1);
    }
  };

  const fallbackPlate = (
    <div className={styles.fallback}>
      <span className={styles.fallbackInitial}>{name.charAt(0).toUpperCase()}</span>
    </div>
  );

  const renderSlideMedia = (item: GalleryMedia, index: number, isActive: boolean) => {
    if (item.type === 'video') {
      // Only the active slide mounts the <video>; inactive video slides show
      // the identical poster pixels with a passive play glyph.
      if (isActive) {
        return (
          <GatedVideo
            key={item.url}
            src={item.url}
            poster={item.poster}
            alt={name}
            className="h-full w-full object-cover"
            posterSizes={FRAME_SIZES}
            posterBlurTone={tone === 'neutral' ? 'dark' : 'light'}
            controlsWhenPlaying
            fallback={fallbackPlate}
          />
        );
      }
      return (
        <>
          {item.poster ? (
            <SmartImage
              src={item.poster}
              alt={name}
              fill
              sizes={FRAME_SIZES}
              blurTone={tone === 'neutral' ? 'dark' : 'light'}
              className="object-cover"
            />
          ) : (
            fallbackPlate
          )}
          <span aria-hidden className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
              <Play size={16} fill="currentColor" />
            </span>
          </span>
        </>
      );
    }
    return (
      <SmartImage
        key={item.url}
        src={item.url}
        alt={`${name} — photo ${index + 1}`}
        fill
        priority={index === 0}
        sizes={FRAME_SIZES}
        blurTone={tone === 'neutral' ? 'dark' : 'light'}
        className="object-cover"
      />
    );
  };

  const renderThumb = (item: GalleryMedia, i: number) => (
    <button
      key={`${item.url}-${i}`}
      type="button"
      onClick={() => goTo(i)}
      aria-label={item.type === 'video' ? `Play video of ${name}` : `View photo ${i + 1} of ${name}`}
      aria-current={i === activeIndex ? 'true' : undefined}
      className={i === activeIndex ? styles.thumbActive : styles.thumb}
    >
      {item.type === 'video' ? (
        <>
          {item.poster ? (
            <SmartImage src={item.poster} alt="" fill sizes="72px" blurTone="none" className="object-cover" />
          ) : (
            <span className="block h-full w-full bg-black" />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-[9px] font-bold uppercase tracking-widest text-white">
            Play
          </span>
        </>
      ) : (
        <SmartImage src={item.url} alt="" fill sizes="72px" blurTone="none" className="object-cover" />
      )}
    </button>
  );

  return (
    <div className={multi ? styles.rootMulti : undefined}>
      {/* Desktop vertical rail — the accessible selectors (≥44px each). */}
      {multi && <div className={styles.rail}>{media.map(renderThumb)}</div>}

      <div className={styles.frameWrap}>
        <div className={styles.main}>
          {slideCount === 0 ? (
            fallbackPlate
          ) : !multi ? (
            // Single media: one static frame.
            media[0].type === 'video' ? (
              <GatedVideo
                key={media[0].url}
                src={media[0].url}
                poster={media[0].poster}
                alt={name}
                className="h-full w-full object-cover"
                posterSizes={FRAME_SIZES}
                posterBlurTone={tone === 'neutral' ? 'dark' : 'light'}
                controlsWhenPlaying
                fallback={fallbackPlate}
              />
            ) : (
              <SmartImage
                key={media[0].url}
                src={media[0].url}
                alt={name}
                fill
                priority
                sizes={FRAME_SIZES}
                blurTone={tone === 'neutral' ? 'dark' : 'light'}
                className="object-cover"
              />
            )
          ) : (
            <>
              {/* Native scroll-snap swipe track (CarouselTrack idiom). */}
              <div
                ref={trackRef}
                role="region"
                tabIndex={0}
                onKeyDown={onTrackKeyDown}
                aria-label={`${name} media, ${activeIndex + 1} of ${slideCount}`}
                className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--site-accent,#1c1917)]"
              >
                {media.map((item, i) => (
                  <div key={`${item.url}-${i}`} className="relative h-full w-full shrink-0 snap-center">
                    {renderSlideMedia(item, i, i === activeIndex)}
                  </div>
                ))}
              </div>

              {/* Desktop paging arrows — ≥44px (h-11 w-11). */}
              <button
                type="button"
                aria-label="Previous media"
                onClick={() => goTo(activeIndex - 1)}
                className={`${styles.arrow} left-3 ${activeIndex > 0 ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                aria-label="Next media"
                onClick={() => goTo(activeIndex + 1)}
                className={`${styles.arrow} right-3 ${activeIndex < slideCount - 1 ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
              >
                <ChevronRight size={18} />
              </button>

              {/* Live counter — the luxury-catalog "01 / 04" plate. */}
              <span aria-hidden className={styles.counter}>
                {pad2(activeIndex + 1)} / {pad2(slideCount)}
              </span>

              {/* Dot indicators — decorative (the ≥44px thumbs are the
                  accessible selectors). */}
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
                {media.map((item, i) => (
                  <span key={`${item.url}-dot-${i}`} className={i === activeIndex ? styles.dotActive : styles.dot} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile thumb row — hidden once the desktop rail takes over. */}
      {multi && <div className={styles.mobileThumbs}>{media.map(renderThumb)}</div>}
    </div>
  );
}
