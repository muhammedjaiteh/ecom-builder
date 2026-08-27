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
//                 on the storefront. The BROWSER fetches the Supabase render
//                 CDN directly: this path never touches the /_next/image
//                 proxy, so it keeps its transforms AND is immune to the
//                 optimizer's SSRF guard (see below).
//
//   'optimized'   Local/static assets ONLY (leading-slash paths: public/
//                 icons, logos, UI art) — the default Vercel optimizer.
//
//   'unoptimized' Every REMOTE non-Supabase URL (fal.media / v*.fal.media
//                 hero stills, creatomate.com poster frames, legacy DALL-E
//                 blob URLs, unknown hosts) plus blob:/data: previews render
//                 the raw pixels directly.
//
// NAT64 DECISION (2026-08-28): remote UGC is permanently retired from the
// /_next/image proxy. Buyers on carrier NAT64 networks (common on Gambian
// mobile carriers) resolve IPv4-only hosts through the 64:ff9b::/96
// well-known prefix, and Next's optimizer SSRF heuristic rejects those
// lookups with `resolved to private ip ["64:ff9b::…"]` — a hard runtime
// refusal no remotePatterns entry can override, breaking real product
// imagery for real buyers. Direct URL render = zero proxy, zero SSRF
// surface (Law 4: the seller's real pixels, never a broken frame). Do NOT
// re-add remote hosts to the 'optimized' path.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_OBJECT_PATH = '/storage/v1/object/public/';
const SUPABASE_RENDER_PATH = '/storage/v1/render/image/public/';

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
  // Local/static assets (leading slash) belong to the default optimizer —
  // same-origin, never DNS-resolved, unaffected by the NAT64/SSRF guard.
  if (src.startsWith('/')) return 'optimized';
  if (src.startsWith('blob:') || src.startsWith('data:')) return 'unoptimized';
  // Supabase Storage object URLs → custom render-CDN loader (direct browser
  // fetch, proxy never involved). Already-transformed render URLs and any
  // other Supabase path fall through to 'unoptimized' below — no Supabase
  // URL can ever reach the /_next/image proxy.
  if (isSupabasePublicStorageUrl(src)) return 'supabase';
  // Every remote URL (fal.media, creatomate, legacy DALL-E blobs, unknown
  // hosts) renders direct — see the NAT64 decision in the header.
  return 'unoptimized';
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
