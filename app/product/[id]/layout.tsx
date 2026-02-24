import { createClient } from '@supabase/supabase-js';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: product } = await supabase
    .from('products')
    .select('*, shops(shop_name)')
    .eq('id', id)
    .single();

  // Bulletproof TypeScript Fix:
  const shopData: any = product?.shops;
  const shopName = (Array.isArray(shopData) ? shopData[0]?.shop_name : shopData?.shop_name) ?? 'Shop';
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