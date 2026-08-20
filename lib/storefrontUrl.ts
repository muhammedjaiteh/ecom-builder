import { WebsiteConfigSchema } from '@/lib/siteTemplates';
import { slugify } from '@/lib/slugify';

// ─────────────────────────────────────────────────────────────────────────────
// storefrontUrl — the ONE pure core behind "what is this seller's best public
// URL?", shared by the client hook (lib/useStorefrontUrl) and the server
// (marketing-link minting in /api/ai + /api/ai/campaign, OG metadata).
//
// Priority (mirrors the /site serve predicate EXACTLY — a /site link is
// minted only when requireSite would actually serve it to the public):
//   1. https://{custom_domain}   when domain_status === 'active'
//   2. /site/{canonicalSlug}     when status === 'published' AND the stored
//                                config passes WebsiteConfigSchema (the same
//                                safeParse requireSite runs) AND a canonical
//                                slug is available
//   3. /shop/{encodeURIComponent(rawSlug)}   the classic boutique fallback
//   4. null                      when not even a raw slug exists
//
// Pure and client-safe: no supabase import, no env read inside the resolver.
// ─────────────────────────────────────────────────────────────────────────────

/** The shop_websites columns the resolver reads — every website API row
 *  satisfies this structurally. */
export type StorefrontWebsiteFacts = {
  status?: string | null;
  config?: unknown;
  custom_domain?: string | null;
  domain_status?: string | null;
} | null | undefined;

export function resolveStorefrontPath(args: {
  /** shops.shop_slug exactly as stored (may be legacy: spaces/uppercase). */
  rawSlug: string | null | undefined;
  /** A slug that is safe to mint /site links with (lowercase-hyphenated).
   *  Client callers pass the verified canonical slug (useCanonicalShopSlug);
   *  server callers may pass slugify(rawSlug) — the /site route's verified
   *  legacy fallback resolves it to the same shop (Law 2 slug safety). */
  canonicalSlug: string | null | undefined;
  website: StorefrontWebsiteFacts;
}): string | null {
  const website = args.website ?? null;

  if (website?.custom_domain && website.domain_status === 'active') {
    return `https://${website.custom_domain}`;
  }

  if (
    website?.status === 'published' &&
    args.canonicalSlug &&
    WebsiteConfigSchema.safeParse(website.config).success
  ) {
    return `/site/${args.canonicalSlug}`;
  }

  if (args.rawSlug) {
    return `/shop/${encodeURIComponent(args.rawSlug)}`;
  }

  return null;
}

/** Platform origin for absolute link minting: PUBLIC_APP_URL ??
 *  NEXT_PUBLIC_APP_URL ?? the request host ?? the canonical production
 *  domain. Server callers pass headers().get('host'); on the client the env
 *  fallback chain resolves at build time (non-NEXT_PUBLIC vars are undefined
 *  there by design). Same env priority proxy.ts and /api/domains use. */
export function resolveAppOrigin(hostHeader?: string | null): string {
  for (const envUrl of [process.env.PUBLIC_APP_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    if (!envUrl) continue;
    try {
      return new URL(envUrl).origin;
    } catch {
      // Malformed env value — try the next source.
    }
  }
  if (hostHeader) {
    const host = hostHeader.trim();
    if (host) return host.startsWith('localhost') || host.startsWith('127.') ? `http://${host}` : `https://${host}`;
  }
  return 'https://sanndikaa.com';
}

/** Prefix the platform origin onto relative storefront paths for external
 *  shares (WhatsApp, marketing copy); absolute custom-domain URLs pass
 *  through untouched. */
export function toAbsoluteStorefrontUrl(url: string, origin?: string): string {
  return url.startsWith('http') ? url : `${origin ?? resolveAppOrigin()}${url}`;
}

/** Server-side one-shot: mint the ABSOLUTE marketing link for a shop from a
 *  service-role read of its website row. `websiteReader` keeps this module
 *  client-safe (no supabase import) — routes pass their admin client.
 *  Never throws: any read failure degrades to the /shop (or origin) link. */
export async function mintStorefrontLink(args: {
  shop: { id: string; shop_slug: string | null };
  origin: string;
  /** e.g. (shopId) => admin.from('shop_websites').select(...).eq('shop_id', shopId).maybeSingle() */
  readWebsite: (shopId: string) => PromiseLike<{ data: StorefrontWebsiteFacts }>;
}): Promise<string> {
  let website: StorefrontWebsiteFacts = null;
  try {
    website = (await args.readWebsite(args.shop.id)).data ?? null;
  } catch (err) {
    console.warn('[storefrontUrl] website read failed — falling back to /shop link:', err);
  }
  const path = resolveStorefrontPath({
    rawSlug: args.shop.shop_slug,
    canonicalSlug: slugify(args.shop.shop_slug) || null,
    website,
  });
  return path ? toAbsoluteStorefrontUrl(path, args.origin) : args.origin;
}
