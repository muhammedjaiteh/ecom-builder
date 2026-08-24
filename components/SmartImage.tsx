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
//     transformer: resized at the edge, ~75 quality, zero Vercel quota).
//   • fal.media / creatomate    → default Vercel optimizer (allowlisted in
//     next.config.ts remotePatterns).
//   • blob:/data:/unknown hosts → unoptimized passthrough — the optimizer
//     would 400 them into broken frames (Law 4: real pixels or a branded
//     plate, never a broken image).
//
// OPTIMIZER RESILIENCE (Law 4): the optimizer can refuse an allowlisted host
// at runtime — production logged its SSRF DNS guard rejecting v3b.fal.media
// ("resolved to private ip"), which no remotePatterns entry can override. On
// an optimizer <img> error for a non-Supabase https host, the component
// degrades THAT src to a direct unoptimized render (state keyed per src — a
// second error on the degraded render is a genuinely dead URL and is left
// alone, so no retry loop). Buyers see the image either way. DURABLE FIX
// (follow-up, do not band-aid further): rehost fal-hosted assets to Supabase
// Storage at creation time like lib/siteAssets.ts already does —
// app/api/ai/generate-still still writes raw fal URLs to
// video_ads.hero_image_url, which add-ad-video copies onto
// products.ad_hero_image_url.
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
  const effectiveStrategy =
    strategy === 'optimized' && degradedSrc === src ? 'unoptimized' : strategy;

  const handleError: NonNullable<ImageProps['onError']> = (event) => {
    // Degrade only optimizer-routed remote hosts: Supabase runs its own
    // transformer (a failure there is a dead object, direct won't help) and
    // static '/' paths would 404 direct too. Already-degraded srcs are final.
    if (strategy === 'optimized' && src.startsWith('https://') && degradedSrc !== src) {
      console.warn(
        `[smart-image] optimizer failed for ${hostnameOf(src)} — degraded to direct render: ${src}`
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
