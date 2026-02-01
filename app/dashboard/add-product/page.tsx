'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowLeft, Save, Loader2, UploadCloud } from 'lucide-react';
import Link from 'next/link';

export default function AddProduct() {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  // 🪄 The AI Magic Function
  const handleGenerateAI = async () => {
    if (!name) return alert('Please enter a Product Name first (so the AI knows what to write about)!');
    
    setGenerating(true);
    try {
      const res = await fetch('/api/generate-description', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      
      const data = await res.json();
      
      if (data.description) {
        setDescription(data.description);
      } else {
        console.error("AI Error:", data);
        alert('AI Error: ' + (data.error || 'Could not generate. Check console.'));
      }
    } catch (e) {
      console.error("Connection Error:", e);
      alert('Failed to connect to the AI brain.');
    }
    setGenerating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from('products').insert({
      name,
      price: parseFloat(price),
      description,
      status: 'active'
    });

    if (error) {
      alert(error.message);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex justify-center items-start">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* Header Section */}
        <div className="bg-green-900 p-8 text-white">
          <Link href="/dashboard" className="inline-flex items-center text-green-200 hover:text-white mb-4 transition-colors">
            <ArrowLeft size={20} className="mr-2" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-black tracking-tight">Add New Product</h1>
          <p className="text-green-200 opacity-80">Fill in the details below to list your item.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          
          {/* Product Name */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">Product Name</label>
            <input 
              type="text" 
              required
              placeholder="e.g. Traditional Wonjo Juice"
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-100 focus:border-green-500 outline-none transition-all font-medium"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">Price (Dalasi)</label>
            <div className="relative">
              <span className="absolute left-4 top-4 text-gray-400 font-bold">D</span>
              <input 
                type="number" 
                required
                placeholder="150"
                className="w-full p-4 pl-10 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-100 focus:border-green-500 outline-none transition-all font-medium"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>

          {/* AI Section - The "CTO Design" Upgrade 🟣 */}
          <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100">
            <div className="flex justify-between items-center mb-4">
              <label className="block text-sm font-bold text-purple-900">Description</label>
              <span className="text-xs font-bold bg-purple-200 text-purple-800 px-2 py-1 rounded-full uppercase tracking-wider">AI Powered</span>
            </div>
            
            <textarea 
              rows={5}
              placeholder="Type a description manually, or click the magic button below..."
              className="w-full p-4 bg-white border border-purple-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 outline-none transition-all text-gray-600 mb-4"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            {/* THE NEW HIGH-VISIBILITY BUTTON */}
            <button 
              type="button"
              onClick={handleGenerateAI}
              disabled={generating}
              className="w-full group relative overflow-hidden bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-200 hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 size={24} className="animate-spin" />
                  <span>Connecting to Brain...</span>
                </>
              ) : (
                <>
                  <Sparkles size={24} className="group-hover:animate-pulse text-yellow-300" />
                  <span className="text-lg">Auto-Write Description</span>
                </>
              )}
            </button>
            <p className="text-center text-xs text-purple-400 mt-2">Powered by OpenAI & Gambia Store Intelligence</p>
          </div>

          {/* Product Image Placeholder (For future Vision AI) */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">Product Image</label>
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center text-gray-400 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
              <UploadCloud size={40} className="mb-2" />
              <span className="text-sm font-medium">Click to upload image</span>
            </div>
          </div>

          {/* Save Button */}
          <button 
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white text-xl font-bold py-5 rounded-2xl shadow-xl shadow-green-200 hover:shadow-2xl transition-all flex items-center justify-center gap-3"
          >
            {loading ? 'Saving to Database...' : <>Save Product <Save size={24} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}