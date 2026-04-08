'use client';

import { createBrowserClient } from '@supabase/ssr';
import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Plus, Save, Star, Trash2, Sparkles, X } from 'lucide-react';
import Link from 'next/link';

const CATEGORY_OPTIONS = ['Food & Culinary', 'Drinks', 'Beauty & Wellness', 'Fashion', 'Sneakers', 'Home & Artisan', 'Tech Accessories', 'General'] as const;
const MAX_IMAGES = 5;

type ThemeColor = 'emerald' | 'midnight' | 'terracotta' | 'ocean' | 'rose';

const themeButtonClasses: Record<ThemeColor, string> = {
  emerald: 'bg-emerald-600 hover:bg-emerald-700',
  midnight: 'bg-slate-900 hover:bg-slate-950',
  terracotta: 'bg-orange-700 hover:bg-orange-800',
  ocean: 'bg-blue-600 hover:bg-blue-700',
  rose: 'bg-rose-500 hover:bg-rose-600',
};

type ImageItem = { url: string; isDefault: boolean };

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } catch {
      // fall through to comma-separated parsing
    }

    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = use(params);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // 🚀 AI Subscription States
  const [subscriptionTier, setSubscriptionTier] = useState('standard');
  const [aiCredits, setAiCredits] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>('General');
  const [status, setStatus] = useState('Active');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [colorsInput, setColorsInput] = useState('');
  const [sizesInput, setSizesInput] = useState('');
  const [themeColor, setThemeColor] = useState<ThemeColor>('emerald');

  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  useEffect(() => {
    async function fetchProduct() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch shop data for theme, tier, and AI credits
      const { data: shopData } = await supabase
        .from('shops')
        .select('theme_color, subscription_tier, ai_credits')
        .eq('id', user.id)
        .maybeSingle();

      if (shopData) {
        const nextTheme = shopData.theme_color;
        if (nextTheme && nextTheme in themeButtonClasses) {
          setThemeColor(nextTheme as ThemeColor);
        }
        setSubscriptionTier(shopData.subscription_tier || 'standard');
        setAiCredits(shopData.ai_credits || 0);
      }

      // UPGRADE 1: Fetching the product_variants data
      const { data: product, error } = await supabase
        .from('products')
        .select('id, name, price, description, image_url, image_urls, category, status, stock_quantity, colors, sizes, product_variants(variant_name, variant_value)')
        .eq('id', productId)
        .eq('user_id', user.id)
        .single();

      if (error || !product) {
        alert('Product not found!');
        router.push('/dashboard');
        return;
      }

      const galleryUrls = normalizeStringArray(product.image_urls);
      const fallbackImage = product.image_url && product.image_url.trim().length > 0 ? [product.image_url] : [];
      const allImages = galleryUrls.length > 0 ? galleryUrls : fallbackImage;

      setName(product.name || '');
      setPrice(String(product.price ?? ''));
      setDescription(product.description || '');
      setCategory((product.category as (typeof CATEGORY_OPTIONS)[number]) || 'General');
      setStatus(product.status || 'Active');
      setStockQuantity(product?.stock_quantity ? String(product.stock_quantity) : '0');
      setImages(allImages.map((url, index) => ({ url, isDefault: index === 0 })));

      // UPGRADE 2: Combine legacy arrays with the new database vault for seamless loading
      const dbColors = product.product_variants?.filter((v: any) => v.variant_name.toLowerCase() === 'color').map((v: any) => v.variant_value) || [];
      const legacyColors = normalizeStringArray(product.colors);
      const combinedColors = Array.from(new Set([...dbColors, ...legacyColors]));

      const dbSizes = product.product_variants?.filter((v: any) => v.variant_name.toLowerCase() === 'size').map((v: any) => v.variant_value) || [];
      const legacySizes = normalizeStringArray(product.sizes);
      const combinedSizes = Array.from(new Set([...dbSizes, ...legacySizes]));

      setColorsInput(combinedColors.join(', '));
      setSizesInput(combinedSizes.join(', '));
      setLoading(false);
    }

    void fetchProduct();
  }, [productId, router, supabase]);

  const setAsPrimary = (index: number) => {
    setImages((prev) => prev.map((image, imageIndex) => ({ ...image, isDefault: imageIndex === index })));
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, imageIndex) => imageIndex !== index);

      if (next.length > 0 && !next.some((image) => image.isDefault)) {
        next[0] = { ...next[0], isDefault: true };
      }

      return next;
    });
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      const remainingSlots = Math.max(MAX_IMAGES - images.length, 0);
      const filesToUpload = Array.from(files).slice(0, remainingSlots);
      const uploaded: ImageItem[] = [];

      for (const file of filesToUpload) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, file);
        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('product-images').getPublicUrl(filePath);

        uploaded.push({ url: publicUrl, isDefault: false });
      }

      if (uploaded.length > 0) {
        setImages((prev) => {
          const hasPrimary = prev.some((image) => image.isDefault);
          const nextUploads = uploaded.map((image, index) => ({
            ...image,
            isDefault: !hasPrimary && index === 0,
          }));

          return [...prev, ...nextUploads];
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Image upload failed: ${message}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  // 🚀 THE AI ENGINE WITH CREDIT METERING
  const handleGenerateDescription = async () => {
    if (!name) {
      alert("Please enter a Product Name first so the AI knows what to write about!");
      return;
    }

    setAiError(null);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `${name} in the ${category} category` }),
      });

      const data = await response.json();

      // Handle 403 credit exhaustion error
      if (response.status === 403) {
        setAiError(data.error || 'AI Credit limit reached. Please upgrade to Advanced for unlimited access.');
        return;
      }

      if (!response.ok) {
        setAiError(data.error || 'Failed to generate description. Please try again.');
        return;
      }

      if (data.description) {
        setDescription(data.description);

        // Update local credits state instantly (no page refresh needed)
        if (data.creditsRemaining !== null && data.creditsRemaining !== undefined) {
          setAiCredits(data.creditsRemaining);
        }
      }
    } catch (error) {
      console.error('AI generation error:', error);
      setAiError('Failed to connect to AI service. Please check your connection and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // UPGRADE 3: The Wipe and Replace Variant Update Strategy
  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const orderedImages = [...images].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
      const colors = colorsInput.split(',').map((s) => s.trim()).filter(Boolean);
      const sizes = sizesInput.split(',').map((s) => s.trim()).filter(Boolean);

      // STEP 1: Update the main product data
      const { error: productError } = await supabase
        .from('products')
        .update({
          name,
          price: parseFloat(price),
          description,
          category,
          status,
          stock_quantity: parseInt(stockQuantity) || 0,
          image_urls: orderedImages.map((image) => image.url),
          image_url: orderedImages[0]?.url || null,
        })
        .eq('id', productId);

      if (productError) throw productError;

      // STEP 2: Wipe the slate clean (Delete old variants)
      await supabase.from('product_variants').delete().eq('product_id', productId);

      // STEP 3: Insert the new variants
      const variantsToInsert: any[] = [];
      if (colors.length > 0) {
        colors.forEach(color => {
          variantsToInsert.push({
            product_id: productId,
            variant_name: 'Color',
            variant_value: color,
            stock_quantity: 10
          });
        });
      }

      if (sizes.length > 0) {
        sizes.forEach(size => {
          variantsToInsert.push({
            product_id: productId,
            variant_name: 'Size',
            variant_value: size,
            stock_quantity: 10
          });
        });
      }

      if (variantsToInsert.length > 0) {
        const { error: variantError } = await supabase.from('product_variants').insert(variantsToInsert);
        if (variantError) console.error("Variants failed to update:", variantError);
      }

      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error updating product: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center">Loading Editor...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F9F8F6] p-6 font-sans text-[#2C3E2C] flex justify-center">
      <div className="w-full max-w-2xl">
        <Link href="/dashboard" className="mb-8 flex items-center text-gray-500 transition-colors hover:text-green-700">
          <ArrowLeft size={20} className="mr-2" /> Cancel &amp; Go Back
        </Link>

        <div className="rounded-3xl border border-[#E6E4DC] bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-3xl font-serif font-bold">Edit Product</h1>

          <form onSubmit={handleUpdate} className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">Product Gallery (up to 5)</label>
                <span className="text-xs text-gray-400">{images.length}/{MAX_IMAGES}</span>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => void handleUpload(event.target.files)}
              />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {Array.from({ length: MAX_IMAGES }).map((_, index) => {
                  const image = images[index];

                  if (image) {
                    return (
                      <div
                        key={`${image.url}-${index}`}
                        className="group relative overflow-hidden rounded-2xl border border-[#E6E4DC] bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <img src={image.url} alt={`Product ${index + 1}`} className="h-28 w-full object-cover" />

                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition hover:bg-red-600"
                          aria-label="Delete image"
                        >
                          <Trash2 size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setAsPrimary(index)}
                          className={`flex w-full items-center justify-center gap-1 px-2 py-2 text-[11px] font-semibold transition ${
                            image.isDefault
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <Star size={12} className={image.isDefault ? 'fill-current' : ''} />
                          {image.isDefault ? 'Primary' : 'Set Primary'}
                        </button>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={`empty-${index}`}
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      disabled={uploading}
                      className="flex h-36 items-center justify-center rounded-2xl border-2 border-dashed border-[#D7D4CA] bg-[#F9F8F6] text-gray-400 transition-all duration-300 hover:border-[#2C3E2C] hover:text-[#2C3E2C] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={24} />}
                    </button>
                  );
                })}
              </div>

              {images.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {images.map((image, index) => (
                    <img
                      key={`preview-${image.url}-${index}`}
                      src={image.url}
                      alt={`Preview ${index + 1}`}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">Product Name</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl bg-[#F9F8F6] p-4 text-lg font-serif focus:ring-2 focus:ring-[#2C3E2C]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">Category</label>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as (typeof CATEGORY_OPTIONS)[number])}
                  className="w-full rounded-xl bg-[#F9F8F6] p-4 font-bold text-gray-700 focus:ring-2 focus:ring-[#2C3E2C]"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">Price (D)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className="w-full rounded-xl bg-[#F9F8F6] p-4 text-lg font-bold text-green-700 focus:ring-2 focus:ring-[#2C3E2C]"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">Status</label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full rounded-xl bg-[#F9F8F6] p-4 font-bold text-gray-700 focus:ring-2 focus:ring-[#2C3E2C]"
                >
                  <option value="Active">Active (Visible to buyers)</option>
                  <option value="Draft">Draft / Sold Out (Hidden from buyers)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">Stock Quantity</label>
                <input
                  type="number"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full rounded-xl bg-[#F9F8F6] p-4 text-lg font-bold text-gray-700 focus:ring-2 focus:ring-[#2C3E2C]"
                />
                <p className="mt-1 text-xs text-gray-400">How many units available?</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">Colors (comma separated)</label>
                <input
                  type="text"
                  value={colorsInput}
                  onChange={(event) => setColorsInput(event.target.value)}
                  className="w-full rounded-xl bg-[#F9F8F6] p-4 text-sm text-gray-700 focus:ring-2 focus:ring-[#2C3E2C]"
                  placeholder="Red, Blue, Green"
                />
                <p className="mt-1 text-xs text-gray-400">Example: Red, Blue, Green</p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">Sizes/Lengths (comma separated)</label>
                <input
                  type="text"
                  value={sizesInput}
                  onChange={(event) => setSizesInput(event.target.value)}
                  className="w-full rounded-xl bg-[#F9F8F6] p-4 text-sm text-gray-700 focus:ring-2 focus:ring-[#2C3E2C]"
                  placeholder="2 Metres, 5 Metres"
                />
                <p className="mt-1 text-xs text-gray-400">Example: 2 Metres, 5 Metres</p>
              </div>
            </div>

            {/* 🚀 AI DESCRIPTION BOX - ENHANCED */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">Description</label>
                
                <div className="flex items-center gap-3">
                  {['starter', 'pro'].includes(subscriptionTier) && (
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${
                      aiCredits <= 0 ? 'text-red-500' : 'text-gray-400'
                    }`}>
                      ✨ {aiCredits} Credits Left
                    </span>
                  )}
                  {['advanced', 'flagship'].includes(subscriptionTier) && (
                    <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">
                      ✨ Unlimited AI
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleGenerateDescription}
                    disabled={isGenerating || !name}
                    className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {isGenerating ? 'Writing...' : 'Write with AI'}
                  </button>
                </div>
              </div>
              
              {aiError && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-3 animate-in slide-in-from-top duration-300">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-900">{aiError}</p>
                    {aiError.includes('limit reached') && (
                      <Link href="/pricing" className="mt-2 inline-block text-xs font-bold text-red-600 hover:text-red-700 underline">
                        Upgrade to Advanced for Unlimited AI →
                      </Link>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiError(null)}
                    className="flex-shrink-0 text-red-400 hover:text-red-500 transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                className="w-full rounded-xl bg-[#F9F8F6] p-4 text-gray-600 focus:ring-2 focus:ring-[#2C3E2C]"
                placeholder="Describe your product..."
              />
            </div>

            <button
              type="submit"
              disabled={saving || uploading}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold text-white shadow-xl transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 ${themeButtonClasses[themeColor]}`}
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              {saving ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
