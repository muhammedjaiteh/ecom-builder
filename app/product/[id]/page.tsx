'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { use, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, MapPin, MessageCircle, ShoppingBag, Truck } from 'lucide-react';
import Link from 'next/link';

type ThemeColor = 'emerald' | 'midnight' | 'terracotta' | 'ocean' | 'rose';

type ShopInfo = {
  shop_name: string;
  shop_slug: string;
  whatsapp_number: string | null;
  theme_color: ThemeColor | null;
};

type Product = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
  image_urls: string[] | null;

  shops: ShopInfo | ShopInfo[];
};

type FulfillmentMethod = 'delivery' | 'pickup';

const PAYMENT_OPTIONS = ['Cash on Delivery', 'Wave'] as const;

const themeColors: Record<ThemeColor, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600' },
  midnight: { bg: 'bg-slate-900', text: 'text-slate-900' },
  terracotta: { bg: 'bg-orange-700', text: 'text-orange-700' },
  ocean: { bg: 'bg-blue-600', text: 'text-blue-600' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-500' },
};

function sanitizePhoneNumber(rawNumber?: string | null) {
  if (!rawNumber) return null;

  const cleanNumber = rawNumber.replace(/\D/g, '');
  if (!cleanNumber) return null;

  return cleanNumber;
}

function generateWhatsAppLink(number: string | null | undefined, message: string) {
  const cleanNumber = sanitizePhoneNumber(number);
  if (!cleanNumber) return null;

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = use(params);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_OPTIONS)[number]>('Cash on Delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchProduct() {
      const { data, error } = await supabase
        .from('products')

        .eq('id', productId)
        .single();

      if (error) {
        console.error('Error fetching product:', error);
      } else {

      }

      setLoading(false);
    }

    fetchProduct();
  }, [productId, supabase]);

  const resolvedShop = useMemo(() => {
    const shopData = product?.shops;
    return Array.isArray(shopData) ? shopData[0] : shopData;
  }, [product?.shops]);

  const normalizedImageUrls = useMemo(() => {
    if (!product) return [];

    const galleryUrls = Array.isArray(product.image_urls)
      ? product.image_urls.filter((img): img is string => typeof img === 'string' && img.trim().length > 0)
      : [];

    const singleImage = product.image_url && product.image_url.trim().length > 0 ? [product.image_url] : [];

    return [...galleryUrls, ...singleImage];
  }, [product]);


  const themeColor = resolvedShop?.theme_color;
  const activeColor = themeColor ? themeColors[themeColor] || themeColors.emerald : themeColors.emerald;

  const handleOrderClick = () => {
    if (!product || !resolvedShop) return;

    if (fulfillmentMethod === 'delivery' && !deliveryAddress.trim()) {
      alert('Please provide a delivery address to continue.');
      return;
    }


      fulfillmentMethod === 'delivery' ? `Delivery to ${deliveryAddress.trim()}` : 'Pickup'
    }\n\nIs this item available?`;

    const whatsappLink = generateWhatsAppLink(resolvedShop.whatsapp_number, message);
    if (!whatsappLink) {
      alert('This seller has not set up a valid WhatsApp number yet.');
      return;
    }

    window.location.href = whatsappLink;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6] text-[#1a2e1a]">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading product...
        </div>
      </div>
    );
  }

  if (!product || !resolvedShop) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6] p-6">
        <div className="text-center">
          <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-gray-400" />
          <h1 className="mb-2 text-2xl font-bold text-[#1a2e1a]">Product Not Found</h1>
          <Link href="/" className="text-sm font-semibold text-green-700 hover:underline">
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F8F6] pb-28 text-[#1a2e1a]">
      <section className="relative h-[450px] w-full overflow-hidden bg-gray-200">
        {normalizedImageUrls.length > 0 ? (
          <img src={normalizedImageUrls[0]} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ShoppingBag className="h-14 w-14 text-gray-400" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />

        <Link
          href={`/shop/${resolvedShop.shop_slug || ''}`}
          className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#1a2e1a] shadow backdrop-blur hover:bg-white"
        >
          <ArrowLeft size={16} /> Back
        </Link>
      </section>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">{resolvedShop.shop_name}</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight md:text-4xl">{product.name}</h1>
          <p className={`mt-3 text-3xl font-black ${activeColor.text}`}>D{product.price}</p>
        </header>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {product.description || 'No description provided for this product.'}
          </p>
        </section>

        <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={handleOrderClick}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition hover:opacity-95 ${activeColor.bg}`}
          >
            <MessageCircle size={18} /> Order via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
