import { createClient } from '@supabase/supabase-js';
import ProductClient from './ProductClient';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const rawId = String(id);
  const cleanId = rawId.replace(/[^a-zA-Z0-9-]/g, '');

  const { data: productData, error: productError } = await supabase
    .from('products')
    .select('*, shops (id, phone, shop_name, shop_slug, logo_url, offers_delivery, offers_pickup), stock_quantity')
    .eq('id', cleanId)
    .maybeSingle();

  if (productError) console.error('[product page] fetch error:', productError.message);

  return <ProductClient product={productData || null} />;
}