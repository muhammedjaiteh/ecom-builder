'use client';

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
// blurTone paints a tone-matched shimmer plate (tiny inline SVG) while pixels
// stream in; 'none' skips it for small chrome images (logos, 64px thumbs).
// ─────────────────────────────────────────────────────────────────────────────

type SmartImageProps = Omit<ImageProps, 'src' | 'loader' | 'placeholder' | 'blurDataURL'> & {
  src: string;
  /** Shimmer plate palette: light (Ritual/Editorial paper), dark (Vitality/Neutral), none. */
  blurTone?: 'light' | 'dark' | 'none';
};

export default function SmartImage({ src, blurTone = 'light', alt, ...rest }: SmartImageProps) {
  const strategy = resolveImageStrategy(src);
  return (
    <Image
      src={src}
      alt={alt}
      {...rest}
      {...(blurTone !== 'none'
        ? {
            placeholder: 'blur' as const,
            blurDataURL: blurTone === 'dark' ? SHIMMER_BLUR_DARK : SHIMMER_BLUR_LIGHT,
          }
        : {})}
      {...(strategy === 'supabase' ? { loader: supabaseImageLoader } : {})}
      {...(strategy === 'unoptimized' ? { unoptimized: true } : {})}
    />
  );
}
