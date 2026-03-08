'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { use, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Share2, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '../../context/CartContext';

type ShopInfo = {
  shop_name: string;
  shop_slug: string;
  theme_color: 'emerald' | 'midnight' | 'terracotta' | 'ocean' | 'rose' | null;
};

type Product = {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string | null;
  image_urls?: string[] | null;
  category: string;
  status?: string | null;
  shops: ShopInfo | ShopInfo[];
};

const themeColors = {
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600' },
  midnight: { bg: 'bg-slate-900', text: 'text-slate-900' },
  terracotta: { bg: 'bg-orange-700', text: 'text-orange-700' },
  ocean: { bg: 'bg-blue-600', text: 'text-blue-600' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-500' },
} as const;

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = use(params);

  // 🧠 TAP INTO THE CART BRAIN
  const { addToCart, cartCount } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchProduct() {
      const { data, error } = await supabase
        .from('products')
        .select(
          'id, name, price, description, image_url, image_urls, category, status, shops(shop_name, shop_slug, theme_color)'
        )
        .eq('id', productId)
        .single();

      if (error) {
        console.error('Error fetching product:', error);
      } else {
        setProduct(data as Product);
      }
      setLoading(false);
    }

    fetchProduct();
  }, [productId, supabase]);

  const shopData = product?.shops as ShopInfo | ShopInfo[] | null | undefined;
  const resolvedShop = useMemo(() => (Array.isArray(shopData) ? shopData[0] : shopData), [shopData]);

  const normalizedImageUrls = useMemo(() => {
    if (!product) return [];
    const galleryUrls = Array.isArray(product.image_urls)
      ? product.image_urls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
      : [];
    if (galleryUrls.length > 0) return galleryUrls;
    return product.image_url ? [product.image_url] : [];
  }, [product]);

  const themeColor = resolvedShop?.theme_color;
  const normalizedProductStatus = product?.status?.trim().toLowerCase();
  const isProductActive = normalizedProductStatus !== 'sold_out' && normalizedProductStatus !== 'inactive';
  const activeColor = themeColor ? themeColors[themeColor] || themeColors.emerald : themeColors.emerald;

  // 🛒 THE SAFE "ADD TO CART" LOGIC (NO WHATSAPP REDIRECT HERE!)
  const handleAddToCart = () => {
    if (!product || !resolvedShop || !isProductActive) return;

    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: normalizedImageUrls[0] || '',
      shop_id: resolvedShop.shop_slug || resolvedShop.shop_name,
      shop_name: resolvedShop.shop_name,
      quantity: 1,
    });

    alert(`🛒 ${product.name} has been added to your cart!`);
  };

  const handleShareProduct = () => {
    if (!product) return;
    const url = window.location.href;
    const message = encodeURIComponent(`🔥 Check out this product on Sanndikaa:\n\n*${product.name}* for D${product.price}\n\nTap the link to buy now:\n${url}`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <ShoppingBag size={32} className="mb-4 animate-pulse text-gray-400" />
    </div>
  );

  if (!product || !resolvedShop) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-800">Product Not Found</h1>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center font-sans text-gray-900">
      <div className="w-full max-w-md bg-white min-h-screen shadow-sm relative pb-32">
        
        <nav className="absolute top-4 left-4 z-10">
          <Link href={`/shop/${resolvedShop.shop_slug || ''}`} className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-800 shadow-sm backdrop-blur-md">
            <ArrowLeft size={16} /> Back
          </Link>
        </nav>

        <div className="relative w-full h-[450px] bg-gray-100">
          {normalizedImageUrls.length > 0 ? (
            <div className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide">
              {normalizedImageUrls.map((url, index) => (
                <div key={index} className="w-full h-full flex-none snap-center relative bg-gray-100">
                  <img src={url} alt="Product" className="object-cover w-full h-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex w-full h-full items-center justify-center text-gray-300"><ShoppingBag size={48} /></div>
          )}
        </div>

        <div className="p-6">
          <div className="mb-2"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{product.category || 'General'}</span></div>
          <div className="flex justify-between items-start mb-2">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{product.name}</h1>
            <p className={`text-xl font-extrabold ${activeColor.text} ml-4 shrink-0`}>D{product.price}</p>
          </div>
          
          <Link href={`/shop/${resolvedShop.shop_slug}`} className="inline-block hover:opacity-70">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Sold By</p>
            <p className={`text-sm font-bold ${activeColor.text} underline decoration-1 underline-offset-4`}>{resolvedShop.shop_name}</p>
          </Link>

          <hr className="my-6 border-gray-100" />

          <div className="mb-8">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Description</h3>
            <p className="text-gray-500 leading-relaxed text-sm whitespace-pre-wrap">{product.description || "A premium item."}</p>
          </div>

          <button onClick={handleShareProduct} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-50 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 hover:bg-gray-100">
            <Share2 size={16} /> Share Product
          </button>
        </div>

        <div className="fixed bottom-0 w-full max-w-md bg-white/90 backdrop-blur-md border-t border-gray-100 p-4 pb-6 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
          {isProductActive ? (
            <div className="flex gap-2 w-full">
              <button onClick={handleAddToCart} className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-4 font-bold text-white shadow-lg transition-all hover:opacity-90 ${activeColor.bg}`}>
                <ShoppingBag size={20} /> Add to Cart
              </button>
              
              {cartCount > 0 && (
                <Link href="/cart" className="flex items-center justify-center bg-gray-900 text-white px-6 rounded-xl font-bold shadow-lg hover:bg-black transition-colors">
                  Cart ({cartCount})
                </Link>
              )}
            </div>
          ) : (
            <button disabled className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-gray-200 py-4 font-bold text-gray-400">Sold Out</button>
          )}
        </div>

      </div>
    </div>
  );
}