// ─────────────────────────────────────────────────────────────────────────────
// productMedia — dependency-free product image helpers shared by the /site
// chromes AND the marketplace client bundle. Kept out of lib/siteTemplates on
// purpose: that module carries the zod website schemas, and the mall's client
// component must not pay for them just to pick a second photo.
// ─────────────────────────────────────────────────────────────────────────────

/** The loosest shape both SiteProduct and the marketplace Product satisfy. */
export type ProductMediaLike = {
  image_url?: string | null;
  image_urls?: string[] | null;
  ad_hero_image_url?: string | null;
};

/**
 * The DISTINCT second photo for a card cross-fade, else null — null means the
 * card renders exactly ONE image layer and mounts no client island. The
 * primary is whatever the card actually paints first (Ad Studio hero still
 * when present, else the product photo); the alt is the first gallery URL
 * that differs from it. Rows read without image_urls resolve to null.
 */
export function secondaryProductImage(p: ProductMediaLike): string | null {
  const primary = p.ad_hero_image_url ?? p.image_url ?? null;
  for (const url of p.image_urls ?? []) {
    if (url && url !== primary) return url;
  }
  return null;
}
