'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import SmartImage from '@/components/SmartImage';
import GatedVideo from '@/components/site-templates/GatedVideo';
import type { SiteTone } from '@/components/site-templates/chrome';

// Product media gallery for the on-site PDP. Server builds the ordered media
// list (Ad Studio video → AI hero still → seller originals — always the
// seller's real pixels, Law 4).
//
// SINGLE MEDIA: exactly the historical static frame.
//
// MULTI MEDIA (Beta QA pass): the main frame becomes a native scroll-snap
// swipe track — the CarouselTrack idiom (snap-mandatory, momentum touch
// scrolling, no wheel hijack, hidden scrollbar) — with dot indicators,
// synced thumbnails (tap thumb → smooth-scroll to slide; swipe → active thumb
// follows via a passive scroll listener), and ≥44px desktop paging arrows.
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
  main: string;
  thumb: string;
  thumbActive: string;
  fallback: string;
  fallbackInitial: string;
  arrow: string;
  dot: string;
  dotActive: string;
}> = {
  ritual: {
    main: 'relative aspect-[4/5] overflow-hidden rounded-2xl bg-stone-100',
    thumb: 'relative h-20 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-stone-200 transition hover:ring-stone-400',
    thumbActive: 'relative h-20 w-16 shrink-0 overflow-hidden rounded-xl ring-2 ring-stone-900',
    fallback: 'flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300',
    fallbackInitial: 'font-serif text-6xl italic text-stone-400/70',
    arrow: 'absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-stone-900 shadow-lg ring-1 ring-stone-200 backdrop-blur transition hover:bg-white active:scale-95 md:flex',
    dot: 'h-1.5 w-1.5 rounded-full bg-white/50 transition-all',
    dotActive: 'h-1.5 w-4 rounded-full bg-white transition-all',
  },
  editorial: {
    main: 'relative aspect-[4/5] overflow-hidden border border-neutral-900 bg-[#EDEAE2]',
    thumb: 'relative h-20 w-16 shrink-0 overflow-hidden border border-neutral-300 transition hover:border-neutral-900',
    thumbActive: 'relative h-20 w-16 shrink-0 overflow-hidden border-2 border-neutral-900',
    fallback: 'flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-200 via-[#EDEAE2] to-neutral-300',
    fallbackInitial: 'font-serif text-6xl italic text-neutral-400/60',
    arrow: 'absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-neutral-900 bg-[#F7F5F0]/95 text-neutral-900 backdrop-blur transition hover:bg-neutral-900 hover:text-[#F7F5F0] active:scale-95 md:flex',
    dot: 'h-1.5 w-1.5 bg-white/50 transition-all',
    dotActive: 'h-1.5 w-4 bg-white transition-all',
  },
  neutral: {
    main: 'relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-black',
    thumb: 'relative h-20 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15 transition hover:ring-[#f0a500]/60',
    thumbActive: 'relative h-20 w-16 shrink-0 overflow-hidden rounded-xl ring-2 ring-[#f0a500]',
    fallback: 'flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1c1c1c] via-[#141414] to-[#242424]',
    fallbackInitial: 'text-6xl font-black uppercase text-white/15',
    arrow: 'absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-black active:scale-95 md:flex',
    dot: 'h-1.5 w-1.5 rounded-full bg-white/40 transition-all',
    dotActive: 'h-1.5 w-4 rounded-full bg-[#f0a500] transition-all',
  },
};

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

  // Thumb tap / arrow → smooth-scroll the track to the slide.
  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(slideCount - 1, index));
    setSelected(clamped);
    const el = trackRef.current;
    if (el && slideCount > 1) {
      programmaticTarget.current = clamped;
      el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
    }
  }, [slideCount]);

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
            posterSizes="(min-width: 768px) 50vw, 100vw"
            posterBlurTone={tone === 'neutral' ? 'dark' : 'light'}
            controlsWhenPlaying
            fallback={
              <div className={styles.fallback}>
                <span className={styles.fallbackInitial}>{name.charAt(0).toUpperCase()}</span>
              </div>
            }
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
              sizes="(min-width: 768px) 50vw, 100vw"
              blurTone={tone === 'neutral' ? 'dark' : 'light'}
              className="object-cover"
            />
          ) : (
            <div className={styles.fallback}>
              <span className={styles.fallbackInitial}>{name.charAt(0).toUpperCase()}</span>
            </div>
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
        sizes="(min-width: 768px) 50vw, 100vw"
        blurTone={tone === 'neutral' ? 'dark' : 'light'}
        className="object-cover"
      />
    );
  };

  return (
    <div>
      <div className={styles.main}>
        {slideCount === 0 ? (
          <div className={styles.fallback}>
            <span className={styles.fallbackInitial}>{name.charAt(0).toUpperCase()}</span>
          </div>
        ) : slideCount === 1 ? (
          // Single media: exactly the historical static frame.
          media[0].type === 'video' ? (
            <GatedVideo
              key={media[0].url}
              src={media[0].url}
              poster={media[0].poster}
              alt={name}
              className="h-full w-full object-cover"
              posterSizes="(min-width: 768px) 50vw, 100vw"
              posterBlurTone={tone === 'neutral' ? 'dark' : 'light'}
              controlsWhenPlaying
              fallback={
                <div className={styles.fallback}>
                  <span className={styles.fallbackInitial}>{name.charAt(0).toUpperCase()}</span>
                </div>
              }
            />
          ) : (
            <SmartImage
              key={media[0].url}
              src={media[0].url}
              alt={name}
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
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
              aria-label={`${name} media, ${activeIndex + 1} of ${slideCount}`}
              className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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

            {/* Dot indicators — decorative (the ≥44px thumbs below are the
                accessible selectors). */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
              {media.map((item, i) => (
                <span key={`${item.url}-dot-${i}`} className={i === activeIndex ? styles.dotActive : styles.dot} />
              ))}
            </div>
          </>
        )}
      </div>

      {media.length > 1 && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {media.map((item, i) => (
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
                    <SmartImage src={item.poster} alt="" fill sizes="64px" blurTone="none" className="object-cover" />
                  ) : (
                    <span className="block h-full w-full bg-black" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-[9px] font-bold uppercase tracking-widest text-white">
                    Play
                  </span>
                </>
              ) : (
                <SmartImage src={item.url} alt="" fill sizes="64px" blurTone="none" className="object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
