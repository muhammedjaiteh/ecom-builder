'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { use, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, ShoppingBag, Plus, Minus, Check, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
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

// The Brand Colors for the checkout button
const themeColors: Record<string, { bg: string; text: string; border: string }> = {
  emerald: { bg: 'bg-[#1a2e1a]', text: 'text-[#1a2e1a]', border: 'border-[#1a2e1a]' },
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
  const { addToCart } = useCart(); 

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
        .select('id, name, price, description, image_url, image_urls, colors, sizes, shops(id, shop_name, shop_slug, whatsapp_number, theme_color), product_variants(variant_name, variant_value)')
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

        if (availableColors.length > 0) setSelectedColor(availableColors[0]);
        if (availableSizes.length > 0) setSelectedSize(availableSizes[0]);
      }
      setLoading(false);
    }
    fetchProduct();
  }, [productId, supabase]);

  const resolvedShop = useMemo(() => Array.isArray(product?.shops) ? product?.shops[0] : product?.shops, [product?.shops]);

  const normalizedImageUrls = useMemo(() => {
    if (!product) return [];
    const galleryUrls = Array.isArray(product.image_urls) ? product.image_urls.filter((img): img is string => typeof img === 'string' && img.trim().length > 0) : [];
    const singleImage = product.image_url && product.image_url.trim().length > 0 ? [product.image_url] : [];
    return [...galleryUrls, ...singleImage];
  }, [product]);

  const normalizedColors = useMemo(() => {
    if (!product) return [];
    const dbColors = product.product_variants?.filter(v => v.variant_name.toLowerCase() === 'color').map(v => v.variant_value) || [];
    const legacyColors = Array.isArray(product.colors) ? product.colors : [];
    return Array.from(new Set([...dbColors, ...legacyColors].filter((c): c is string => typeof c === 'string' && c.trim().length > 0))); 
  }, [product]);

  const normalizedSizes = useMemo(() => {
    if (!product) return [];
    const dbSizes = product.product_variants?.filter(v => v.variant_name.toLowerCase() === 'size').map(v => v.variant_value) || [];
    const legacySizes = Array.isArray(product.sizes) ? product.sizes : [];
    return Array.from(new Set([...dbSizes, ...legacySizes].filter((s): s is string => typeof s === 'string' && s.trim().length > 0))); 
  }, [product]);

  const themeColor = resolvedShop?.theme_color;
  const activeColor = themeColor ? themeColors[themeColor] || themeColors.emerald : themeColors.emerald;
  const currentImageIndex = Math.min(activeImageIndex, Math.max(normalizedImageUrls.length - 1, 0));

  const handleCarouselScroll = () => {
    const node = carouselRef.current;
    if (!node) return;
    const width = node.clientWidth || 1;
    const nextIndex = Math.round(node.scrollLeft / width);
    if (nextIndex !== activeImageIndex) setActiveImageIndex(nextIndex);
  };

  const handleAddToBag = () => {
    if (!product || !resolvedShop) return;
    const variationDetails = [selectedColor ? `Color: ${selectedColor}` : null, selectedSize ? `Size: ${selectedSize}` : null].filter(Boolean).join(', ');
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

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6] text-[#1a2e1a]"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!product || !resolvedShop) return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]"><p className="text-xl font-bold">Product Not Found</p></div>;

  return (
    <div className="min-h-screen bg-white pb-32 font-sans text-gray-900 selection:bg-gray-900 selection:text-white md:bg-[#F9F8F6]">
      
      {/* 🚀 1. EDITORIAL CAROUSEL SECTION */}
      <section className="relative aspect-[4/5] w-full bg-gray-100 md:aspect-auto md:h-[600px] md:rounded-b-3xl md:overflow-hidden">
        {normalizedImageUrls.length > 0 ? (
          <div ref={carouselRef} onScroll={handleCarouselScroll} className="hide-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth">
            {normalizedImageUrls.map((imageUrl, index) => (
              <img key={`${imageUrl}-${index}`} src={imageUrl} alt={`${product.name} image ${index + 1}`} className="min-w-full h-full flex-shrink-0 snap-center object-cover" />
            ))}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300"><ShoppingBag className="h-16 w-16" /></div>
        )}

        {/* Minimal Nav Gradient & Back Button */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 to-transparent" />
        <Link href={`/shop/${resolvedShop.shop_slug || ''}`} className="absolute left-4 top-5 md:top-8 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white hover:text-gray-900">
          <ChevronLeft size={24} />
        </Link>

        {/* Image Indicators */}
        {normalizedImageUrls.length > 1 && (
          <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-md">
              {normalizedImageUrls.map((_, index) => (
                <span key={`dot-${index}`} className={`h-1.5 rounded-full transition-all duration-300 ${index === currentImageIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 🚀 2. PRODUCT DETAILS SECTION */}
      <main className="mx-auto max-w-2xl px-5 py-8 md:px-8 md:py-12 md:bg-white md:-mt-10 md:relative md:z-10 md:rounded-3xl md:shadow-xl md:mb-12">
        <header className="mb-6">
          <Link href={`/shop/${resolvedShop.shop_slug}`} className="mb-3 inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 hover:text-gray-900 transition">
            {resolvedShop.shop_name}
          </Link>
          <h1 className="text-3xl font-serif font-bold leading-tight text-gray-900 md:text-4xl">{product.name}</h1>
          <p className="mt-4 text-2xl font-black text-gray-900">D{product.price.toLocaleString()}</p>
        </header>

        {/* 🚀 3. THE NEW NATIVE VARIANT PILLS */}
        <div className="space-y-8 py-6 border-y border-gray-100">
          
          {normalizedColors.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-900">Color</span>
                <span className="text-[11px] font-medium text-gray-500">{selectedColor}</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {normalizedColors.map((color) => {
                  const isSelected = selectedColor === color;
                  return (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`relative overflow-hidden rounded-xl border px-5 py-3 text-xs font-bold transition-all duration-200 ${
                        isSelected 
                          ? `border-transparent ${activeColor.bg} text-white shadow-md ring-2 ring-${activeColor.bg}/20 ring-offset-1` 
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {color}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {normalizedSizes.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-900">Size</span>
                <span className="text-[11px] font-medium text-gray-500">{selectedSize}</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {normalizedSizes.map((size) => {
                  const isSelected = selectedSize === size;
                  return (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`relative flex min-w-[3rem] items-center justify-center rounded-xl border px-4 py-3 text-xs font-bold transition-all duration-200 ${
                        isSelected 
                          ? `border-transparent ${activeColor.bg} text-white shadow-md ring-2 ring-${activeColor.bg}/20 ring-offset-1` 
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* QUANTITY SELECTOR */}
          <div>
             <span className="mb-3 block text-[11px] font-bold uppercase tracking-widest text-gray-900">Quantity</span>
             <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white shadow-sm p-1">
              <button onClick={() => setQuantity((c) => Math.max(1, c - 1))} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"><Minus size={16} /></button>
              <span className="w-12 text-center text-sm font-bold text-gray-900">{quantity}</span>
              <button onClick={() => setQuantity((c) => c + 1)} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"><Plus size={16} /></button>
            </div>
          </div>
        </div>

        {product.description && (
          <div className="mt-8">
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-900">Description</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
              {product.description}
            </p>
          </div>
        )}
      </main>

      {/* 🚀 4. THE GLASSMORPHISM STICKY CHECKOUT BAR */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100/50 bg-white/80 p-4 pb-safe backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-2xl">
          <button
            type="button"
            onClick={handleAddToBag}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[13px] font-bold uppercase tracking-widest text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-transform hover:scale-[1.01] active:scale-[0.98] ${activeColor.bg}`}
          >
            <ShoppingBag size={18} /> 
            Add to Bag — D{(product.price * quantity).toLocaleString()}
          </button>
        </div>
      </div>
    </div>
  );
}