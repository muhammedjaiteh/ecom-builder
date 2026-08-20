import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { resolveAppOrigin } from '@/lib/storefrontUrl';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
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
  const description = shop?.bio ?? `Welcome to ${shopName} on Sanndikaa`;

  // Flag sweep: PUBLIC_APP_URL ?? the request host — never a hardcoded
  // deployment domain. The slug is re-encoded (legacy slugs carry spaces).
  const origin = resolveAppOrigin((await headers()).get('host'));
  const shopUrl = `${origin}/shop/${encodeURIComponent(slug)}`;

  const images = [];
  if (shop?.banner_url) images.push(shop.banner_url);
  else if (shop?.logo_url) images.push(shop.logo_url);

  return {
    title: `${shopName} on Sanndikaa`,
    description: description,
    openGraph: {
      title: shopName,
      description: description,
      url: shopUrl,
      type: "website",
      images: images.map((url) => ({
        url,
        width: 1200,
        height: 630,
        alt: shopName,
      })),
      siteName: 'Sanndikaa',
    },
    twitter: {
      card: 'summary_large_image',
      title: shopName,
      description: description,
      images: images,
    },
  };
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}