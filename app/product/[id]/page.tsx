import { createClient } from '@supabase/supabase-js';
import type { Metadata, ResolvingMetadata } from 'next';
import ProductClient from './ProductClient';

// 1. GENERATE METADATA (The "WhatsApp Preview" Engine) 🏷️
export async function generateMetadata(
  props: { params: Promise<{ id: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  // In Next.js 15/16, params is a Promise we must await!
  const params = await props.params;
  const id = params.id;
  
  // 🟢 FIX: Use a basic Public Client instead of the Server Cookie Client
  // This bypasses the "Cookies.get is not a function" error completely.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Clean the ID
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
      images: [product.image_url || '/placeholder.png'],
    },
  };
}

// 2. THE PAGE COMPONENT
export default function ProductPage() {
  return <ProductClient />;
}