'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Play } from 'lucide-react';
import SmartImage from '@/components/SmartImage';

// ─────────────────────────────────────────────────────────────────────────────
// VideoHeroMedia — the media surface of the video_hero block (Phase 4).
// Minimal client island: a muted, looping inline video with a two-stage
// graceful fallback when the asset 404s or fails to decode — poster image
// first, then the template's neutral gradient (Law 4: the seller's real
// pixels when they load, a neutral material when they don't; never a broken
// frame). The text overlay stays server-rendered in each template around this
// island.
//
// Adaptive media (Gambia Standard, Step 2 — the 2G defense): playback is
// decided AFTER hydration from a typed navigator.connection shim (the API is
// absent from the TS DOM lib) plus prefers-reduced-motion, via
// useSyncExternalStore (server snapshot 'unknown', live client snapshot,
// subscribed to connection/motion 'change' events):
//
//   saveData === true, effectiveType slow-2g/2g/3g, or reduced-motion
//     → no autoplay. The poster (or gradient) renders with a ≥44px
//       "Tap to play" affordance; tapping starts muted playsInline playback.
//   unconstrained
//     → autoplay, exactly the pre-Step-2 behavior.
//
// SSR safety: the server (and the hydration pass, verdict 'unknown') renders
// the video WITHOUT the autoplay attribute at preload="metadata" — a few KB,
// not a stream — so a 2G visitor never races a multi-megabyte fetch against
// hydration. On an unconstrained network the verdict lands in the same
// hydration commit and autoplay starts immediately; the poster covers the
// frame meanwhile, so the visual result is unchanged.
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

// navigator.connection is a WICG API missing from lib.dom — typed shim, every
// field optional so partial implementations (Safari: none) stay safe.
type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
};

type NavigatorWithConnection = Navigator & { connection?: NetworkInformationLike };

const CONSTRAINED_EFFECTIVE_TYPES = new Set(['slow-2g', '2g', '3g']);
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

type EnvironmentVerdict = 'unknown' | 'constrained' | 'unconstrained';

function subscribeToEnvironment(onChange: () => void): () => void {
  const connection = (navigator as NavigatorWithConnection).connection;
  connection?.addEventListener?.('change', onChange);
  const media = window.matchMedia?.(REDUCED_MOTION_QUERY);
  media?.addEventListener?.('change', onChange);
  return () => {
    connection?.removeEventListener?.('change', onChange);
    media?.removeEventListener?.('change', onChange);
  };
}

function getEnvironmentVerdict(): EnvironmentVerdict {
  if (window.matchMedia?.(REDUCED_MOTION_QUERY).matches) return 'constrained';
  const connection = (navigator as NavigatorWithConnection).connection;
  if (connection) {
    if (connection.saveData === true) return 'constrained';
    const effectiveType = (connection.effectiveType ?? '').toLowerCase();
    if (CONSTRAINED_EFFECTIVE_TYPES.has(effectiveType)) return 'constrained';
  }
  return 'unconstrained';
}

const getServerEnvironmentVerdict = (): EnvironmentVerdict => 'unknown';

export default function VideoHeroMedia({ src, poster, alt, className, fallbackClassName }: VideoHeroMediaProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  // Explicit tap on the gated affordance — user intent outranks the verdict.
  const [userStarted, setUserStarted] = useState(false);
  const verdict = useSyncExternalStore(
    subscribeToEnvironment,
    getEnvironmentVerdict,
    getServerEnvironmentVerdict
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const shouldAutoplay = userStarted || verdict === 'unconstrained';
  const gated = verdict === 'constrained' && !userStarted;

  // The autoPlay attribute only acts at element insertion; when the verdict
  // (or a tap) lands after the video already exists, start playback here.
  useEffect(() => {
    if (shouldAutoplay && !videoFailed) {
      videoRef.current?.play().catch(() => {
        // Autoplay rejection (browser policy) leaves the poster frame — never a crash.
      });
    }
  }, [shouldAutoplay, videoFailed]);

  const posterFrame =
    poster && !posterFailed ? (
      <SmartImage
        src={poster}
        alt={alt}
        fill
        sizes="100vw"
        blurTone="dark"
        className={className}
        onError={() => setPosterFailed(true)}
      />
    ) : (
      <div aria-hidden className={fallbackClassName} />
    );

  // Existing failure ladder, intact: video error → poster → gradient.
  if (videoFailed) {
    return posterFrame;
  }

  // Constrained network / reduced motion: seller's poster pixels + a large
  // tap target (≥44px). z-10 lifts the button above the templates' sibling
  // gradient overlays so the tap always lands.
  if (gated) {
    return (
      <>
        {posterFrame}
        <button
          type="button"
          onClick={() => setUserStarted(true)}
          aria-label={`Play ${alt}`}
          className="absolute left-1/2 top-1/2 z-10 flex min-h-[44px] -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-full bg-black/60 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-lg backdrop-blur-sm transition hover:bg-black/75 active:scale-95"
        >
          <Play size={16} fill="currentColor" aria-hidden />
          Tap to play
        </button>
      </>
    );
  }

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster ?? undefined}
      autoPlay={shouldAutoplay}
      loop
      muted
      playsInline
      preload="metadata"
      onError={() => setVideoFailed(true)}
      className={className}
    />
  );
}
