'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export default function AddProduct() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  
  const router = useRouter();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 🤖 AI Generator
  const handleAutoWrite = async () => {
    if (!name) return alert('Please enter a product name first!');
    setAiLoading(true);

    try {
      const res = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: name }),
      });
      const data = await res.json();
      if (data.description) setDescription(data.description);
    } catch (error) {
      console.error(error);
      alert('AI is tired. Please type manually.');
    }
    setAiLoading(false);
  };

  // 📤 Main Submit Function
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let imageUrl = "";

      // 1. Upload Image (if one was selected)
      if (imageFile) {
        // Create a unique name: "timestamp-filename"
        const fileName = `${Date.now()}-${imageFile.name.replace(/\s/g, '-')}`;
        
        const { error: uploadError } = await supabase.storage
          .from('products') // Accessing the bucket you just confirmed
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        // Get the Public Link
        const { data: publicUrlData } = supabase.storage
          .from('products')
          .getPublicUrl(fileName);

        imageUrl = publicUrlData.publicUrl;
      }

      // 2. Save Product Data (with Image Link)
      const { error } = await supabase.from('products').insert([
        {
          name,
          description,
          price: parseFloat(price),
          image_url: imageUrl, 
        },
      ]);

      if (error) throw error;

      alert('Product created successfully! 🎉');
      router.push('/dashboard/products');

    } catch (error: any) {
      console.error("Upload Error:", error);
      alert('Error creating product: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-lg border">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Add New Product</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="e.g. Baobab Juice"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <button
              type="button"
              onClick={handleAutoWrite}
              disabled={aiLoading}
              className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold hover:bg-purple-200 transition-colors"
            >
              {aiLoading ? '✨ Thinking...' : '✨ AI Auto-Write'}
            </button>
          </div>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 border rounded-lg h-32 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Describe your product..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price (GMD)</label>
          <input
            type="number"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="0.00"
          />
        </div>

        {/* Image Upload Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setImageFile(e.target.files[0]);
              }
            }}
            className="w-full p-2 border rounded-lg bg-gray-50"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-md"
        >
          {loading ? 'Uploading...' : 'Create Product'}
        </button>
      </form>
    </div>
  );
}