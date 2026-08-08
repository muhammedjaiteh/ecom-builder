'use client';

import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// VideoHeroMedia — the media surface of the video_hero block (Phase 4).
// Minimal client island: an autoplaying, muted, looping inline video with a
// two-stage graceful fallback when the asset 404s or fails to decode —
// poster image first, then the template's neutral gradient (Law 4: the
// seller's real pixels when they load, a neutral material when they don't;
// never a broken frame). The text overlay stays server-rendered in each
// template around this island.
// ─────────────────────────────────────────────────────────────────────────────

type VideoHeroMediaProps = {
  src: string;
  poster: string | null;
  alt: string;
  /** Shared positioning/object-fit classes for the video and poster img. */
  className: string;
  /** Template-dialect gradient rendered when both video and poster fail. */
  fallbackClassName: string;
};

export default function VideoHeroMedia({ src, poster, alt, className, fallbackClassName }: VideoHeroMediaProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  if (videoFailed) {
    if (poster && !posterFailed) {
      return <img src={poster} alt={alt} className={className} onError={() => setPosterFailed(true)} />;
    }
    return <div aria-hidden className={fallbackClassName} />;
  }

  return (
    <video
      src={src}
      poster={poster ?? undefined}
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
      onError={() => setVideoFailed(true)}
      className={className}
    />
  );
}
