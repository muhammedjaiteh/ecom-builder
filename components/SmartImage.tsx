'use client';

import { useState } from 'react';
import Image, { type ImageProps } from 'next/image';
import {
  SHIMMER_BLUR_DARK,
  SHIMMER_BLUR_LIGHT,
  resolveImageStrategy,
  supabaseImageLoader,
} from '@/lib/imageLoader';

// ─────────────────────────────────────────────────────────────────────────────
// SmartImage — the storefront's single next/image surface (Gambia Standard,
// Step 2). A thin client island the server-rendered templates compose, because
// loader functions cannot cross the server→client prop boundary; importing the
// loader HERE keeps every template/chrome a Server Component.
//
//   • Supabase Storage uploads  → supabaseImageLoader (Pro render/image
//     transformer: resized at the edge, ~75 quality; the browser fetches the
//     Supabase CDN directly — the /_next/image proxy is never involved).
//   • Local/static '/' paths    → default Vercel optimizer (same-origin,
//     never DNS-resolved, immune to the SSRF guard).
//   • ALL remote non-Supabase   → unoptimized direct render. NAT64 DECISION
//     (2026-08-28, lib/imageLoader.ts header): carrier NAT64 networks
//     resolve IPv4-only hosts via 64:ff9b::/96 and the optimizer's SSRF
//     guard hard-rejects them ("resolved to private ip") — no remotePatterns
//     entry can override it, so remote UGC bypasses the proxy entirely.
//
// RESIDUAL RESILIENCE (Law 4): the strategy router already keeps remote UGC
// off the proxy, so this net should now rarely fire. On an <img> error for
// an https src on a loader-routed strategy, the component degrades THAT src
// to a direct unoptimized render (state keyed per src — a second error on
// the degraded render is a genuinely dead URL and is left alone, no retry
// loop). This now also covers the Supabase render transformer refusing an
// object it cannot transform (oversized original, exotic format): the raw
// object URL still renders, so buyers see the seller's pixels either way.
//
// blurTone paints a tone-matched shimmer plate (tiny inline SVG) while pixels
// stream in; 'none' skips it for small chrome images (logos, 64px thumbs).
// ─────────────────────────────────────────────────────────────────────────────

type SmartImageProps = Omit<ImageProps, 'src' | 'loader' | 'placeholder' | 'blurDataURL'> & {
  src: string;
  /** Shimmer plate palette: light (Ritual/Editorial paper), dark (Vitality/Neutral), none. */
  blurTone?: 'light' | 'dark' | 'none';
};

function hostnameOf(src: string): string {
  try {
    return new URL(src).hostname;
  } catch {
    return 'unknown-host';
  }
}

export default function SmartImage({
  src,
  blurTone = 'light',
  alt,
  onError,
  ...rest
}: SmartImageProps) {
  // The src whose optimizer request failed and now renders direct. Keyed to
  // the exact src so a prop change to a new image gets a fresh optimizer try.
  const [degradedSrc, setDegradedSrc] = useState<string | null>(null);

  const strategy = resolveImageStrategy(src);
  const effectiveStrategy = degradedSrc === src ? 'unoptimized' : strategy;

  const handleError: NonNullable<ImageProps['onError']> = (event) => {
    // Degrade only loader-routed https srcs: 'unoptimized' already renders
    // direct (an error there is a dead URL), and static '/' paths would 404
    // direct too. Already-degraded srcs are final — no retry loop.
    if (strategy !== 'unoptimized' && src.startsWith('https://') && degradedSrc !== src) {
      console.warn(
        `[smart-image] ${strategy} loader failed for ${hostnameOf(src)} — degraded to direct render: ${src}`
      );
      setDegradedSrc(src);
    }
    onError?.(event);
  };

  return (
    <Image
      src={src}
      alt={alt}
      {...rest}
      onError={handleError}
      {...(blurTone !== 'none'
        ? {
            placeholder: 'blur' as const,
            blurDataURL: blurTone === 'dark' ? SHIMMER_BLUR_DARK : SHIMMER_BLUR_LIGHT,
          }
        : {})}
      {...(effectiveStrategy === 'supabase' ? { loader: supabaseImageLoader } : {})}
      {...(effectiveStrategy === 'unoptimized' ? { unoptimized: true } : {})}
    />
  );
}
