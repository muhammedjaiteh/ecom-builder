'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { use, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, MapPin, MessageCircle, Share2, ShoppingBag, Truck } from 'lucide-react';
import Link from 'next/link';
// IMPORTING OUR NEW CART BRAIN
import { useCart } from '../../context/CartContext';

type ShopInfo = {
  shop_name: string;
  shop_slug: string;
  phone: string | null;
  whatsapp_number: string | null;
  theme_color: 'emerald' | 'midnight' | 'terracotta' | 'ocean' | 'rose' | null;
  offers_delivery: boolean | null;
  offers_pickup: boolean | null;
  pickup_instructions: string | null;
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
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', ring: 'ring-emerald-600' },
  midnight: { bg: 'bg-slate-900', text: 'text-slate-900', ring: 'ring-slate-900' },
  terracotta: { bg: 'bg-orange-700', text: 'text-orange-700', ring: 'ring-orange-700' },
  ocean: { bg: 'bg-blue-600', text: 'text-blue-600', ring: 'ring-blue-600' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-500', ring: 'ring-rose-500' },
} as const;

const PAYMENT_OPTIONS = ['Cash on Delivery', 'Wave'] as const;

type FulfillmentMethod = 'delivery' | 'pickup';

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = use(params);

  // TAPPING INTO THE CART BRAIN
  const { addToCart, cartCount } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_OPTIONS)[number]>('Cash on Delivery');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchProduct() {
      const { data, error } = await supabase
        .from('products')
        .select(
          'id, name, price, description, image_url, image_urls, category, status, shops(shop_name, shop_slug, phone, whatsapp_number, theme_color, offers_delivery, offers_pickup, pickup_instructions)'
        )
        .eq('id', productId)
        .single();

      if (error) {
        console.error('Error fetching product:', error);
      } else {
        const resolvedShopData = Array.isArray(data?.shops) ? data.shops[0] : data?.shops;
        const defaultMethod: FulfillmentMethod = resolvedShopData?.offers_delivery ?? true ? 'delivery' : 'pickup';

        setProduct(data as Product);
        setFulfillmentMethod(defaultMethod);
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
  const offersDelivery = resolvedShop?.offers_delivery ?? true;
  const offersPickup = resolvedShop?.offers_pickup ?? true;
  const pickupInstructions = resolvedShop?.pickup_instructions?.trim() || '';
  const normalizedProductStatus = product?.status?.trim().toLowerCase();
  const isSoldOut = normalizedProductStatus === 'sold_out' || normalizedProductStatus === 'inactive';
  const isProductActive = !isSoldOut;

  const activeColor = themeColor ? themeColors[themeColor] || themeColors.emerald : themeColors.emerald;

  // NEW ADD TO CART LOGIC
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

    // Provide instant visual feedback
    alert(`🛒 ${product.name} has been added to your cart!`);
  };

  const handleShareProduct = () => {
    if (!product) return;
    const url = window.location.href;
    const message = encodeURIComponent(
      `🔥 Check out this product on Sanndikaa:\n\n*${product.name}* for D${product.price}\n\nTap the link to buy now:\n${url}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  if (loading)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <ShoppingBag size={32} className="mb-4 animate-pulse text-gray-400" />
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Loading Product...</p>
      </div>
    );

  if (!product || !resolvedShop)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-800">Product Not Found</h1>
          <Link href="/" className="text-sm font-bold text-gray-500 hover:text-gray-800 transition">
            Back to Marketplace
          </Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center font-sans text-gray-900">
      <div className="w-full max-w-md bg-white min-h-screen shadow-sm relative pb-32">
        
        <nav className="absolute top-4 left-4 z-10">
          <Link
            href={`/shop/${resolvedShop.shop_slug || ''}`}
            className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-800 shadow-sm backdrop-blur-md transition hover:bg-white"
          >
            <ArrowLeft size={16} /> Back to Shop
          </Link>
        </nav>

        <div className="relative w-full h-[450px] bg-gray-100">
          {normalizedImageUrls.length > 0 ? (
            <div className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide">
              {normalizedImageUrls.map((url, index) => (
                <div key={index} className="w-full h-full flex-none snap-center relative bg-gray-100">
                  <img
                    src={url}
                    alt={`Product image ${index + 1}`}
                    className="object-cover w-full h-full"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex w-full h-full items-center justify-center text-gray-300">
              <ShoppingBag size={48} />
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {product.category || 'General'}
            </span>
          </div>
          
          <div className="flex justify-between items-start mb-2">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              {product.name}
            </h1>
            <p className={`text-xl font-extrabold ${activeColor.text} ml-4 shrink-0`}>
              D{product.price}
            </p>
          </div>

          <Link href={`/shop/${resolvedShop.shop_slug}`} className="inline-block hover:opacity-70 transition-opacity">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Sold By</p>
            <p className={`text-sm font-bold ${activeColor.text} underline decoration-1 underline-offset-4`}>
              {resolvedShop.shop_name}
            </p>
          </Link>

          <hr className="my-6 border-gray-100" />

          <div className="mb-8">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
              Description
            </h3>
            <p className="text-gray-500 leading-relaxed text-sm whitespace-pre-wrap">
              {product.description || "A premium item from our exclusive collection."}
            </p>
          </div>

          <button
            onClick={handleShareProduct}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-50 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <Share2 size={16} /> Share Product
          </button>
        </div>

        {/* THE NEW DYNAMIC BOTTOM ACTION BAR */}
        <div className="fixed bottom-0 w-full max-w-md bg-white/90 backdrop-blur-md border-t border-gray-100 p-4 pb-6 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
          {isProductActive ? (
            <div className="flex gap-2 w-full">
              <button
                onClick={handleAddToCart}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-4 font-bold text-white shadow-lg transition-all hover:opacity-90 ${activeColor.bg}`}
              >
                <ShoppingBag size={20} /> Add to Cart
              </button>
              
              {/* This button magically appears if there is something in the cart! */}
              {cartCount > 0 && (
                <Link
                  href="/cart"
                  className="flex items-center justify-center bg-gray-900 text-white px-6 rounded-xl font-bold shadow-lg hover:bg-black transition-colors"
                >
                  Cart ({cartCount})
                </Link>
              )}
            </div>
          ) : (
            <button
              disabled
              className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-gray-200 py-4 font-bold text-gray-400"
            >
              Sold Out
            </button>
          )}
        </div>

      </div>
    </div>
  );
}