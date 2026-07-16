'use client';

import { useState } from 'react';
import type { SiteTone } from '@/components/site-templates/chrome';

// Product media gallery for the on-site PDP. Server builds the ordered media
// list (Ad Studio video → AI hero still → seller originals — always the
// seller's real pixels, Law 4); this island only handles selection state.

export type GalleryMedia =
  | { type: 'video'; url: string; poster: string | null }
  | { type: 'image'; url: string };

const FRAME_STYLES: Record<SiteTone, { main: string; thumb: string; thumbActive: string; fallback: string; fallbackInitial: string }> = {
  ritual: {
    main: 'relative aspect-[4/5] overflow-hidden rounded-2xl bg-stone-100',
    thumb: 'relative h-20 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-stone-200 transition hover:ring-stone-400',
    thumbActive: 'relative h-20 w-16 shrink-0 overflow-hidden rounded-xl ring-2 ring-stone-900',
    fallback: 'flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300',
    fallbackInitial: 'font-serif text-6xl italic text-stone-400/70',
  },
  editorial: {
    main: 'relative aspect-[4/5] overflow-hidden border border-neutral-900 bg-[#EDEAE2]',
    thumb: 'relative h-20 w-16 shrink-0 overflow-hidden border border-neutral-300 transition hover:border-neutral-900',
    thumbActive: 'relative h-20 w-16 shrink-0 overflow-hidden border-2 border-neutral-900',
    fallback: 'flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-200 via-[#EDEAE2] to-neutral-300',
    fallbackInitial: 'font-serif text-6xl italic text-neutral-400/60',
  },
  neutral: {
    main: 'relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-black',
    thumb: 'relative h-20 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15 transition hover:ring-[#f0a500]/60',
    thumbActive: 'relative h-20 w-16 shrink-0 overflow-hidden rounded-xl ring-2 ring-[#f0a500]',
    fallback: 'flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1c1c1c] via-[#141414] to-[#242424]',
    fallbackInitial: 'text-6xl font-black uppercase text-white/15',
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
  const current = media[Math.min(selected, Math.max(0, media.length - 1))] ?? null;

  return (
    <div>
      <div className={styles.main}>
        {current === null ? (
          <div className={styles.fallback}>
            <span className={styles.fallbackInitial}>{name.charAt(0).toUpperCase()}</span>
          </div>
        ) : current.type === 'video' ? (
          <video
            key={current.url}
            src={current.url}
            poster={current.poster ?? undefined}
            autoPlay
            loop
            muted
            playsInline
            controls
            className="h-full w-full object-cover"
          />
        ) : (
          <img key={current.url} src={current.url} alt={name} className="h-full w-full object-cover" />
        )}
      </div>

      {media.length > 1 && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {media.map((item, i) => (
            <button
              key={`${item.url}-${i}`}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={item.type === 'video' ? `Play video of ${name}` : `View photo ${i + 1} of ${name}`}
              className={i === selected ? styles.thumbActive : styles.thumb}
            >
              {item.type === 'video' ? (
                <>
                  {item.poster ? (
                    <img src={item.poster} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="block h-full w-full bg-black" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-[9px] font-bold uppercase tracking-widest text-white">
                    Play
                  </span>
                </>
              ) : (
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
