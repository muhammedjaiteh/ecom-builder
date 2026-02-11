import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Metadata, ResolvingMetadata } from 'next';
import ProductClient from './ProductClient';

// 1. GENERATE METADATA (The "WhatsApp Preview" Engine) 🏷️
export async function generateMetadata(
  { params }: { params: { id: string } },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const supabase = createServerComponentClient({ cookies });
  const id = params.id;
  
  // Clean the ID just like before
  const cleanId = id.replace(/[^a-zA-Z0-9-]/g, '');

  // Fetch the product for SEO tags
  const { data: product } = await supabase
    .from('products')
    .select('name, price, description, image_url')
    .eq('id', cleanId)
    .single();

  // If no product found, return default tags
  if (!product) {
    return {
      title: 'Item Not Found | Sanndikaa',
    };
  }

  // Return the "Rich Card" data
  return {
    title: `${product.name} (D${product.price}) | Sanndikaa Marketplace`,
    description: product.description || 'Order directly via WhatsApp on The Gambia\'s Premium Marketplace.',
    openGraph: {
      title: `${product.name} - D${product.price}`,
      description: product.description,
      images: [product.image_url || '/placeholder.png'], // The big image!
    },
  };
}

// 2. THE PAGE COMPONENT (The Wrapper)
export default function ProductPage() {
  // We just render the Client Component (The one you already built)
  return <ProductClient />;
}