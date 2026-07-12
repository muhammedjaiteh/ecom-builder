import type { SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Canonical URL slugifier — the single source of truth for every site/store
// slug the platform produces (Law 2: safe URL slugs, lowercase + hyphenated).
// Consumed by:
//   - app/api/ai/generate-website/route.ts  (write-repair before save/return)
//   - app/api/websites/publish/route.ts     (write-repair on publish)
//   - app/api/admin/shops/route.ts          (normalize admin slug edits)
//   - components/website/WebsiteGeneratorStudio.tsx (defensive link minting)
//   - app/site/[slug]/page.tsx              (inbound param normalization)
// ─────────────────────────────────────────────────────────────────────────────

/** "Jambaba Boutique09!" → "jambaba-boutique09". Symbols collapse to single hyphens. */
export function slugify(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Slugify with a deterministic fallback: a name made only of symbols must never
 * yield an empty slug. The fallback derives from the shop/user id — stable
 * across calls, no randomness.
 */
export function slugifyWithFallback(value: string | null | undefined, fallbackId: string): string {
  const slug = slugify(value);
  if (slug) return slug;
  const idPart = slugify(fallbackId).replace(/-/g, '').slice(0, 8) || 'boutique';
  return `shop-${idPart}`;
}

/**
 * Write-repair a shop's slug to its canonical slugified form (service-role
 * client required). Legacy rows can contain spaces/uppercase — minted by the
 * signup-side DB trigger from the raw boutique name — which makes /site links
 * unroutable. Called whenever the seller generates or publishes a website.
 *
 * Returns the canonical slug the caller should mint links with. On a
 * unique-constraint collision it retries once with a deterministic id-derived
 * suffix. If the DB write fails outright we still return the canonical slug:
 * the /site lookup resolves legacy un-repaired rows via a verified fallback
 * match, so the minted link never 404s.
 */
export async function repairShopSlug(
  admin: SupabaseClient,
  shop: { id: string; shop_name?: string | null; shop_slug?: string | null }
): Promise<string> {
  const canonical = slugifyWithFallback(shop.shop_slug || shop.shop_name, shop.id);
  if (shop.shop_slug === canonical) return canonical;

  const { error } = await admin
    .from('shops')
    .update({ shop_slug: canonical })
    .eq('id', shop.id);
  if (!error) {
    console.log(`[slugify] Repaired shop ${shop.id} slug: "${shop.shop_slug ?? ''}" → "${canonical}"`);
    return canonical;
  }

  // Likely a unique collision with another shop — deterministic suffix, no randomness.
  const suffix = slugify(shop.id).replace(/-/g, '').slice(0, 6) || '0';
  const suffixed = `${canonical}-${suffix}`;
  const { error: retryError } = await admin
    .from('shops')
    .update({ shop_slug: suffixed })
    .eq('id', shop.id);
  if (!retryError) {
    console.log(`[slugify] Repaired shop ${shop.id} slug with suffix: "${suffixed}"`);
    return suffixed;
  }

  console.error(`[slugify] shop_slug write-repair failed for shop ${shop.id}:`, retryError);
  return canonical;
}
