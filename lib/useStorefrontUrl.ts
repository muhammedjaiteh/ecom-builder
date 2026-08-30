'use client';

// ─────────────────────────────────────────────────────────────────────────────
// useStorefrontUrl — ONE answer to "what is this seller's best public URL?"
// for every seller-facing 'view / share my shop' surface (dashboard View
// Shop, WhatsApp customer links). Client-side minting only — there is
// deliberately NO server-side /shop → /site bridge, so this can never create
// a redirect loop with /site's shop-fallback (siteData.ts requireSite).
//
// Priority (mirrors the /site serve predicate EXACTLY — a /site link is
// minted only when requireSite would actually serve it to the public):
//   1. https://{custom_domain}        when domain_status === 'active'
//   2. /site/{canonicalSlug}          when status === 'published' AND the
//                                     stored config passes WebsiteConfigSchema
//                                     (the same safeParse requireSite runs)
//                                     AND the slug is canonical
//                                     (useCanonicalShopSlug semantics — legacy
//                                     slugs are never minted into /site links)
//   3. /shop/{encodeURIComponent(rawSlug)}  the classic boutique fallback
//   4. null while the shop row (and its slug) hasn't loaded — callers render
//      disabled, never /shop/undefined.
//
// The website row rides GET /api/websites/content over SWR with the SAME key
// (websiteContentKey) and row contract the onboarding interceptor / themes
// page use — inside the dashboard's persisted per-user cache scope this is a
// pure dedupe (zero extra requests); elsewhere SWR's module-level dedupe
// keeps it to one cached fetch. The GET is tier-gated server-side (403 below
// Advanced), so the fetch only fires for qualifying tiers — locked tiers go
// straight to the /shop fallback without a doomed request.
// ─────────────────────────────────────────────────────────────────────────────

import useSWR from 'swr';
import { fetchJSON, isTransportError } from '@/lib/transport';
import { websiteContentKey } from '@/lib/swrCache';
import type { ShopWebsiteRow } from '@/lib/siteTemplates';
import { canUseStudio } from '@/lib/tiers';
import { resolveStorefrontPath, toAbsoluteStorefrontUrl as toAbsolute } from '@/lib/storefrontUrl';
import { useCanonicalShopSlug } from '@/lib/useCanonicalShopSlug';

// Tier gate: lib/tiers canUseStudio — the same predicate the content API
// enforces server-side, so the fetch only fires for qualifying tiers.

/** Minimal shops-row shape the hook needs — lib/types.ts Shop satisfies it. */
export type StorefrontShop = {
  id: string;
  shop_slug: string | null;
  subscription_tier?: string | null;
};

/** The content API returns the full DB row; custom_domain/domain_status are
 *  the SECTION 9 columns not yet on the ShopWebsiteRow type. */
type WebsiteRowWithDomain = ShopWebsiteRow & {
  custom_domain?: string | null;
  domain_status?: string | null;
};

// Identical contract to the interceptor/themes fetcher — same key, same
// row-or-null shape, so all consumers share one cache entry.
async function fetchWebsiteRow(): Promise<WebsiteRowWithDomain | null> {
  const data = await fetchJSON<{ website: WebsiteRowWithDomain | null }>('/api/websites/content');
  return data.website ?? null;
}

/** Prefixes the platform origin onto relative storefront paths for external
 *  shares (WhatsApp); absolute custom-domain URLs pass through untouched.
 *  Re-exported from the shared pure core (lib/storefrontUrl) so client and
 *  server mint identically. */
export function toAbsoluteStorefrontUrl(url: string): string {
  return toAbsolute(url);
}

export function useStorefrontUrl(shop: StorefrontShop | null | undefined): string | null {
  const tierQualifies = canUseStudio(shop?.subscription_tier);

  const { data: website } = useSWR<WebsiteRowWithDomain | null>(
    shop && tierQualifies ? websiteContentKey(shop.id) : null,
    fetchWebsiteRow,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      // A server verdict (403/5xx) won't change by hammering; connectivity
      // failures ride SWR's backoff (the interceptor's exact idiom).
      shouldRetryOnError: (err: unknown) => !(isTransportError(err) && err.kind === 'server'),
    }
  );

  const published = website?.status === 'published';

  // Law 2: /site links are minted ONLY from canonical slugs. The repair
  // round-trip is gated to the exact case where it matters — a published
  // site sitting on a legacy slug.
  const canonicalSlug = useCanonicalShopSlug(
    shop?.shop_slug ?? null,
    Boolean(shop) && tierQualifies && published
  );

  if (!shop) return null;

  // The pure shared core (lib/storefrontUrl) applies the full priority chain,
  // including the same WebsiteConfigSchema safeParse requireSite gates on.
  return resolveStorefrontPath({
    rawSlug: shop.shop_slug,
    canonicalSlug,
    website,
  });
}
