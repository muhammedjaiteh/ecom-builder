'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Plus, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AddProduct() {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Food'); // Default Category
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const supabase = createClientComponentClient();
  const router = useRouter();

  // 🏷️ OUR CATEGORY LIST
  const CATEGORIES = [
    "Food",
    "Fashion",
    "Beauty",
    "Home",
    "Electronics",
    "Other"
  ];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      let imageUrl = null;
      if (image) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }

      const { error } = await supabase.from('products').insert({
        name,
        price,
        category, // Saving the category!
        description,
        image_url: imageUrl,
        user_id: user.id
      });

      if (error) throw error;

      router.push('/dashboard');
      router.refresh();

    } catch (error: any) {
      alert('Error adding product: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-[#2C3E2C] p-6 flex justify-center">
      <div className="w-full max-w-2xl">
        
        <Link href="/dashboard" className="flex items-center text-gray-500 hover:text-green-700 mb-8 transition-colors">
           <ArrowLeft size={20} className="mr-2" /> Cancel & Go Back
        </Link>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#E6E4DC]">
          <h1 className="text-3xl font-serif font-bold mb-6">Add New Product</h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Image Upload */}
            <div className="flex flex-col items-center p-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 hover:border-green-500 transition-colors group">
               {previewUrl ? (
                 <div className="w-32 h-32 bg-gray-200 rounded-lg overflow-hidden mb-4 relative shadow-md">
                   <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                 </div>
               ) : (
                 <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                   <Upload size={24} />
                 </div>
               )}
               <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 transition-all">
                 Choose Image
                 <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
               </label>
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Product Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-4 bg-[#F9F8F6] border-none rounded-xl text-lg font-serif focus:ring-2 focus:ring-[#2C3E2C]"
                placeholder="e.g. Baobab Juice"
                required 
              />
            </div>

            {/* Category & Price Row */}
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Category</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-4 bg-[#F9F8F6] border-none rounded-xl font-bold text-gray-700 focus:ring-2 focus:ring-[#2C3E2C]"
                  >
                    {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Price (Dalasi)</label>
                  <input 
                    type="number" 
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full p-4 bg-[#F9F8F6] border-none rounded-xl text-lg font-bold text-green-700 focus:ring-2 focus:ring-[#2C3E2C]"
                    placeholder="150"
                    required 
                  />
               </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Description</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full p-4 bg-[#F9F8F6] border-none rounded-xl text-gray-600 focus:ring-2 focus:ring-[#2C3E2C]"
                placeholder="Describe your product..."
              />
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#2C3E2C] hover:bg-black text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Plus size={20} />}
              {loading ? 'Publishing...' : 'Publish Product'}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}