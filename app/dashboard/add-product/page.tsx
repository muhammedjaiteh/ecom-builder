'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowLeft, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function AddProduct() {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false); // State for AI loading
  const router = useRouter();
  const supabase = createClientComponentClient();

  // 🪄 The AI Magic Function
  const handleGenerateAI = async () => {
    if (!name) return alert('Please enter a product name first!');
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
        alert('AI Error: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Failed to connect to AI.');
    }
    setGenerating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Save to Supabase
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
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-gray-500" />
          </Link>
          <h1 className="text-2xl font-black text-gray-900">Add New Product</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Product Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Product Name</label>
            <input 
              type="text" 
              required
              placeholder="e.g. Handmade Leather Sandals"
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Price (Dalasi)</label>
            <input 
              type="number" 
              required
              placeholder="e.g. 1500"
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          {/* AI Description Section */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold text-gray-700">Description</label>
              
              {/* THE MAGIC BUTTON */}
              <button 
                type="button"
                onClick={handleGenerateAI}
                disabled={generating}
                className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1 rounded-full font-bold flex items-center gap-1 transition-all"
              >
                {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {generating ? 'Writing...' : 'Generate with AI'}
              </button>
            </div>
            
            <textarea 
              rows={4}
              placeholder="Enter details or use AI to generate..."
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <button 
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-200 flex items-center justify-center gap-2 transition-all"
          >
            {loading ? 'Saving...' : <>Save Product <Save size={20} /></>}
          </button>
        </form>

      </div>
    </div>
  );
}