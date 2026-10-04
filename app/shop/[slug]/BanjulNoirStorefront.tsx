import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import BanjulNoirStorefrontUI, {
  type StorefrontMerchant,
  type StorefrontProduct,
} from '@/components/generator/matrix/BanjulNoirStorefront';
import { LUXURY_COLUMNS, selectWithOptionalColumns } from '@/lib/productColumns';
import { slugify } from '@/lib/slugify';

// ─────────────────────────────────────────────────────────────────────────────
// LUXURY DATA WRAPPER
// Translates raw Supabase rows into the strict UI contract for Banjul Noir.
// Called exclusively by the Apex Switchboard in app/shop/[slug]/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────

// --- Raw row types ---
type StoreRow = {
  id: string;
  shop_name: string | null;
  shop_slug: string | null;
  phone: string | null;
  bio: string | null;
  banner_url: string | null;
  logo_url: string | null;
  theme_matrix?: string | null;
};

const STORE_OPTIONAL_COLUMNS = ['theme_matrix'] as const;

type ProductRow = {
  id: string;
  name: string;
  price: number | string | null;
  description: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  ad_hero_image_url: string | null;
  category: string | null;
  stock_quantity: number | null;
  created_at: string | null;
  kicker?: string | null;
  extraction?: string | null;
  details?: string | null;
  eyebrow?: string | null;
};

const STORE_COLUMNS = 'id, shop_name, shop_slug, phone, bio, banner_url, logo_url';

const PRODUCT_BASE_COLUMNS =
  'id, name, price, description, image_url, image_urls, ad_hero_image_url, category, stock_quantity, created_at';

// --- Mapping helpers ---
function clean(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function toParagraphs(value: string | null | undefined): string[] {
  return clean(value)
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toBullets(value: string | null | undefined): string[] {
  return clean(value)
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);
}

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

async function fetchStore(rawSlug: string, cleanSlug: string): Promise<StoreRow | null> {
  const supabase = getSupabase();
  const candidates = rawSlug === cleanSlug ? [cleanSlug] : [cleanSlug, rawSlug];
  for (const candidate of candidates) {
    const { data, error } = await selectWithOptionalColumns<StoreRow>(
      STORE_COLUMNS,
      STORE_OPTIONAL_COLUMNS,
      (columns) => supabase.from('shops').select(columns).eq('shop_slug', candidate).maybeSingle(),
      's-storefront/shops',
    );
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
        .or(`shop_id.eq.${storeId},user_id.eq.${storeId}`)
        .order('created_at', { ascending: false }),
    's-storefront',
  );
  if (error) throw new Error(`[s-storefront] products read failed: ${error.message}`);
  return data ?? [];
}

// --- Component Wrapper ---

export default async function BanjulNoirStorefront({ slug }: { slug: string }) {
  const rawSlug = decodeSlugParam(slug);
  const cleanSlug = slugify(rawSlug);
  if (!cleanSlug) notFound();

  const store = await fetchStore(rawSlug, cleanSlug);
  if (!store) notFound();

  const rows = await fetchProducts(store.id);
  const merchant = toMerchant(store, cleanSlug);
  const products = rows.map(toProduct).filter((product) => product.image);

  return (
    <main className="min-h-screen bg-mall-forest">
      <BanjulNoirStorefrontUI merchant={merchant} products={products} />
    </main>
  );
}