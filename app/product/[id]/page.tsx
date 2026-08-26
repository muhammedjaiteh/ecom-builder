import { createClient } from '@supabase/supabase-js';
import { fetchMarketplaceProduct } from '@/lib/marketplaceProduct';
import ProductClient from './ProductClient';

// Fix 4: the historical `.select('*, shops (…)')` embed failed live with
// PGRST201 (two products→shops relationships in the DB) and its swallowed
// error rendered EVERY marketplace PDP as "Item Unavailable". The shared
// resolver fetches the product alone, then resolves the seller through the
// dual-column rule (shop_id ?? user_id) — see lib/marketplaceProduct.ts.
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const product = await fetchMarketplaceProduct(supabase, id);

  return <ProductClient product={product ?? undefined} />;
}
