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
      `Hello ${resolvedShop.shop_name}! 👋

I want to buy ${product.name} for D${product.price}.
My payment method is: ${paymentMethod}.
${
  fulfillmentMethod === 'delivery'
    ? `Fulfillment: Delivery to ${deliveryAddress.trim()}.`
    : 'Fulfillment: Pickup/Meetup.'
}

Is this available?`
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
      `🔥 Check out this product on Sanndikaa:

*${product.name}* for D${product.price}

Tap the link to buy now:
${url}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  if (loading)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F8F6]">
        <ShoppingBag size={32} className="mb-4 animate-pulse text-[#2C3E2C]" />
        <p className="text-xs font-bold uppercase text-gray-500">Loading Product...</p>
      </div>
    );

  if (!product || !resolvedShop)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F6]">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-serif text-gray-800">Product Not Found</h1>
          <Link href="/" className="text-sm font-bold text-green-700 hover:underline">
            Back to Marketplace
          </Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#F9F8F6] pb-24 font-sans text-[#2C3E2C]">
      <nav className="p-6">
        <Link
          href={`/shop/${resolvedShop.shop_slug || ''}`}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase text-gray-500 hover:text-[#2C3E2C]"
        >
          <ArrowLeft size={16} /> Back
        </Link>
      </nav>

      <main className="mx-auto mt-4 grid max-w-4xl gap-8 px-4 md:grid-cols-2 md:gap-12 md:px-6">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm">
          {normalizedImageUrls.length > 0 ? (
            <div className="relative w-full overflow-hidden">
              <div className="flex w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                {normalizedImageUrls.map((url, index) => (
                  <div key={index} className="w-full flex-none snap-center relative aspect-square bg-gray-100">
                    <img
                      src={url}
                      alt={`Product image ${index + 1}`}
                      className="object-cover w-full h-full"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex aspect-square w-full items-center justify-center text-gray-300">
              <ShoppingBag size={48} />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center">
          <div className="mb-2">
            <span className="text-[10px] font-bold uppercase text-gray-400">{product.category || 'General'}</span>
          </div>
          <h1 className="mb-4 text-3xl font-semibold text-[#1a2e1a] md:text-5xl">{product.name}</h1>
          <p className="mb-6 text-3xl font-bold text-green-800">D{product.price}</p>

          <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="whitespace-pre-wrap text-sm text-gray-600">{product.description || 'No description provided.'}</p>
          </div>

          <div className="mb-8 border-t border-gray-100 pt-6">
            <Link href={`/shop/${resolvedShop.shop_slug}`} className="hover:opacity-70 transition-opacity cursor-pointer inline-block">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Sold By</p>
              <p className="text-base font-bold text-green-800 underline decoration-1 underline-offset-4">{resolvedShop.shop_name}</p>
            </Link>
          </div>

          {isProductActive ? (
            <>
              {(offersDelivery || offersPickup) && (
                <div className="mb-6 border-t border-gray-100 pt-6">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">How to Get Your Order</p>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {offersDelivery && (
                      <button
                        type="button"
                        onClick={() => setFulfillmentMethod('delivery')}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                          fulfillmentMethod === 'delivery'
                            ? `border-transparent ${activeColor.bg} text-white`
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Truck size={16} /> Delivery
                        </span>
                        {fulfillmentMethod === 'delivery' ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <span className="h-[18px] w-[18px] rounded-full border border-gray-300" />
                        )}
                      </button>
                    )}

                    {offersPickup && (
                      <button
                        type="button"
                        onClick={() => setFulfillmentMethod('pickup')}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                          fulfillmentMethod === 'pickup'
                            ? `border-transparent ${activeColor.bg} text-white`
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <MapPin size={16} /> Pickup
                        </span>
                        {fulfillmentMethod === 'pickup' ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <span className="h-[18px] w-[18px] rounded-full border border-gray-300" />
                        )}
                      </button>
                    )}
                  </div>

                  {fulfillmentMethod === 'delivery' && offersDelivery && (
                    <div className="mt-3 space-y-2">
                      <label htmlFor="delivery-address" className="text-xs font-bold uppercase tracking-wide text-gray-500">
                        Delivery Area / Address (Optional but recommended)
                      </label>
                      <textarea
                        id="delivery-address"
                        rows={3}
                        value={deliveryAddress}
                        onChange={(event) => setDeliveryAddress(event.target.value)}
                        placeholder="Senegambia, near the petrol station"
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-[#2C3E2C]"
                      />
                    </div>
                  )}

                  {fulfillmentMethod === 'pickup' && offersPickup && (
                    <div className="mt-3 rounded-xl bg-gray-100 p-4 text-sm text-gray-700">
                      {pickupInstructions || 'Pickup details will be shared by the seller after you place your order.'}
                    </div>
                  )}
                </div>
              )}

              <div className="mb-6 border-y border-gray-200 py-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Payment Method</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {PAYMENT_OPTIONS.map((option) => {
                    const selected = paymentMethod === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setPaymentMethod(option)}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                          selected
                            ? 'border-[#2C3E2C] bg-[#2C3E2C]/5 text-[#2C3E2C]'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span>{option}</span>
                        {selected ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <span className="h-[18px] w-[18px] rounded-full border border-gray-300" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleOrderClick}
                className={`flex w-full items-center justify-center gap-3 rounded-xl py-4 font-bold text-white shadow-xl transition-all hover:opacity-90 ${activeColor.bg}`}
              >
                <MessageCircle size={20} /> Order via WhatsApp
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled
              className="mb-6 flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl bg-gray-300 py-4 font-bold text-gray-600"
            >
              Sold Out
            </button>
          )}

          <button
            onClick={handleShareProduct}
            className="mt-3 flex w-full items-center justify-center gap-3 rounded-xl bg-gray-100 py-4 font-bold text-gray-800 transition-all hover:bg-gray-200"
          >
            <Share2 size={20} /> Share Product
          </button>
        </div>
      </main>
    </div>
  );
}
