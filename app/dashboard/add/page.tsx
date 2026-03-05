'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, ArrowLeft, Wand2, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function AddProduct() {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Food');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);

  const supabase = createClientComponentClient();
  const router = useRouter();

  const CATEGORIES = ["Food", "Fashion", "Beauty", "Home", "Electronics", "Other"];

  // 🤖 THE UPGRADED "AI" ENGINE (v2.0)
  const generateMagicDescription = () => {
    if (!name) {
        alert("Please enter a product name first!");
        return;
    }

    setGenerating(true);

    setTimeout(() => {
        let aiText = "";
        const lowerName = name.toLowerCase();

        switch(category) {
            case "Food":
                // 🟢 SMART CHECK: Is it a raw/pure item?
                if (lowerName.includes('honey') || lowerName.includes('oil') || lowerName.includes('pure') || lowerName.includes('raw')) {
                    aiText = `Experience the untouched purity of ${name}. 100% natural and locally sourced from The Gambia's finest producers. No additives or preservatives—just authentic, healthy quality for your home.`;
                } else {
                    // Cooked/Prepared items
                    aiText = `Experience the authentic taste of ${name}. Freshly prepared with care using the finest local ingredients. Perfect for family meals or a healthy treat. Taste the difference of premium quality.`;
                }
                break;

            case "Fashion":
                if (lowerName.includes('dress') || lowerName.includes('gown') || lowerName.includes('kaftan')) {
                     aiText = `Step out in elegance with this stunning ${name}. Expertly tailored for a flattering fit, this piece combines traditional Gambian style with modern luxury. Perfect for special occasions.`;
                } else {
                     aiText = `Upgrade your wardrobe with this stylish ${name}. Designed for comfort and durability, making it the perfect choice for everyday wear or social gatherings.`;
                }
                break;

            case "Beauty":
                if (lowerName.includes('cream') || lowerName.includes('lotion') || lowerName.includes('soap')) {
                    aiText = `Nourish your skin with our premium ${name}. Enriched with natural vitamins to leave your skin feeling soft, hydrated, and glowing. Gentle enough for daily use.`;
                } else {
                    aiText = `Enhance your natural beauty with ${name}. Dermatologically tested and safe for all skin types. A must-have addition to your self-care routine.`;
                }
                break;

            case "Electronics":
                aiText = `Upgrade your tech game with the ${name}. Features state-of-the-art performance, long-lasting durability, and a sleek design. Tested for quality and reliability.`;
                break;

            default:
                aiText = `Discover the excellence of ${name}. High-quality, authentic, and designed to meet your needs. One of our top-rated items in the store.`;
        }

        setDescription(aiText);
        setGenerating(false);
    }, 1500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let finalImageUrl = null;

      // Upload Image
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `product-${user.id}-${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        
        finalImageUrl = publicUrl;
      }

      // Save Product
      const { error } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          name,
          price: parseFloat(price),
          category,
          description,
          image_url: finalImageUrl
        });

      if (error) throw error;

      router.push('/dashboard');
      router.refresh();

    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-[#2C3E2C] p-6 flex justify-center">
      <div className="w-full max-w-2xl">
        
        <Link href="/dashboard" className="flex items-center text-gray-500 hover:text-green-700 mb-8 transition-colors">
           <ArrowLeft size={20} className="mr-2" /> Cancel
        </Link>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#E6E4DC]">
          <h1 className="text-3xl font-serif font-bold mb-6">Add New Product</h1>
          
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Image Upload */}
            <div>
               <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Product Image</label>
               <input 
                 type="file" 
                 accept="image/*"
                 onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                 className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
               />
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Product Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-4 bg-[#F9F8F6] border-none rounded-xl text-lg font-serif focus:ring-2 focus:ring-[#2C3E2C]"
                placeholder="e.g. Royal Baobab Juice"
                required 
              />
            </div>

            {/* Category & Price */}
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
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Price (D)</label>
                  <input 
                    type="number" 
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full p-4 bg-[#F9F8F6] border-none rounded-xl text-lg font-bold text-green-700 focus:ring-2 focus:ring-[#2C3E2C]"
                    placeholder="0.00"
                    required 
                  />
               </div>
            </div>

            {/* 🤖 THE AI SECTION */}
            <div>
              <div className="flex justify-between items-center mb-2">
                 <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">Description</label>
                 <button 
                   type="button" 
                   onClick={generateMagicDescription}
                   disabled={generating || !name}
                   className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white px-3 py-1 rounded-full shadow-md hover:scale-105 transition-transform"
                 >
                    {generating ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12} />}
                    {generating ? 'Writing...' : 'AI Magic Write'}
                 </button>
              </div>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full p-4 bg-[#F9F8F6] border-none rounded-xl text-gray-600 focus:ring-2 focus:ring-[#2C3E2C]"
                placeholder="Describe your product..."
              />
            </div>

            {/* Save Button */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#2C3E2C] hover:bg-black text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              {loading ? 'Publish Product' : 'Publish Product'}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}