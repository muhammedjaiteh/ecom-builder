'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Plus, Save, Sparkles, Star, Trash2 } from 'lucide-react';
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

export default function AddProductPage() {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>('General');
  const [status, setStatus] = useState('Active');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<{ url: string; isDefault: boolean }[]>([]);
  const [colorsInput, setColorsInput] = useState('');
  const [sizesInput, setSizesInput] = useState('');
  const [themeColor, setThemeColor] = useState<ThemeColor>('emerald');

  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    async function fetchThemeColor() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from('shops')
        .select('theme_color')
        .eq('id', user.id)
        .maybeSingle();

      const nextTheme = data?.theme_color;
      if (nextTheme && nextTheme in themeButtonClasses) {
        setThemeColor(nextTheme as ThemeColor);
      }
    }

    void fetchThemeColor();
  }, [supabase]);

  const generateMagicDescription = () => {
    if (!name.trim()) {
      alert('Please enter a product name first!');
      return;
    }

    setGenerating(true);

    setTimeout(() => {
      const lowerName = name.toLowerCase();
      let aiText = `Discover the excellence of ${name}. High-quality, authentic, and designed to meet your needs.`;

      if (category === 'Food & Culinary') {
        aiText = lowerName.includes('honey') || lowerName.includes('oil')
          ? `Experience the untouched purity of ${name}. 100% natural and locally sourced with no additives.`
          : `Experience the authentic taste of ${name}. Freshly prepared with the finest local ingredients.`;
      }

      if (category === 'Fashion' || category === 'Sneakers') {
        aiText = `Upgrade your wardrobe with ${name}. Crafted for comfort, style, and long-lasting quality.`;
      }

      if (category === 'Beauty & Wellness') {
        aiText = `Enhance your self-care routine with ${name}. Gentle, premium quality, and suitable for daily use.`;
      }

      if (category === 'Tech Accessories') {
        aiText = `Upgrade your tech with ${name}. Reliable performance, durable build, and sleek everyday usability.`;
      }
      setDescription(aiText);
      setGenerating(false);
    }, 1200);
  };

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
    if (images.length >= MAX_IMAGES) {
      alert('You can upload up to 5 images only.');
      return;
    }

    setUploading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      const remainingSlots = MAX_IMAGES - images.length;
      const filesToUpload = Array.from(files).slice(0, remainingSlots);
      const uploaded: { url: string; isDefault: boolean }[] = [];

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

      setImages((prev) => {
        const next = [...prev, ...uploaded];
        if (next.length > 0 && !next.some((image) => image.isDefault)) {
          next[0] = { ...next[0], isDefault: true };
        }
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Image upload failed: ${message}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  // 🚀 UPGRADED: The Enterprise Variant Engine
  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const orderedImages = [...images].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
      
      const colors = colorsInput.split(',').map((s) => s.trim()).filter(Boolean);
      const sizes = sizesInput.split(',').map((s) => s.trim()).filter(Boolean);

      // STEP 1: Insert the main product and GET the new product ID back
      const { data: newProduct, error: productError } = await supabase.from('products').insert({
        user_id: user.id,
        name,
        price: parseFloat(price),
        category,
        status,
        description,
        image_urls: orderedImages.map((image) => image.url),
        image_url: orderedImages[0]?.url || null,
        // We no longer save raw arrays here. We keep the database normalized!
      }).select().single();

      if (productError) throw productError;

      // STEP 2: Generate the Advanced Variants payload
      const variantsToInsert: any[] = [];

      if (colors.length > 0) {
        colors.forEach(color => {
          variantsToInsert.push({
            product_id: newProduct.id,
            variant_name: 'Color',
            variant_value: color,
            stock_quantity: 10 // Default stock for now
          });
        });
      }

      if (sizes.length > 0) {
        sizes.forEach(size => {
          variantsToInsert.push({
            product_id: newProduct.id,
            variant_name: 'Size',
            variant_value: size,
            stock_quantity: 10 // Default stock for now
          });
        });
      }

      // STEP 3: Bulk insert into the new product_variants table!
      if (variantsToInsert.length > 0) {
        const { error: variantError } = await supabase.from('product_variants').insert(variantsToInsert);
        if (variantError) {
          console.error("Variants failed to save, but product was created:", variantError);
          // We don't throw an error here so the seller still gets redirected successfully
        }
      }

      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] p-6 font-sans text-[#2C3E2C] flex justify-center">
      <div className="w-full max-w-2xl">
        <Link href="/dashboard" className="mb-8 flex items-center text-gray-500 transition-colors hover:text-green-700">
          <ArrowLeft size={20} className="mr-2" /> Cancel
        </Link>

        <div className="rounded-3xl border border-[#E6E4DC] bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-3xl font-serif font-bold">Add New Product</h1>

          <form onSubmit={handleSave} className="space-y-6">
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
                placeholder="e.g. Royal Baobab Juice"
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
                  placeholder="0.00"
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

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">Description</label>
                <button
                  type="button"
                  onClick={generateMagicDescription}
                  disabled={generating || !name.trim()}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition-transform hover:scale-105 disabled:opacity-60"
                >
                  {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {generating ? 'Writing...' : 'AI Magic Write'}
                </button>
              </div>

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
              disabled={loading || uploading}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold text-white shadow-xl transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 ${themeButtonClasses[themeColor]}`}
            >
              {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              {loading ? 'Publishing Product...' : 'Publish Product'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}