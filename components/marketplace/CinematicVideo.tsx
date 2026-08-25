'use client';

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { useMediaEnvironmentVerdict } from '@/components/site-templates/GatedVideo';
import { usePlaybackChannel } from './PlaybackCoordinator';

// ─────────────────────────────────────────────────────────────────────────────
// CinematicVideo — the living layer of a CinematicTile. The tile shell renders
// the SmartImage poster underneath; this island overlays the <video> and runs
// the enhancement ladder: shimmer → poster (shell) → crossfade-in video.
//
//   • NEAR-VIEWPORT MOUNT: one IntersectionObserver (rootMargin 25%) mounts
//     the video element only as the tile approaches, with preload="none" —
//     zero bytes move until the coordinator actually elects this tile and
//     play() fires. Scrolled away → the element UNMOUNTS back to the poster,
//     releasing the decoder and the stream.
//   • ONE-PLAYING RULE: every IO callback reports visibility + distance to
//     the PlaybackCoordinator; only the elected activeId plays, everyone else
//     pauses on their poster. Without a provider the tile degrades to
//     play-when-near (still bounded by the near-mount rule).
//   • 2G / SAVE-DATA / REDUCED MOTION (GatedVideo semantics): the verdict
//     gates everything behind a whisper '▶ Watch' affordance (≥44px); a tap
//     is explicit intent and outranks both the verdict and the election.
//   • FAILURE: a video error permanently returns THIS tile to its poster —
//     never a broken frame (Law 4).
// ─────────────────────────────────────────────────────────────────────────────

type CinematicVideoProps = {
  /** Stable tile id for the playback election (product id). */
  id: string;
  src: string;
  poster: string | null;
  /** Accessible name for the whisper affordance. */
  alt: string;
};

export default function CinematicVideo({ id, src, poster, alt }: CinematicVideoProps) {
  const verdict = useMediaEnvironmentVerdict();
  const playback = usePlaybackChannel();
  const report = playback?.report;
  const unregister = playback?.unregister;
  const activeId = playback ? playback.activeId : null;
  const hasCoordinator = playback !== null;

  const [near, setNear] = useState(false);
  const [showing, setShowing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [userStarted, setUserStarted] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const gated = verdict === 'constrained' && !userStarted;

  // IO: near-viewport mount + election reporting. report/unregister are
  // referentially stable, so this observer survives election re-renders.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (ioEntries) => {
        const entry = ioEntries[ioEntries.length - 1];
        setNear(entry.isIntersecting);
        if (!entry.isIntersecting) setShowing(false);
        if (report) {
          const rect = entry.boundingClientRect;
          const distance = Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2);
          report(id, entry.isIntersecting, distance);
        }
      },
      // 25% beyond the viewport counts as "near" (mount); the graded
      // thresholds keep distance reports fresh as the tile scrolls.
      { rootMargin: '25% 0px', threshold: [0, 0.15, 0.35, 0.6, 0.85, 1] }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      unregister?.(id);
    };
  }, [id, report, unregister]);

  // Election → playback. userStarted (explicit tap on a constrained network,
  // where nothing else autoplays) outranks the election.
  const elected = hasCoordinator ? activeId === id : near;
  const mounted = near && !gated && !failed;
  const shouldPlay = mounted && (elected || userStarted);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (shouldPlay) {
      video.play().catch(() => {
        // Autoplay policy said no — the poster stays; a user tap still works.
      });
    } else {
      video.pause();
    }
  }, [shouldPlay, mounted]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {mounted && (
        <video
          ref={videoRef}
          src={src}
          poster={poster ?? undefined}
          loop
          muted
          playsInline
          preload="none"
          onPlaying={() => setShowing(true)}
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            showing ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
      {gated && !failed && (
        <button
          type="button"
          onClick={() => setUserStarted(true)}
          aria-label={`Play ${alt}`}
          className="absolute left-1/2 top-1/2 z-10 flex min-h-11 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-black/55 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.25em] text-white backdrop-blur-sm transition hover:bg-black/70 active:scale-95"
        >
          <Play size={13} fill="currentColor" aria-hidden /> Watch
        </button>
      )}
    </div>
  );
}
