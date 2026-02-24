import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';

type ProductLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ProductLayoutProps): Promise<Metadata> {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  );

  const { data: product } = await supabase
    .from('products')
    .select(
      `
      name,
      price,
      image_url,
      shops (
        shop_name
      )
    `
    )
    .eq('id', id)
    .single();

  const productName = product?.name ?? 'Product';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shopData: any = product?.shops;
  const shopName = (Array.isArray(shopData) ? shopData[0]?.shop_name : shopData?.shop_name) ?? 'Shop';
  const price = product?.price ?? 0;
  const description = `Order for D${price} on Sanndikaa`;

  return {
    title: `${productName} | ${shopName}`,
    description,
    openGraph: {
      title: `${productName} | ${shopName}`,
      description,
      images: product?.image_url ? [product.image_url] : [],
    },
  };
}

export default function ProductLayout({ children }: ProductLayoutProps) {
  return children;
}
