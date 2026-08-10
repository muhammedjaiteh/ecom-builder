import type { ImageLoaderProps } from 'next/image';

// ─────────────────────────────────────────────────────────────────────────────
// imageLoader — the storefront's image delivery strategy (Gambia Standard,
// Step 2: Images & Adaptive Media).
//
// Three-way routing, decided per URL:
//
//   'supabase'    Seller uploads live in Supabase Storage public buckets
//                 (products, brand). Supabase Pro ships an on-the-fly image
//                 transformer at /storage/v1/render/image/public/…, so the
//                 custom loader rewrites the object URL to the render URL with
//                 the width next/image requests and ~75 quality. A 4000px
//                 phone-camera original becomes a ~640px WebP-negotiated
//                 payload on a 2G product grid — the single largest byte win
//                 on the storefront — and it never touches the Vercel
//                 optimizer quota.
//
//   'optimized'   AI assets (Fal hero stills on fal.media / v*.fal.media,
//                 Creatomate poster frames) go through the default Vercel
//                 optimizer (/_next/image), governed by the exact
//                 remotePatterns allowlist in next.config.ts.
//
//   'unoptimized' blob:/data: dashboard upload previews and any unknown host
//                 render the raw pixels directly. The optimizer would 400 an
//                 un-allowlisted host into a broken frame — Law 4 says the
//                 seller's real pixels or a branded plate, never a broken
//                 image, so unknown hosts bypass optimization instead.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_OBJECT_PATH = '/storage/v1/object/public/';
const SUPABASE_RENDER_PATH = '/storage/v1/render/image/public/';

/** Hosts the default Vercel optimizer accepts — mirror of next.config.ts
 *  images.remotePatterns. Keep the two lists in lockstep. */
const OPTIMIZED_EXACT_HOSTS = new Set(['fal.media', 'creatomate.com', 'cdn.creatomate.com']);
const OPTIMIZED_HOST_SUFFIXES = ['.fal.media'];

export type ImageStrategy = 'supabase' | 'optimized' | 'unoptimized';

export function isSupabasePublicStorageUrl(src: string): boolean {
  if (!src.startsWith('https://')) return false;
  try {
    const url = new URL(src);
    return url.hostname.endsWith('.supabase.co') && url.pathname.startsWith(SUPABASE_OBJECT_PATH);
  } catch {
    return false;
  }
}

export function resolveImageStrategy(src: string): ImageStrategy {
  // Local/static assets (leading slash) belong to the default optimizer.
  if (src.startsWith('/')) return 'optimized';
  if (src.startsWith('blob:') || src.startsWith('data:')) return 'unoptimized';
  if (isSupabasePublicStorageUrl(src)) return 'supabase';
  try {
    const { protocol, hostname } = new URL(src);
    if (protocol !== 'https:') return 'unoptimized';
    if (OPTIMIZED_EXACT_HOSTS.has(hostname)) return 'optimized';
    if (OPTIMIZED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return 'optimized';
    // Non-storage paths on our own Supabase host (e.g. an already-transformed
    // render URL) ship as-is rather than double-transforming.
    return 'unoptimized';
  } catch {
    return 'unoptimized';
  }
}

/** next/image loader for Supabase Storage public objects: rewrites the object
 *  URL to the Supabase Pro render/image transformer with the requested width
 *  and ~75 quality, so sellers' full-resolution uploads ship resized. */
export function supabaseImageLoader({ src, width, quality }: ImageLoaderProps): string {
  try {
    const url = new URL(src);
    if (!url.pathname.startsWith(SUPABASE_OBJECT_PATH)) return src;
    url.pathname = url.pathname.replace(SUPABASE_OBJECT_PATH, SUPABASE_RENDER_PATH);
    url.searchParams.set('width', String(width));
    url.searchParams.set('quality', String(quality ?? 75));
    return url.toString();
  } catch {
    return src;
  }
}

// ── Shimmer plates ───────────────────────────────────────────────────────────
// Tiny inline-SVG gradients used as blurDataURL while the real pixels stream
// in — tone-matched to the template palettes (warm paper for Ritual/Editorial,
// near-black for Vitality/Neutral) so loading never flashes a foreign color.

function shimmerDataUrl(from: string, to: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/>` +
    `</linearGradient></defs><rect width="8" height="8" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const SHIMMER_BLUR_LIGHT = shimmerDataUrl('#e8e4dc', '#f5f3ee');
export const SHIMMER_BLUR_DARK = shimmerDataUrl('#161616', '#262626');
