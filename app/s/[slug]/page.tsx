import { createClient } from "@supabase/supabase-js";
import OrderButton from "./OrderButton";
import { notFound } from "next/navigation";

// --- Types ---
type StoreRow = {
  id: string;
  name: string;
  slug: string;
  whatsapp_number: string | null;
  theme_color: string | null;
};

type ProductRow = {
  id: string;
  store_id: string;
  name: string;
  price_d: number | null;
  image_url: string | null; // We now use this
  category: string | null;
};

export default async function StorePublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. Fetch Store
  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!store) {
    return <div className="p-10 text-center">Store not found</div>;
  }

  // 2. Fetch Products
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", store.id);

  return (
    <main className="max-w-md mx-auto p-4 bg-white min-h-screen font-sans">
      <header className="py-8 text-center border-b mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-tight">{store.name}</h1>
      </header>

      <div className="space-y-8">
        {products?.map((product: ProductRow) => (
          <div key={product.id} className="border-b pb-6 last:border-0">
            {/* DISPLAY IMAGE IF IT EXISTS */}
            {product.image_url && (
              <div className="mb-4 rounded-lg overflow-hidden h-48 w-full relative">
                <img 
                  src={product.image_url} 
                  alt={product.name} 
                  className="object-cover w-full h-full"
                />
              </div>
            )}

            <h2 className="text-lg font-semibold text-gray-900">{product.name}</h2>
            <p className="text-xl text-green-700 font-bold mb-4">
              D{product.price_d?.toLocaleString()}
            </p>

            <OrderButton 
              product={product} 
              storeId={store.id} 
              storePhone={store.whatsapp_number} 
            />
          </div>
        ))}
      </div>
    </main>
  );
}