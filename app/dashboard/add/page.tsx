'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Upload, X, Image as ImageIcon, Plus, Package } from 'lucide-react';
import Link from 'next/link';

const CATEGORIES = ['Fashion', 'Sneakers', 'Beauty & Wellness', 'Home & Artisan', 'Tech Accessories', 'Food & Culinary'];

export default function AddProductPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form States
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  
  // Media States
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Variants States
  const [colors, setColors] = useState<string[]>([]);
  const [colorInput, setColorInput] = useState('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [sizeInput, setSizeInput] = useState('');

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
      else setUserId(user.id);
    }
    checkAuth();
  }, [router, supabase]);

  // Handle Images
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImageFiles((prev) => [...prev, ...filesArray]);
      
      const previewsArray = filesArray.map((file) => URL.createObjectURL(file));
      setImagePreviews((prev) => [...prev, ...previewsArray]);
    }
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle Variants
  const addColor = () => {
    if (colorInput.trim() && !colors.includes(colorInput.trim())) {
      setColors([...colors, colorInput.trim()]);
      setColorInput('');
    }
  };

  const removeColor = (colorToRemove: string) => {
    setColors(colors.filter(c => c !== colorToRemove));
  };

  const addSize = () => {
    if (sizeInput.trim() && !sizes.includes(sizeInput.trim())) {
      setSizes([...sizes, sizeInput.trim()]);
      setSizeInput('');
    }
  };

  const removeSize = (sizeToRemove: string) => {
    setSizes(sizes.filter(s => s !== sizeToRemove));
  };

  // Submit Flow
  const handlePublish = async () => {
    if (!name || !price || imageFiles.length === 0) {
      alert('Please provide a name, price, and at least one image.');
      return;
    }
    if (!userId) return;

    setLoading(true);

    try {
      // 1. Upload Images to Supabase Storage
      const imageUrls: string[] = [];
      for (const file of imageFiles) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(filePath);
        imageUrls.push(publicUrl);
      }

      // 2. Insert Product to Database
      const { error: insertError } = await supabase.from('products').insert({
        user_id: userId,
        name: name.trim(),
        price: parseFloat(price),
        description: description.trim(),
        category: category,
        image_url: imageUrls[0], // Primary image
        image_urls: imageUrls,   // Gallery
        colors: colors,
        sizes: sizes
      });

      if (insertError) throw insertError;

      // 3. Success -> Send back to dashboard
      router.push('/dashboard');
      
    } catch (error: any) {
      console.error('Upload Error:', error);
      alert(error.message || 'Failed to publish product.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white pb-24">
      
      {/* 🚀 HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-4 md:px-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900">
            <ArrowLeft size={16} /> Cancel
          </Link>
          <div className="flex items-center gap-3">
            <button 
              onClick={handlePublish}
              disabled={loading}
              className="flex items-center gap-2 rounded-full bg-[#1a2e1a] px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black disabled:opacity-70"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={14} />}
              {loading ? 'Publishing...' : 'Publish Product'}
            </button>
          </div>
        </div>
      </header>

      {/* 🚀 MAIN EDITOR */}
      <main className="max-w-4xl mx-auto px-4 py-8 md:px-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          
          {/* LEFT COLUMN: Main Info */}
          <div className="md:col-span-2 space-y-6 md:space-y-8">
            
            {/* General Info Card */}
            <div className="rounded-[2rem] bg-white p-6 md:p-8 shadow-sm border border-gray-100">
              <h2 className="text-lg font-serif font-bold text-gray-900 mb-6 flex items-center gap-2"><Package size={18} className="text-gray-400" /> Basic Details</h2>
              
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Product Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Nike Air Force 1 '07"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Price (GMD)</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">D</span>
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 pl-10 pr-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full appearance-none rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    placeholder="Describe the product, material, and fit..."
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Media Upload Card */}
            <div className="rounded-[2rem] bg-white p-6 md:p-8 shadow-sm border border-gray-100">
              <h2 className="text-lg font-serif font-bold text-gray-900 mb-6 flex items-center gap-2"><ImageIcon size={18} className="text-gray-400" /> Media Gallery</h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {imagePreviews.map((src, idx) => (
                  <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 border border-gray-200 group">
                    <img src={src} alt={`preview ${idx}`} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-full bg-white/90 text-red-500 opacity-0 group-hover:opacity-100 transition shadow-sm"
                    >
                      <X size={14} />
                    </button>
                    {idx === 0 && <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[8px] font-bold uppercase tracking-widest text-white backdrop-blur-sm">Primary</span>}
                  </div>
                ))}

                <label className="relative aspect-square rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition group">
                  <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm text-gray-400 group-hover:text-gray-900 group-hover:scale-105 transition">
                    <Plus size={20} />
                  </div>
                  <span className="mt-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-gray-600">Add Image</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              </div>
              <p className="mt-4 text-xs text-gray-500">First image will be used as the primary thumbnail. We recommend square (1:1) or vertical (4:5) ratios.</p>
            </div>
          </div>

          {/* RIGHT COLUMN: Variants & Settings */}
          <div className="space-y-6 md:space-y-8">
            
            {/* Variants Card */}
            <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-serif font-bold text-gray-900 mb-6">Variants</h2>
              
              {/* Colors Engine */}
              <div className="mb-6">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Available Colors</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {colors.map(color => (
                    <span key={color} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 pl-3 pr-1.5 py-1 text-xs font-bold text-gray-700">
                      {color}
                      <button onClick={() => removeColor(color)} className="rounded-full p-1 hover:bg-gray-200 text-gray-400 hover:text-red-500 transition"><X size={12} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={colorInput} 
                    onChange={(e) => setColorInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColor())}
                    placeholder="e.g. Midnight Black" 
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-xs font-medium outline-none focus:border-gray-900 focus:bg-white transition"
                  />
                  <button type="button" onClick={addColor} className="rounded-xl bg-gray-100 px-4 py-2.5 text-xs font-bold text-gray-600 transition hover:bg-gray-200">Add</button>
                </div>
              </div>

              {/* Sizes Engine */}
              <div className="pt-6 border-t border-gray-50">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Available Sizes</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {sizes.map(size => (
                    <span key={size} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 pl-3 pr-1.5 py-1 text-xs font-bold text-gray-700">
                      {size}
                      <button onClick={() => removeSize(size)} className="rounded-full p-1 hover:bg-gray-200 text-gray-400 hover:text-red-500 transition"><X size={12} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={sizeInput} 
                    onChange={(e) => setSizeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())}
                    placeholder="e.g. XL, 42, OS" 
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-xs font-medium outline-none focus:border-gray-900 focus:bg-white transition"
                  />
                  <button type="button" onClick={addSize} className="rounded-xl bg-gray-100 px-4 py-2.5 text-xs font-bold text-gray-600 transition hover:bg-gray-200">Add</button>
                </div>
              </div>
            </div>

            {/* Help Card */}
            <div className="rounded-[2rem] bg-blue-50/50 p-6 border border-blue-100/50">
              <h3 className="text-sm font-bold text-blue-900 mb-2">Seller Pro Tip</h3>
              <p className="text-xs text-blue-700 leading-relaxed">
                Products with 3+ clear images and detailed descriptions sell 40% faster on the District. Make sure your primary image has good lighting!
              </p>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}