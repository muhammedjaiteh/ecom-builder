'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, ArrowLeft, Upload } from 'lucide-react';
import Link from 'next/link';

const CATEGORY_OPTIONS = ['Food', 'Drinks', 'Beauty', 'Fashion', 'Electronics', 'General'] as const;

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = use(params);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const supabase = createClientComponentClient();
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

      const { data: product, error } = await supabase
        .from('products')
        .select('id, name, price, description, image_url, category')
        .eq('id', productId)
        .eq('user_id', user.id)
        .single();

      if (error || !product) {
        alert('Product not found!');
        router.push('/dashboard');
        return;
      }

      setName(product.name || '');
      setPrice(String(product.price ?? ''));
      setDescription(product.description || '');
      setCategory(product.category || 'General');
      setCurrentImageUrl(product.image_url || '');
      setLoading(false);
    }

    fetchProduct();
  }, [productId, router, supabase]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setNewImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      let finalImageUrl = currentImageUrl;

      if (newImageFile) {
        const fileExt = newImageFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, newImageFile);
        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('product-images').getPublicUrl(fileName);

        finalImageUrl = publicUrl;
      }

      const { error } = await supabase
        .from('products')
        .update({
          name,
          price,
          description,
          category,
          image_url: finalImageUrl,
        })
        .eq('id', productId);

      if (error) throw error;

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
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-[#2C3E2C] p-6 flex justify-center">
      <div className="w-full max-w-2xl">
        <Link href="/dashboard" className="mb-8 flex items-center text-gray-500 transition-colors hover:text-green-700">
          <ArrowLeft size={20} className="mr-2" /> Cancel &amp; Go Back
        </Link>

        <div className="rounded-3xl border border-[#E6E4DC] bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-3xl font-serif font-bold">Edit Product</h1>

          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-6">
              <div className="relative mb-4 h-32 w-32 overflow-hidden rounded-lg bg-gray-200 shadow-md">
                {previewUrl || currentImageUrl ? (
                  <img src={previewUrl || currentImageUrl} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">No image</div>
                )}
              </div>

              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-bold text-gray-700 transition-all hover:bg-gray-50">
                <Upload size={16} /> Change Image
                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
              </label>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">Product Name</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border-none bg-[#F9F8F6] p-4 text-lg font-serif focus:ring-2 focus:ring-[#2C3E2C]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">Price (Dalasi)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className="w-full rounded-xl border-none bg-[#F9F8F6] p-4 text-lg font-bold text-green-700 focus:ring-2 focus:ring-[#2C3E2C]"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">Status</label>
                <div className="w-full rounded-xl border border-green-200 bg-green-100 p-4 text-center font-bold text-green-800">Active</div>
              </div>
            </div>

            <div>
              <label htmlFor="category" className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-xl border border-[#E6E4DC] bg-[#F9F8F6] p-4 text-sm font-semibold text-[#2C3E2C] outline-none transition focus:border-[#2C3E2C]"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">Description</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                className="w-full rounded-xl border-none bg-[#F9F8F6] p-4 text-gray-600 focus:ring-2 focus:ring-[#2C3E2C]"
                placeholder="Describe your product..."
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C3E2C] py-4 text-lg font-bold text-white shadow-xl transition-all active:scale-[0.98] hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              {saving ? 'Saving Changes...' : 'Update Product'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
