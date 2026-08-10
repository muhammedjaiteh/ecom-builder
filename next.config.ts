import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Exact, minimal allowlist for the default Vercel optimizer. Keep in
    // lockstep with OPTIMIZED_* in lib/imageLoader.ts (unknown hosts render
    // unoptimized there instead of 400ing into broken frames).
    remotePatterns: [
      // Supabase Storage (seller uploads: products, brand buckets) — the
      // custom supabaseImageLoader normally routes these straight to the
      // Supabase Pro render/image transformer, but the object path stays
      // allowlisted for any default-loader usage.
      {
        protocol: 'https',
        hostname: 'igorddajjfqwdqurnohp.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'igorddajjfqwdqurnohp.supabase.co',
        pathname: '/storage/v1/render/image/public/**',
      },
      // Fal AI assets (hero stills) — served from fal.media and versioned
      // subdomains (v2.fal.media, v3.fal.media).
      { protocol: 'https', hostname: 'fal.media' },
      { protocol: 'https', hostname: '*.fal.media' },
      // Creatomate renders — video_url/poster frames live on the CDN host
      // (render.url stored by the webhook + render-status routes).
      { protocol: 'https', hostname: 'creatomate.com' },
      { protocol: 'https', hostname: 'cdn.creatomate.com' },
    ],
  },
};

export default nextConfig;
