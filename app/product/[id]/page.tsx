'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { use, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, ShoppingBag, Plus, Minus } from 'lucide-react';
import Link from 'next/link';
// 🚀 1. Import the Global Memory Bank!
import { useCart } from '../../../components/CartProvider'; 

type ShopInfo = {
  id: string;
  shop_name: string;
  shop_slug: string;
  whatsapp_number: string | null;
  theme_color: string | null;
};

type ProductVariant = {
  variant_name: string;
  variant_value: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  colors: string[] | null;
  sizes: string[] | null;
  shops: ShopInfo | ShopInfo[];
  product_variants?: ProductVariant[] | null;
};

const themeColors: Record<string, { bg: string; text: string; border: string }> = {
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-600' },
  midnight: { bg: 'bg-slate-900', text: 'text-slate-900', border: 'border-slate-900' },
  terracotta: { bg: 'bg-orange-700', text: 'text-orange-700', border: 'border-orange-700' },
  ocean: { bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-600' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500' },
  champagne: { bg: 'bg-[#D7C0AE]', text: 'text-[#B89F8A]', border: 'border-[#D7C0AE]' },
  sage: { bg: 'bg-[#8A9A86]', text: 'text-[#6B7A68]', border: 'border-[#8A9A86]' },
  onyx: { bg: 'bg-[#1A1A1A]', text: 'text-[#1A1A1A]', border: 'border-[#1A1A1A]' },
  crimson: { bg: 'bg-[#8B0000]', text: 'text-[#8B0000]', border: 'border-[#8B0000]' },
  sand: { bg: 'bg-[#C2B280]', text: 'text-[#A39461]', border: 'border-[#C2B280]' },
  stone: { bg: 'bg-[#8B8C89]', text: 'text-[#6C6D6A]', border: 'border-[#8B8C89]' },
};

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = use(params);
  const { addToCart } = useCart(); // 🚀 2. Connect to the Cart

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchProduct() {
      const { data, error } = await supabase
        .from('products')
        .select(
          'id, name, price, description, image_url, image_urls, colors, sizes, shops(id, shop_name, shop_slug, whatsapp_number, theme_color), product_variants(variant_name, variant_value)'
        )
        .eq('id', productId)
        .single();

      if (error) {
        console.error('Error fetching product:', error);
      } else {
        const fetchedProduct = data as Product;
        setProduct(fetchedProduct);

        const availableColors = (() => {
          const dbColors = fetchedProduct.product_variants?.filter(v => v.variant_name.toLowerCase() === 'color').map(v => v.variant_value) || [];
          const legacyColors = Array.isArray(fetchedProduct.colors) ? fetchedProduct.colors : [];
          return [...dbColors, ...legacyColors].filter(c => typeof c === 'string' && c.trim().length > 0);
        })();

        const availableSizes = (() => {
          const dbSizes = fetchedProduct.product_variants?.filter(v => v.variant_name.toLowerCase() === 'size').map(v => v.variant_value) || [];
          const legacySizes = Array.isArray(fetchedProduct.sizes) ? fetchedProduct.sizes : [];
          return [...dbSizes, ...legacySizes].filter(s => typeof s === 'string' && s.trim().length > 0);
        })();

        setSelectedColor(availableColors.length > 0 ? availableColors[0] : null);
        setSelectedSize(availableSizes.length > 0 ? availableSizes[0] : null);
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

  const normalizedColors = useMemo(() => {
    if (!product) return [];
    const dbColors = product.product_variants?.filter(v => v.variant_name.toLowerCase() === 'color').map(v => v.variant_value) || [];
    const legacyColors = Array.isArray(product.colors) ? product.colors : [];
    const combined = [...dbColors, ...legacyColors].filter((c): c is string => typeof c === 'string' && c.trim().length > 0);
    return Array.from(new Set(combined)); 
  }, [product]);

  const normalizedSizes = useMemo(() => {
    if (!product) return [];
    const dbSizes = product.product_variants?.filter(v => v.variant_name.toLowerCase() === 'size').map(v => v.variant_value) || [];
    const legacySizes = Array.isArray(product.sizes) ? product.sizes : [];
    const combined = [...dbSizes, ...legacySizes].filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    return Array.from(new Set(combined)); 
  }, [product]);

  const themeColor = resolvedShop?.theme_color;
  const activeColor = themeColor ? themeColors[themeColor] || themeColors.emerald : themeColors.emerald;
  const currentImageIndex = Math.min(activeImageIndex, Math.max(normalizedImageUrls.length - 1, 0));

  const handleCarouselScroll = () => {
    const node = carouselRef.current;
    if (!node) return;
    const width = node.clientWidth || 1;
    const nextIndex = Math.round(node.scrollLeft / width);
    if (nextIndex !== activeImageIndex) {
      setActiveImageIndex(nextIndex);
    }
  };

  // 🚀 3. The New Add To Cart Logic
  const handleAddToBag = () => {
    if (!product || !resolvedShop) return;

    const variationDetails = [
      selectedColor ? `Color: ${selectedColor}` : null,
      selectedSize ? `Size: ${selectedSize}` : null,
    ].filter(Boolean).join(', ');

    // Create a unique ID so a Size 9 doesn't overwrite a Size 10
    const cartItemId = `${product.id}-${selectedColor || 'none'}-${selectedSize || 'none'}`;

    addToCart({
      id: cartItemId,
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: quantity,
      image_url: normalizedImageUrls[0] || '',
      shop_id: resolvedShop.id,
      shop_name: resolvedShop.shop_name,
      shop_whatsapp: resolvedShop.whatsapp_number || '',
      variant_details: variationDetails || 'None',
    });
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
      {/* HERO IMAGE CAROUSEL SECTION */}
      <section className="relative h-[450px] w-full bg-gray-200">
        {normalizedImageUrls.length > 0 ? (
          <div
            ref={carouselRef}
            onScroll={handleCarouselScroll}
            className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth scrollbar-hide"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {normalizedImageUrls.map((imageUrl, index) => (
              <img 
                key={`${imageUrl}-${index}`} 
                src={imageUrl} 
                alt={`${product.name} image ${index + 1}`} 
                className="min-w-full h-full flex-shrink-0 snap-center object-cover" 
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ShoppingBag className="h-14 w-14 text-gray-400" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />

        <Link
          href={`/shop/${resolvedShop.shop_slug || ''}`}
          className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#1a2e1a] shadow backdrop-blur hover:bg-white"
        >
          <ArrowLeft size={16} /> Back
        </Link>

        {normalizedImageUrls.length > 1 && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
            <div className="flex items-center gap-1.5 rounded-full bg-black/20 px-2 py-1 backdrop-blur-sm">
              {normalizedImageUrls.map((_, index) => {
                const isActive = index === currentImageIndex;
                return (
                  <span
                    key={`dot-${index}`}
                    className={`h-1.5 w-1.5 rounded-full transition ${isActive ? activeColor.bg : 'bg-white/60'}`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">{resolvedShop.shop_name}</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight md:text-4xl">{product.name}</h1>
          <p className="mt-3 text-3xl font-black text-gray-900">D{product.price}</p>
        </header>

        {product.description && (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {product.description}
            </p>
          </section>
        )}

        <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {normalizedColors.length > 0 && (
            <div>
              <label htmlFor="product-color" className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-gray-500">
                Select Color
              </label>
              <select
                id="product-color"
                value={selectedColor || ''}
                onChange={(event) => setSelectedColor(event.target.value || null)}
                className="w-full rounded-xl border border-gray-200 bg-transparent px-4 py-3 text-sm font-medium text-gray-700 outline-none transition focus:border-gray-400"
              >
                {normalizedColors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </div>
          )}

          {normalizedSizes.length > 0 && (
            <div>
              <label htmlFor="product-size" className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-gray-500">
                Select Size/Length
              </label>
              <select
                id="product-size"
                value={selectedSize || ''}
                onChange={(event) => setSelectedSize(event.target.value || null)}
                className="w-full rounded-xl border border-gray-200 bg-transparent px-4 py-3 text-sm font-medium text-gray-700 outline-none transition focus:border-gray-400"
              >
                {normalizedSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-gray-500">Quantity</p>
            <div className="inline-flex items-center rounded-xl border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                className="rounded-lg bg-white p-2 text-gray-700 shadow-sm transition hover:bg-gray-100"
              >
                <Minus size={16} />
              </button>
              <span className="min-w-12 px-4 text-center text-sm font-bold text-gray-900">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((current) => current + 1)}
                className="rounded-lg bg-white p-2 text-gray-700 shadow-sm transition hover:bg-gray-100"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={handleAddToBag}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition hover:opacity-95 ${activeColor.bg}`}
          >
            <ShoppingBag size={18} /> 
            Add to Bag — D{product.price * quantity}
          </button>
        </div>
      </div>
    </div>
  );
}