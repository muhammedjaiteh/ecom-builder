'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Save, Loader2, ArrowLeft, Upload, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

export default function EditProduct() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form Data
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const supabase = createClientComponentClient();
  const router = useRouter();
  const params = useParams();

  // 1. LOAD THE EXISTING DATA 📥
  useEffect(() => {
    async function loadProduct() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const productId = String(params.id);

      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('user_id', user.id) // Security: Ensure they own it!
        .single();

      if (error || !product) {
        alert('Product not found!');
        router.push('/dashboard');
        return;
      }

      // Fill the form
      setName(product.name);
      setPrice(product.price);
      setDescription(product.description || '');
      setCurrentImageUrl(product.image_url);
      setLoading(false);
    }
    loadProduct();
  }, [params, router]);

  // Handle New Image Selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  // 2. SAVE THE UPDATES 💾
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let finalImageUrl = currentImageUrl;

      // If they picked a NEW image, upload it first
      if (newImageFile) {
        const fileExt = newImageFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, newImageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        
        finalImageUrl = publicUrl;
      }

      // Update the Database Record
      const { error } = await supabase
        .from('products')
        .update({
          name,
          price,
          description,
          image_url: finalImageUrl
        })
        .eq('id', params.id);

      if (error) throw error;

      router.push('/dashboard'); // Go back home
      router.refresh(); 

    } catch (error: any) {
      alert('Error updating product: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center">Loading Editor...</div>;

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-[#2C3E2C] p-6 flex justify-center">
      <div className="w-full max-w-2xl">
        
        <Link href="/dashboard" className="flex items-center text-gray-500 hover:text-green-700 mb-8 transition-colors">
           <ArrowLeft size={20} className="mr-2" /> Cancel & Go Back
        </Link>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#E6E4DC]">
          <h1 className="text-3xl font-serif font-bold mb-6">Edit Product</h1>
          
          <form onSubmit={handleUpdate} className="space-y-6">
            
            {/* 📸 IMAGE SECTION */}
            <div className="flex flex-col items-center p-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
               <div className="w-32 h-32 bg-gray-200 rounded-lg overflow-hidden mb-4 relative shadow-md">
                 <img 
                   src={previewUrl || currentImageUrl} 
                   alt="Preview" 
                   className="w-full h-full object-cover" 
                 />
               </div>
               <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 transition-all flex items-center gap-2">
                 <Upload size={16} /> Change Image
                 <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
               </label>
            </div>

            {/* 📝 TEXT FIELDS */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Product Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-4 bg-[#F9F8F6] border-none rounded-xl text-lg font-serif focus:ring-2 focus:ring-[#2C3E2C]"
                required 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Price (Dalasi)</label>
                  <input 
                    type="number" 
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full p-4 bg-[#F9F8F6] border-none rounded-xl text-lg font-bold text-green-700 focus:ring-2 focus:ring-[#2C3E2C]"
                    required 
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Status</label>
                  <div className="w-full p-4 bg-green-100 text-green-800 rounded-xl font-bold text-center border border-green-200">
                    Active
                  </div>
               </div>
            </div>

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

            {/* 💾 SAVE BUTTON */}
            <button 
              type="submit" 
              disabled={saving}
              className="w-full bg-[#2C3E2C] hover:bg-black text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"
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