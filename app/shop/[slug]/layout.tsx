import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';

type ShopLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ShopLayoutProps): Promise<Metadata> {
  const { slug } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  );

  const { data: shop } = await supabase
    .from('shops')
    .select('shop_name, bio, banner_url, logo_url')
    .eq('shop_slug', slug)
    .single();

  const shopName = shop?.shop_name ?? 'Shop';
  const description = shop?.bio || 'Discover this shop on Sanndikaa.';
  const imageUrl = shop?.banner_url || shop?.logo_url;

  return {
    title: `${shopName} on Sanndikaa`,
    description,
    openGraph: {
      title: `${shopName} on Sanndikaa`,
      description,
      images: imageUrl ? [imageUrl] : [],
    },
  };
}

export default function ShopLayout({ children }: ShopLayoutProps) {
  return children;
}
