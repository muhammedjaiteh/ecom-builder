import type { SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Marketplace PDP data path (Final UX Polish, Fix 4) — ONE resolver shared by
// the server page, its generateMetadata, and the client fallback loader.
//
// ROOT CAUSE (live probe, 2026-08-26): the historical single query
//   .select('*, shops (…)').eq('id', id).maybeSingle()
// fails with PGRST201 — the live DB carries TWO products→shops relationships
// (products_shop_id_fkey on shop_id AND the out-of-repo products_shop_link on
// user_id), so PostgREST refuses the un-hinted `shops(…)` embed: "Could not
// embed because more than one relationship was found". The error was
// swallowed into `productData || null`, so EVERY marketplace PDP rendered the
// "Item Unavailable" terminal for products that exist and are publicly
// readable.
//
// THE FIX — no FK hints, no embed at all:
//   1. fetch the product row alone (products_public_read RLS: USING(true));
//   2. resolve the seller with the dual-column rule shop_id ?? user_id (the
//      exact siteData.ts resolution — shops are keyed on the owner's auth
//      id), via a second plain read.
// This works with or without provisioning.sql SECTION 10 (ghost shop_id-NULL
// rows resolve through user_id), survives any live FK topology, and a failed
// SHOP read degrades to a null shop (platform-fallback contact) instead of
// killing the page. Only a genuinely missing/unreadable PRODUCT returns null
// — the honest not-found state.
// ─────────────────────────────────────────────────────────────────────────────

export type MarketplaceProductShop = {
  id: string;
  phone: string | null;
  shop_name: string | null;
  shop_slug: string | null;
  logo_url: string | null;
  offers_delivery: boolean | null;
  offers_pickup: boolean | null;
};

/** The PDP's product shape: the fields the page renders/orders with, plus the
 *  resolved seller under the historical `shops` key so every existing call
 *  site keeps its contract. The select is `*` — extra columns ride along. */
export type MarketplaceProduct = {
  id: string;
  user_id: string | null;
  shop_id: string | null;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
  ad_video_url: string | null;
  ad_hero_image_url: string | null;
  stock_quantity: number | null;
  colors: string[] | null;
  sizes: string[] | null;
  shops: MarketplaceProductShop | null;
};

/** Same id hygiene as the /site PDP — strip everything non [A-Za-z0-9-]. */
export function sanitizeProductId(rawId: string): string {
  return String(rawId).replace(/[^a-zA-Z0-9-]/g, '');
}

export async function fetchMarketplaceProduct(
  supabase: SupabaseClient,
  rawId: string
): Promise<MarketplaceProduct | null> {
  const cleanId = sanitizeProductId(rawId);
  if (!cleanId) return null;

  // Step 1 — the product row alone. Only THIS failing yields the not-found
  // terminal; nothing downstream can poison it.
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', cleanId)
    .maybeSingle();
  if (productError) {
    console.error('[marketplace-pdp] product read failed:', productError.message);
    return null;
  }
  if (!product) return null;

  // Step 2 — dual-column seller resolution (shop_id ?? user_id). A shop read
  // failure degrades to null: the PDP renders with the platform's fallback
  // contact rather than declaring the item unavailable.
  const sellerId = (product.shop_id ?? product.user_id) as string | null;
  let shop: MarketplaceProductShop | null = null;
  if (sellerId) {
    const { data: shopRow, error: shopError } = await supabase
      .from('shops')
      .select('id, phone, shop_name, shop_slug, logo_url, offers_delivery, offers_pickup')
      .eq('id', sellerId)
      .maybeSingle();
    if (shopError) {
      console.error('[marketplace-pdp] shop read failed (degrading to null shop):', shopError.message);
    }
    shop = (shopRow as MarketplaceProductShop | null) ?? null;
  }

  return { ...(product as Omit<MarketplaceProduct, 'shops'>), shops: shop };
}
