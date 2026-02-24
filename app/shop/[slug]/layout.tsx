import { createClient } from '@supabase/supabase-js';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('shop_slug', slug)
    .single();

  const shopName = shop?.shop_name ?? 'Shop';
  const bio = shop?.bio ?? `Welcome to ${shopName} on Sanndikaa`;
  
  const images = [];
  if (shop?.banner_url) images.push(shop.banner_url);
  else if (shop?.logo_url) images.push(shop.logo_url);

  return {
    title: `${shopName} on Sanndikaa`,
    description: bio,
    openGraph: {
      images: images,
    },
  };
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}