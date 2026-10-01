import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import BanjulNoirStorefront, {
  type StorefrontMerchant,
  type StorefrontProduct,
} from '@/components/generator/matrix/BanjulNoirStorefront';
import { selectWithOptionalColumns } from '@/lib/productColumns';
import { slugify } from '@/lib/slugify';

// ─────────────────────────────────────────────────────────────────────────────
// /s/[slug] — Server Component adapter for the Banjul Noir storefront matrix.
//
// The component is data-blind: it receives a `merchant` and a `products` array
// and renders nothing it was not handed. This file is the ONLY place raw
// Supabase rows are translated into that contract.
//
// Schema note: the live tables are `shops` (shop_slug / shop_name / phone) and
// `products` (price, stock_quantity, …). The previous version of this page read
// a `stores` table and a `price_d` column that no longer exist (see the header
// of app/dashboard/products/page.tsx), so it could never resolve a shop.
//
// The four luxury merchandising columns (kicker, extraction, details, eyebrow)
// ship in supabase/migrations/20261001000000_add_luxury_fields_to_products.sql.
// They are read as OPTIONAL columns: until the migration has run, the select
// degrades to the base column list (PostgreSQL 42703 → retry without them)
// instead of rendering an empty storefront — Gambia Standard §3.
// ─────────────────────────────────────────────────────────────────────────────

// --- Raw row types ---
type StoreRow = {
  id: string;
  shop_name: string | null;
  shop_slug: string | null;
  /** WhatsApp number as stored by the seller. Sanitised by the component at link-build time. */
  phone: string | null;
  bio: string | null;
  banner_url: string | null;
  logo_url: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  price: number | string | null;
  description: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  ad_hero_image_url: string | null;
  category: string | null;
  /** NULL = untracked inventory (always purchasable); 0 = sold out. */
  stock_quantity: number | null;
  created_at: string | null;
  // Luxury merchandising fields — optional until the migration has run.
  kicker?: string | null;
  extraction?: string | null;
  details?: string | null;
  eyebrow?: string | null;
};

const STORE_COLUMNS = 'id, shop_name, shop_slug, phone, bio, banner_url, logo_url';

const PRODUCT_BASE_COLUMNS =
  'id, name, price, description, image_url, image_urls, ad_hero_image_url, category, stock_quantity, created_at';

const LUXURY_COLUMNS = ['kicker', 'extraction', 'details', 'eyebrow'] as const;

// --- Mapping helpers ---

/** Trim, drop empties. */
function clean(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** One paragraph per line break. Rendered in full by the component — never an accordion. */
function toParagraphs(value: string | null | undefined): string[] {
  return clean(value)
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** One spec bullet per line or pipe ("Hand-filled in Banjul | Glass vial, brass cap"). */
function toBullets(value: string | null | undefined): string[] {
  return clean(value)
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Primary product photo first, then gallery, then the Ad Studio hero still. */
function pickImage(row: ProductRow): string {
  return (
    clean(row.image_url) ||
    clean(row.image_urls?.find((url) => clean(url))) ||
    clean(row.ad_hero_image_url)
  );
}

function toMerchant(store: StoreRow, fallbackSlug: string): StorefrontMerchant {
  const name = clean(store.shop_name) || fallbackSlug;
  const subtitle = clean(store.bio);
  const backgroundImage = clean(store.banner_url);
  return {
    name,
    whatsappNumber: clean(store.phone),
    hero: {
      title: name,
      // Omitted fields fall back to the component's defaults.
      ...(subtitle ? { subtitle } : {}),
      ...(backgroundImage ? { backgroundImage } : {}),
    },
  };
}

function toProduct(row: ProductRow): StorefrontProduct {
  const price = Number(row.price);
  return {
    id: row.id,
    name: clean(row.name),
    kicker: clean(row.kicker) || clean(row.eyebrow) || clean(row.category),
    extraction: clean(row.extraction),
    price: Number.isFinite(price) && price > 0 ? Math.round(price) : 0,
    image: pickImage(row),
    inStock: row.stock_quantity === null || row.stock_quantity === undefined || row.stock_quantity > 0,
    // Review aggregation is not wired on this surface yet; 0 suppresses the ratings UI.
    reviewCount: 0,
    rating: 0,
    description: toParagraphs(row.description),
    details: toBullets(row.details),
  };
}

// --- Data access ---

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function decodeSlugParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Canonical slug first; then the raw param for legacy rows minted by the
 * signup trigger before slugs were normalised. THROWS on query errors so an
 * outage renders as an error, never as a 404.
 */
async function fetchStore(rawSlug: string, cleanSlug: string): Promise<StoreRow | null> {
  const supabase = getSupabase();
  const candidates = rawSlug === cleanSlug ? [cleanSlug] : [cleanSlug, rawSlug];
  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from('shops')
      .select(STORE_COLUMNS)
      .eq('shop_slug', candidate)
      .maybeSingle();
    if (error) throw new Error(`[s-storefront] shop read failed: ${error.message}`);
    if (data) return data as StoreRow;
  }
  return null;
}

async function fetchProducts(storeId: string): Promise<ProductRow[]> {
  const { data, error } = await selectWithOptionalColumns<ProductRow[]>(
    PRODUCT_BASE_COLUMNS,
    LUXURY_COLUMNS,
    (columns) =>
      getSupabase()
        .from('products')
        .select(columns)
        // Dual-column ownership: legacy rows carry only user_id (see sql/provisioning.sql).
        .or(`shop_id.eq.${storeId},user_id.eq.${storeId}`)
        .order('created_at', { ascending: false }),
    's-storefront',
  );
  if (error) throw new Error(`[s-storefront] products read failed: ${error.message}`);
  return data ?? [];
}

// --- Page ---

export default async function StorePublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rawSlug = decodeSlugParam(slug);
  const cleanSlug = slugify(rawSlug);
  if (!cleanSlug) notFound();

  const store = await fetchStore(rawSlug, cleanSlug);
  if (!store) notFound();

  const rows = await fetchProducts(store.id);

  const merchant = toMerchant(store, cleanSlug);
  // The matrix frames every piece as a 4:5 editorial image; a row with no
  // image at all has nothing to frame and is withheld from the storefront.
  const products = rows.map(toProduct).filter((product) => product.image);

  return (
    <main className="min-h-screen bg-mall-forest">
      <BanjulNoirStorefront merchant={merchant} products={products} />
    </main>
  );
}
