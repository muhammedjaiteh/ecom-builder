import { createClient } from '@supabase/supabase-js';
import { fetchMarketplaceProduct } from '@/lib/marketplaceProduct';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fix 4: the historical `shops(shop_name)` embed failed live with PGRST201
  // (two products→shops relationships), leaving every PDP with placeholder
  // metadata. The shared resolver reads the product alone and resolves the
  // seller via shop_id ?? user_id.
  const product = await fetchMarketplaceProduct(supabase, id);

  const shopName = product?.shops?.shop_name ?? 'Shop';
  const productName = product?.name ?? 'Product';
  const price = product?.price ?? 0;

  return {
    title: `${productName} | ${shopName}`,
    description: `Order for D${price} on Sanndikaa`,
    openGraph: {
      images: product?.image_url ? [product.image_url] : [],
    },
  };
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
