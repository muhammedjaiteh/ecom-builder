import type { NextConfig } from "next";

// Platform support WhatsApp. Mirrors SUPPORT_WHATSAPP in lib/tiers.ts —
// duplicated here on purpose: next.config is evaluated by the Next CLI
// outside the app's `@/` alias / bundler, so it must not import app code.
// Keep both in lockstep.
const SUPPORT_WHATSAPP_URL = 'https://wa.me/447599710468';

const nextConfig: NextConfig = {
  // Footer routes that never got a page. Meta / TikTok ad-account reviewers
  // crawl every footer link, and a 404 is a policy strike, so each one 308s
  // to a real destination: "Contact Us" / "Help Center" go straight to the
  // WhatsApp line that IS our support desk; "How Ordering Works" goes home
  // to the marketplace (the storefront itself is the explainer). Redirects
  // run before proxy.ts, so tenant custom domains are covered identically.
  async redirects() {
    return [
      { source: '/contact', destination: SUPPORT_WHATSAPP_URL, permanent: true },
      { source: '/support', destination: SUPPORT_WHATSAPP_URL, permanent: true },
      { source: '/support/how-ordering-works', destination: '/', permanent: true },
    ];
  },
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
      // subdomains. The wildcard covers the family; the explicit v2/v3/v3b
      // entries pin the hosts observed in production data. NOTE: prod logged
      // "upstream image https://v3b.fal.media/... resolved to private ip" —
      // that is the optimizer's SSRF DNS guard, not pattern matching, so
      // SmartImage additionally degrades a failed optimizer request to a
      // direct render. DURABLE FIX (follow-up): rehost fal-hosted assets to
      // Supabase Storage at creation time, exactly like lib/siteAssets.ts —
      // app/api/ai/generate-still (video_ads.hero_image_url) still stores
      // raw fal URLs that add-ad-video then copies to
      // products.ad_hero_image_url.
      { protocol: 'https', hostname: 'fal.media', pathname: '/**' },
      { protocol: 'https', hostname: '*.fal.media', pathname: '/**' },
      { protocol: 'https', hostname: 'v2.fal.media', pathname: '/**' },
      { protocol: 'https', hostname: 'v3.fal.media', pathname: '/**' },
      { protocol: 'https', hostname: 'v3b.fal.media', pathname: '/**' },
      // DALL-E era transient URLs (legacy rows only — the logo pipeline now
      // receives b64 bytes and rehosts to the 'brand' bucket immediately).
      {
        protocol: 'https',
        hostname: 'oaidalleapiprodscus.blob.core.windows.net',
        pathname: '/**',
      },
      // Creatomate renders — video_url/poster frames live on the CDN host
      // (render.url stored by the webhook + render-status routes).
      { protocol: 'https', hostname: 'creatomate.com' },
      { protocol: 'https', hostname: 'cdn.creatomate.com' },
    ],
  },
};

export default nextConfig;
