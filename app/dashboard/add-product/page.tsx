'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

export default function AddProduct() {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  // 🖼️ Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile)); // Show preview instantly
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      let image_url = null;

      // 1. Upload Image (If selected)
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. Get Public Link
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);
          
        image_url = publicUrl;
      }

      // 3. Save Product to Database
      const { error } = await supabase.from('products').insert({
        name,
        price,
        description,
        user_id: user.id,
        image_url: image_url // Saving the link!
      });

      if (error) throw error;

      router.push('/dashboard');
      router.refresh();

    } catch (error: any) {
      alert('Error creating product: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      
      <div className="w-full max-w-md mb-8">
        <Link href="/dashboard" className="flex items-center text-gray-500 hover:text-green-700 transition-colors">
          <ArrowLeft size={20} className="mr-2" /> Back to Dashboard
        </Link>
      </div>

      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-xl">
        <div className="text-center">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">New Product</h2>
          <p className="mt-2 text-sm text-gray-600">Add a premium item to your collection</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          
          {/* 📸 Image Upload Area */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">Product Image</label>
            <div className="relative group">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
              <div className={`
                border-2 border-dashed rounded-2xl h-48 flex flex-col items-center justify-center transition-all
                ${preview ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}
              `}>
                {preview ? (
                  <img src={preview} alt="Preview" className="h-full w-full object-cover rounded-2xl" />
                ) : (
                  <>
                    <div className="p-4 bg-white rounded-full shadow-sm mb-3">
                      <ImageIcon className="text-gray-400" size={24} />
                    </div>
                    <p className="text-sm text-gray-500 font-medium">Click to upload photo</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Product Name</label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                placeholder="e.g. Pure Baobab Juice"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Price (Dalasi)</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">D</span>
                </div>
                <input
                  required
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="focus:ring-green-500 focus:border-green-500 block w-full pl-8 pr-12 sm:text-sm border-gray-300 rounded-xl py-3"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
               <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
               <textarea
                 rows={3}
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                 placeholder="Tell your customers about the quality..."
               />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-green-900 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-lg transition-all active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <span className="flex items-center gap-2">
                <Upload size={20} /> Publish Product
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}