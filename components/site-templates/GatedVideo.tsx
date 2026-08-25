'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Play } from 'lucide-react';
import SmartImage from '@/components/SmartImage';

// ─────────────────────────────────────────────────────────────────────────────
// GatedVideo — THE 2G media gate (Gambia Standard, Step 2), extracted from
// VideoHeroMedia so every inline video on a /site page (video_hero film,
// hero_banner ad video, PDP gallery slide) runs the same defense. One client
// island: muted, looping, playsInline video with
//
//   • the network verdict: saveData === true, effectiveType slow-2g/2g/3g, or
//     prefers-reduced-motion → NO autoplay. The poster (seller's real pixels,
//     Law 4) renders with a ≥44px "Tap to play" affordance; tapping starts
//     muted inline playback (user intent outranks the verdict).
//   • the failure ladder: video error → poster → caller-supplied fallback
//     (each template's own gradient / branded plate) — never a broken frame.
//   • SSR safety: the server (and the hydration pass, verdict 'unknown')
//     renders the video WITHOUT the autoplay attribute at preload="metadata"
//     — a few KB, not a stream — so a 2G visitor never races a multi-megabyte
//     fetch against hydration. On an unconstrained network the verdict lands
//     in the same hydration commit and playback starts immediately; the
//     poster covers the frame meanwhile, so the visual result is unchanged.
//
// The verdict is decided AFTER hydration from a typed navigator.connection
// shim (the API is absent from the TS DOM lib) plus prefers-reduced-motion,
// via useSyncExternalStore (server snapshot 'unknown', live client snapshot,
// subscribed to connection/motion 'change' events).
//
// Preview scope: the dashboard Site Editor and template miniatures render the
// real templates scaled down — an autoplaying video (or even a play button)
// inside a scaled, click-captured frame is noise. Wrapping the template in
// <GatedVideoPreviewScope> forces every GatedVideo underneath into the static
// poster state: no video element, no autoplay, no button.
// ─────────────────────────────────────────────────────────────────────────────

type GatedVideoProps = {
  src: string;
  /** Seller's poster pixels (ad hero still / product image); null → fallback. */
  poster: string | null;
  alt: string;
  /** Shared positioning/object-fit classes for the video and poster img. */
  className: string;
  /** Template-dialect surface rendered when both video and poster fail. */
  fallback: ReactNode;
  /** SmartImage `sizes` for the poster frame. Default: full-bleed hero. */
  posterSizes?: string;
  /** SmartImage shimmer palette for the poster frame. */
  posterBlurTone?: 'light' | 'dark' | 'none';
  /** Above-the-fold posters (hero banners) load eagerly. */
  posterPriority?: boolean;
  /** Tone-styled tap-to-play affordance (must keep a ≥44px box). */
  playButtonClassName?: string;
  /** Native controls once playback is live (PDP gallery); the gated poster
   *  state never shows controls — the tap target IS the control. */
  controlsWhenPlaying?: boolean;
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

/** The 2G media-gate verdict as a reusable hook (marketplace cinematic tiles
 *  share GatedVideo's exact semantics): 'unknown' on the server/hydration
 *  pass, then live saveData/effectiveType/reduced-motion subscription. */
export function useMediaEnvironmentVerdict(): EnvironmentVerdict {
  return useSyncExternalStore(
    subscribeToEnvironment,
    getEnvironmentVerdict,
    getServerEnvironmentVerdict
  );
}

const DEFAULT_PLAY_BUTTON =
  'absolute left-1/2 top-1/2 z-10 flex min-h-[44px] -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-full bg-black/60 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-lg backdrop-blur-sm transition hover:bg-black/75 active:scale-95';

const GatedVideoPreviewContext = createContext(false);

/** Forces every GatedVideo underneath into the static poster state — for the
 *  Site Editor's scaled preview and template miniatures. */
export function GatedVideoPreviewScope({ children }: { children: ReactNode }) {
  return <GatedVideoPreviewContext.Provider value={true}>{children}</GatedVideoPreviewContext.Provider>;
}

export default function GatedVideo({
  src,
  poster,
  alt,
  className,
  fallback,
  posterSizes = '100vw',
  posterBlurTone = 'dark',
  posterPriority = false,
  playButtonClassName = DEFAULT_PLAY_BUTTON,
  controlsWhenPlaying = false,
}: GatedVideoProps) {
  const inPreviewScope = useContext(GatedVideoPreviewContext);
  const [videoFailed, setVideoFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  // Explicit tap on the gated affordance — user intent outranks the verdict.
  const [userStarted, setUserStarted] = useState(false);
  const verdict = useMediaEnvironmentVerdict();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const shouldAutoplay = !inPreviewScope && (userStarted || verdict === 'unconstrained');
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
        sizes={posterSizes}
        priority={posterPriority}
        blurTone={posterBlurTone}
        className={className}
        onError={() => setPosterFailed(true)}
      />
    ) : (
      fallback
    );

  // Scaled previews: the static poster state, always — no video element, no
  // autoplay storm, no dead play button under the editor's click-capture.
  if (inPreviewScope) {
    return <>{posterFrame}</>;
  }

  // Failure ladder, stage one: video error → poster (→ fallback).
  if (videoFailed) {
    return <>{posterFrame}</>;
  }

  // Constrained network / reduced motion: seller's poster pixels + a large
  // tap target (≥44px). z-10 lifts the button above the templates' sibling
  // gradient overlays so the tap always lands.
  if (gated) {
    return (
      <>
        {posterFrame}
        <button type="button" onClick={() => setUserStarted(true)} aria-label={`Play ${alt}`} className={playButtonClassName}>
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
      controls={controlsWhenPlaying}
      onError={() => setVideoFailed(true)}
      className={className}
    />
  );
}
