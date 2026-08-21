import GatedVideo from './GatedVideo';

// ─────────────────────────────────────────────────────────────────────────────
// VideoHeroMedia — the media surface of the video_hero block. The 2G defense
// itself (network verdict via useSyncExternalStore, ≥44px tap-to-play on
// constrained networks, video → poster → gradient failure ladder, SSR-safe
// preload="metadata") lives in GatedVideo — the shared gate every /site video
// runs through (hero_banner ad videos and the PDP gallery included). This
// component only binds the video_hero block's contract to it: a full-bleed
// poster frame with a dark shimmer and the template-dialect gradient as the
// terminal fallback. The text overlay stays server-rendered in each template
// around this island; the props API is unchanged.
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
  return (
    <GatedVideo
      src={src}
      poster={poster}
      alt={alt}
      className={className}
      posterSizes="100vw"
      posterBlurTone="dark"
      fallback={<div aria-hidden className={fallbackClassName} />}
    />
  );
}
