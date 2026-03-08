'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { use, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, MapPin, MessageCircle, Share2, ShoppingBag, Truck } from 'lucide-react';
import Link from 'next/link';

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

function sanitizeGambianPhoneNumber(rawNumber?: string | null) {
  if (!rawNumber) return null;

  const numericOnly = rawNumber.replace(/\D/g, '');
  if (!numericOnly) return null;

  return numericOnly;
}

function generateWhatsAppLink(number: string | null | undefined, message: string) {
  const cleanNumber = sanitizeGambianPhoneNumber(number);
  if (!cleanNumber) return null;

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = use(params);

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

  const handleOrderClick = async () => {
    if (!product || !resolvedShop || !isProductActive) return;

    if (fulfillmentMethod === 'delivery' && !deliveryAddress.trim()) {
      alert('Please enter your delivery area/address so the seller can fulfill your order.');
      return;
    }

    await supabase.from('leads').insert({ product_id: product.id, shop_id: resolvedShop.shop_name });

    const whatsappLink = generateWhatsAppLink(
      resolvedShop.whatsapp_number || resolvedShop.phone,
      `Hello ${resolvedShop.shop_name}! 👋\n\nI want to buy *${product.name}* for D${product.price}.\nMy payment method is: ${paymentMethod}.\n${
        fulfillmentMethod === 'delivery'
          ? `Fulfillment: Delivery to ${deliveryAddress.trim()}.`
          : 'Fulfillment: Pickup/Meetup.'
      }\n\nIs this available?`
    );

    if (!whatsappLink) {
      alert('This seller has not updated their WhatsApp number yet!');
      return;
    }

    window.location.href = whatsappLink;
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
      {/* Sleek Mobile-Optimized Container */}
      <div className="w-full max-w-md bg-white min-h-screen shadow-sm relative pb-32">
        
        {/* Floating Back Button */}
        <nav className="absolute top-4 left-4 z-10">
          <Link
            href={`/shop/${resolvedShop.shop_slug || ''}`}
            className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-800 shadow-sm backdrop-blur-md transition hover:bg-white"
          >
            <ArrowLeft size={16} /> Back to Shop
          </Link>
        </nav>

        {/* Massive Edge-to-Edge Image Section */}
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

        {/* Clean Content Section */}
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

          {/* Description */}
          <div className="mb-8">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
              Description
            </h3>
            <p className="text-gray-500 leading-relaxed text-sm whitespace-pre-wrap">
              {product.description || "A premium item from our exclusive collection."}
            </p>
          </div>

          {/* Elegant Fulfillment & Payment Toggles */}
          {isProductActive && (
            <div className="mb-4">
              {(offersDelivery || offersPickup) && (
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Order Details</h3>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {offersDelivery && (
                      <button
                        onClick={() => setFulfillmentMethod('delivery')}
                        className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold transition ${
                          fulfillmentMethod === 'delivery'
                            ? `border-transparent ${activeColor.bg} text-white`
                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <Truck size={14} /> Delivery
                      </button>
                    )}
                    {offersPickup && (
                      <button
                        onClick={() => setFulfillmentMethod('pickup')}
                        className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold transition ${
                          fulfillmentMethod === 'pickup'
                            ? `border-transparent ${activeColor.bg} text-white`
                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <MapPin size={14} /> Pickup
                      </button>
                    )}
                  </div>

                  {fulfillmentMethod === 'delivery' && offersDelivery && (
                    <textarea
                      value={deliveryAddress}
                      onChange={(event) => setDeliveryAddress(event.target.value)}
                      placeholder="Enter Delivery Area (e.g. Senegambia)"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-gray-400 mb-4"
                      rows={2}
                    />
                  )}
                  {fulfillmentMethod === 'pickup' && offersPickup && (
                    <div className="mb-4 rounded-xl bg-gray-50 p-4 text-xs text-gray-500 border border-gray-100">
                      {pickupInstructions || 'Pickup details will be shared by the seller on WhatsApp.'}
                    </div>
                  )}
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Payment</h3>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_OPTIONS.map((option) => {
                    const selected = paymentMethod === option;
                    return (
                      <button
                        key={option}
                        onClick={() => setPaymentMethod(option)}
                        className={`rounded-xl border py-3 text-xs font-bold transition ${
                          selected
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Share Button (moved out of the way of the sticky footer) */}
          <button
            onClick={handleShareProduct}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-50 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <Share2 size={16} /> Share Product
          </button>
        </div>

        {/* The Magic Sticky Bottom Button */}
        <div className="fixed bottom-0 w-full max-w-md bg-white/90 backdrop-blur-md border-t border-gray-100 p-4 pb-6 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
          {isProductActive ? (
            <button
              onClick={handleOrderClick}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold text-white shadow-lg transition-all hover:opacity-90 ${activeColor.bg}`}
            >
              <MessageCircle size={20} /> Order via WhatsApp
            </button>
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